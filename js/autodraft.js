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
            if (!State.draftStarted || State.currentPick >= State.draftOrder.length || State.draftOrder[State.currentPick] !== teamId) {
                this.isDrafting = false;
                return;
            }
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

        let topWRs = State.availablePlayers.filter(p => p.Pos === 'WR').slice(0, 3);
        let topRBs = State.availablePlayers.filter(p => p.Pos === 'RB').slice(0, 3);
        let avgTopFlexVBD = 0, flexBenchCount = 0;
        [...topWRs, ...topRBs].forEach(p => { avgTopFlexVBD += (p.AdvVBD || p.VBD); flexBenchCount++; });
        avgTopFlexVBD = flexBenchCount > 0 ? (avgTopFlexVBD / flexBenchCount) : 20;

        let evaluatedWrapper = State.availablePlayers.slice(0, 150).map(p => {
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

            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 0;
            let currentCount = team.counts[p.Pos] || 0;

            let isStarterOpen = currentCount < starterMax;
            let isFlexOpen = State.isPositionFlexEligible(p.Pos) && (team.counts['Flex'] < State.settings.roster.Flex.max);

            let starterBonus = 0;
            if (isStarterOpen) {
                starterBonus = 25; // Direct starter slot open
            } else if (isFlexOpen) {
                starterBonus = 15; // Flex slot open
            } else {
                let overage = currentCount - starterMax;
                if (State.isPositionFlexEligible(p.Pos)) {
                    multiplier *= Math.pow(0.5, overage + 1); // Soft multiplier for flex depth
                } else {
                    multiplier *= (overage === 0 ? 0.05 : 0.01); // Severe multiplier for non-flex positions
                }
            }

            // Scarcity Bonus
            let posRank = State.availablePlayers.filter(x => x.Pos === p.Pos).findIndex(x => x._cleanName === p._cleanName);
            let scarcityBonus = 0;
            if (posRank < 3 && scarcity[p.Pos]) {
                if (currentCount < starterMax || p.Pos !== 'TE' || ((p.AdvVBD || p.VBD) - avgTopFlexVBD > 5)) {
                    scarcityBonus = scarcity[p.Pos];
                }
            }

            // Kickers strictly in bottom 3 rounds
            if (p.Pos === 'PK' && round <= totalRounds - 3) multiplier *= 0.001;

            let rawVbd = p.AdvVBD || p.VBD;
            let baseValue = rawVbd >= 0 ? (rawVbd * multiplier) : (rawVbd / multiplier);
            let ppwValue = (p._addedPPW || 0) * 15;

            let adpPenalty = 0;
            if (p.adp) {
                let adpDiff = p.adp - currentOverallPick;
                if (adpDiff > 18) adpPenalty = Math.min(5, (adpDiff - 18) * 0.15); // Softened threshold
            }

            return {
                player: p,
                adjustedVBD: (baseValue + ppwValue + starterBonus + scarcityBonus) - adpPenalty
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
        const idx = State.availablePlayers.findIndex(p => p._cleanName === player._cleanName && p.Pos === player.Pos && p.Team === player.Team);
        if (idx !== -1) State.availablePlayers.splice(idx, 1);

        // Record the overall pick number on the player object for strategy detection
        player.draftPickNum = State.currentPick + 1;

        team.roster.push({ ...player, slottedPos: slot });
        team.counts[slot]++;
        State.draftHistory.push({ pickIndex: State.currentPick, player: player, teamId: team.id, slot: slot });
        State.currentPick++;
    }
};

const AutoDraft = window.AutoDraft;