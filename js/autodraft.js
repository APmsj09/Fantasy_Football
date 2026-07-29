const AutoDraft = {
    isDrafting: false,

    async processQueue() {
        if (!State.draftStarted || State.currentPick >= State.draftOrder.length || this.isDrafting) return;
        if (State.settings.draftMode === 'live') return; 
        
        const teamId = State.draftOrder[State.currentPick];
        const team = State.teamsById[teamId];

        if (team.isCPU) {
            this.isDrafting = true;
            await new Promise(r => setTimeout(r, 600)); // Simulating thinking time
            this.makeCPUPick(team);
            this.isDrafting = false;
            
            UI.updateDraftBoard();
            this.processQueue();
        }
    },

    makeCPUPick(team) {
        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const profile = team.profile; // The historical tendencies

        // Deep copy players so we can manipulate 'Adjusted VBD' without ruining the master list
        let evaluatedPlayers = State.availablePlayers.map(p => ({ ...p, adjustedVBD: (p.AdvVBD || p.VBD) }));

        // --- APPLY AI TENDENCIES based on Profile ---
        if (profile) {
            evaluatedPlayers.forEach(p => {
                let multiplier = 1.0;

                // 1. Core Strategy (Rounds 1-4)
                if (round <= 4) {
                    if (profile.strategy === 'RB-Heavy' && p.Pos === 'RB') multiplier = 1.4;
                    if (profile.strategy === 'Zero-RB' && p.Pos === 'WR') multiplier = 1.4;
                }

                // 2. Early QB / TE reaches
                // If they historically reach, inflate that position's value around their average draft round
                if (p.Pos === 'QB' && profile.draftsEarlyQB && round >= (profile.qbAvgRound - 1) && round <= (profile.qbAvgRound + 1)) {
                    multiplier = 1.8; 
                }
                if (p.Pos === 'TE' && profile.draftsEarlyTE && round >= (profile.teAvgRound - 1) && round <= (profile.teAvgRound + 1)) {
                    multiplier = 1.8;
                }
                
                // 3. Needs-based adjustment (Drafting a 2nd QB drops value drastically)
                if (team.counts[p.Pos] > 0 && ['QB', 'TE', 'PK', 'DST'].includes(p.Pos)) {
                    multiplier = 0.1; // CPU rarely drafts backups for onesies early
                }

                p.adjustedVBD = p.VBD * multiplier;
            });
        }

        // Sort by the new personality-adjusted VBD
        evaluatedPlayers.sort((a, b) => b.adjustedVBD - a.adjustedVBD);

        let selectedPlayer = null;
        let slottedPos = null;

        // Find the best legal player
        for (let player of evaluatedPlayers) {
            let pos = player.Pos;
            if (team.counts[pos] < State.settings.roster[pos].max) slottedPos = pos;
            else if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < State.settings.roster.Flex.max) slottedPos = 'Flex';
            else if (team.counts['Bench'] < State.settings.roster.Bench.max) slottedPos = 'Bench';

            if (slottedPos) {
                // Find the original player object in State to draft
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