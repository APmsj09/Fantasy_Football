window.Compare = {
    getTierDetails(player) {
        const avail = State.availablePlayers.filter(p => p.Pos === player.Pos);
        if (!avail.length) return { tierNum: 1, tierName: 'Depth', remaining: 1, isLastInTier: true, gapToNext: '0.0' };

        // Dynamic drop threshold: Scales down automatically as VBD values decrease in deep rounds
        const topVal = Math.max(8.0, avail[0].AdvVBD || avail[0].VBD || 8.0);
        const dropThreshold = Math.max(2.0, Math.min(9.5, topVal * 0.18));

        let tierNum = 1;
        let tierPlayers = [];
        let currentTier = [];
        let gapToNext = 0;

        for (let i = 0; i < avail.length; i++) {
            let p = avail[i];
            if (i > 0) {
                let prevVal = avail[i - 1].AdvVBD || avail[i - 1].VBD;
                let currVal = p.AdvVBD || p.VBD;
                if ((prevVal - currVal) >= dropThreshold) {
                    if (currentTier.some(x => x._cleanName === player._cleanName)) {
                        gapToNext = prevVal - currVal;
                        tierPlayers = [...currentTier];
                        break;
                    }
                    tierNum++;
                    currentTier = [];
                }
            }
            currentTier.push(p);
            if (p._cleanName === player._cleanName && i === avail.length - 1) {
                tierPlayers = [...currentTier];
            }
        }

        if (tierPlayers.length === 0) tierPlayers = [player];

        // Contextual Tier Naming for Early Rounds vs. Deep Rounds
        const currentRound = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        let tierName = `Tier ${tierNum}`;

        if (currentRound <= 6) {
            if (tierNum === 1) tierName = `Tier 1 (Elite ${player.Pos})`;
            else if (tierNum === 2) tierName = `Tier 2 (High-End ${player.Pos})`;
            else if (tierNum === 3) tierName = `Tier 3 (Solid ${player.Pos})`;
            else tierName = `Tier ${tierNum} (${player.Pos} Depth)`;
        } else {
            // Late-Round Archetype Tier Naming (Removes misleading Tier X numbers)
            if (player.isRBHandcuff) tierName = `Handcuff / Lottery Ticket Tier`;
            else if (player.targetShare && player.targetShare >= 15) tierName = `Target-Share / PPR Floor Tier`;
            else if (player.aDOT && player.aDOT >= 12) tierName = `Deep-Threat / Spike-Week Tier`;
            else if (player.age && player.age <= 22) tierName = `Rookie / Youth Upside Tier`;
            else tierName = `${player.Pos} Bench Depth Tier`;
        }

        let remaining = tierPlayers.length;
        let isLastInTier = (tierPlayers[tierPlayers.length - 1]._cleanName === player._cleanName);

        return { tierNum, tierName, remaining, isLastInTier, gapToNext: gapToNext.toFixed(1) };
    },

    showComparison() {
        const recs = State.currentRecommendations;
        if (!recs || recs.length < 2) return;

        const topPick = recs[0];
        const alternatives = recs.slice(1);
        const userTeam = State.teamsById[State.userTeamId];

        const nextUserPick = State.currentPick + 1 + (State.settings.numTeams * 2) - 1; // Rough estimation of next pick

        let html = `
            <div class="space-y-6">
                <!-- Top Recommendation Highlight -->
                <div class="bg-emerald-50 border border-emerald-200 p-5 rounded-xl">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 mb-1 block">🏆 The #1 Recommendation</span>
                            <h3 class="text-xl font-extrabold text-gray-900">${topPick.Player} <span class="text-sm font-medium text-gray-500">(${topPick.Pos} - ${topPick.Team})</span></h3>
                        </div>
                        <span class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full text-sm">${(topPick.AdvVBD || topPick.VBD).toFixed(1)} Adv VBD</span>
                    </div>
                    
                    <p class="text-sm text-gray-700 leading-relaxed mb-3">
                        The algorithm strongly prefers <strong>${topPick.Player}</strong> here based on a combination of positional need, market urgency, and optimized lineup fit.
                    </p>
                    
                    <ul class="space-y-2 text-sm text-gray-800 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                        ${this.generateTopPickHighlights(topPick, userTeam)}
                    </ul>
                </div>
                
                <h4 class="font-bold text-gray-500 uppercase tracking-wider text-xs border-b pb-2">Head-to-Head Comparisons</h4>
        `;

        // Generate Head-to-Head Comparisons
        alternatives.forEach((alt, index) => {
            html += this.generateHeadToHead(topPick, alt, userTeam, nextUserPick, index);
        });

        html += `</div>`;

        UI.showMessage(`🤔 Draft Decision Analysis`, html);
    },

    generateTopPickHighlights(p, team) {
        let highlights = [];

        // 1. Lineup impact (PPW)
        if (p._addedPPW >= 1.0 || (p._addedPPW > 0 && !p._byeFillWeek)) {
            highlights.push(`<li><strong class="text-emerald-700">Optimal Lineup Fit:</strong> Adding him instantly increases your optimal starting lineup by <strong>+${p._addedPPW.toFixed(2)} Points Per Week</strong>.</li>`);
        } else if (p._byeFillWeek) {
            highlights.push(`<li><strong class="text-emerald-700">Crucial Bye Cover:</strong> Heavily patches a hole in your roster during Week ${p._byeFillWeek}.</li>`);
        }

        // 2. Market / ADP Urgency
        if (p.adp && p.adp < State.currentPick + 6) {
            highlights.push(`<li><strong class="text-indigo-600">Draft Urgency:</strong> With an ADP of ${p.adp.toFixed(1)}, he is flying off the board and <strong>will not survive</strong> until your next pick.</li>`);
        }

        // 3. Team Need
        let posRoster = State.settings.roster[p.Pos];
        let isStarterNeeded = team.counts[p.Pos] < (posRoster ? posRoster.max : 1);
        if (isStarterNeeded) {
            highlights.push(`<li><strong class="text-amber-600">Positional Need:</strong> Secures a critical starting ${p.Pos} spot on your roster.</li>`);
        }

        // 4. Stacking
        if (p._stackPartner) {
            highlights.push(`<li><strong class="text-purple-600">Stack Synergy:</strong> Pairs perfectly with your QB (${p._stackPartner}) for correlated ceiling upside.</li>`);
        }

        // 5. Volume/Ceiling tags
        if (p._isFlyer && p.upsideScore) {
            highlights.push(`<li><strong class="text-rose-600">Elite Ceiling:</strong> Provides league-winning upside metrics (Upside Score: ${(p.upsideScore).toFixed(1)}).</li>`);
        } else if (p.targetShare && p.targetShare >= 20) {
            highlights.push(`<li><strong class="text-blue-600">Volume Security:</strong> Commands a massive ${p.targetShare}% of his team's targets.</li>`);
        }

        // Fallback
        if (highlights.length === 0) {
            highlights.push(`<li><strong class="text-gray-700">Best Available Value:</strong> Simply the highest mathematical baseline projection on the board.</li>`);
        }

        return highlights.join('');
    },

    generateHeadToHead(topPick, alt, team, nextPick, index) {
        let prosForAlt = [];
        let consForAlt = [];

        // 1. Raw Value vs Positional Need (With Tiebreaker Logic)
        let topVBD = topPick.AdvVBD || topPick.VBD || 0;
        let altVBD = alt.AdvVBD || alt.VBD || 0;
        let diff = altVBD - topVBD;

        if (diff > 0) {
            if (diff <= 6.0) {
                prosForAlt.push(`<strong>Slight Value Edge:</strong> Projects marginally higher (+${diff.toFixed(1)} VBD) in a vacuum, but the difference is small enough that roster needs dictate the pick.`);
            } else {
                prosForAlt.push(`<strong>Higher Absolute Value:</strong> In a vacuum, ${alt.Player} has a mathematically higher value (+${diff.toFixed(1)} VBD) regardless of roster needs.`);
            }
            
            if ((team.counts[topPick.Pos] || 0) < (team.counts[alt.Pos] || 0)) {
                consForAlt.push(`<strong>Roster Logjam:</strong> You already have depth at ${alt.Pos}. Taking ${topPick.Player} (${topPick.Pos}) fills a bigger structural hole on your team.`);
            }
        } else if (diff < 0 && Math.abs(diff) <= 6.0) {
            consForAlt.push(`<strong>Virtual Value Tie:</strong> Projects within ${Math.abs(diff).toFixed(1)} VBD of ${alt.Player}. The algorithm leans ${topPick.Player} strictly due to roster construction and lineup impact.`);
        }

        // 2. Draft Urgency & True ADP Value Comparison
        const currentPickNum = State.currentPick + 1;
        if (alt.adp) {
            if (currentPickNum - alt.adp >= 8) {
                prosForAlt.push(`<strong>Extreme ADP Value:</strong> ${alt.Player} is sliding past his ADP (${alt.adp.toFixed(1)}), presenting strong market value at Pick ${currentPickNum}.`);
            } else if (alt.adp > currentPickNum + 15) {
                consForAlt.push(`<strong>You Can Wait:</strong> ${alt.Player}'s ADP is ${alt.adp.toFixed(1)}. You have a high chance of drafting him in later rounds.`);
            }
        }

        // 3. Lineup Optimization & Opportunity Cost
        let topPPW = topPick._addedPPW || 0;
        let altPPW = alt._addedPPW || 0;
        if (altPPW > topPPW + 0.5) {
            prosForAlt.push(`<strong>Higher Immediate Lineup Boost:</strong> Adds +${altPPW.toFixed(1)} PPW to your weekly optimal score (vs. +${topPPW.toFixed(1)} PPW for ${topPick.Player}).`);
        } else if (topPPW > altPPW + 0.5) {
            let altPosRoster = State.settings.roster[alt.Pos];
            let isAltStarterFull = (team.counts[alt.Pos] || 0) >= (altPosRoster ? altPosRoster.max : 1);
            let impactLabel = (topPick.Pos === alt.Pos) ? "Slightly Lower Lineup Boost" : (isAltStarterFull ? "Bench Warmer Risk" : "Lower Lineup Impact");
            consForAlt.push(`<strong>${impactLabel}:</strong> Adds +${altPPW.toFixed(1)} PPW to your starters compared to +${topPPW.toFixed(1)} PPW for ${topPick.Player}.`);
        }

        // 4. Sample Size Reliability & Multi-Level Trait Context
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

        // 4b. Boom/Bust Consistency Check
        if (alt.boomBust && topPick.boomBust) {
            if (alt.boomBust.bust + 8 < topPick.boomBust.bust) {
                prosForAlt.push(`<strong>Dramatically Safer Floor:</strong> Busted in only <strong>${alt.boomBust.bust}%</strong> of 2025 games vs. ${topPick.Player}'s <strong>${topPick.boomBust.bust}%</strong> bust rate.`);
            } else if (topPick.boomBust.bust + 8 < alt.boomBust.bust) {
                consForAlt.push(`<strong>Volatile Bust Risk:</strong> Busted in <strong>${alt.boomBust.bust}%</strong> of games last year compared to ${topPick.Player}'s clean <strong>${topPick.boomBust.bust}%</strong> bust rate.`);
            }

            if (alt.boomBust.boom > topPick.boomBust.boom + 8) {
                prosForAlt.push(`<strong>Higher Weekly Ceiling:</strong> Posted a "Boom" week in <strong>${alt.boomBust.boom}%</strong> of games vs. ${topPick.Player}'s ${topPick.boomBust.boom}%.`);
            }
        }

        if (alt._isSafeFloor && !topPick._isSafeFloor) {
            prosForAlt.push(`<strong>Safer Floor:</strong> Provides more reliable week-to-week stability if you are looking to insulate a risky roster.`);
        }
        if (topPick._isFlyer && !alt._isFlyer) {
            consForAlt.push(`<strong>Lower Ceiling:</strong> Lacks the slate-breaking upside and advanced metrics that ${topPick.Player} possesses.`);
        }

        // 5. Enhanced Positional & Cross-Positional Tier Analysis
        let topTier = this.getTierDetails(topPick);
        let altTier = this.getTierDetails(alt);
        const currentRound = Math.floor(State.currentPick / State.settings.numTeams) + 1;

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
            // Cross-Position Tier Scarcity Comparison (Caps at Round 7 to prevent late-round noise)
            if (topTier.isLastInTier && (topTier.tierNum <= 2 || currentRound <= 7)) {
                const altAvailInTier = State.availablePlayers.filter(p => p.Pos === alt.Pos && Compare.getTierDetails(p).tierNum === altTier.tierNum);
                const altSurvivingCount = altAvailInTier.filter(p => (p.adp || 0) > nextPick).length;
                
                let survivalNote = altSurvivingCount > 0 
                    ? `(with ~<strong>${altSurvivingCount}</strong> likely to reach your next pick at Pick ${nextPick})` 
                    : `(though <strong>none</strong> are projected to survive to your next pick at Pick ${nextPick})`;

                let scarcityLabel = currentRound <= 6 ? `in ${topTier.tierName}` : `in the ${topTier.tierName} pool`;
                consForAlt.push(`<strong>Cross-Positional Scarcity:</strong> ${topPick.Player} is the <strong>LAST remaining option</strong> ${scarcityLabel}, whereas ${alt.Pos} has <strong>${altTier.remaining} option(s)</strong> available in ${altTier.tierName} ${survivalNote}.`);
            }
        }

        // 6. Position & Strategy Specific Trade-offs
        if (alt.Pos === 'QB' && ['RB', 'WR'].includes(topPick.Pos) && currentRound <= 4) {
            consForAlt.push(`<strong>1-QB Opportunity Cost:</strong> Drafting a QB in Round ${currentRound} sacrifices elite ${topPick.Pos} positional scarcity when quality QBs remain available later.`);
        }
        if (topPick.targetShare && alt.targetShare && topPick.targetShare > alt.targetShare + 4) {
            consForAlt.push(`<strong>Lower Target Command:</strong> ${alt.Player} (${alt.targetShare}% Tgt Share) commands less passing volume than ${topPick.Player} (${topPick.targetShare}%).`);
        }

        // Fallbacks if arrays are empty
        if (prosForAlt.length === 0) prosForAlt.push(`Offers elite, foundational baseline production as a top-tier ${alt.Pos}.`);
        if (consForAlt.length === 0) {
            if (topPick.Pos === alt.Pos) {
                let vbdGap = ((topPick.AdvVBD || topPick.VBD) - (alt.AdvVBD || alt.VBD)).toFixed(1);
                consForAlt.push(`Leans ${topPick.Player} due to a slightly higher overall season projection (+${vbdGap} VBD edge).`);
            } else {
                consForAlt.push(`Prioritizes ${topPick.Player}'s positional scarcity and roster structural balance at ${topPick.Pos}.`);
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
                        <h6 class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 mb-1">Why pick ${alt.Player.split(' ')[1] || alt.Player}?</h6>
                        <ul class="text-xs text-gray-700 space-y-1.5">
                            ${prosForAlt.map(p => `<li class="flex items-start"><span class="text-emerald-500 mr-1.5">•</span> <span>${p}</span></li>`).join('')}
                        </ul>
                    </div>
                    
                    <!-- Why we chose the top pick over them -->
                    <div>
                        <h6 class="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 mb-1">Why ${topPick.Player.split(' ')[1] || topPick.Player} wins</h6>
                        <ul class="text-xs text-gray-700 space-y-1.5">
                            ${consForAlt.map(c => `<li class="flex items-start"><span class="text-rose-500 mr-1.5">•</span> <span>${c}</span></li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
};