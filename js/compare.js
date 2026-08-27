window.Compare = {
    getTierDetails(player) {
        const tierNum = player.staticTier || 1;
        const tiers = State.getPositionalTiers(player.Pos);
        const availableInSameTier = State.availablePlayers.filter(p => p.Pos === player.Pos && (p.staticTier || 1) === tierNum);

        const tierNames = {
            1: `Tier 1 (Elite ${player.Pos})`,
            2: `Tier 2 (High-End ${player.Pos})`,
            3: `Tier 3 (Solid ${player.Pos})`,
            4: `Tier 4 (Low-End / High Flex)`,
            5: `Tier 5 (Premium Bench)`,
            6: `Tier 6 (Upside Flyers)`,
            7: `Tier 7 (Deep Stash)`
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
        const alternatives = recs.slice(1, 8); // Evaluates up to 8 total targets
        const userTeam = State.teamsById[State.userTeamId];
        const currentPickNum = State.currentPick + 1;
        
        let userFuturePicks = [];
        State.draftOrder.forEach((teamId, idx) => {
            if (idx >= State.currentPick && teamId === State.userTeamId) userFuturePicks.push(idx + 1);
        });

        let nextWindowPicks = [];
        for (let i = 0; i < userFuturePicks.length; i++) {
            let pick = userFuturePicks[i];
            if ((pick - currentPickNum) > 2) nextWindowPicks.push(pick);
        }
        let nextUserOverallPick = nextWindowPicks.length > 0 ? nextWindowPicks[0] : (currentPickNum + State.settings.numTeams);
        
        let html = `
            <div class="space-y-6">
                <!-- THE PRIMARY TARGET (Detailed Writeup) -->
                <div class="bg-white border border-indigo-100 p-5 rounded-2xl shadow-sm">
                    <div class="flex justify-between items-start mb-4 flex-wrap gap-2">
                        <div>
                            <span class="text-xs font-extrabold text-indigo-500 mb-1 block tracking-wide uppercase">Primary Recommendation</span>
                            <h3 class="text-2xl font-black text-slate-900 tracking-tight">${topPick.Player} 
                                <span class="text-sm font-semibold text-slate-500">(${topPick.Pos} • ${topPick.Team})</span>
                            </h3>
                        </div>
                        <div class="text-right">
                            <span class="block text-lg font-black text-indigo-700">${(topPick.AdvVBD || topPick.VBD).toFixed(1)} <span class="text-xs text-indigo-400 font-semibold">Adv VBD</span></span>
                            <span class="text-xs text-slate-500 font-medium">Proj: ${topPick.ProjPts.toFixed(1)} pts</span>
                        </div>
                    </div>
                    
                    <div class="text-sm leading-relaxed text-slate-700 mb-4">
                        <p>${this.generateMacroThoughtProcess(topPick, userTeam, nextUserOverallPick)}</p>
                    </div>

                    <div class="border-t border-slate-100 pt-3">
                        <h4 class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Supporting Analytical Profile</h4>
                        <ul class="space-y-2 text-xs text-slate-700">
                            ${this.generateTopPickHighlights(topPick, userTeam, nextUserOverallPick)}
                        </ul>
                    </div>
                </div>
                
                <div class="flex items-center gap-3">
                    <div class="h-px bg-slate-200 flex-1"></div>
                    <h4 class="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Head-to-Head Alternative Evaluations</h4>
                    <div class="h-px bg-slate-200 flex-1"></div>
                </div>
        `;

        alternatives.forEach((alt) => {
            html += this.generateHeadToHead(topPick, alt, userTeam, nextUserOverallPick);
        });

        html += `</div>`;
        UI.showMessage(`Strategic Draft Room Discussion`, html);
    },

    generateMacroThoughtProcess(p, team, nextPick) {
        let narrative = `The engine recommends prioritizing <strong>${p.Player}</strong> here. `;
        const tierInfo = this.getTierDetails(p);
        let posRoster = State.settings.roster[p.Pos];
        let isStarterNeeded = team.counts[p.Pos] < (posRoster ? posRoster.max : 1);
        
        let reasons = [];

        // 1. Lineup Value (+PPW) & Critical Bye-Week Plug
        if (p._byeFillWeek) {
            reasons.push(`he acts as a <strong>critical Week ${p._byeFillWeek} bye-week plug</strong>, insulating a major starting vacancy for an estimated <strong>+${p._byeFillPts.toFixed(1)} fill points</strong>`);
        } else if (isStarterNeeded) {
            reasons.push(`he fills an open starting ${p.Pos} slot, directly boosting your optimal weekly lineup by <strong>+${(p._addedPPW || 0).toFixed(2)} Points Per Week</strong>`);
        } else if (p._addedPPW && p._addedPPW >= 1.0) {
            reasons.push(`he forces his way into your starting Flex rotation, adding <strong>+${p._addedPPW.toFixed(2)} Points Per Week</strong> over your current starters`);
        }

        // 2. Positional Scarcity / Tiers
        if (tierInfo.isLastInTier && tierInfo.tierNum <= 4) {
            reasons.push(`he is the <strong>last remaining player in ${tierInfo.tierName}</strong>, preventing a steep positional cliff`);
        } 

        // 3. Market Urgency & Exact Survival Probability %
        if (p.adp && p._survivalProb !== undefined && p._survivalProb < 0.25) {
            let survPct = Math.round(p._survivalProb * 100);
            reasons.push(`board momentum indicates he has only a <strong>${survPct}% chance of reaching your next pick (#${nextPick})</strong>`);
        } else if (p.adp && (State.currentPick + 1) - p.adp >= 10) {
            reasons.push(`he is experiencing a notable draft-day slide past his ADP of ${p.adp.toFixed(0)}, offering substantial surplus draft capital`);
        }

        if (reasons.length === 0) {
            narrative += `He offers the highest synthesized blend of safety, median projection, and advanced metrics available.`;
        } else if (reasons.length === 1) {
            narrative += `Structurally, ${reasons[0]}.`;
        } else {
            narrative += `Structurally, ${reasons[0]}, and importantly, ${reasons[1]}.`;
        }

        return narrative;
    },

    generateTopPickHighlights(p, team, nextPick) {
        let highlights = [];

        // 1. Lineup Value (+PPW) & Bye-Week Coverage
        if (p._byeFillWeek) {
            highlights.push(`<li><strong class="text-amber-700">🔄 Critical Bye-Week Plug:</strong> Insulates a severe roster hole in Week ${p._byeFillWeek} (+${p._byeFillPts.toFixed(1)} fill points).</li>`);
        } else if (p._addedPPW >= 1.0 || (p._addedPPW > 0 && !p._byeFillWeek)) {
            highlights.push(`<li><strong class="text-emerald-700">⚡ Starting Lineup Maximizer:</strong> Directly increases your starting roster's projected weekly optimal output by <strong>+${p._addedPPW.toFixed(2)} Points Per Week</strong>.</li>`);
        }

        // 2. Market Urgency & Survival Probability
        if (p.adp) {
            if (p._survivalProb !== undefined && p._survivalProb < 0.20) {
                highlights.push(`<li><strong class="text-rose-700">🚨 High Draft Urgency:</strong> Has only a <strong>${Math.round(p._survivalProb * 100)}% chance</strong> to survive until your next pick (#${nextPick}). Draft him now or lose him.</li>`);
            } else if (p.adp < State.currentPick + 6) {
                highlights.push(`<li><strong class="text-rose-700">🚨 Immediate ADP Scarcity:</strong> Board momentum (ADP ${p.adp.toFixed(1)}) dictates he will not survive the turn.</li>`);
            }
        }

        // 3. Positional Need & Lineup Slotting
        let posRoster = State.settings.roster[p.Pos];
        let isStarterNeeded = team.counts[p.Pos] < (posRoster ? posRoster.max : 1);
        if (isStarterNeeded) {
            highlights.push(`<li><strong class="text-indigo-700">📋 Core Starter Requirement:</strong> Secures an essential open starter slot at <strong>${p.Pos}</strong> before viable talent drops into replacement tiers.</li>`);
        }

        // 4. Stacking & Handcuff Insurance / Lottery Tickets
        if (p._stackPartner) {
            highlights.push(`<li><strong class="text-purple-700">⚡ Stacking Multiplier:</strong> Correlates directly with your roster's QB (${p._stackPartner}) for week-winning ceiling outcomes.</li>`);
        }
        let userOwnsStarter = p.starterName && team.roster.some(r => r._cleanName === State.normalizeName(p.starterName));
        if (userOwnsStarter) {
            highlights.push(`<li><strong class="text-blue-700">🔒 Roster Security Handcuff:</strong> Protects your investment in ${p.starterName} by securing his direct handcuff.</li>`);
        } else if (p.isRBHandcuff) {
            highlights.push(`<li><strong class="text-emerald-700">🚀 League-Winning Upside:</strong> An elite bench stash who would inherit a massive role if ${p.starterName || 'the starter'} misses time.</li>`);
        }

        // 5. Volume / Ceiling, Flyers & Breakout Stashes
        if (p._isFlyer && p.upsideScore) {
            highlights.push(`<li><strong class="text-rose-700">💥 Elite Ceiling:</strong> Provides league-winning upside metrics (Upside Score: ${(p.upsideScore).toFixed(1)}).</li>`);
        } else if (p.targetShare && p.targetShare >= 20.0) {
            highlights.push(`<li><strong class="text-blue-700">🎯 Volume Security:</strong> Commands a massive ${p.targetShare}% of his team's targets, insulating him from negative game scripts.</li>`);
        }

        // 6. Off-Season Scheme Upgrades
        if (p.isTeamChanger && p._envDelta && p._envDelta >= 0.015) {
            let note = ['WR', 'TE'].includes(p.Pos) ? "significantly higher QB on-target accuracy and pocket protection" : "a superior run-blocking offensive line (YBC/Att)";
            highlights.push(`<li><strong class="text-emerald-700">🔄 Lucrative Scheme Upgrade:</strong> Move from ${p.pastTeam} to ${p.Team} lands him in ${note}, projecting an efficiency surge.</li>`);
        }

        // 7. Expected Touchdown (xTD) Positive Regression
        if (p._positiveTdRegression && p.xTD !== undefined && p.pastStats?.totalTd !== undefined) {
            let diff = p.xTD - p.pastStats.totalTd;
            highlights.push(`<li><strong class="text-emerald-700">📈 Positive Touchdown Regression:</strong> Scored ${p.pastStats.totalTd} TDs last year, but red-zone usage warranted <strong>${p.xTD.toFixed(1)} Expected TDs (xTD)</strong> (~+${Math.round(diff)} projected rebound).</li>`);
        }

        // 8. Comprehensive Running Back Archetypes
        if (p.Pos === 'RB') {
            if (p._rbArchetype === 'Bellcow Alpha') {
                highlights.push(`<li><strong class="text-emerald-700">👑 Three-Down Bellcow Alpha:</strong> Uncontested lead back commanding <strong>${p.hvo || 65}+ High-Value Touches</strong> and complete snap monopoly.</li>`);
            } else if (p._rbArchetype === '1B Co-Starter') {
                highlights.push(`<li><strong class="text-indigo-700">⚔️ Designed 1B Co-Starter:</strong> Commands guaranteed weekly volume (${p.stats?.rushAtt || 0} carries / ${p.stats?.targets || 0} tgts), providing a Flex floor with RB1 contingent upside.</li>`);
            } else if (p._rbArchetype === 'High-Leverage Space Back') {
                highlights.push(`<li><strong class="text-blue-700">🎯 High-Leverage Space Creator:</strong> Script-proof receiver out of the backfield (${p.targetShare || 13}% target share) with an elite PPR floor.</li>`);
            } else if (p._rbArchetype === 'Explosive Chunk Slasher') {
                highlights.push(`<li><strong class="text-emerald-700">💥 Explosive Chunk Slasher:</strong> Generates independent chunk plays with elite <strong>${p.yacAtt || '3.4'} Yards After Contact</strong> and high burst.</li>`);
            } else if (p._rbArchetype === '1A Early-Down Hammer') {
                highlights.push(`<li><strong class="text-amber-700">🔨 Early-Down Power Hammer:</strong> Monopolizes short-yardage and goal-line work for high touchdown equity.</li>`);
            }
        }

        // 9. WR & TE Archetypes
        if (p.Pos === 'WR') {
            if (p._wrArchetype === 'Alpha Target Funnel') {
                highlights.push(`<li><strong class="text-blue-700">👑 Dominant Alpha WR1:</strong> Commands a massive <strong>${p.targetShare}% target share</strong> (${p.wopr ? p.wopr.toFixed(2) + ' WOPR' : 'Alpha WOPR'}), immunizing him from bracket coverage.</li>`);
            } else if (p._wrArchetype === 'High-Volume Slot Magnet') {
                highlights.push(`<li><strong class="text-indigo-700">📡 High-Volume Slot Engine:</strong> Highly efficient chain-mover (${p.aDOT} aDOT, ${p.trueCatchRate?.toFixed(1)}% Catch Rate) guaranteeing a high-floor PPR baseline.</li>`);
            } else if (p._wrArchetype === 'Vertical Spike-Week Weapon') {
                highlights.push(`<li><strong class="text-rose-700">🚀 Field-Tilting Deep Weapon:</strong> Generates slate-breaking splash plays with an elite <strong>${p.aDOT} aDOT</strong>.</li>`);
            }
        } else if (p.Pos === 'TE') {
            if (p._teArchetype === 'Detached Alpha "Big Slot"') {
                highlights.push(`<li><strong class="text-purple-700">🦄 Detached Alpha TE Weapon:</strong> Runs routes from wide/slot alignments as a primary team receiver, bypassing the streaming pack.</li>`);
            }
        }

        // 10. QB Rushing Floor & Escapability
        if (p.Pos === 'QB') {
            const rushYds = p.stats?.rushYds || 0;
            if (p._qbArchetype === 'Konami Code Alpha' || rushYds >= 650) {
                highlights.push(`<li><strong class="text-amber-700">🏃 Konami Code Alpha Floor:</strong> Projected for <strong>${rushYds} rush yards</strong>, creating an elite baseline that pocket passers cannot match.</li>`);
            } else if (p._qbArchetype === 'Dynamic Dual-Threat' || rushYds >= 425) {
                highlights.push(`<li><strong class="text-amber-700">🏃 Dynamic Dual-Threat:</strong> Projected for <strong>${rushYds} rushing yards</strong> of weekly insulation.</li>`);
            }
            if (p.p2s && p.p2s <= 14.0) {
                highlights.push(`<li><strong class="text-emerald-700">🛡️ Elite Pocket Escapability:</strong> Low ${p.p2s.toFixed(1)}% Pressure-to-Sack rate proves he actively converts collapsing pockets into positive plays.</li>`);
            }
        }

        // 11. Advanced Additions (Multi-Year, Synergy, Healthy PPG, Vacated)
        if (p._isProvenMultiYearAlpha) {
            highlights.push(`<li><strong class="text-indigo-700">⭐ Multi-Year Alpha Command:</strong> Has sustained a 24%+ target share across consecutive campaigns rather than relying on a 1-year projection spike.</li>`);
        }
        if (p._deepRoutePocketSynergy) {
            highlights.push(`<li><strong class="text-emerald-700">🎯 Deep Route / Pocket Synergy:</strong> Vertical route tree (${p.aDOT} aDOT) pairs with over 2.5s of pocket protection to let deep concepts develop.</li>`);
        }
        if (p._healthyPpg && p._healthyPpg >= ((p.ProjPts || 0) / 17) + 2.0) {
            highlights.push(`<li><strong class="text-emerald-700">🏥 Hidden Healthy PPG Edge:</strong> While season totals reflect projected missed games, his underlying <strong>${p._healthyPpg.toFixed(1)} Healthy PPG</strong> paces like an elite starter when active.</li>`);
        }
        if (p._vacatedTgts && p._vacatedTgts >= 50) {
            highlights.push(`<li><strong class="text-indigo-700">📦 Vacated Opportunity:</strong> Inherits <strong>+${p._vacatedTgts} vacated targets</strong> from offseason departures.</li>`);
        }

        if (highlights.length === 0) {
            highlights.push(`<li><strong class="text-slate-600">📊 Best Available Value:</strong> Highest synthesized VBD projection remaining on the board.</li>`);
        }

        return highlights.join('');
    },

    generateHeadToHead(topPick, alt, team, nextPick) {
        let topVBD = topPick.AdvVBD || topPick.VBD || 0;
        let altVBD = alt.AdvVBD || alt.VBD || 0;
        let vbdGap = topVBD - altVBD;
        let isTossUp = vbdGap <= 3.5; 
        
        const altPosLimit = (State.settings.roster[alt.Pos]?.max || 2);
        const topPosLimit = (State.settings.roster[topPick.Pos]?.max || 2);
        const isAltStarterNeeded = (team.counts[alt.Pos] || 0) < altPosLimit;
        const isTopStarterNeeded = (team.counts[topPick.Pos] || 0) < topPosLimit;

        // Team Environments
        let topTeam = State.normalizeTeam(topPick.Team);
        let altTeam = State.normalizeTeam(alt.Team);
        let topRush = State.teamAdvRush?.[topTeam];
        let altRush = State.teamAdvRush?.[altTeam];
        let topPass = State.teamAdvPass?.[topTeam];
        let altPass = State.teamAdvPass?.[altTeam];

        // Early Schedule Calculation (Weeks 1-4)
        let topEarlySos = 0, topWeeks = 0;
        [1, 2, 3, 4].forEach(w => {
            if (topPick.sosWeeks?.[`W${w}`] && topPick.sosWeeks[`W${w}`] !== 'BYE') {
                topEarlySos += Number(topPick.sosWeeks[`W${w}`]);
                topWeeks++;
            }
        });
        topEarlySos = topWeeks > 0 ? topEarlySos / topWeeks : 3.0;

        let altEarlySos = 0, altWeeks = 0;
        [1, 2, 3, 4].forEach(w => {
            if (alt.sosWeeks?.[`W${w}`] && alt.sosWeeks[`W${w}`] !== 'BYE') {
                altEarlySos += Number(alt.sosWeeks[`W${w}`]);
                altWeeks++;
            }
        });
        altEarlySos = altWeeks > 0 ? altEarlySos / altWeeks : 3.0;

        // =========================================================
        // 1. THE ANALYST'S TAKE (Macro Context)
        // =========================================================
        let analystTake = "";
        if (isTossUp) {
            analystTake = `The margins here are incredibly thin. Both players offer nearly identical mathematical value at this stage of the draft, making this a true preference play. The engine leans slightly toward ${topPick.Player}, but pivoting to ${alt.Player} is equally sound depending on your specific roster construction.`;
        } else if (vbdGap >= 12.0) {
            analystTake = `${topPick.Player} belongs in a different tier of projected value. While ${alt.Player} is a fine player, bypassing ${topPick.Player} here means leaving a significant amount of baseline points on the table (-${vbdGap.toFixed(1)} VBD gap).`;
        } else if (vbdGap >= 7.0) {
            analystTake = `The math noticeably favors ${topPick.Player}. Unless you have a desperate positional need or firmly believe in a breakout, the baseline value gap makes ${topPick.Player} the safer investment.`;
        } else {
            if (topPick.Pos !== alt.Pos) {
                if (!isAltStarterNeeded && isTopStarterNeeded) {
                    analystTake = `While ${alt.Player} brings great upside, your ${alt.Pos} room is already well-stocked. ${topPick.Player} gets the nod here because he addresses a more urgent starting need for your lineup.`;
                } else {
                    analystTake = `${topPick.Player} gets a slight edge because his projected volume and lineup fit offer slightly more structural stability than ${alt.Player}.`;
                }
            } else {
                let topTier = this.getTierDetails(topPick);
                let altTier = this.getTierDetails(alt);
                if (topTier.tierNum < altTier.tierNum) {
                    analystTake = `${topPick.Player} resides in a higher overall tier (${topTier.tierName}) than ${alt.Player} (${altTier.tierName}), insulating him against floor-level risk.`;
                } else {
                    analystTake = `Both players are in the same positional tier, but ${topPick.Player} edges out ${alt.Player} due to a slightly better combination of expected volume and offensive environment.`;
                }
            }
        }

        // =========================================================
        // 2. THE CASE FOR THE TOP PICK (Defending the Choice)
        // =========================================================
        let topCase = [];
        
        // Structural & Lineup
        if (topPick.Pos !== alt.Pos && isTopStarterNeeded && !isAltStarterNeeded) {
            topCase.push(`Addresses an immediate starting need at ${topPick.Pos}, whereas ${alt.Player} would likely begin as a bench or rotational player.`);
        }
        if (vbdGap > 5.0) {
            topCase.push(`Carries a noticeably safer baseline projection (+${vbdGap.toFixed(1)} VBD).`);
        }

        // Floor / Volatility / TD Regression
        if (topPick.boomBust && alt.boomBust && topPick.boomBust.bust < alt.boomBust.bust - 8.0) {
            topCase.push(`Offers a much safer weekly floor; he busted in only ${topPick.boomBust.bust}% of games last year compared to a volatile ${alt.boomBust.bust}% for ${alt.Player}.`);
        }
        if (topPick._positiveTdRegression && alt._isFlukeTDScorer) {
            topCase.push(`Primed for positive touchdown regression based on red-zone touch volume, whereas ${alt.Player}'s scoring rate last year was mathematically unsustainable.`);
        }

        // Trench & Offensive Line Quality
        if (topPick.olTier === 'S' || (topPick.olTier === 'A' && ['D', 'F'].includes(alt.olTier))) {
            topCase.push(`Benefits from elite trench play behind a Tier ${topPick.olTier} offensive line, while ${alt.Player} faces severe blocking concerns.`);
        }

        // Efficiency (YPT / True Catch / Drops)
        if (topPick.ypt && alt.ypt && topPick.ypt >= alt.ypt + 2.0 && (topPick.targetShare || 0) >= 16) {
            topCase.push(`Generates far more yardage per look (${topPick.ypt.toFixed(1)} vs ${alt.ypt.toFixed(1)} YPT), maximizing his opportunities rather than relying on empty volume.`);
        }
        if (topPick.trueCatchRate && alt.dropRate && topPick.trueCatchRate >= 90.0 && alt.dropRate >= 8.0) {
            topCase.push(`Displays elite hands (${topPick.trueCatchRate.toFixed(1)}% catch rate on catchable balls), while ${alt.Player} has struggled with drive-killing drops (${alt.dropRate.toFixed(1)}% drop rate).`);
        }

        // RB Specific Clashes
        if (topPick.Pos === 'RB' && alt.Pos === 'RB') {
            if (topPick._rbArchetype === 'Bellcow Alpha' && alt._rbArchetype !== 'Bellcow Alpha') {
                topCase.push(`Operates as a true three-down bellcow, insulating his floor with guaranteed volume that ${alt.Player} lacks in a ${alt._rbArchetype || 'shared'} role.`);
            } else if (topPick.hvo && alt.hvo && topPick.hvo > alt.hvo + 15) {
                topCase.push(`Commands significantly more High-Value Opportunities (${topPick.hvo} vs ${alt.hvo} HVO), which are the primary driver of elite RB scoring.`);
            } else if (topPick._inheritsGoalLineWork && !alt._inheritsGoalLineWork) {
                topCase.push(`Inherits massive vacated goal-line work from offseason departures, unlocking a touchdown ceiling that ${alt.Player} doesn't have.`);
            }
            if (alt._isSystemDependentRB && topPick._isIndependentYACCreator) {
                topCase.push(`Creates his own yardage after contact (${topPick.yacAtt?.toFixed(1)} YAC), whereas ${alt.Player}'s historical production was heavily propped up by system blocking lanes.`);
            }
            if (topPick.err && alt.err && topPick.err >= alt.err + 1.8) {
                topCase.push(`Possesses superior big-play burst with a ${topPick.err.toFixed(1)}% Explosive Run Rate compared to ${alt.Player}'s ${alt.err.toFixed(1)}% mark.`);
            }
            if (State.scoring.ppr === 0 && (topPick.stats?.rushAtt || 0) > (alt.stats?.rushAtt || 0) + 40) {
                topCase.push(`In Standard (Non-PPR) scoring, his heavy carry volume (${Math.round(topPick.stats.rushAtt)} proj carries) is vastly more valuable than ${alt.Player}'s catch-dependent profile.`);
            }
            if (topPick.bmi && topPick.bmi >= 31.0 && alt.weight && parseInt(alt.weight, 10) < 200) {
                topCase.push(`Carries a prototypical workhorse frame (${topPick.weight} lbs, ${topPick.bmi.toFixed(1)} BMI) built to absorb full-season contact, while ${alt.Player}'s lighter build carries durability concerns.`);
            }
            if (alt._rb3ThreatNote) {
                topCase.push(`Has a clean grasp on backfield volume, while ${alt.Player}'s touch ceiling is actively threatened by multiple rotational backs.`);
            }
        }
        
        // WR/TE Specific Clashes
        if (['WR', 'TE'].includes(topPick.Pos) && ['WR', 'TE'].includes(alt.Pos)) {
            if ((topPick.targetShare || 0) > (alt.targetShare || 0) + 6.0) {
                topCase.push(`Commands a significantly larger slice of his team's passing attack (${topPick.targetShare}% vs ${alt.targetShare || 0}%).`);
            } else if (topPick.wopr && alt.wopr && topPick.wopr > alt.wopr + 0.15) {
                topCase.push(`Dominates his team's passing tree with an elite ${topPick.wopr.toFixed(2)} WOPR, guaranteeing a safer target floor.`);
            } else if (topPick._passingTreeType === 'Concentrated 2-Man Funnel' && alt._passingTreeType !== 'Concentrated 2-Man Funnel') {
                topCase.push(`Operates in a highly concentrated passing attack, avoiding the target-share volatility that ${alt.Player} faces in a crowded receiver room.`);
            }
            if (topPick._isProvenMultiYearAlpha && !alt._isProvenMultiYearAlpha) {
                topCase.push(`Brings a verified multi-year track record of commanding high-volume target share, carrying far less projection risk than ${alt.Player}.`);
            }
            if (topPick.Pos === 'TE' && alt._teCommitteeThreat) {
                topCase.push(`Commands complete route participation, whereas ${alt.Player} splits routes in heavy 12-personnel formations with a capable secondary tight end.`);
            }
            if (topPick.Pos === 'WR' && alt._targetCompressionRisk) {
                topCase.push(`Operates as the clear focal point of his offense, avoiding the target-cannibalization that ${alt.Player} faces alongside another elite teammate.`);
            }
        }

        // Format & Scoring Rules
        if ((State.scoring.tePremium || 0) > 0 && topPick.Pos === 'TE' && ['WR', 'RB'].includes(alt.Pos)) {
            topCase.push(`Capitalizes directly on your league's TE-Premium rule (+${State.scoring.tePremium} pts/rec), mathematically elevating his receptions above standard skill-position scoring.`);
        }

        // QB Specific Clashes
        if (topPick.Pos === 'QB' && alt.Pos === 'QB') {
            if (topPick.p2s && alt.p2s && topPick.p2s < alt.p2s - 8.0) {
                topCase.push(`Possesses far superior pocket escapability, converting pressure into positive plays rather than taking the drive-killing sacks that plague ${alt.Player}.`);
            }
            if ((topPick._eliteWeaponCount || 0) > (alt._eliteWeaponCount || 0)) {
                topCase.push(`Operates with a much stronger pass-catching arsenal (${topPick._eliteWeaponCount} elite separators), allowing him to sustain drives and red-zone efficiency better than ${alt.Player}.`);
            }
            if (alt._shortLeashRisk && !topPick._shortLeashRisk) {
                topCase.push(`Enjoys total job security as an uncontested franchise starter, whereas ${alt.Player} carries in-season benching risk with a high-pedigree backup behind him.`);
            }
        }

        // Environmental Disparity (YBC)
        if (topPick.Pos === 'RB' && alt.Pos === 'RB' && topRush?.ybcAtt && altRush?.ybcAtt) {
            if (topRush.ybcAtt >= altRush.ybcAtt + 0.5) {
                topCase.push(`Runs behind a significantly more dominant run-blocking unit, getting ${topRush.ybcAtt.toFixed(1)} Yards Before Contact per attempt vs just ${altRush.ybcAtt.toFixed(1)} for ${alt.Player}.`);
            }
        }

        // Schedule & Health
        if (topEarlySos >= 3.6 && altEarlySos <= 2.5) {
            topCase.push(`Enjoys a soft opening schedule (⭐${topEarlySos.toFixed(1)} SOS in Wks 1–4), providing immediate starting production while ${alt.Player} navigates a difficult early gauntlet.`);
        }
        if (topPick._isFullyCleared && alt._isMajorReturn) {
            topCase.push(`Enters the season with 100% health, whereas ${alt.Player} is returning from a major procedure and may see managed snap counts early on.`);
        }
        if (alt.byeWeek && alt.byeWeek !== 'N/A') {
            let sameByeCount = team.roster.filter(r => String(r.byeWeek) === String(alt.byeWeek)).length;
            if (sameByeCount >= 3) {
                topCase.push(`Drafting him avoids creating a severe Week ${alt.byeWeek} bye-week hole (${sameByeCount} of your players are already off that week).`);
            }
        }
        if (topPick.floorPpg && alt.floorPpg && topPick.floorPpg >= alt.floorPpg + 2.5) {
            topCase.push(`Establishes a rock-solid floor (${topPick.floorPpg.toFixed(1)} Floor PPG vs ${alt.floorPpg.toFixed(1)} for ${alt.Player}), giving you reliable weekly output without dud risk.`);
        }
        if (topPick.nflDraftPick && topPick.nflDraftPick <= 32 && alt.draftRound && alt.draftRound >= 4) {
            topCase.push(`Backed by 1st-round NFL draft capital and long-term organizational commitment, securing him a much longer leash during slumps than ${alt.Player}.`);
        }

        if (topCase.length === 0) topCase.push(`Provides a slightly better overall blend of usage metrics and matchup stability.`);

        // =========================================================
        // 3. THE CASE FOR THE ALTERNATIVE (When to Pivot)
        // =========================================================
        let altCase = [];
        
        // Positional & Scarcity Pivots
        if (topPick.Pos !== alt.Pos && isAltStarterNeeded) {
            altCase.push(`<strong>Positional Priority:</strong> If securing your starting ${alt.Pos} slot feels more urgent to you right now than taking the raw value at ${topPick.Pos}.`);
        }
        const altTier = this.getTierDetails(alt);
        const topTier = this.getTierDetails(topPick);
        if (altTier.isLastInTier && altTier.tierNum <= 4 && !topTier.isLastInTier) {
            altCase.push(`<strong>Positional Scarcity:</strong> ${alt.Player} is the LAST remaining player in ${altTier.tierName}. The ${topPick.Pos} board is deeper, allowing you to wait.`);
        }

        // Correlation & Roster Insurance
        if (alt._stackPartner) {
            altCase.push(`<strong>Correlation Stacking:</strong> You want to complete the ${alt.Team} passing stack with ${alt._stackPartner}, exponentially raising your weekly ceiling.`);
        }
        let userOwnsAltStarter = alt.starterName && team.roster.some(r => r._cleanName === State.normalizeName(alt.starterName));
        if (userOwnsAltStarter) {
            altCase.push(`<strong>Roster Insurance:</strong> He is the direct handcuff to your starter (${alt.starterName}), securing your backfield from injury risk.`);
        }

        // Deep RB Nuance
        if (alt.Pos === 'RB' && topPick.Pos === 'RB') {
            if ((alt.targetShare || 0) > (topPick.targetShare || 0) + 5.0 && State.scoring.ppr >= 0.5) {
                altCase.push(`<strong>PPR Scoring Rules:</strong> You want to heavily exploit PPR scoring, as ${alt.Player} commands elite pass-catching volume compared to ${topPick.Player}'s ground-heavy role.`);
            } else if (alt._isGoalLineHammer && !topPick._isGoalLineHammer) {
                altCase.push(`<strong>Touchdown Equity:</strong> You prefer a back who monopolizes high-leverage goal-line carries over a between-the-20s grinder.`);
            } else if (alt.yacAtt && topPick.yacAtt && alt.yacAtt > topPick.yacAtt + 0.5) {
                altCase.push(`<strong>Independent Creator:</strong> You trust ${alt.Player}'s elite tackle-breaking ability (${alt.yacAtt.toFixed(1)} YAC/Att) over ${topPick.Player}'s scheme dependence.`);
            } else if (alt._isAscendingRole && !topPick._isAscendingRole) {
                altCase.push(`<strong>Breakout Trajectory:</strong> You are betting on ${alt.Player}'s rapidly expanding mid-season role over ${topPick.Player}'s static workload.`);
            }
            if (alt._inheritsGoalLineWork && !topPick._inheritsGoalLineWork) {
                altCase.push(`<strong>Goal-Line Monopoly:</strong> He inherits vacated short-yardage carries from departed personnel, giving him direct multi-touchdown upside.`);
            }
            if (alt.speedScore && alt.speedScore >= 110.0 && (!topPick.speedScore || alt.speedScore > topPick.speedScore + 8.0)) {
                altCase.push(`<strong>Elite Athletic Profile:</strong> Boasts a rare ${alt.speedScore} Speed Score (${alt.fortyTime}s at ${alt.weight} lbs), giving him breakaway home-run gear.`);
            }
            if (altRush?.ybcAtt && topRush?.ybcAtt && altRush.ybcAtt >= topRush.ybcAtt + 0.4) {
                altCase.push(`<strong>Superior Blocking Lanes:</strong> His offensive line creates ${altRush.ybcAtt.toFixed(1)} Yards Before Contact per carry, allowing him to reach the second level cleanly.`);
            }
        } 
        
        // Deep WR/TE Nuance
        else if (['WR', 'TE'].includes(alt.Pos) && ['WR', 'TE'].includes(topPick.Pos)) {
            if (alt._isShortAdotOperator && topPick._isSpikeWeekWeapon && State.scoring.ppr >= 0.5) {
                altCase.push(`<strong>PPR Consistency:</strong> You want to avoid weekly volatility and prefer a safe, high-volume underneath chain-mover over a boom/bust deep threat.`);
            } else if (alt._isSpikeWeekWeapon && topPick._isShortAdotOperator) {
                altCase.push(`<strong>Slate-Breaking Ceiling:</strong> You need ceiling and are willing to trade target consistency for ${alt.Player}'s massive depth-of-target (${alt.aDOT} aDOT) and splash-play upside.`);
            } else if (alt._vacatedTgts && alt._vacatedTgts >= 60 && (!topPick._vacatedTgts || topPick._vacatedTgts < 30)) {
                altCase.push(`<strong>Vacated Volume:</strong> You are betting on ${alt.Player} absorbing the massive +${alt._vacatedTgts} targets vacated by his team's offseason departures.`);
            }
            if (alt.unrealizedAirYards && alt.unrealizedAirYards >= 600 && alt.racr && alt.racr < 0.70) {
                altCase.push(`<strong>Unrealized Air Yards:</strong> ${alt.Player} is sitting on ${alt.unrealizedAirYards} unrealized air yards with an artificially low ${alt.racr.toFixed(2)} RACR; positive conversion regression gives him huge breakout upside.`);
            }
            if (alt.tps && alt.tps >= 0.22 && (!topPick.tps || alt.tps > topPick.tps + 0.04)) {
                altCase.push(`<strong>Elite Route Separation:</strong> He commands targets on ${(alt.tps * 100).toFixed(1)}% of his snaps (TPS), proving his individual separation skills create independent looks.`);
            }
            if (alt.Pos === 'WR' && alt.height && alt.weight && parseInt(alt.weight, 10) >= 215 && (topPick.weight || 200) < 190) {
                altCase.push(`<strong>Red-Zone Box-Out Frame:</strong> Offers imposing boundary size (${alt.height}, ${alt.weight} lbs) that creates natural mismatch and touchdown leverage near the goal line.`);
            }
            if (alt.Pos === 'TE' && topPick.Pos === 'TE' && alt._teArchetype === 'Detached Alpha "Big Slot"' && topPick._teArchetype !== 'Detached Alpha "Big Slot"') {
                altCase.push(`<strong>Hybrid Slot Alignment:</strong> He runs routes detached from the line like a wide receiver, avoiding the inline blocking responsibilities that cap ${topPick.Player}'s route participation.`);
            }
        }

        // Format & Scoring Rules
        if ((State.scoring.tePremium || 0) > 0 && alt.Pos === 'TE' && ['WR', 'RB'].includes(topPick.Pos)) {
            altCase.push(`<strong>TE-Premium Arbitrage:</strong> In this format (+${State.scoring.tePremium} TE bonus), ${alt.Player}'s target volume scales with premium value, giving him an structural edge over standard flex options.`);
        }
        if (State.scoring.useMilestones && alt._isSpikeWeekWeapon && !topPick._isSpikeWeekWeapon) {
            altCase.push(`<strong>Milestone Hunter:</strong> His vertical profile (${alt.aDOT} aDOT) makes him far more likely to trigger your league's 100-yard and 20+ yard bonus thresholds for slate-breaking scores.`);
        }

        // Deep QB Nuance
        if (alt.Pos === 'QB' && topPick.Pos === 'QB') {
            if (alt.stats?.rushYds && topPick.stats?.rushYds && alt.stats.rushYds > topPick.stats.rushYds + 200) {
                altCase.push(`<strong>Konami Code Upside:</strong> You want to chase the elite dual-threat rushing floor that ${alt.Player} provides over a traditional pocket passer.`);
            }
            if (altPass?.rpoPlays && altPass.rpoPlays >= 75) {
                altCase.push(`<strong>RPO Scheme Engine:</strong> Operates in a heavy RPO offense (${altPass.rpoPlays} RPO designs) that freezes second-level defenders and creates wide-open passing lanes.`);
            }
        }

        // Scheme & Matchup Nuance
        if (['WR', 'TE'].includes(alt.Pos) && altPass?.playActionYds >= 950 && (topPass?.playActionYds || 0) < 700) {
            altCase.push(`<strong>Play-Action Scheme Boost:</strong> He plays in a scheme generating ${altPass.playActionYds} passing yards off play-action, creating wide-open chunk targets.`);
        }
        if (alt._garbageTimeInsulated && !topPick._garbageTimeInsulated) {
            altCase.push(`<strong>Garbage-Time Equity:</strong> His underneath target role provides built-in script insulation, keeping his PPR floor active even when his team is trailing in negative game scripts.`);
        }
        if (alt.playoffSOS && topPick.playoffSOS && alt.playoffSOS >= topPick.playoffSOS + 0.5) {
            altCase.push(`<strong>Championship Schedule:</strong> He enjoys a significantly softer matchup slate during the fantasy playoffs (⭐${alt.playoffSOS.toFixed(1)} vs ⭐${topPick.playoffSOS.toFixed(1)} SOS in Weeks 15–17).`);
        }
        if (topPick._coldWeatherRisk && !alt._coldWeatherRisk) {
            altCase.push(`<strong>Climate-Controlled Schedule:</strong> He avoids the severe cold-weather December matchups that could drag down ${topPick.Player}'s late-season passing/kicking environment.`);
        }
        if (altEarlySos >= 3.6 && topEarlySos <= 2.6) {
            altCase.push(`<strong>Fast-Start Schedule:</strong> He steps into a favorable opening month (⭐${altEarlySos.toFixed(1)} SOS in Weeks 1–4), giving your starting lineup an immediate early-season boost.`);
        }
        if (alt._healthyPpg && alt.Min_Missed_26 > 0 && alt._healthyPpg > ((topPick.ProjPts || 0) / 17)) {
            altCase.push(`<strong>Per-Game Dominance:</strong> If you have early-season roster depth, his ${alt._healthyPpg.toFixed(1)} Healthy PPG provides elite, championship-winning production the moment he returns.`);
        }
        if (alt._isSuspended) {
            altCase.push(`<strong>Playoff Freshness:</strong> While he misses early games, he will return with full health and fresh legs for the stretch run and fantasy playoffs.`);
        }

        // Market / Macro Pivots
        if (alt.adp && alt.adp < currentPickNum - 10) {
            altCase.push(`<strong>Draft Value Slide:</strong> ${alt.Player} has fallen noticeably past his ADP (${alt.adp.toFixed(0)}), and you want to catch the falling value.`);
        }
        if (alt.age && topPick.age && alt.age <= 23 && topPick.age >= 28) {
            altCase.push(`<strong>Youth & Fresh Legs:</strong> You want to avoid the looming age cliff of ${topPick.Player} and bet on the ascending physical prime of ${alt.Player}.`);
        }
        if (alt.ceilingPpg && topPick.ceilingPpg && alt.ceilingPpg >= topPick.ceilingPpg + 3.0) {
            altCase.push(`<strong>Slate-Breaking Ceiling:</strong> In maximum-efficiency scenarios, his ceiling reaches ${alt.ceilingPpg.toFixed(1)} PPG, offering the week-winning upside that ${topPick.Player} lacks.`);
        }
        let altUpside = alt.upsideScore || altVBD;
        let topUpside = topPick.upsideScore || topVBD;
        if (altUpside > topUpside + 6.0) {
            altCase.push(`<strong>Swinging for the Fences:</strong> ${alt.Player} possesses mathematical, week-winning upside that ${topPick.Player} currently lacks.`);
        }

        if (altCase.length === 0) {
            altCase.push(`You simply prefer ${alt.Player}'s offensive environment, scheme fit, and talent profile.`);
        }

        return `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-5">
                <!-- HEADER -->
                <div class="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
                    <h5 class="font-black text-slate-900 text-lg">
                        ${alt.Player} <span class="text-sm text-slate-500 font-semibold ml-1">(${alt.Pos} • ${alt.Team})</span>
                    </h5>
                </div>
                
                <!-- THE ANALYST'S TAKE -->
                <div class="mb-5">
                    <h6 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">The Analyst's Take</h6>
                    <p class="text-sm text-slate-700 leading-relaxed">${analystTake}</p>
                </div>
                
                <!-- PROS AND CONS DISCUSSION -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <h6 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                            <span class="text-indigo-500">🛡️</span> The Case for ${topPick.Player.split(' ').slice(-1)[0]}
                        </h6>
                        <ul class="text-xs text-slate-600 space-y-2">
                            ${topCase.slice(0, 3).map(c => `<li class="flex items-start"><span class="text-indigo-400 mr-2 font-black">•</span> <span class="leading-snug">${c}</span></li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <h6 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                            <span class="text-emerald-500">🔄</span> Why Pivot to ${alt.Player.split(' ').slice(-1)[0]}?
                        </h6>
                        <ul class="text-xs text-slate-600 space-y-2">
                            ${altCase.slice(0, 3).map(c => `<li class="flex items-start"><span class="text-emerald-400 mr-2 font-black">•</span> <span class="leading-snug">${c}</span></li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
};
