// Make AutoDraft globally available
window.AutoDraft = {
    isDrafting: false,

    async processQueue() {
        if (!State.draftStarted || State.currentPick >= State.draftOrder.length || this.isDrafting) return;
        if (State.settings.draftMode === 'live') return;

        const teamId = State.draftOrder[State.currentPick];
        const team = State.teamsById[teamId];

        if (team && team.isCPU) {
            this.isDrafting = true;
            await new Promise(r => setTimeout(r, 400)); // Thinking time delay
            this.makeCPUPick(team);
            this.isDrafting = false;

            UI.updateDraftBoard();
            this.processQueue();
        }
    },

    makeCPUPick(team) {
        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const profile = team.profile;

        let evaluatedPlayers = State.availablePlayers.map(p => ({ ...p, adjustedVBD: (p.AdvVBD || p.VBD) }));

        evaluatedPlayers.forEach(p => {
            let multiplier = 1.0;

            // Factor Schedule Strength into CPU Pick Choice
            if (p.avgStars) {
                multiplier *= (1 + (p.avgStars - 3.0) * 0.04);
            }

            // Apply profile strategies
            if (profile) {
                if (round <= 4) {
                    if (profile.strategy === 'RB-Heavy' && p.Pos === 'RB') multiplier *= 1.4;
                    if (profile.strategy === 'Zero-RB' && p.Pos === 'WR') multiplier *= 1.4;
                }
                if (p.Pos === 'QB' && profile.draftsEarlyQB && round >= (profile.qbAvgRound - 1) && round <= (profile.qbAvgRound + 1)) {
                    multiplier *= 1.8;
                }
                if (p.Pos === 'TE' && profile.draftsEarlyTE && round >= (profile.teAvgRound - 1) && round <= (profile.teAvgRound + 1)) {
                    multiplier *= 1.8;
                }
            }

            if (team.counts[p.Pos] > 0 && ['QB', 'TE', 'PK', 'DST'].includes(p.Pos)) {
                multiplier *= 0.1;
            }

            p.adjustedVBD = (p.AdvVBD || p.VBD) * multiplier;
        });

        evaluatedPlayers.sort((a, b) => b.adjustedVBD - a.adjustedVBD);

        let selectedPlayer = null;
        let slottedPos = null;

        for (let player of evaluatedPlayers) {
            let pos = player.Pos;
            if (team.counts[pos] < State.settings.roster[pos].max) slottedPos = pos;
            else if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < State.settings.roster.Flex.max) slottedPos = 'Flex';
            else if (team.counts['Bench'] < State.settings.roster.Bench.max) slottedPos = 'Bench';

            if (slottedPos) {
                selectedPlayer = State.availablePlayers.find(p => p.Player === player.Player);
                break;
            }
        }

        if (selectedPlayer) this.executeDraft(selectedPlayer, team, slottedPos);
    },

    executeDraft(player, team, slot) {
        State.availablePlayers = State.availablePlayers.filter(p => p.Player !== player.Player);
        team.roster.push({ ...player, slottedPos: slot });
        team.counts[slot]++;
        State.draftHistory.push({ pickIndex: State.currentPick, player: player, teamId: team.id, slot: slot });
        State.currentPick++;
    }
};

// Global reference
const AutoDraft = window.AutoDraft;