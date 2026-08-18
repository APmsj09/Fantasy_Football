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
        // from throwing a TypeError on unrecognized positions.
        let safeAvailablePlayers = State.availablePlayers.filter(p => State.settings.roster[p.Pos]);
        State.evaluateRosterFits(team, safeAvailablePlayers);

        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const totalRounds = State.settings.roster.totalSize;
        const currentOverallPick = State.currentPick + 1;
        const profile = team.profile;

        let cpuSorted = [...safeAvailablePlayers].sort((a, b) => (b.AdvVBD ?? b.VBD ?? 0) - (a.AdvVBD ?? a.VBD ?? 0));

        // 1. CALCULATE POSITIONAL SCARCITY (Tier Drop-offs)
        let scarcity = {};
        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
            let tiers = State.getPositionalTiers(pos);
            // If the current top tier is almost empty (3 or fewer players), calculate the VBD drop to the next tier
            if (tiers.length > 1 && tiers[0].length <= 3) {
                let lastInTopTier = tiers[0][tiers[0].length - 1];
                let firstInNextTier = tiers[1][0];
                let drop = (lastInTopTier.AdvVBD ?? lastInTopTier.VBD ?? 0) - (firstInNextTier.AdvVBD ?? firstInNextTier.VBD ?? 0);
                
                // Urgency multiplier: The fewer players left in the tier, the higher the panic/scarcity bonus
                let urgencyMult = tiers[0].length === 1 ? 1.0 : (tiers[0].length === 2 ? 0.7 : 0.4);
                scarcity[pos] = Math.max(0, drop) * urgencyMult;
            } else {
                scarcity[pos] = 0; // Plenty of options in the current tier, no scarcity panic
            }
        });

        let topWRs = cpuSorted.filter(p => p.Pos === 'WR').slice(0, 3);
        let topRBs = cpuSorted.filter(p => p.Pos === 'RB').slice(0, 3);
        let avgTopFlexVBD = 0, flexBenchCount = 0;
        [...topWRs, ...topRBs].forEach(p => { avgTopFlexVBD += (p.AdvVBD ?? p.VBD ?? 0); flexBenchCount++; });
        avgTopFlexVBD = flexBenchCount > 0 ? (avgTopFlexVBD / flexBenchCount) : 20;

        // 2. FILTER OUT PLAYERS THAT DO NOT FIT ON THE ROSTER
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

            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 0;
            let currentCount = team.counts[p.Pos] || 0;
            let isStarterOpen = currentCount < starterMax;

            if (p.avgStars) {
                multiplier *= (1 + (p.avgStars - 3.0) * 0.04);
            }

            let hasSameBye = team.roster.some(r => r.Pos === p.Pos && r.byeWeek === p.byeWeek && p.byeWeek !== 'N/A');
            if (hasSameBye && !isStarterOpen) {
                multiplier *= 0.25;
            }

            // Manager Personality Strategy Multipliers
            // Manager Personality Strategy Multipliers (Matches Draft History Profiles)
            if (profile) {
                if (round <= 6) {
                    if (profile.strategy === 'Hero-RB') {
                        // Secure exactly 1 RB early, then aggressively target WRs
                        if (team.counts['RB'] >= 1 && p.Pos === 'WR' && round <= 5) multiplier *= 1.45;
                        if (team.counts['RB'] >= 1 && p.Pos === 'RB' && round <= 5) multiplier *= 0.35;
                    }
                    else if (profile.strategy === 'Zero-RB' && round <= 5) {
                        // Completely avoid RBs in the early rounds; hammer WR/TE
                        if (['WR', 'TE'].includes(p.Pos)) multiplier *= 1.40;
                        if (p.Pos === 'RB') multiplier *= 0.15; 
                    }
                    else if (profile.strategy === 'Robust-RB') {
                        // Aggressively target RBs early
                        if (p.Pos === 'RB' && round <= 4) multiplier *= 1.45;
                        if (['WR', 'TE'].includes(p.Pos) && round <= 4 && team.counts['RB'] >= 3) multiplier *= 1.30;
                    }
                    else if (profile.strategy === 'Double-Elite' && round <= 5) {
                        // Reach for elite QB and TE advantages
                        if (p.Pos === 'QB' && team.counts['QB'] === 0) multiplier *= 1.50;
                        if (p.Pos === 'TE' && team.counts['TE'] === 0) multiplier *= 1.50;
                    }
                }

                // Mid-Round Tendencies
                if (round >= 7 && round <= 11 && profile.likesHandcuffs && p.Pos === 'RB') {
                    multiplier *= 1.35; // Handcuff hoarders will reach heavily for RBs here
                }

                p._cpuReachBonus = 0;
                if (round >= 8 && round <= 14 && isStarterOpen) {
                    // Scales reach panic: Reaches harder if the position is drying up, or if they are past their historical average round
                    if (p.Pos === 'PK' && profile.reachesForKicker) {
                        let pkRoundDiff = round - (Math.floor(profile.pkAvgRound) - 1);
                        if (pkRoundDiff >= 0) p._cpuReachBonus = 25.0 + (pkRoundDiff * 12.0); // Continually increases each round
                    }
                    if (p.Pos === 'DST' && profile.reachesForDST) {
                        let dstRoundDiff = round - (Math.floor(profile.dstAvgRound) - 1);
                        if (dstRoundDiff >= 0) p._cpuReachBonus = 25.0 + (dstRoundDiff * 12.0);
                    }
                }

                // Correlated Stacking
                let draftedQBs = team.roster.filter(r => r.Pos === 'QB');
                if (draftedQBs.length > 0 && ['WR', 'TE'].includes(p.Pos) && draftedQBs.some(qb => qb._cleanTeam === p._cleanTeam)) {
                    multiplier *= 1.25;
                }
            }

            let isFlexRBWROpen = ['RB', 'WR'].includes(p.Pos) && (team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0));
            let isFlexOpen = ['RB', 'WR', 'TE'].includes(p.Pos) && (team.counts['Flex'] < (State.settings.roster.Flex?.max || 0));
            let isSuperflexOpen = ['QB', 'RB', 'WR', 'TE'].includes(p.Pos) && (team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0));

            let starterBonus = 0;
            if (isStarterOpen) {
                starterBonus = 25;
            } else if (isFlexRBWROpen || isFlexOpen || isSuperflexOpen) {
                starterBonus = 15;
            } else {
                let totalPosCount = team.roster.filter(r => r.Pos === p.Pos).length;
                let overage = Math.max(0, totalPosCount - starterMax);
                
                // Evaluate the strength of the player(s) already drafted at this position by the CPU
                let draftedAtPos = team.roster.filter(r => r.Pos === p.Pos);
                let bestStarterRank = draftedAtPos.length > 0 ? Math.min(...draftedAtPos.map(r => parseInt(r.posRank?.replace(/\D/g, '') || 99))) : 99;

                if (['RB', 'WR'].includes(p.Pos)) {
                    multiplier *= Math.pow(0.65, overage + 1); // CPUs are slightly more conservative than humans
                } else if (p.Pos === 'TE') {
                    if (overage === 0) {
                        if (bestStarterRank <= 5) multiplier *= 0.05;
                        else if (bestStarterRank <= 10) multiplier *= 0.25;
                        else multiplier *= 0.60;
                    } else {
                        multiplier *= 0.05;
                    }
                } else if (p.Pos === 'QB') {
                    if ((State.settings.roster.Superflex?.max || 0) > 0) {
                        multiplier *= Math.pow(0.60, overage + 1);
                    } else {
                        if (overage === 0) {
                            if (bestStarterRank <= 6) multiplier *= 0.05;
                            else if (bestStarterRank <= 12) multiplier *= 0.15;
                            else multiplier *= 0.45;
                        } else {
                            multiplier *= 0.05;
                        }
                    }
                } else {
                    // PK and DST overage penalties (Ensures CPUs don't hoard kickers/defenses)
                    multiplier *= (overage === 0 ? 0.15 : 0.05); 
                }
            }

            let posRank = cpuSorted.filter(x => x.Pos === p.Pos).findIndex(x => x._cleanName === p._cleanName);
            let scarcityBonus = 0;
            if (posRank < 3 && scarcity[p.Pos]) {
                if (currentCount < starterMax || p.Pos !== 'TE' || ((p.AdvVBD ?? p.VBD ?? 0) - avgTopFlexVBD > 5)) {
                    scarcityBonus = scarcity[p.Pos];
                }
            }

            // Suppress PK and DST until late rounds unless manager profile historically reaches
            const canDraftPK = profile && profile.reachesForKicker && round >= Math.floor(profile.pkAvgRound);
            const canDraftDST = profile && profile.reachesForDST && round >= Math.floor(profile.dstAvgRound);
            
            if (p.Pos === 'PK' && round <= totalRounds - 2 && !canDraftPK) {
                multiplier *= 0.001; // Kickers streamed easily; delay until end
            }
            if (p.Pos === 'DST' && !canDraftDST) {
                if (posRank < 6 && round >= 10) {
                    multiplier *= 0.8; // Top 5-6 DSTs hold enough value to grab in double-digit rounds
                } else if (round <= totalRounds - 2) {
                    multiplier *= 0.001; // Wait to stream DSTs outside the elite tier
                }
            }

            let rawVbd = p.AdvVBD ?? p.VBD ?? 0;
            let userOwnsStarter = p.starterName && team.roster.some(r => r._cleanName === State.normalizeName(p.starterName));

            // --- CPU Late-Round Upside, Handcuffs, & Sleeper Shift ---
            if (round >= 7) {
                let upsideWeight = Math.min(0.65, (round - 6) * 0.10);
                let floorWeight = 1.0 - upsideWeight;
                let ceilingScore = p.upsideScore || rawVbd;
                rawVbd = (rawVbd * floorWeight) + (ceilingScore * upsideWeight);

                if (['RB', 'WR', 'TE', 'QB'].includes(p.Pos)) {
                    let roundScale = Math.min(1.0, (round - 6) * 0.20);

                    // Draft Handcuffs and sleeper breakouts with realistic market-scaled value
                    if (userOwnsStarter && p.Pos === 'RB') rawVbd += (14.0 * roundScale);
                    else if (p.isRBHandcuff) rawVbd += (8.5 * roundScale);
                    else if (p.depthChart === 2 && p.isNewRole) rawVbd += (7.5 * roundScale);
                    else if (p.age && p.age <= 23) rawVbd += (6.5 * roundScale);
                    else if (p.targetShare && p.targetShare >= 15) rawVbd += (6.0 * roundScale);
                    else if (p.aDOT && p.aDOT >= 12.0) rawVbd += (5.5 * roundScale);
                    else if (p.brokenTackles && p.brokenTackles > 15) rawVbd += (5.0 * roundScale);
                    else if (p.hvo && p.hvo >= 40) rawVbd += (5.5 * roundScale);
                }
            }

            let baseValue = rawVbd >= 0 
                ? (rawVbd * multiplier) 
                : (multiplier >= 1 ? rawVbd / multiplier : rawVbd * (1 / multiplier));

            let adpPenalty = 0;
            let adpBonus = 0;
            let isFanTarget = profile && profile.teamBias && profile.teamBias !== 'None' && profile.teamBias === State.normalizeTeam(p.Team);

            if (p.adp) {
                let adpDiff = p.adp - currentOverallPick;
                
                if (adpDiff > 12) {
                    adpPenalty = Math.min(18.0, (adpDiff - 10) * 0.65);
                    
                    // ⚡ CPU Personality Override: Managers will ignore ADP reach penalties for "their guys"
                    if (isFanTarget) {
                        adpPenalty = 0; // The "Homer" pick: Completely ignores the ADP reach cap
                    } else if (p.Pos === 'RB' && profile?.strategy === 'Robust-RB' && round <= 5) {
                        adpPenalty *= 0.25; // Robust-RB managers will happily reach for early RBs
                    } else if (['WR', 'TE'].includes(p.Pos) && profile?.strategy === 'Zero-RB' && round <= 5) {
                        adpPenalty *= 0.25; // Zero-RB managers will happily reach for early WRs/TEs
                    } else if (p.Pos === 'RB' && p.isRBHandcuff && profile?.likesHandcuffs && round >= 7) {
                        adpPenalty = 0; // Handcuff hoarders will reach heavily for lotto tickets
                    }
                } else if (adpDiff < -12) {
                    adpBonus = Math.min(10, Math.abs(adpDiff + 12) * 0.3); // Catch sliding value
                }
            }

            // Fan bonus scales with the raw baseline of the player (so they don't overdraft a horrible depth player just because of team bias)
            let fanBonus = isFanTarget ? Math.max(5.0, (p.AdvVBD || p.VBD) * 0.15) : 0;

            return {
                player: p,
                adjustedVBD: baseValue + starterBonus + scarcityBonus + adpBonus - adpPenalty + (p._cpuReachBonus || 0) + fanBonus
            };
        });

        evaluatedWrapper.sort((a, b) => b.adjustedVBD - a.adjustedVBD);

        let selectedPlayer = null;
        let slottedPos = null;

        for (let item of evaluatedWrapper) {
            let p = item.player;
            let pos = p.Pos;

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

        if (selectedPlayer) {
            this.executeDraft(selectedPlayer, team, slottedPos);
        } else {
            let fallback = cpuSorted[0];
            if (fallback) {
                this.executeDraft(fallback, team, 'Bench');
            } else {
                State.currentPick++;
            }
        }
    },

    executeDraft(player, team, slot) {
        const idx = State.availablePlayers.findIndex(p => p._cleanName === player._cleanName && p.Pos === player.Pos && p.Team === player.Team);
        if (idx !== -1) State.availablePlayers.splice(idx, 1);

        player.draftPickNum = State.currentPick + 1;

        team.roster.push({ ...player, slottedPos: slot });
        team.counts[slot]++;
        State.draftHistory.push({ pickIndex: State.currentPick, player: player, teamId: team.id, slot: slot });
        State.currentPick++;
    }
};

const AutoDraft = window.AutoDraft;
