window.Compare = {
    getTierDetails(player) {
        const tierNum = player.staticTier || 1;
        const tiers = State.getPositionalTiers(player.Pos);
        const availableInSameTier = State.availablePlayers.filter(p => p.Pos === player.Pos && (p.staticTier || 1) === tierNum);

        const tierNames = {
            1: `Tier 1 (Elite ${player.Pos})`,
            2: `Tier 2 (High-End ${player.Pos} Starter)`,
            3: `Tier 3 (Solid ${player.Pos} Starter)`,
            4: `Tier 4 (Low-End Starter / High Flex)`,
            5: `Tier 5 (Premium Bench / Rotational)`,
            6: `Tier 6 (Upside Flyers & Handcuffs)`,
            7: `Tier 7 (Deep Stash & Depth)`
        };
        let tierName = tierNames[tierNum] || `Tier ${tierNum} (${player.Pos} Depth)`;

        let remaining = availableInSameTier.length;
        let isLastInTier = (remaining === 1 && availableInSameTier[0]._cleanName === player._cleanName);

        return { tierNum, tierName, remaining, isLastInTier };
    },

    showComparison() {
        const recs = State.currentRecommendations;
        if (!recs || recs.length < 2) return;

        const topPick = recs[0];
        const alternatives = recs.slice(1, 6); // Top 5 alternatives
        const userTeam = State.teamsById[State.userTeamId];

        const currentPickNum = State.currentPick + 1;
        
        // Multi-Window Lookahead for the Comparison Modal
        let userFuturePicks = [];
        State.draftOrder.forEach((teamId, idx) => {
            if (idx >= State.currentPick && teamId === State.userTeamId) userFuturePicks.push(idx + 1);
        });

        let nextWindowPicks = [];
        for (let i = 0; i < userFuturePicks.length; i++) {
            let pick = userFuturePicks[i];
            if ((pick - currentPickNum) > 2) {
                nextWindowPicks.push(pick);
            }
        }
        let nextUserOverallPick = nextWindowPicks.length > 0 ? nextWindowPicks[0] : (currentPickNum + State.settings.numTeams);
        let html = `
            <div class="space-y-6">
                <!-- Top Recommendation Highlight Card -->
                <div class="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/40 p-5 rounded-2xl shadow-lg text-white">
                    <div class="flex justify-between items-start mb-3 flex-wrap gap-2">
                        <div>
                            <span class="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 mb-1 flex items-center gap-1.5">
                                <span>🏆</span> THE TOP RECOMMENDATION
                            </span>
                            <h3 class="text-2xl font-black text-white tracking-tight">${topPick.Player} 
                                <span class="text-sm font-semibold text-emerald-300">(${topPick.Pos} • ${topPick.Team})</span>
                            </h3>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black px-3 py-1 rounded-xl text-sm">
                                ${(topPick.AdvVBD || topPick.VBD).toFixed(1)} Adv VBD
                            </span>
                        </div>
                    </div>
                    
                    <p class="text-xs text-slate-300 leading-relaxed mb-4">
                        Draft Pro recommends <strong>${topPick.Player}</strong> after validating his baseline against advanced metrics, structural lineup additions, touch-quality ratios, and draft board scarcity.
                    </p>
                    
                    <ul class="space-y-2 text-xs bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-slate-200">
                        ${this.generateTopPickHighlights(topPick, userTeam, nextUserOverallPick)}
                    </ul>
                </div>
                
                <div class="flex items-center justify-between border-b border-gray-200 pb-2 pt-2">
                    <h4 class="font-extrabold text-gray-700 uppercase tracking-wider text-xs">
                        Head-to-Head Analytical Breakdown (Why Alternatives Ranked Lower)
                    </h4>
                    <span class="text-[10px] font-bold text-gray-400">Comparing Next ${alternatives.length} Options</span>
                </div>
        `;

        alternatives.forEach((alt, index) => {
            html += this.generateHeadToHead(topPick, alt, userTeam, nextUserOverallPick, index);
        });

        html += `</div>`;

        UI.showMessage(`🎯 Strategic Draft Decision Engine`, html);
    },

    generateTopPickHighlights(p, team, nextPick) {
        let highlights = [];

        // 1. Lineup Value (+PPW) & Bye-Week Coverage
        if (p._addedPPW >= 1.0 || (p._addedPPW > 0 && !p._byeFillWeek)) {
            highlights.push(`<li><strong class="text-emerald-400">⚡ Starting Lineup Maximizer:</strong> Directly increases your starting roster's projected weekly optimal output by <strong class="text-emerald-300">+${p._addedPPW.toFixed(2)} Points Per Week</strong>.</li>`);
        } else if (p._byeFillWeek) {
            highlights.push(`<li><strong class="text-amber-400">🔄 Critical Bye-Week Plug:</strong> Insulates a severe roster hole in Week ${p._byeFillWeek} (+${p._byeFillPts.toFixed(1)} fill points).</li>`);
        }

        // 2. Market Urgency & Survival Probability
        if (p.adp) {
            if (p._survivalProb !== undefined && p._survivalProb < 0.20) {
                highlights.push(`<li><strong class="text-rose-400">🚨 High Draft Urgency:</strong> Has only a <strong class="text-rose-300">${Math.round(p._survivalProb * 100)}% chance</strong> to survive until your next pick (#${nextPick}). Draft him now or lose him.</li>`);
            } else if (p.adp < State.currentPick + 6) {
                highlights.push(`<li><strong class="text-rose-400">🚨 Immediate ADP Scarcity:</strong> Board momentum (ADP ${p.adp.toFixed(1)}) dictates he will not survive the turn.</li>`);
            }
        }

        // 3. Positional Need & Lineup Slotting
        let posRoster = State.settings.roster[p.Pos];
        let isStarterNeeded = team.counts[p.Pos] < (posRoster ? posRoster.max : 1);
        if (isStarterNeeded) {
            highlights.push(`<li><strong class="text-indigo-400">📋 Core Starter Requirement:</strong> Secures an essential open starter slot at <strong class="text-indigo-300">${p.Pos}</strong> before viable talent drops into replacement tiers.</li>`);
        }

        // 4. Stacking & Handcuff Insurance / Lottery Tickets
        if (p._stackPartner) {
            highlights.push(`<li><strong class="text-purple-400">⚡ Stacking Multiplier:</strong> Correlates directly with your roster's QB (${p._stackPartner}) for week-winning ceiling outcomes.</li>`);
        }

        let userOwnsStarter = p.starterName && team.roster.some(r => r._cleanName === State.normalizeName(p.starterName));
        if (userOwnsStarter) {
            highlights.push(`<li><strong class="text-blue-400">🔒 Roster Security Handcuff:</strong> Protects your investment in ${p.starterName} by securing his direct handcuff.</li>`);
        } else if (p.isRBHandcuff) {
            highlights.push(`<li><strong class="text-emerald-400">🚀 League-Winning Upside:</strong> An elite bench stash who would inherit a massive role if ${p.starterName} misses time.</li>`);
        }

        // 5. Defensive (DST) Context
        let overallPosRank = State.allPlayers.filter(x => x.Pos === p.Pos).findIndex(x => x._cleanName === p._cleanName) + 1;
        if (p.Pos === 'DST') {
            if (overallPosRank <= 6) {
                highlights.push(`<li><strong class="text-indigo-400">🛡️ Elite Defense Advantage:</strong> Secures a top-tier defensive unit, avoiding the unpredictable weekly streaming carousel.</li>`);
            } else {
                highlights.push(`<li><strong class="text-slate-300">🛡️ Streamable Defense:</strong> A solid situational option if you missed the elite tier of DSTs.</li>`);
            }
        }

        // 6. Volume / Ceiling, Flyers & Breakout Stashes
        if (p._isFlyer && p.upsideScore) {
            highlights.push(`<li><strong class="text-rose-400">💥 Elite Ceiling:</strong> Provides league-winning upside metrics (Upside Score: ${(p.upsideScore).toFixed(1)}).</li>`);
        } else if (p.targetShare && p.targetShare >= 20.0) {
            highlights.push(`<li><strong class="text-blue-400">🎯 Volume Security:</strong> Commands a massive ${p.targetShare}% of his team's targets, insulating him from negative game scripts.</li>`);
        } else if (p.depthChart === 2 && p.isNewRole) {
            highlights.push(`<li><strong class="text-amber-400">📈 Breakout Stash:</strong> High-potential stash who is one depth-chart shift away from inheriting a massive role.</li>`);
        }

        // 7. Off-Season Scheme Upgrades (Environmental Migration)
        if (p.isTeamChanger && p._envDelta && p._envDelta >= 0.015) {
            let note = ['WR', 'TE'].includes(p.Pos) ? "significantly higher QB on-target accuracy and pocket protection" : "a superior run-blocking offensive line (YBC/Att)";
            highlights.push(`<li><strong class="text-emerald-400">🔄 Lucrative Offseason Scheme Upgrade:</strong> Move from ${p.pastTeam} to ${p.Team} lands him in ${note}, projecting an efficiency surge over past output.</li>`);
        }

        // 8. Expected Touchdown (xTD) Positive Regression
        if (p._positiveTdRegression && p.xTD !== undefined && p.pastStats?.totalTd !== undefined) {
            let diff = p.xTD - p.pastStats.totalTd;
            highlights.push(`<li><strong class="text-emerald-400">📈 Positive Touchdown Regression:</strong> Scored ${p.pastStats.totalTd} TDs last year, but his underlying red-zone usage warranted <strong class="text-emerald-300">${p.xTD.toFixed(1)} Expected TDs (xTD)</strong>. Math projects ~+${Math.round(diff)} more scores with neutral variance.</li>`);
        }

        // 9. Split Backfield Dominance & High-Value Opportunities (HVO)
        if (p.Pos === 'RB') {
            if (p.isRBStarter && p.handcuffName) {
                highlights.push(`<li><strong class="text-indigo-400">🛡️ Clear Backfield Alpha:</strong> Holds uncontested lead-back status with designated handcuff protection (${p.handcuffName}).</li>`);
            }
            if (p.hvo && p.hvo >= 60) {
                highlights.push(`<li><strong class="text-purple-400">💎 High-Value Opportunity (HVO) Dominance:</strong> Handled <strong class="text-purple-300">${p.hvo} high-leverage touches</strong> (Targets + RZ carries), immunizing his floor even in split-carry games.</li>`);
            } else if (p._isSatelliteBack && State.scoring.ppr >= 0.5) {
                highlights.push(`<li><strong class="text-blue-400">🎯 High-Leverage PPR Specialist:</strong> Commands high-value targets out of the backfield, capitalizing directly on this league's PPR scoring rules.</li>`);
            }
        }

        // 10. Wide Receiver / Tight End Alpha Profiles (WOPR / TPS)
        if (['WR', 'TE'].includes(p.Pos)) {
            if (p.wopr && p.wopr >= 0.60) {
                highlights.push(`<li><strong class="text-blue-400">👑 Elite Alpha WOPR (${p.wopr.toFixed(2)}):</strong> Commands premier market share across both targets and deep air yards.</li>`);
            }
            if (p.tps && p.tps >= 0.22) {
                highlights.push(`<li><strong class="text-purple-400">⚡ Hyper-Efficient Target Earner:</strong> Demands passes on <strong class="text-purple-300">${(p.tps * 100).toFixed(1)}% of routes run</strong> (Targets Per Snap).</li>`);
            }
        }

        // 11. Rushing QB Floor / Escapability
        if (p.Pos === 'QB') {
            if (p.stats && p.stats.rushAtt >= 50) {
                highlights.push(`<li><strong class="text-amber-400">🏃 Konami Code Rushing Floor:</strong> Projected for <strong class="text-amber-300">${p.stats.rushYds} rush yards</strong>, creating an elite baseline that pocket passers cannot match.</li>`);
            }
            if (p.p2s && p.p2s <= 14.0) {
                highlights.push(`<li><strong class="text-emerald-400">🛡️ Elite Pocket Escapability:</strong> Low ${p.p2s.toFixed(1)}% Pressure-to-Sack rate proves he avoids drive-killing negative plays under pressure.</li>`);
            }
        }

        // 12. Ascending Workload Trajectory
        if (p._isAscendingRole) {
            highlights.push(`<li><strong class="text-emerald-400">📈 Expanding Featured Role:</strong> Projected for a +${p._growthPct}% surge in workload compared to last season, indicating a true breakout trajectory.</li>`);
        }

        // Fallback
        if (highlights.length === 0) {
            highlights.push(`<li><strong class="text-slate-300">📊 Best Available Value:</strong> Highest synthesized VBD projection remaining on the board.</li>`);
        }

        return highlights.join('');
    },

    generateHeadToHead(topPick, alt, team, nextPick, index) {
        let prosForAlt = [];
        let consForAlt = [];

        const currentPickNum = State.currentPick + 1;
        const currentRound = Math.floor(State.currentPick / State.settings.numTeams) + 1;

        // -------------------------------------------------------------
        // 1. RAW VALUE VS POSITIONAL NEED (WITH TIEBREAKER BANDS)
        // -------------------------------------------------------------
        let topVBD = topPick.AdvVBD || topPick.VBD || 0;
        let altVBD = alt.AdvVBD || alt.VBD || 0;
        let diff = altVBD - topVBD;

        const altPosLimit = (State.settings.roster[alt.Pos]?.max || 2);
        const altPosCount = team.counts[alt.Pos] || 0;
        const topPosCount = team.counts[topPick.Pos] || 0;

        // Check if the alternative player is TRULY blocked from the starting lineup (including Flex)
        let isAltBlocked = altPosCount >= altPosLimit;
        if (isAltBlocked) {
            if (['RB', 'WR'].includes(alt.Pos) && team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) isAltBlocked = false;
            else if (['RB', 'WR', 'TE'].includes(alt.Pos) && team.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) isAltBlocked = false;
            else if (['QB', 'RB', 'WR', 'TE'].includes(alt.Pos) && team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) isAltBlocked = false;
        }

        if (diff > 0) {
            if (diff <= 6.0) {
                prosForAlt.push(`<strong>Slight Value Edge:</strong> Projects marginally higher (+${diff.toFixed(1)} VBD) in a vacuum, but the difference is small enough that roster needs dictate the pick.`);
            } else {
                prosForAlt.push(`<strong>Higher Absolute Value:</strong> In a vacuum, ${alt.Player} has a mathematically higher value (+${diff.toFixed(1)} VBD) regardless of roster needs.`);
            }

            // Only declare a Roster Logjam if the players are DIFFERENT positions and the alt's position is already full
            if (topPick.Pos !== alt.Pos) {
                if (isAltBlocked) {
                    consForAlt.push(`<strong>Roster Logjam:</strong> Your starting ${alt.Pos} and Flex slots are already filled. Taking ${topPick.Player} (${topPick.Pos}) addresses an unfilled starting spot rather than adding a bench player.`);
                } else if (altPosCount > topPosCount && currentPickNum <= 48) {
                    let remainingAlts = State.availablePlayers.filter(p => p.Pos === alt.Pos && (p.AdvVBD || p.VBD) >= 40).length;
                    let remainingTops = State.availablePlayers.filter(p => p.Pos === topPick.Pos && (p.AdvVBD || p.VBD) >= 40).length;
                    
                    if (remainingAlts >= remainingTops + 3) {
                        consForAlt.push(`<strong>Positional Scarcity:</strong> The ${alt.Pos} board has a deep plateau (${remainingAlts} quality options remaining), whereas ${topPick.Pos} faces an immediate cliff. Drafting ${topPick.Player} secures an elite ${topPick.Pos} before the tier evaporates.`);
                    } else {
                        consForAlt.push(`<strong>Positional Balance:</strong> Having already secured a ${alt.Pos} in earlier rounds, drafting ${topPick.Player} (${topPick.Pos}) builds a more balanced starting foundation.`);
                    }
                }
            }
        } else if (diff < 0) {
            let absDiff = Math.abs(diff);
            if (absDiff <= 6.0) {
                consForAlt.push(`<strong>Slight Value Edge:</strong> ${topPick.Player} projects marginally higher (+${absDiff.toFixed(1)} VBD) in a vacuum. Combined with roster context, he is the safer mathematical pick.`);
            } else {
                consForAlt.push(`<strong>Significant Value Edge:</strong> ${topPick.Player} projects significantly higher (+${absDiff.toFixed(1)} VBD) in a vacuum. Passing on him sacrifices too much baseline value.`);
            }
        }

        // -------------------------------------------------------------
        // 2. DRAFT URGENCY & TRUE ADP VALUE COMPARISON
        // -------------------------------------------------------------
        if (alt.adp) {
            if (currentPickNum - alt.adp >= 8) {
                prosForAlt.push(`<strong>Extreme Market Value:</strong> The public let ${alt.Player} slide past his ADP (${alt.adp.toFixed(1)}). Capitalizing on this drop presents massive draft value at Pick ${currentPickNum}.`);
            } else if (alt.adp > nextPick + 4) {
                // Only advise waiting if the player's ADP is safely past your ACTUAL next pick in the draft order
                consForAlt.push(`<strong>Exploit Public ADP:</strong> The public values ${alt.Player} at pick ${alt.adp.toFixed(1)} (safely past your next pick at #${nextPick}), giving you a high chance of drafting him later.`);
            }
        }

        // -------------------------------------------------------------
        // 3. LINEUP OPTIMIZATION & OPPORTUNITY COST
        // -------------------------------------------------------------
        let topPPW = topPick._addedPPW || 0;
        let altPPW = alt._addedPPW || 0;
        if (altPPW > topPPW + 0.5) {
            prosForAlt.push(`<strong>Higher Immediate Lineup Boost:</strong> Adds +${altPPW.toFixed(1)} PPW to your weekly optimal score (vs. +${topPPW.toFixed(1)} PPW for ${topPick.Player}).`);
        } else if (topPPW > altPPW + 0.5) {
            let impactLabel = (topPick.Pos === alt.Pos) ? "Slightly Lower Lineup Boost" : (isAltBlocked ? "Bench Warmer Risk" : "Lower Lineup Impact");
            consForAlt.push(`<strong>${impactLabel}:</strong> Adds +${altPPW.toFixed(1)} PPW to your starters compared to +${topPPW.toFixed(1)} PPW for ${topPick.Player}.`);
        }

        // -------------------------------------------------------------
        // 4. SAMPLE SIZE RELIABILITY & MULTI-LEVEL TRAIT CONTEXT
        // -------------------------------------------------------------
        const topGp = topPick.pastStats?.gp ?? 17;
        const altGp = alt.pastStats?.gp ?? 17;

        if (topGp >= 14 && altGp <= 7 && alt.pastPpg >= 14.0) {
            let densityNote = alt._isSmallSampleAlpha ? "with undeniable alpha per-game usage density" : "though heavily skewed by limited sample variance";
            prosForAlt.push(`<strong>Explosive Per-Game Ceiling:</strong> Produced at an elite rate (${alt.pastPpg.toFixed(1)} PPG in ${altGp} games) ${densityNote}.`);
            consForAlt.push(`<strong>Proven Full-Season Reliability:</strong> ${topPick.Player} sustained high-end production over a full ${topGp}-game slate, carrying far less regression risk.`);
        } else if (altGp >= 14 && topGp <= 7 && topPick.pastPpg >= 14.0) {
            prosForAlt.push(`<strong>Full-Season Track Record:</strong> Bankable ${altGp}-game durability and volume baseline vs. ${topPick.Player}'s ${topGp}-game sample.`);
            consForAlt.push(`<strong>Per-Game Dominance:</strong> ${topPick.Player} flashed league-winning per-game dominance (${topPick.pastPpg.toFixed(1)} PPG) when active.`);
        }

        if (alt._isIndependentYACCreator) {
            prosForAlt.push(`<strong>Independent Tackle-Breaker:</strong> Creates high yards after contact independently without relying on elite blocking.`);
        }
        if (alt._isSystemDependentRB) {
            consForAlt.push(`<strong>System-Dependent Rusher:</strong> 2025 efficiency was heavily propped up by massive blocking lanes rather than individual tackle-breaking.`);
        }
        if (alt._isFlukeTDScorer) {
            consForAlt.push(`<strong>TD Fluke Warning:</strong> 2025 TD output lacked underlying red-zone opportunity volume, making high regression likely.`);
        }

        // -------------------------------------------------------------
        // 4B. ADVANCED ENGINE FEATURES (HVO, xTD, SCHEME SHIFTS, WOPR)
        // -------------------------------------------------------------
        // Running Back High-Value Opportunities (HVO) & Vacated Touch Dynamics
        if (topPick.Pos === 'RB' && alt.Pos === 'RB') {
            // Vacated Opportunity & Role Consolidation
            if (alt._inheritsGoalLineWork && !topPick._inheritsGoalLineWork) {
                let depStr = alt._departedBackfieldNames?.length > 0 ? ` (${alt._departedBackfieldNames.join(', ')})` : '';
                prosForAlt.push(`<strong>Vacated Goal-Line Work:</strong> Enters 2026 with <strong>+${alt._vacatedRzAtt} vacated Red-Zone carries</strong> opening up from departed personnel${depStr}. His touchdown expectation rises significantly.`);
            } else if (topPick._inheritsGoalLineWork && !alt._inheritsGoalLineWork) {
                let depStr = topPick._departedBackfieldNames?.length > 0 ? ` (${topPick._departedBackfieldNames.join(', ')})` : '';
                consForAlt.push(`<strong>Backfield Consolidation Advantage:</strong> ${topPick.Player} inherits <strong>+${topPick._vacatedRzAtt} vacated Red-Zone carries</strong>${depStr}, locking in an elite touchdown ceiling that ${alt.Player} lacks.`);
            }

            // Backup Threat Assessment
            if (alt._backupThreatLevel === 'Low Standalone Threat' && topPick._backupThreatLevel === 'Goal-Line Vulture Threat') {
                prosForAlt.push(`<strong>Clean Backfield Monopoly:</strong> His backup (${alt._backupName || 'depth'}) poses minimal standalone threat, whereas ${topPick.Player} faces goal-line competition from ${topPick._backupName}.`);
            } else if (topPick._backupThreatLevel === 'Low Standalone Threat' && alt._backupThreatLevel === 'Goal-Line Vulture Threat') {
                consForAlt.push(`<strong>Goal-Line Vulture Risk:</strong> ${alt.Player} faces short-yardage touchdown competition from ${alt._backupName}, whereas ${topPick.Player} has full three-down control.`);
            }

            // High-Value Opportunities (Normalized for Ascending Backs)
            const topTouches = (topPick.pastStats?.rushAtt || 0) + (topPick.pastStats?.rec || 0);
            const altTouches = (alt.pastStats?.rushAtt || 0) + (alt.pastStats?.rec || 0);
            const isTouchMismatch = Math.abs(topTouches - altTouches) >= 80;

            if (topPick.hvo && alt.hvo && !isTouchMismatch) {
                if (topPick.hvo >= alt.hvo + 12) {
                    consForAlt.push(`<strong>Inferior Touch Quality:</strong> ${topPick.Player} commands significantly more High-Value Opportunities (<strong>${topPick.hvo} vs ${alt.hvo} HVO</strong>).`);
                } else if (alt.hvo >= topPick.hvo + 12) {
                    prosForAlt.push(`<strong>Superior Touch Quality:</strong> Commands more High-Value Opportunities (<strong>${alt.hvo} vs ${topPick.hvo} HVO</strong>).`);
                }
            }

            // PPR Role Clashes
            if (State.scoring.ppr >= 0.5) {
                if (topPick._isSatelliteBack && alt._isGoalLineHammer) {
                    consForAlt.push(`<strong>PPR Scoring Deficit:</strong> ${alt.Player} is a goal-line hammer with virtually zero pass-catching floor. In this PPR format, ${topPick.Player}'s target volume establishes a far safer weekly baseline.`);
                } else if (alt._isSatelliteBack && topPick._isGoalLineHammer) {
                    prosForAlt.push(`<strong>PPR Scoring Advantage:</strong> High pass-catching utilization out of the backfield scales perfectly with this league's PPR scoring rules.`);
                }
            }

            // Explosive Run Rate
            if (topPick.err && alt.err) {
                if (topPick.err >= alt.err + 1.0) {
                    consForAlt.push(`<strong>Lower Explosive Burst:</strong> Posts a ${alt.err.toFixed(1)}% Explosive Run Rate compared to ${topPick.Player}'s slate-breaking <strong>${topPick.err.toFixed(1)}% ERR</strong>.`);
                } else if (alt.err >= topPick.err + 1.0) {
                    prosForAlt.push(`<strong>Higher Explosive Run Rate:</strong> Generates chunk runs at a superior rate (<strong>${alt.err.toFixed(1)}% vs ${topPick.err.toFixed(1)}% ERR</strong>).`);
                }
            }
        

            // Big Plays Comparison (Suppressed on Backup Sample Size Mismatches)
            let topBig = topPick.pastStats?.bigPlays || 0;
            let altBig = alt.pastStats?.bigPlays || 0;
            if (!isTouchMismatch) {
                if (altBig >= topBig + 2) {
                    prosForAlt.push(`<strong>More Big-Play Strikes:</strong> Logged <strong>${altBig} explosive plays (20+ yds)</strong> last season vs. ${topPick.Player}'s ${topBig}.`);
                } else if (topBig >= altBig + 2) {
                    consForAlt.push(`<strong>Fewer Explosive Plays:</strong> Logged ${altBig} big plays (20+ yds) vs. ${topPick.Player}'s <strong>${topBig}</strong>.`);
                }
            }
            // Suppress Backup Bust Rate Penalty if Player is Ascending to a Starting Role
            if (alt.boomBust && topPick.boomBust && !alt._isAscendingRole) {
                if (alt.boomBust.bust > topPick.boomBust.bust + 8) {
                    consForAlt.push(`<strong>Volatile Bust Risk:</strong> Busted in <strong>${alt.boomBust.bust}%</strong> of games last year compared to ${topPick.Player}'s clean <strong>${topPick.boomBust.bust}%</strong> bust rate.`);
                }
            }

            // Offensive Line Run-Blocking (YBC/Att) Edge
            let topTeam = State.normalizeTeam(topPick.Team);
            let altTeam = State.normalizeTeam(alt.Team);
            let topRushEnv = State.teamAdvRush ? State.teamAdvRush[topTeam] : null;
            let altRushEnv = State.teamAdvRush ? State.teamAdvRush[altTeam] : null;

            if (topRushEnv && altRushEnv) {
                let topYbc = topRushEnv.ybcAtt || 0;
                let altYbc = altRushEnv.ybcAtt || 0;
                if (altYbc >= topYbc + 0.25) {
                    prosForAlt.push(`<strong>Superior Blocking Environment:</strong> Runs behind an offensive line creating <strong>${altYbc.toFixed(1)} Yards Before Contact/Att</strong> vs. ${topPick.Player}'s ${topYbc.toFixed(1)} YBC.`);
                } else if (topYbc >= altYbc + 0.25) {
                    consForAlt.push(`<strong>Worse Blocking Environment:</strong> Offense generates only ${altYbc.toFixed(1)} YBC/Att vs. ${topPick.Player}'s <strong>${topYbc.toFixed(1)} YBC</strong>.`);
                }
            }

            // Schedule Strength Edge
            if (alt.avgStars && topPick.avgStars) {
                if (alt.avgStars >= topPick.avgStars + 0.25) {
                    prosForAlt.push(`<strong>Softer Schedule:</strong> Enjoys a more favorable matchup schedule (⭐<strong>${alt.avgStars.toFixed(2)}</strong> vs. ⭐${topPick.avgStars.toFixed(2)}).`);
                } else if (topPick.avgStars >= alt.avgStars + 0.25) {
                    consForAlt.push(`<strong>Tougher Matchup Schedule:</strong> Faces a more difficult SOS (⭐${alt.avgStars.toFixed(2)} vs. ⭐<strong>${topPick.avgStars.toFixed(2)}</strong>).`);
                }
            }

            // Ascending Workload Trajectory
            if (alt._isAscendingRole && !topPick._isAscendingRole) {
                prosForAlt.push(`<strong>Expanding Featured Role:</strong> Enters 2026 with an ascending workload trajectory (+${alt._growthPct}% touches/g) due to vacated backfield touches.`);
            }
        }

        // -------------------------------------------------------------
        // Wide Receiver / Tight End Air Share, Vacated Targets & Tree Dynamics
        // -------------------------------------------------------------
        if (['WR', 'TE'].includes(topPick.Pos) && ['WR', 'TE'].includes(alt.Pos)) {
            // Multi-Currency Vacated Volume & Role Inheritance
            const formatVacatedNote = (player, depList) => {
                if (player._vacatedRoleType === 'Intermediate MOF & Red-Zone Funnel' || (player.Pos === 'TE' && player._inheritsRzFunnel)) {
                    return `inheriting high-leverage <strong>Middle-of-the-Field targets and +${player._vacatedRzTgts || 0} Red-Zone looks</strong>${depList}, expanding his weekly touchdown equity`;
                } else if (player._vacatedRoleType === 'Detached Hybrid Deep Seam') {
                    return `inheriting <strong>+${player._vacatedAirYards} deep seam air yards</strong> in a hybrid detached receiver role${depList}`;
                } else if (player._vacatedRoleType === 'High-Volume Slot Outlet') {
                    return `inheriting <strong>+${player._vacatedTgts} underneath targets</strong>${depList} with heavy PPR chain-moving volume`;
                } else {
                    return `inheriting <strong>+${player._vacatedAirYards} deep air yards</strong> and <strong>+${player._vacatedTgts} vacated targets</strong>${depList}, securing an alpha downfield role`;
                }
            };

            let altHasVacated = alt._inheritsAlphaAirShare || alt._inheritsRzFunnel || alt._inheritsIntermediateVolume;
            let topHasVacated = topPick._inheritsAlphaAirShare || topPick._inheritsRzFunnel || topPick._inheritsIntermediateVolume;

            if (altHasVacated && !topHasVacated) {
                let depList = alt._departedReceiverNames?.length > 0 ? ` (${alt._departedReceiverNames.join(', ')})` : '';
                prosForAlt.push(`<strong>Vacated Opportunity Surge:</strong> Enters 2026 ${formatVacatedNote(alt, depList)}.`);
            } else if (topHasVacated && !altHasVacated) {
                let depList = topPick._departedReceiverNames?.length > 0 ? ` (${topPick._departedReceiverNames.join(', ')})` : '';
                consForAlt.push(`<strong>Role Consolidation Advantage:</strong> ${topPick.Player} enters 2026 ${formatVacatedNote(topPick, depList)}, locking in a level of opportunity command that ${alt.Player} lacks.`);
            }

            // Passing Tree Concentration Clashes
            if (alt._passingTreeType === 'Concentrated 2-Man Funnel' && topPick._passingTreeType === 'Crowded Committee Spread') {
                prosForAlt.push(`<strong>Concentrated Passing Tree:</strong> Plays in a 2-man target funnel (${alt.Team}), giving him a script-proof floor vs. ${topPick.Player}'s crowded receiver room.`);
            } else if (topPick._passingTreeType === 'Concentrated 2-Man Funnel' && alt._passingTreeType === 'Crowded Committee Spread') {
                consForAlt.push(`<strong>Crowded Target Hierarchy:</strong> ${alt.Player} must compete with 3+ viable pass-catchers in ${alt.Team}, whereas ${topPick.Player} commands a concentrated 2-man passing tree.`);
            }

            // WOPR & Target Share
            if (topPick.wopr && alt.wopr) {
                if (topPick.wopr >= alt.wopr + 0.10) {
                    consForAlt.push(`<strong>Lower Opportunity Command:</strong> Commands a <strong>${alt.wopr.toFixed(2)} WOPR</strong> vs ${topPick.Player}'s alpha <strong>${topPick.wopr.toFixed(2)} WOPR</strong>.`);
                } else if (alt.wopr >= topPick.wopr + 0.10) {
                    prosForAlt.push(`<strong>Higher Opportunity Command:</strong> Commands a superior Weighted Opportunity Rating (<strong>${alt.wopr.toFixed(2)} vs ${topPick.wopr.toFixed(2)} WOPR</strong>).`);
                }
            }

            if (topPick.targetShare && alt.targetShare) {
                if (topPick.targetShare >= alt.targetShare + 4.0) {
                    consForAlt.push(`<strong>Lower Target Command:</strong> Commands ${alt.targetShare}% target share vs. ${topPick.Player}'s dominant <strong>${topPick.targetShare}%</strong>.`);
                } else if (alt.targetShare >= topPick.targetShare + 4.0) {
                    prosForAlt.push(`<strong>Higher Target Share:</strong> Commands a higher percentage of team pass attempts (<strong>${alt.targetShare}% vs ${topPick.targetShare}%</strong>).`);
                }
            }

            if (topPick.ypt && alt.ypt) {
                if (topPick.ypt >= 9.0 && alt.ypt <= 7.0) {
                    consForAlt.push(`<strong>Inefficient Target Profile:</strong> Generates only <strong>${alt.ypt.toFixed(1)} Yards Per Target</strong> vs ${topPick.Player}'s hyper-efficient <strong>${topPick.ypt.toFixed(1)} YPT</strong>.`);
                } else if (alt.ypt >= 9.0 && topPick.ypt <= 7.0) {
                    prosForAlt.push(`<strong>Superior Target Efficiency:</strong> Generates <strong>${alt.ypt.toFixed(1)} YPT</strong> vs ${topPick.Player}'s ${topPick.ypt.toFixed(1)} YPT.`);
                }
            }

            if (alt._isEmptyCalories) {
                consForAlt.push(`<strong>'Empty Calories' Warning:</strong> Volume is undermined by dismal per-target efficiency, creating a safe floor with virtually no weekly ceiling.`);
            }
            if (alt._isCardioKing) {
                consForAlt.push(`<strong>'Cardio King' Profile:</strong> High snap share is deceptive; runs decoy routes and blocks rather than earning targeted opportunities.`);
            }
        }

        // -------------------------------------------------------------
        // CROSS-POSITIONAL ADVANCED TRAIT CLASHES (RB vs WR, RB vs TE)
        // -------------------------------------------------------------
        if (topPick.Pos === 'RB' && ['WR', 'TE'].includes(alt.Pos)) {
            // WR Target Command & WOPR vs RB Ground Dependency
            if (alt.targetShare && alt.targetShare >= 23.0) {
                prosForAlt.push(`<strong>Script-Proof Target Priority:</strong> Commands a massive <strong>${alt.targetShare}% target share</strong>, establishing a bulletproof PPR floor that cannot be neutralized by negative game scripts.`);
            } else if (alt.wopr && alt.wopr >= 0.58) {
                prosForAlt.push(`<strong>Elite Downfield Opportunity (WOPR):</strong> Commands a dominant <strong>${alt.wopr.toFixed(2)} WOPR</strong> with massive air yards share, giving him multi-touchdown spike week upside.`);
            }

            // Targets Per Snap (Route Dominance)
            if (alt.tps && alt.tps >= 0.21) {
                prosForAlt.push(`<strong>Elite Route Separation:</strong> Demands targets on <strong>${(alt.tps * 100).toFixed(1)}% of routes run</strong> (TPS), proving elite individual separation skills.`);
            }

            // Passing Tree Concentration & Vacated Air Yards
            if (alt._passingTreeType === 'Concentrated 2-Man Funnel') {
                prosForAlt.push(`<strong>Concentrated Passing Funnel:</strong> Operates in a 2-man target funnel in ${alt.Team}, locking in reliable high-volume weekly pass attempts.`);
            }
            if (alt._inheritsAlphaAirShare) {
                let depList = alt._departedReceiverNames?.length > 0 ? ` (${alt._departedReceiverNames.join(', ')})` : '';
                prosForAlt.push(`<strong>Inherited Alpha Air Yards:</strong> Inherits <strong>+${alt._vacatedAirYards} deep air yards</strong>${depList}, raising his ceiling.`);
            }

            // Hands / Catch Rate
            if (alt.trueCatchRate && alt.trueCatchRate >= 88.0) {
                prosForAlt.push(`<strong>Reliable Hands & Quality Targets:</strong> Converted <strong>${alt.trueCatchRate.toFixed(1)}% of catchable passes</strong> into receptions.`);
            }

            // Schedule Advantage
            if (alt.avgStars && topPick.avgStars && alt.avgStars >= topPick.avgStars + 0.20) {
                prosForAlt.push(`<strong>Softer Matchup Schedule:</strong> Faces a more favorable matchup slate (⭐<strong>${alt.avgStars.toFixed(2)}</strong> vs. ⭐${topPick.avgStars.toFixed(2)}).`);
            }

            // Workload Longevity & Structural Safety
            let topTouches = (topPick.pastStats?.rushAtt || 0) + (topPick.pastStats?.rec || 0);
            if (topTouches >= 300) {
                prosForAlt.push(`<strong>Workload Durability Advantage:</strong> Avoids the severe injury and efficiency cliff that running backs historically face following a 300+ touch season (${topPick.Player} had ${topTouches} touches).`);
            }

            // Big-Play Strikes
            let altBig = alt.pastStats?.bigPlays || 0;
            let topBig = topPick.pastStats?.bigPlays || 0;
            if (altBig >= topBig + 2) {
                prosForAlt.push(`<strong>Explosive Playmaking:</strong> Generated <strong>${altBig} big plays (20+ yds)</strong> vs. ${topPick.Player}'s ${topBig}.`);
            }

            // Why RB wins over WR
            if (topPick.hvo && topPick.hvo >= 70) {
                consForAlt.push(`<strong>Positional Bellcow Scarcity:</strong> True three-down workhorse running backs commanding ${topPick.hvo} High-Value Opportunities are far more scarce than high-volume wide receivers.`);
            }
            if (topPick.isRBStarter && topPick.handcuffName) {
                consForAlt.push(`<strong>Uncontested Backfield Role:</strong> ${topPick.Player} commands uncontested goal-line and rushing volume in ${topPick.Team}, giving him unmatched weekly touchdown equity.`);
            }
        } else if (['WR', 'TE'].includes(topPick.Pos) && alt.Pos === 'RB') {
            // When Top Pick is WR and Alternative is RB
            if (alt.hvo && alt.hvo >= 65) {
                prosForAlt.push(`<strong>High-Value Touch Scarcity:</strong> Commands <strong>${alt.hvo} High-Value Opportunities</strong> (Targets + RZ carries) in an elite bellcow backfield role.`);
            }
            if (alt.isRBStarter && alt.handcuffName) {
                prosForAlt.push(`<strong>Uncontested Goal-Line Lead:</strong> Monopolizes high-leverage rushing and goal-line work with designated handcuff protection.`);
            }
            if (topPick.targetShare && topPick.targetShare >= 24.0) {
                consForAlt.push(`<strong>Alpha WR Opportunity Cost:</strong> Passing on ${topPick.Player} sacrifices an elite ${topPick.targetShare}% target share in a position where elite volume is foundational.`);
            }
        }

        // Quarterback Dual-Threat, Weapon Room & Escapability Clashes
        if (topPick.Pos === 'QB' && alt.Pos === 'QB') {
            // Surrounding Weapon Quality
            if (alt._eliteWeaponCount && topPick._eliteWeaponCount) {
                if (alt._eliteWeaponCount > topPick._eliteWeaponCount) {
                    prosForAlt.push(`<strong>Superior Weapon Ecosystem:</strong> Surrounded by ${alt._eliteWeaponCount} elite pass-catchers (${alt._avgWeaponCatchRate}% team catch rate) vs. ${topPick.Player}'s ${topPick._eliteWeaponCount}.`);
                } else if (topPick._eliteWeaponCount > alt._eliteWeaponCount) {
                    consForAlt.push(`<strong>Weaker Pass-Catcher Arsenal:</strong> Operates with fewer elite separators (${alt._avgWeaponCatchRate}% team catch rate) compared to ${topPick.Player}'s supporting cast.`);
                }
            }

            // Dual-Threat & Goal-Line Rushing Equity
            let topRush = topPick.stats?.rushYds || 0;
            let altRush = alt.stats?.rushYds || 0;
            if (topRush >= altRush + 180) {
                consForAlt.push(`<strong>Lacks Dual-Threat Floor:</strong> Projected for only ${altRush} rushing yards vs ${topPick.Player}'s massive <strong>${topRush} rushing yards</strong>.`);
            } else if (altRush >= topRush + 180) {
                prosForAlt.push(`<strong>Superior Dual-Threat Floor:</strong> Generates a rushing floor (<strong>${altRush} vs ${topRush} rush yds</strong>) that pure pocket passers cannot match.`);
            }

            if (alt._hasGoalLineRushingEquity && !topPick._hasGoalLineRushingEquity) {
                prosForAlt.push(`<strong>Goal-Line Rushing Equity:</strong> Directs designed goal-line sneaks/keeper plays, providing immense rushing touchdown upside.`);
            }

            // Pocket Escapability
            if (topPick.p2s && alt.p2s) {
                if (alt.p2s >= topPick.p2s + 5.0) {
                    consForAlt.push(`<strong>Takes Drive-Killing Sacks:</strong> High <strong>${alt.p2s.toFixed(1)}% Pressure-to-Sack rate</strong> indicates difficulty escaping collapsing pockets.`);
                } else if (topPick.p2s >= alt.p2s + 5.0) {
                    prosForAlt.push(`<strong>Elite Pocket Escapability:</strong> Lower Pressure-to-Sack rate (<strong>${alt.p2s.toFixed(1)}% vs ${topPick.p2s.toFixed(1)}%</strong>) avoids negative plays.`);
                }
            }
        }

        // Environmental Scheme Upgrades (Offseason Team Changers)
        if (topPick.isTeamChanger || alt.isTeamChanger) {
            if (topPick._envDelta && topPick._envDelta >= 0.02 && (!alt._envDelta || alt._envDelta < topPick._envDelta)) {
                consForAlt.push(`<strong>Hidden Environmental Upgrade:</strong> ${topPick.Player} moved to a significantly improved blocking and accuracy ecosystem; ${alt.Player} lacks this efficiency catalyst.`);
            } else if (alt._envDelta && alt._envDelta >= 0.02 && (!topPick._envDelta || topPick._envDelta < alt._envDelta)) {
                prosForAlt.push(`<strong>Scheme Upgrade Catalyst:</strong> Offseason team change lands ${alt.Player} in a superior offensive environment, creating breakout efficiency potential.`);
            }
        }

        // Expected Touchdown (xTD) Regression
        if (topPick._positiveTdRegression && alt._isFlukeTDScorer) {
            consForAlt.push(`<strong>Severe TD Regression Divergence:</strong> ${topPick.Player} mathematically under-performed his expected touchdowns last year and is primed for positive rebound, while ${alt.Player}'s touchdown rate is unsustainable.`);
        } else if (alt._positiveTdRegression && topPick._isFlukeTDScorer) {
            prosForAlt.push(`<strong>Positive TD Progression:</strong> Statistically primed to score more touchdowns this season based on his high-leverage red-zone usage.`);
        }

        // -------------------------------------------------------------
        // 5. HANDCUFF & ROSTER PROTECTION DYNAMICS
        // -------------------------------------------------------------
        let userOwnsAltStarter = alt.starterName && team.roster.some(r => r._cleanName === State.normalizeName(alt.starterName));
        let userOwnsTopStarter = topPick.starterName && team.roster.some(r => r._cleanName === State.normalizeName(topPick.starterName));

        if (userOwnsAltStarter) {
            prosForAlt.push(`<strong>Direct Handcuff:</strong> Protects your investment in ${alt.starterName}.`);
        } else if (alt.isRBHandcuff && !userOwnsAltStarter) {
            prosForAlt.push(`<strong>Lottery Ticket Stash:</strong> Huge contingent upside if ${alt.starterName} goes down.`);
        }

        if (userOwnsTopStarter) {
            consForAlt.push(`<strong>Missed Insurance:</strong> Passing on ${topPick.Player} leaves your RB1 (${topPick.starterName}) exposed without a handcuff.`);
        } else if (topPick.isRBHandcuff && !userOwnsTopStarter) {
            consForAlt.push(`<strong>Passed Lottery Ticket:</strong> ${topPick.Player} offers a league-winning ceiling if the starter goes down, which provides more value to a bench stash.`);
        }

        // -------------------------------------------------------------
        // 6. BOOM/BUST CONSISTENCY & CEILING CHECK
        // -------------------------------------------------------------
        if (alt.boomBust && topPick.boomBust) {
            if (alt.boomBust.bust + 8 < topPick.boomBust.bust) {
                prosForAlt.push(`<strong>Dramatically Safer Floor:</strong> Busted in only <strong>${alt.boomBust.bust}%</strong> of 2025 games vs. ${topPick.Player}'s <strong>${topPick.boomBust.bust}%</strong> bust rate.`);
            } else if (topPick.boomBust.bust + 8 < alt.boomBust.bust) {
                consForAlt.push(`<strong>Volatile Bust Risk:</strong> Busted in <strong>${alt.boomBust.bust}%</strong> of games last year compared to ${topPick.Player}'s clean <strong>${topPick.boomBust.bust}%</strong> bust rate.`);
            }

            if (alt.boomBust.boom > topPick.boomBust.boom + 8) {
                prosForAlt.push(`<strong>Higher Weekly Ceiling:</strong> Posted a "Boom" week in <strong>${alt.boomBust.boom}%</strong> of games vs. ${topPick.Player}'s ${topPick.boomBust.boom}%.`);
            } else if (topPick.boomBust.boom > alt.boomBust.boom + 8) {
                consForAlt.push(`<strong>Higher Weekly Ceiling:</strong> ${topPick.Player} posted a "Boom" week in <strong>${topPick.boomBust.boom}%</strong> of games vs. ${alt.Player}'s ${alt.boomBust.boom}%.`);
            }
        }

        let altHasHigherBoom = alt.boomBust && topPick.boomBust && (alt.boomBust.boom > topPick.boomBust.boom + 5);
        let altHasLowerBust = alt.boomBust && topPick.boomBust && (alt.boomBust.bust + 5 < topPick.boomBust.bust);

        if (alt._isSafeFloor && !topPick._isSafeFloor && !altHasLowerBust) {
            prosForAlt.push(`<strong>Safer Floor:</strong> Provides more reliable week-to-week stability if you are looking to insulate a risky roster.`);
        }
        if (topPick._isFlyer && !alt._isFlyer && !altHasHigherBoom) {
            consForAlt.push(`<strong>Lower Ceiling:</strong> Lacks the slate-breaking upside and advanced metrics that ${topPick.Player} possesses.`);
        }

        // -------------------------------------------------------------
        // 7. ENHANCED POSITIONAL & CROSS-POSITIONAL TIER ANALYSIS
        // -------------------------------------------------------------
        let topTier = this.getTierDetails(topPick);
        let altTier = this.getTierDetails(alt);

        if (topPick.Pos === alt.Pos) {
            // Same Position Tier Comparison
            if (topTier.tierNum < altTier.tierNum) {
                let vbdGap = ((topPick.AdvVBD || topPick.VBD) - (alt.AdvVBD || alt.VBD)).toFixed(1);
                consForAlt.push(`<strong>Tier Difference:</strong> ${topPick.Player} is in <strong>${topTier.tierName}</strong> while ${alt.Player} falls into <strong>${altTier.tierName}</strong> (-${vbdGap} VBD gap).`);
            }

            if (topTier.isLastInTier && altTier.tierNum >= topTier.tierNum) {
                consForAlt.push(`<strong>Tier Cliff Warning:</strong> ${topPick.Player} is the <strong>final player</strong> in ${topTier.tierName}. Drafting ${alt.Player} causes you to completely miss this tier.`);
            }

            // Same-Position Raw Projection & Metric Tiebreakers
            let projDiff = (topPick.ProjPts || 0) - (alt.ProjPts || 0);
            if (projDiff >= 5.0) {
                consForAlt.push(`<strong>Higher Total Season Projection:</strong> ${topPick.Player} projects for <strong>+${projDiff.toFixed(1)} more total season points</strong> (${topPick.ProjPts.toFixed(1)} vs ${alt.ProjPts.toFixed(1)}).`);
            } else if (projDiff <= -5.0) {
                prosForAlt.push(`<strong>Higher Total Season Projection:</strong> ${alt.Player} projects for <strong>+${Math.abs(projDiff).toFixed(1)} more season points</strong> (${alt.ProjPts.toFixed(1)} vs ${topPick.ProjPts.toFixed(1)}).`);
            }

            if (topPick.brokenTackles && alt.brokenTackles && (topPick.brokenTackles - alt.brokenTackles >= 3)) {
                consForAlt.push(`<strong>Elusiveness Edge:</strong> ${topPick.Player} logged <strong>${topPick.brokenTackles} broken tackles</strong> vs ${alt.Player}'s ${alt.brokenTackles}.`);
            } else if (alt.brokenTackles && topPick.brokenTackles && (alt.brokenTackles - topPick.brokenTackles >= 3)) {
                prosForAlt.push(`<strong>Elusiveness Edge:</strong> ${alt.Player} logged <strong>${alt.brokenTackles} broken tackles</strong> vs ${topPick.Player}'s ${topPick.brokenTackles}.`);
            }
        } else {
            // Cross-Position Tier Scarcity Comparison
            if (topTier.isLastInTier && (topTier.tierNum <= 3 || currentRound <= 8)) {
                const altTiers = State.getPositionalTiers(alt.Pos);
                let altSurvivingCount = 0;

                if (altTiers.length >= altTier.tierNum) {
                    let actualAltTierGroup = altTiers[altTier.tierNum - 1];
                    altSurvivingCount = actualAltTierGroup.filter(p => (p.adp || 0) > nextPick).length;
                }

                let survivalNote = altSurvivingCount > 0
                    ? `(with ~<strong>${altSurvivingCount}</strong> likely to reach your next pick at Pick ${nextPick})`
                    : `(though <strong>none</strong> are projected to survive to your next pick at Pick ${nextPick})`;

                let scarcityLabel = currentRound <= 6 ? `in ${topTier.tierName}` : `in the ${topTier.tierName} pool`;
                consForAlt.push(`<strong>Cross-Positional Scarcity:</strong> ${topPick.Player} is the <strong>LAST remaining option</strong> ${scarcityLabel}, whereas ${alt.Pos} has <strong>${altTier.remaining} option(s)</strong> available in ${altTier.tierName} ${survivalNote}.`);
            }
        }

        // -------------------------------------------------------------
        // 8. POSITION & STRATEGY SPECIFIC TRADE-OFFS
        // -------------------------------------------------------------
        if (alt.Pos === 'QB' && ['RB', 'WR'].includes(topPick.Pos) && currentRound <= 4) {
            consForAlt.push(`<strong>1-QB Opportunity Cost:</strong> Drafting a QB in Round ${currentRound} sacrifices elite ${topPick.Pos} positional scarcity when quality QBs remain available later.`);
        }

        // Fallbacks
        if (prosForAlt.length === 0) {
            // Surface standalone baseline metrics if the alternative has zero relative edges over topPick
            const pAge = alt.age || alt.Age;

            if (alt.Pos === 'RB' && alt.stats?.rushAtt >= 130) {
                prosForAlt.push(`<strong>Lead Workload Baseline:</strong> Projected for <strong>${alt.stats.rushAtt} carries</strong> (${alt.ProjPts.toFixed(1)} total points) as a primary backfield contributor.`);
            } else if (['WR', 'TE'].includes(alt.Pos) && alt.stats?.targets >= 70) {
                prosForAlt.push(`<strong>Established Target Volume:</strong> Projected for <strong>${alt.stats.targets} targets</strong> (${alt.ProjPts.toFixed(1)} total points) in the ${alt.Team} passing attack.`);
            } else if (alt.Pos === 'QB' && alt.ProjPts >= 300) {
                prosForAlt.push(`<strong>Starting QB Baseline:</strong> Projected for <strong>${alt.ProjPts.toFixed(1)} fantasy points</strong> (${(alt.ProjPts / 17).toFixed(1)} PPG) directing the ${alt.Team} offense.`);
            }

            if (pAge && pAge <= 23) {
                prosForAlt.push(`<strong>Youth & Durability Runway:</strong> Enters at age ${pAge} with fresh legs and low career workload wear.`);
            }

            if (alt.depthChart === 1) {
                prosForAlt.push(`<strong>Starting Depth Chart Role:</strong> Listed as the designated ${alt.Pos}1 on the ${alt.Team} depth chart.`);
            }

            if (prosForAlt.length === 0) {
                prosForAlt.push(`Offers functional ${alt.Pos} starting baseline capacity and depth.`);
            }
        }

        if (consForAlt.length === 0) {
            if (topPick.Pos === alt.Pos) {
                let vbdGap = ((topPick.AdvVBD || topPick.VBD) - (alt.AdvVBD || alt.VBD)).toFixed(1);
                if (parseFloat(vbdGap) > 0) {
                    consForAlt.push(`Leans ${topPick.Player} due to a slightly higher overall season projection (+${vbdGap} VBD edge).`);
                } else {
                    consForAlt.push(`Prioritizes ${topPick.Player}'s ceiling, advanced metrics, or optimal lineup fit over ${alt.Player}'s raw projection.`);
                }
            } else {
                let vbdGap = ((topPick.AdvVBD || topPick.VBD) - (alt.AdvVBD || alt.VBD)).toFixed(1);
                if (parseFloat(vbdGap) >= 5.0) {
                    consForAlt.push(`Significant Projection Advantage: ${topPick.Player} projects for far more baseline value (+${vbdGap} VBD edge) than ${alt.Player}.`);
                } else {
                    consForAlt.push(`Prioritizes ${topPick.Player}'s positional scarcity, draft capital urgency, and roster structural balance at ${topPick.Pos}.`);
                }
            }
        }

        return `
            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
                <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <h5 class="font-bold text-gray-900 flex items-center">
                        <span class="bg-gray-100 text-gray-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] mr-2">VS</span>
                        ${alt.Player} <span class="text-xs text-gray-400 font-normal ml-1">(${alt.Pos})</span>
                    </h5>
                    <span class="text-xs font-bold text-gray-500">${(alt.AdvVBD || alt.VBD).toFixed(1)} Adv VBD</span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Why draft the alt -->
                    <div>
                        <h6 class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 mb-1">Why pick ${alt.Player.split(' ').slice(1).join(' ') || alt.Player}?</h6>
                        <ul class="text-xs text-gray-700 space-y-1.5">
                            ${prosForAlt.map(p => `<li class="flex items-start"><span class="text-emerald-500 mr-1.5">•</span> <span>${p}</span></li>`).join('')}
                        </ul>
                    </div>
                    
                    <!-- Why we chose the top pick over them -->
                    <div>
                        <h6 class="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 mb-1">Why ${topPick.Player.split(' ').slice(1).join(' ') || topPick.Player} wins</h6>
                        <ul class="text-xs text-gray-700 space-y-1.5">
                            ${consForAlt.map(c => `<li class="flex items-start"><span class="text-rose-500 mr-1.5">•</span> <span>${c}</span></li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
};
