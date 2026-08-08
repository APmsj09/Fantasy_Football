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
        // Filter out players with invalid positions to prevent evaluateRosterFits 
        // from throwing a TypeError on unrecognized positions (e.g. Defensive Linemen).
        let safeAvailablePlayers = State.availablePlayers.filter(p => State.settings.roster[p.Pos]);
        State.evaluateRosterFits(team, safeAvailablePlayers);

        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const totalRounds = State.settings.roster.totalSize;
        const currentOverallPick = State.currentPick + 1;
        const profile = team.profile;

        // Create a protected, explicitly sorted array for the CPU.
        // Relying on State.availablePlayers directly is dangerous if the user sorted the table via the UI.
        let cpuSorted = [...safeAvailablePlayers].sort((a, b) => (b.AdvVBD ?? b.VBD ?? 0) - (a.AdvVBD ?? a.VBD ?? 0));

        // 1. CALCULATE POSITIONAL SCARCITY (Tier Drop-offs)
        let scarcity = {};
        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
            let avail = cpuSorted.filter(p => p.Pos === pos);
            if (avail.length > 5) {
                // Use Nullish Coalescing (??) so a true VBD of `0` isn't skipped as falsy.
                let top = avail[0].AdvVBD ?? avail[0].VBD ?? 0;
                let fifth = avail[4].AdvVBD ?? avail[4].VBD ?? 0;
                scarcity[pos] = Math.max(0, top - fifth) * 0.5;
            } else {
                scarcity[pos] = 0;
            }
        });

        let topWRs = cpuSorted.filter(p => p.Pos === 'WR').slice(0, 3);
        let topRBs = cpuSorted.filter(p => p.Pos === 'RB').slice(0, 3);
        let avgTopFlexVBD = 0, flexBenchCount = 0;
        [...topWRs, ...topRBs].forEach(p => { avgTopFlexVBD += (p.AdvVBD ?? p.VBD ?? 0); flexBenchCount++; });
        avgTopFlexVBD = flexBenchCount > 0 ? (avgTopFlexVBD / flexBenchCount) : 20;

        // 2. FILTER OUT PLAYERS THAT DO NOT FIT ON THE ROSTER (Prevents infinite loops)
        let validPlayers = cpuSorted.filter(p => {
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

        // 3. EVALUATE TOP 150 VALID PLAYERS
        let evaluatedWrapper = validPlayers.slice(0, 150).map(p => {
            let multiplier = 1.0;

            if (p.avgStars) {
                multiplier *= (1 + (p.avgStars - 3.0) * 0.04);
            }

            // Manager Personality Strategy Multipliers
            if (profile) {
                // 1. Early-Round Strategy Multipliers (Rounds 1-5)
                if (round <= 5) {
                    if (profile.strategy === 'Hero-RB') {
                        // Boost WRs heavily if they already drafted their 1 Hero RB
                        if (team.counts['RB'] >= 1 && p.Pos === 'WR') multiplier *= 1.35;
                        // Prevent taking a 2nd RB early
                        if (team.counts['RB'] >= 1 && p.Pos === 'RB') multiplier *= 0.60;
                    }
                    else if (profile.strategy === 'Zero-RB' && round <= 5) {
                        if (p.Pos === 'WR') multiplier *= 1.40;
                        if (p.Pos === 'RB') multiplier *= 0.30; // Strictly avoid early RBs
                    }
                    else if (profile.strategy === 'Robust-RB' && round <= 3) {
                        if (p.Pos === 'RB') multiplier *= 1.35;
                    }
                }

                // 2. Mid-Round Handcuff / RB Collector Tendency (Rounds 7-11)
                if (round >= 7 && round <= 11 && profile.likesHandcuffs) {
                    if (p.Pos === 'RB') multiplier *= 1.25;
                }

                // 3. Early Kicker / DST Reacher (Rounds 10-12)
                if (round >= 10 && round <= 12) {
                    if (p.Pos === 'PK' && profile.reachesForKicker) multiplier *= 1000.0; // Fully cancels the round <= 13 penalty (0.001)
                    if (p.Pos === 'DST' && profile.reachesForDST) multiplier *= 1000.0;
                }

                // 4. Stacking Synergy Boost (Rounds 4-10)
                // If CPU already drafted a QB, boost receivers on the SAME NFL team
                let draftedQBs = team.roster.filter(r => r.Pos === 'QB');
                if (draftedQBs.length > 0 && ['WR', 'TE'].includes(p.Pos)) {
                    let matchesQB = draftedQBs.some(qb => qb._cleanTeam === p._cleanTeam);
                    if (matchesQB) multiplier *= 1.20; // 20% stack boost
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

            let posRank = cpuSorted.filter(x => x.Pos === p.Pos).findIndex(x => x._cleanName === p._cleanName);
            let scarcityBonus = 0;
            if (posRank < 3 && scarcity[p.Pos]) {
                if (currentCount < starterMax || p.Pos !== 'TE' || ((p.AdvVBD ?? p.VBD ?? 0) - avgTopFlexVBD > 5)) {
                    scarcityBonus = scarcity[p.Pos];
                }
            }

            if (p.Pos === 'PK' && round <= totalRounds - 3) multiplier *= 0.001;

            let rawVbd = p.AdvVBD ?? p.VBD ?? 0;
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
            let fallback = cpuSorted[0];
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