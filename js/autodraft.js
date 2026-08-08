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

        // 1. CALCULATE POSITIONAL SCARCITY (Tier Drop-offs)
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

        // 2. FILTER OUT PLAYERS THAT DO NOT FIT ON THE ROSTER (Prevents infinite loops)
        let validPlayers = State.availablePlayers.filter(p => {
            let pos = p.Pos;
            let posRoster = State.settings.roster[pos];
            let maxForPos = posRoster ? posRoster.max : 0;
            
            if ((team.counts[pos] || 0) < maxForPos) return true;
            if (['RB', 'WR'].includes(pos) && team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) return true;
            if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) return true;
            if (['QB', 'RB', 'WR', 'TE'].includes(pos) && team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) return true;
            if (team.counts['Bench'] < State.settings.roster.Bench.max) return true;
            
            return false;
        });

        // Ensure the CPU evaluates the best players, even if the user manually sorted the UI table
        validPlayers.sort((a, b) => (b.AdvVBD || b.VBD || 0) - (a.AdvVBD || a.VBD || 0));

        // 3. EVALUATE TOP 150 VALID PLAYERS
        let evaluatedWrapper = validPlayers.slice(0, 150).map(p => {
            let multiplier = 1.0;

            if (p.avgStars) {
                multiplier *= (1 + (p.avgStars - 3.0) * 0.04);
            }

            // Manager Personality Strategy Multipliers
            if (profile) {
                if (round <= 4) {
                    if (profile.strategy === 'RB-Heavy' && p.Pos === 'RB') multiplier *= 1.4;
                    if (profile.strategy === 'Zero-RB' && p.Pos === 'WR') multiplier *= 1.4;
                }

                if (p.Pos === 'QB' && profile.draftsEarlyQB && round >= (profile.qbAvgRound - 1) && round <= (profile.qbAvgRound + 1)) multiplier *= 1.8;
                if (p.Pos === 'TE' && profile.draftsEarlyTE && round >= (profile.teAvgRound - 1) && round <= (profile.teAvgRound + 1)) multiplier *= 1.8;

                if (profile.teamBias !== 'None' && p._cleanTeam === profile.teamBias) {
                    multiplier *= 1.15;
                }
            }

            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 0;
            let currentCount = team.counts[p.Pos] || 0;

            let isStarterOpen = currentCount < starterMax;
            let isFlexRBWROpen = ['RB', 'WR'].includes(p.Pos) && (team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0));
            let isFlexOpen = ['RB', 'WR', 'TE'].includes(p.Pos) && (team.counts['Flex'] < (State.settings.roster.Flex?.max || 0));
            let isSuperflexOpen = ['QB', 'RB', 'WR', 'TE'].includes(p.Pos) && (team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0));

            let starterBonus = 0;
            if (isStarterOpen) {
                starterBonus = 25;
            } else if (isFlexRBWROpen || isFlexOpen || isSuperflexOpen) {
                starterBonus = 15;
            } else {
                let overage = currentCount - starterMax;
                if (isFlexRBWROpen || isFlexOpen || isSuperflexOpen || State.isPositionFlexEligible(p.Pos)) {
                    multiplier *= Math.pow(0.5, overage + 1);
                } else {
                    multiplier *= (overage === 0 ? 0.05 : 0.01);
                }
            }

            let posRank = State.availablePlayers.filter(x => x.Pos === p.Pos).findIndex(x => x._cleanName === p._cleanName);
            let scarcityBonus = 0;
            if (posRank < 3 && scarcity[p.Pos]) {
                if (currentCount < starterMax || p.Pos !== 'TE' || ((p.AdvVBD || p.VBD) - avgTopFlexVBD > 5)) {
                    scarcityBonus = scarcity[p.Pos];
                }
            }

            if (p.Pos === 'PK' && round <= totalRounds - 3) multiplier *= 0.001;

            let rawVbd = p.AdvVBD || p.VBD;
            let baseValue = rawVbd >= 0 ? (rawVbd * multiplier) : (rawVbd / multiplier);

            let adpPenalty = 0;
            if (p.adp) {
                let adpDiff = p.adp - currentOverallPick;
                if (adpDiff > 18) adpPenalty = Math.min(15, (adpDiff - 18) * 0.25);
            }

            return {
                player: p,
                adjustedVBD: baseValue + starterBonus + scarcityBonus - adpPenalty
            };
        });

        evaluatedWrapper.sort((a, b) => b.adjustedVBD - a.adjustedVBD);

        let selectedPlayer = null;
        let slottedPos = null;

        for (let item of evaluatedWrapper) {
            let p = item.player;
            let pos = p.Pos;
            
            // Safely read the max positional limit
            let posRoster = State.settings.roster[pos];
            let maxForPos = posRoster ? posRoster.max : 0;

            if ((team.counts[pos] || 0) < maxForPos) slottedPos = pos;
            else if (['RB', 'WR'].includes(pos) && team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) slottedPos = 'FlexRBWR';
            else if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) slottedPos = 'Flex';
            else if (['QB', 'RB', 'WR', 'TE'].includes(pos) && team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) slottedPos = 'Superflex';
            else if (team.counts['Bench'] < State.settings.roster.Bench.max) slottedPos = 'Bench';

            if (slottedPos) {
                selectedPlayer = p;
                break;
            }
        }

        // Failsafe execution: If a player is found, draft them. If not, pick a fallback so the app never freezes.
        if (selectedPlayer) {
            this.executeDraft(selectedPlayer, team, slottedPos);
        } else {
            let fallback = State.availablePlayers[0];
            if (fallback) {
                this.executeDraft(fallback, team, 'Bench');
            } else {
                State.currentPick++; // Give up and move onto the next pick
            }
        }
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