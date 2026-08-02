window.AutoDraft = {
    isDrafting: false,

    async processQueue() {
        if (!State.draftStarted || State.currentPick >= State.draftOrder.length || this.isDrafting) return;
        if (State.settings.draftMode === 'live') return;

        const teamId = State.draftOrder[State.currentPick];
        const team = State.teamsById[teamId];

        if (team && team.isCPU) {
            this.isDrafting = true;
            await new Promise(r => setTimeout(r, 400)); 
            this.makeCPUPick(team);
            this.isDrafting = false;

            UI.updateDraftBoard();
            this.processQueue();
        }
    },

    makeCPUPick(team) {
        State.evaluateRosterFits(team, State.availablePlayers);

        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const totalRounds = State.settings.roster.totalSize;
        const currentOverallPick = State.currentPick + 1;
        const profile = team.profile;

        // CALCULATE POSITIONAL SCARCITY (Tier Drop-offs)
        let scarcity = {};
        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
            let avail = State.availablePlayers.filter(p => p.Pos === pos);
            if (avail.length > 5) {
                let top = avail[0].AdvVBD || avail[0].VBD;
                let fifth = avail[4].AdvVBD || avail[4].VBD;
                scarcity[pos] = Math.max(0, top - fifth) * 0.5;
            } else {
                scarcity[pos] = 0;
            }
        });

        let evaluatedWrapper = State.availablePlayers.map(p => {
            let multiplier = 1.0;

            if (p.avgStars) {
                multiplier *= (1 + (p.avgStars - 3.0) * 0.04);
            }

            if (profile) {
                if (round <= 4) {
                    if (profile.strategy === 'RB-Heavy' && p.Pos === 'RB') multiplier *= 1.4;
                    if (profile.strategy === 'Zero-RB' && p.Pos === 'WR') multiplier *= 1.4;
                }
                if (p.Pos === 'QB' && profile.draftsEarlyQB && round >= (profile.qbAvgRound - 1) && round <= (profile.qbAvgRound + 1)) multiplier *= 1.8;
                if (p.Pos === 'TE' && profile.draftsEarlyTE && round >= (profile.teAvgRound - 1) && round <= (profile.teAvgRound + 1)) multiplier *= 1.8;
            }

            let starterMax = State.settings.roster[p.Pos].max;
            let currentCount = team.counts[p.Pos];
            
            if (currentCount >= starterMax) {
                let overage = currentCount - starterMax; 
                if (['QB', 'TE', 'PK', 'DST'].includes(p.Pos)) {
                    multiplier *= (overage === 0 ? 0.05 : 0.01); 
                } else if (['RB', 'WR'].includes(p.Pos)) {
                    multiplier *= Math.pow(0.5, overage + 1);
                }
            } else {
                if (round >= 6 && currentCount === 0) {
                    multiplier *= 1.5; 
                }
            }

            // KICKERS ONLY in bottom 3 rounds
            if (p.Pos === 'PK' && round <= totalRounds - 3) multiplier *= 0.001;

            let baseValue = (p.AdvVBD || p.VBD) * multiplier;
            let ppwValue = (p._addedPPW || 0) * 15;

            // SCARCITY BONUS (Apply if player is top 3 remaining at position)
            let posRank = State.availablePlayers.filter(x => x.Pos === p.Pos).findIndex(x => x._cleanName === p._cleanName);
            let scarcityBonus = (posRank < 3 && scarcity[p.Pos]) ? scarcity[p.Pos] : 0;

            // ADP PENALTY (Softened)
            let adpPenalty = 0;
            if (p.adp) {
                let adpDiff = p.adp - currentOverallPick;
                if (adpDiff > 12) adpPenalty = (adpDiff * 0.5);
            }

            return {
                player: p,
                adjustedVBD: (baseValue + ppwValue + scarcityBonus) - adpPenalty
            };
        });

        evaluatedWrapper.sort((a, b) => b.adjustedVBD - a.adjustedVBD);

        let selectedPlayer = null;
        let slottedPos = null;

        for (let item of evaluatedWrapper) {
            let p = item.player;
            let pos = p.Pos;
            
            if (team.counts[pos] < State.settings.roster[pos].max) slottedPos = pos;
            else if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < State.settings.roster.Flex.max) slottedPos = 'Flex';
            else if (team.counts['Bench'] < State.settings.roster.Bench.max) slottedPos = 'Bench';

            if (slottedPos) {
                selectedPlayer = p; 
                break;
            }
        }

        if (selectedPlayer) this.executeDraft(selectedPlayer, team, slottedPos);
    },

    executeDraft(player, team, slot) {
        const idx = State.availablePlayers.findIndex(p => p._cleanName === player._cleanName);
        if (idx !== -1) State.availablePlayers.splice(idx, 1);
        
        team.roster.push({ ...player, slottedPos: slot });
        team.counts[slot]++;
        State.draftHistory.push({ pickIndex: State.currentPick, player: player, teamId: team.id, slot: slot });
        State.currentPick++;
    }
};

const AutoDraft = window.AutoDraft;