function getPlayerLastName(fullName) {
    if (!fullName) return '';
    let parts = fullName.trim().split(/\s+/);
    const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
    if (parts.length > 1 && suffixes.has(parts[parts.length - 1].toLowerCase())) {
        parts.pop();
    }
    return parts[parts.length - 1] || fullName;
}

window.Compare = {
    getTierDetails(player) {
        if (!player) return { tierNum: 1, tierName: 'Tier 1', remaining: 1, isLastInTier: false };
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
        const userTeam = State.teamsById[State.userTeamId] || { counts: {}, roster: [] };
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
        let nextUserOverallPick = nextWindowPicks.length > 0 ? nextWindowPicks[0] : (currentPickNum + (State.settings.numTeams || 12));
        
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
                            <span class="block text-lg font-black text-indigo-700">${(topPick.AdvVBD || topPick.VBD || 0).toFixed(1)} <span class="text-xs text-indigo-400 font-semibold">Adv VBD</span></span>
                            <span class="text-xs text-slate-500 font-medium">Proj: ${(topPick.ProjPts || 0).toFixed(1)} pts</span>
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

    // =========================================================================
    // 1. MACRO THOUGHT PROCESS (Context-Aware by Draft Phase & Format)
    // =========================================================================
    generateMacroThoughtProcess(p, team, nextPick) {
        team = team || State.teamsById[State.userTeamId] || { counts: {}, roster: [] };
        const currentRound = Math.floor(State.currentPick / (State.settings.numTeams || 12)) + 1;
        const tierInfo = this.getTierDetails(p);
        const posRoster = State.settings.roster[p.Pos];
        const isStarterNeeded = (team.counts[p.Pos] || 0) < (posRoster ? posRoster.max : 1);
        
        const pronoun = p.Pos === 'DST' ? 'this defense' : 'he';
        let narrative = `The engine recommends selecting <strong>${p.Player}</strong> (${p.Pos} • ${p.Team}) here. `;
        let reasons = [];

        // Phase 1: Early-Round Anchor Phase (Rounds 1–4)
        if (currentRound <= 4) {
            if (p.Pos === 'RB' && p._rbArchetype === 'Bellcow Alpha') {
                reasons.push(`he locks in an irreplaceable <strong>three-down bellcow foundation (${p.hvo || 60}+ High-Value Touches)</strong> before the board hits committee timeshares`);
            } else if (p.Pos === 'WR' && p.targetShare >= 24.0) {
                reasons.push(`he provides an elite <strong>alpha WR1 target funnel (${p.targetShare}% target share)</strong>, establishing a high-ceiling PPR anchor with low injury volatility`);
            } else if (p.Pos === 'TE' && (State.scoring.tePremium > 0 || tierInfo.tierNum === 1)) {
                reasons.push(`he provides a massive <strong>weekly positional mismatch at TE</strong>, escaping the streaming wasteland`);
            } else if (p.Pos === 'QB' && (State.settings.roster.Superflex?.max > 0 || p.stats?.rushYds >= 450)) {
                reasons.push(`he secures an elite <strong>dual-threat QB baseline (${p.stats?.rushYds || 500}+ rush yds)</strong> that standard pocket passers cannot match`);
            }
        }
        // Phase 2: Mid-Round Structural Build (Rounds 5–9)
        else if (currentRound <= 9) {
            if (p._byeFillWeek) {
                reasons.push(`he functions as a <strong>critical Week ${p._byeFillWeek} bye-week plug</strong>, preventing an empty starter slot (+${(p._byeFillPts || 0).toFixed(1)} fill points)`);
            } else if (isStarterNeeded) {
                reasons.push(`he fills your open starting ${p.Pos} slot with a direct lineup gain of <strong>+${(p._addedPPW || 0).toFixed(2)} Points Per Week</strong> over replacement`);
            } else if (p._addedPPW && p._addedPPW >= 1.0) {
                reasons.push(`he forces his way into your Flex rotation, elevating your starting lineup by <strong>+${p._addedPPW.toFixed(2)} Points Per Week</strong>`);
            } else if (p._vacatedTgts && p._vacatedTgts >= 50) {
                reasons.push(`he steps into massive <strong>offseason vacated opportunity (+${p._vacatedTgts} targets)</strong> on an ascending trajectory`);
            }
        }
        // Phase 3: Late-Round Upside & Contingency (Rounds 10+)
        else {
            let userOwnsStarter = p.starterName && (team.roster || []).some(r => r._cleanName === State.normalizeName(p.starterName));
            if (userOwnsStarter) {
                reasons.push(`he secures <strong>direct backfield handcuff insurance</strong> for your starter (${p.starterName}), protecting your investment`);
            } else if (p.contingentDraftEquity && p.contingentDraftEquity >= 25.0) {
                reasons.push(`he represents a <strong>league-winning contingent lottery ticket (${p._contingentTier || 'Diamond Stash'})</strong> who inherits an RB1 workload if ${p.starterName || 'the starter'} misses time`);
            } else if (p._isFlyer && p.upsideScore >= 20.0) {
                reasons.push(`he offers pure <strong>right-tail ceiling metrics (${p.upsideScore.toFixed(0)} Upside Score)</strong> to stash on your bench`);
            } if (['PK', 'DST'].includes(p.Pos)) {
                reasons.push(`${pronoun} offers a premier <strong>Week 1 streaming matchup (⭐${(p.sosWeeks?.W1 || p.avgStars || 3.0).toFixed(1)} SOS)</strong> to open the season`);
            }
        }

        // Scarcity & Survival Probability Check
        if (tierInfo.isLastInTier && tierInfo.tierNum <= 4) {
            reasons.push(`he is the <strong>last remaining option in ${tierInfo.tierName}</strong>, preventing a severe tier cliff`);
        } else if (p.adp && p._survivalProb !== undefined && p._survivalProb < 0.20) {
            reasons.push(`market velocity indicates only a <strong>${Math.round(p._survivalProb * 100)}% chance of reaching your next pick (#${nextPick})</strong>`);
        }

        if (reasons.length === 0) {
            narrative += `He offers the highest synthesized blend of median volume, efficiency, and offensive environment remaining on the board.`;
        } else if (reasons.length === 1) {
            narrative += `Structurally, ${reasons[0]}.`;
        } else {
            narrative += `Structurally, ${reasons[0]}, and importantly, ${reasons[1]}.`;
        }

        return narrative;
    },

    // =========================================================================
    // 2. TOP PICK SUPPORTING ANALYTICAL PROFILE
    // =========================================================================
    generateTopPickHighlights(p, team, nextPick) {
        team = team || State.teamsById[State.userTeamId] || { counts: {}, roster: [] };
        nextPick = nextPick || (State.currentPick + 1 + (State.settings.numTeams || 12));
        let highlights = [];

        // 1. Lineup Value (+PPW) & Bye-Week Coverage
        if (p._byeFillWeek) {
            highlights.push(`<li><strong class="text-amber-700">🔄 Critical Bye-Week Plug:</strong> Insulates a severe roster hole in Week ${p._byeFillWeek} (+${(p._byeFillPts || 0).toFixed(1)} fill points).</li>`);
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
        let isStarterNeeded = (team.counts[p.Pos] || 0) < (posRoster ? posRoster.max : 1);
        if (isStarterNeeded) {
            highlights.push(`<li><strong class="text-indigo-700">📋 Core Starter Requirement:</strong> Secures an essential open starter slot at <strong>${p.Pos}</strong> before viable talent drops into replacement tiers.</li>`);
        }

        // 4. Stacking & Handcuff Insurance / Lottery Tickets
        if (p._stackPartner) {
            highlights.push(`<li><strong class="text-purple-700">⚡ Stacking Multiplier:</strong> Correlates directly with your roster's QB (${p._stackPartner}) for week-winning ceiling outcomes.</li>`);
        }
        let userOwnsStarter = p.starterName && (team.roster || []).some(r => r._cleanName === State.normalizeName(p.starterName));
        if (userOwnsStarter) {
            highlights.push(`<li><strong class="text-blue-700">🔒 Roster Security Handcuff:</strong> Protects your investment in ${p.starterName} by securing his direct handcuff.</li>`);
        } else if (p.isRBHandcuff) {
            highlights.push(`<li><strong class="text-emerald-700">🚀 League-Winning Upside:</strong> An elite bench stash who would inherit a massive role if ${p.starterName || 'the starter'} misses time.</li>`);
        }

        // 5. Volume / Ceiling, Flyers & Breakout Stashes
        if (p._isFlyer && p.upsideScore) {
            highlights.push(`<li><strong class="text-rose-700">💥 Elite Ceiling:</strong> Provides league-winning upside metrics (Upside Score: ${(p.upsideScore).toFixed(1)}).</li>`);
        }
        if (p.targetShare && p.targetShare >= 20.0) {
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

        // 8. Comprehensive Running Back Archetypes & Backfield Competition
        if (p.Pos === 'RB') {
            let rzText = (p._vacatedRzAtt && p._vacatedRzAtt > 0) ? ` and <strong>+${p._vacatedRzAtt} red-zone looks</strong>` : '';
            if (p._rbArchetype === 'Bellcow Alpha') {
                highlights.push(`<li><strong class="text-emerald-700">👑 Three-Down Bellcow Alpha:</strong> Uncontested lead back commanding <strong>${p.hvo || 65}+ High-Value Touches</strong> and complete snap monopoly.</li>`);
            } else if (p._rbArchetype === '1B Co-Starter') {
                highlights.push(`<li><strong class="text-indigo-700">⚔️ Designed 1B Co-Starter:</strong> Commands guaranteed weekly volume (${p.stats?.rushAtt || 0} carries / ${p.stats?.targets || 0} tgts), providing a Flex floor with RB1 contingent upside.</li>`);
            } else if (p._rbArchetype === 'High-Leverage Space Back' || p._isSatelliteBack) {
                highlights.push(`<li><strong class="text-blue-700">🎯 High-Leverage Space Creator:</strong> Script-proof receiver out of the backfield (${p.targetShare || 13}% target share) with an elite PPR floor.</li>`);
            } else if (p._rbArchetype === 'Explosive Chunk Slasher') {
                highlights.push(`<li><strong class="text-emerald-700">💥 Explosive Chunk Slasher:</strong> Generates independent chunk plays with elite <strong>${p.yacAtt || '3.4'} Yards After Contact</strong> and high burst.</li>`);
            } else if (p._rbArchetype === '1A Early-Down Hammer' || p._rbArchetype === 'Featured Workhorse Lead') {
                highlights.push(`<li><strong class="text-amber-700">🔨 Early-Down Power Hammer:</strong> Monopolizes short-yardage and goal-line work (${Math.round(p.stats?.rushAtt || 200)}+ carries) for high touchdown equity.</li>`);
            }

            if (p._backupThreatLevel === 'Low Standalone Threat') {
                highlights.push(`<li><strong class="text-emerald-700">🛡️ Uncontested Backfield Lead:</strong> Backfield depth behind him is graded as Low Threat, guaranteeing unshared goal-line and third-down snaps.</li>`);
            }
            if (p._vacatedCarries && p._vacatedCarries >= 40) {
                highlights.push(`<li><strong class="text-indigo-700">📦 Inherited Vacated Touches:</strong> Absorbs <strong>+${p._vacatedCarries} vacated carries</strong>${rzText}...</li>`);
            }
        }

        // 9. WR & TE Archetypes & Route Trees
        if (p.Pos === 'WR') {
            if (p._wrArchetype === 'Alpha Target Funnel') {
                highlights.push(`<li><strong class="text-blue-700">👑 Dominant Alpha WR1:</strong> Commands a massive <strong>${p.targetShare}% target share</strong> (${p.wopr ? p.wopr.toFixed(2) + ' WOPR' : 'Alpha WOPR'}), immunizing him from bracket coverage.</li>`);
            } else if (p._wrArchetype === 'High-Volume Slot Magnet') {
                highlights.push(`<li><strong class="text-indigo-700">📡 High-Volume Slot Engine:</strong> Highly efficient chain-mover (${p.aDOT} aDOT, ${p.trueCatchRate?.toFixed(1)}% Catch Rate) guaranteeing a high-floor PPR baseline.</li>`);
            } else if (p._wrArchetype === 'Vertical Spike-Week Weapon') {
                highlights.push(`<li><strong class="text-rose-700">🚀 Field-Tilting Deep Weapon:</strong> Generates slate-breaking splash plays with an elite <strong>${p.aDOT} aDOT</strong>.</li>`);
            }

            if (p._passingTreeType === 'Concentrated 2-Man Funnel') {
                highlights.push(`<li><strong class="text-emerald-700">🎯 Concentrated Target Hierarchy:</strong> Plays in a 2-man target funnel, ensuring heavy week-in week-out scheme priority.</li>`);
            }
        } else if (p.Pos === 'TE') {
            if (p._teArchetype === 'Detached Alpha "Big Slot"') {
                highlights.push(`<li><strong class="text-purple-700">🦄 Detached Alpha TE Weapon:</strong> Runs routes from wide/slot alignments as a primary team receiver, bypassing the streaming pack.</li>`);
            }
        }

        // 10. QB Rushing Floor & Escapability
        if (p.Pos === 'QB') {
            const rushYds = p.stats?.rushYds || 0;
            const cleanRushYds = Math.round(p.stats?.rushYds || 0);
            if (p._qbArchetype === 'Konami Code Alpha' || rushYds >= 650) {
                highlights.push(`<li><strong class="text-amber-700">🏃 Konami Code Alpha Floor:</strong> Projected for <strong>${cleanRushYds} rush yards</strong>...</li>`);
            } else if (p._qbArchetype === 'Dynamic Dual-Threat' || rushYds >= 425) {
                highlights.push(`<li><strong class="text-amber-700">🏃 Dynamic Dual-Threat:</strong> Projected for <strong>${rushYds} rushing yards</strong> of weekly insulation.</li>`);
            }
            if (p.p2s && p.p2s <= 14.0) {
                highlights.push(`<li><strong class="text-emerald-700">🛡️ Elite Pocket Escapability:</strong> Low ${p.p2s.toFixed(1)}% Pressure-to-Sack rate proves he actively converts collapsing pockets into positive plays.</li>`);
            }
            if ((p._eliteWeaponCount || 0) >= 2) {
                highlights.push(`<li><strong class="text-indigo-700">🎯 Elite Supporting Arsenal:</strong> Supported by ${p._eliteWeaponCount} elite separators and a top-tier pass-catching group.</li>`);
            }
        }

        // 11. Advanced Additions (Multi-Year, Synergy, Healthy PPG, Vacated & Trenches)
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
        if (p.olTier === 'S' || p.olTier === 'A') {
            highlights.push(`<li><strong class="text-emerald-700">🏰 Elite Trench Quality:</strong> Operates behind a <strong>Tier ${p.olTier} Offensive Line</strong> (Run Block #${p.olRunBlk || 10}, Pass Block #${p.olPassBlk || 10}).</li>`);
        }

        if (highlights.length === 0) {
            highlights.push(`<li><strong class="text-slate-600">📊 Best Available Value:</strong> Highest synthesized VBD projection remaining on the board.</li>`);
        }

        return highlights.join('');
    },

    // =========================================================
    // 3. UNIVERSAL HEAD-TO-HEAD COMPARISON MATRIX
    // =========================================================
    generateHeadToHead(topPick, alt, team, nextPick) {
        const currentPickNum = State.currentPick + 1;
        team = team || State.teamsById[State.userTeamId] || { counts: {}, roster: [] };
        
        let topVBD = topPick.AdvVBD ?? topPick.VBD ?? 0;
        let altVBD = alt.AdvVBD ?? alt.VBD ?? 0;
        let vbdGap = topVBD - altVBD;
        let isTossUp = Math.abs(vbdGap) <= 3.5;
        
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

        const topPpg = ((topPick.ProjPts || 0) / 17).toFixed(1);
        const altPpg = ((alt.ProjPts || 0) / 17).toFixed(1);

        const topSurname = getPlayerLastName(topPick.Player);
        const altSurname = getPlayerLastName(alt.Player);


        // =========================================================
        // 1. THE ANALYST'S TAKE (Macro Context)
        // =========================================================
        let analystTake = "";
        if (isTossUp) {
            if (topPick.Pos === alt.Pos) {
                analystTake = `This is a virtual dead-heat at ${topPick.Pos} (${topPick.Player}: ${topPpg} PPG vs ${alt.Player}: ${altPpg} PPG). Both players offer nearly identical mathematical value at this stage of the draft (~${topVBD.toFixed(1)} Adv VBD). The engine leans slightly toward ${topPick.Player} on usage metrics, but pivoting to ${alt.Player} is completely sound based on personal risk tolerance.`;
            } else {
                analystTake = `A razor-thin structural decision between ${topPick.Pos} (${topPick.Player}) and ${alt.Pos} (${alt.Player}). Both offer equivalent surplus value over positional replacement (~${topVBD.toFixed(1)} VBD). Your choice should hinge on your target roster construction.`;
            }
        } else if (topPick.Pos !== alt.Pos) {
            if (topPick.Pos === 'RB' && ['WR', 'TE'].includes(alt.Pos)) {
                analystTake = `Structural positional clash: ${topPick.Player} offers a higher mathematical edge over replacement (+${vbdGap.toFixed(1)} Adv VBD gap) and locks down scarce lead-back touches. However, choosing ${alt.Player} secures an elite ${alt.Pos} anchor with lower in-season injury volatility.`;
            } else if (['WR', 'TE'].includes(topPick.Pos) && alt.Pos === 'RB') {
                analystTake = `${topPick.Player} holds a significant baseline value edge (+${vbdGap.toFixed(1)} Adv VBD) as an elite target earner. Pivoting to ${alt.Player} is only recommended if you fear backfield scarcity and prioritize securing guaranteed early-round rushing volume.`;
            } else {
                analystTake = `${topPick.Player} (${topPick.Pos}) currently outpaces ${alt.Player} (${alt.Pos}) by +${vbdGap.toFixed(1)} Adv VBD points, providing superior lineup insulation over baseline replacement.`;
            }
        } else {
            let topTier = this.getTierDetails(topPick);
            let altTier = this.getTierDetails(alt);
            if (topTier.tierNum < altTier.tierNum) {
                analystTake = `${topPick.Player} projects for ${topPpg} PPG vs ${altPpg} PPG for ${alt.Player}, placing him in a higher positional tier (${topTier.tierName}). While ${alt.Player} has paths to spike production, bypassing ${topPick.Player} leaves +${vbdGap.toFixed(1)} baseline VBD on the board.`;
            } else {
                analystTake = `Both players reside in ${topTier.tierName}, but ${topPick.Player} (${topPpg} PPG) edges out ${alt.Player} (${altPpg} PPG) due to superior high-value touch/target density (+${vbdGap.toFixed(1)} Adv VBD advantage).`;
            }
        }

        // =========================================================
        // 2. THE CASE FOR THE TOP PICK (Defending the Choice)
        // =========================================================
        let topCase = [];
        
        // Structural & Baseline Points
        if (vbdGap >= 4.0) {
            topCase.push(`<strong>Baseline Scoring Edge:</strong> Projects for <strong>${topPpg} PPG</strong> (${(topPick.ProjPts || 0).toFixed(1)} pts) vs <strong>${altPpg} PPG</strong> for ${alt.Player}, delivering a clear <strong>+${vbdGap.toFixed(1)} Adv VBD</strong> surplus over replacement.`);
        }
        if (topPick.Pos !== alt.Pos && isTopStarterNeeded && !isAltStarterNeeded) {
            topCase.push(`<strong>Starting Need Priority:</strong> Addresses an immediate starting need at ${topPick.Pos}, whereas ${alt.Player} would begin as a bench or rotational player.`);
        }
        if (topPick.floorPpg && alt.floorPpg && topPick.floorPpg >= alt.floorPpg + 1.8) {
            topCase.push(`<strong>Insulated Weekly Floor:</strong> Establishes a rock-solid floor (<strong>${topPick.floorPpg.toFixed(1)} Floor PPG</strong> vs ${alt.floorPpg.toFixed(1)} for ${alt.Player}), giving you reliable weekly output without dud risk.`);
        }
        if (topPick.boomBust && alt.boomBust && topPick.boomBust.bust < alt.boomBust.bust - 6.0) {
            topCase.push(`<strong>Consistency & Safety:</strong> Busted in only <strong>${topPick.boomBust.bust}%</strong> of games last year compared to a volatile ${alt.boomBust.bust}% for ${alt.Player}.`);
        }
        if (topPick._positiveTdRegression && alt._isFlukeTDScorer) {
            topCase.push(`<strong>Positive TD Regression:</strong> Primed for positive touchdown regression based on red-zone touch volume, whereas ${alt.Player}'s scoring rate last year was mathematically unsustainable.`);
        }

        // Trenches & Efficiency
        if (topPick.olTier === 'S' || (topPick.olTier === 'A' && ['C', 'D', 'F'].includes(alt.olTier))) {
            topCase.push(`<strong>Trench Dominance:</strong> Benefits from elite trench play behind a <strong>Tier ${topPick.olTier} offensive line</strong>, while ${alt.Player} faces blocking concerns.`);
        }
        if (topPick.ypt && alt.ypt && topPick.ypt >= alt.ypt + 1.8 && (topPick.targetShare || 0) >= 15) {
            topCase.push(`<strong>Target Efficiency:</strong> Generates far more yardage per look (<strong>${topPick.ypt.toFixed(1)} vs ${alt.ypt.toFixed(1)} YPT</strong>), maximizing his opportunities rather than relying on empty volume.`);
        }
        if (topPick.trueCatchRate && alt.dropRate && topPick.trueCatchRate >= 89.0 && alt.dropRate >= 7.5) {
            topCase.push(`<strong>Reliable Hands:</strong> Displays elite hands (<strong>${topPick.trueCatchRate.toFixed(1)}% catch rate</strong> on catchable balls), while ${alt.Player} has struggled with drive-killing drops (${alt.dropRate.toFixed(1)}% drop rate).`);
        }

        // RB Specific Clashes
        if (topPick.Pos === 'RB' && alt.Pos === 'RB') {
            if (topPick._rbArchetype === 'Bellcow Alpha' && alt._rbArchetype !== 'Bellcow Alpha') {
                topCase.push(`<strong>Three-Down Bellcow:</strong> Operates as a true three-down bellcow, insulating his floor with guaranteed volume that ${alt.Player} lacks in a ${alt._rbArchetype || 'shared'} role.`);
            }
            if (topPick.hvo && alt.hvo && topPick.hvo > alt.hvo + 12) {
                topCase.push(`<strong>High-Value Touch Monopoly:</strong> Commands significantly more High-Value Opportunities (<strong>${topPick.hvo} vs ${alt.hvo} HVO</strong>), which are the primary driver of elite RB scoring.`);
            }
            if (topPick._inheritsGoalLineWork && !alt._inheritsGoalLineWork) {
                topCase.push(`<strong>Inherited Red-Zone Work:</strong> Inherits massive vacated goal-line work from offseason departures, unlocking a touchdown ceiling that ${alt.Player} doesn't have.`);
            }
            if (alt._isSystemDependentRB && topPick._isIndependentYACCreator) {
                topCase.push(`<strong>Independent Creation:</strong> Creates his own yardage after contact (<strong>${topPick.yacAtt?.toFixed(1)} YAC</strong>), whereas ${alt.Player}'s production was heavily propped up by system blocking lanes.`);
            }
            if (topPick.err && alt.err && topPick.err >= alt.err + 1.5) {
                topCase.push(`<strong>Explosive Big-Play Burst:</strong> Possesses superior big-play burst with a <strong>${topPick.err.toFixed(1)}% Explosive Run Rate</strong> compared to ${alt.Player}'s ${alt.err.toFixed(1)}% mark.`);
            }
            if (State.scoring.ppr === 0 && (topPick.stats?.rushAtt || 0) > (alt.stats?.rushAtt || 0) + 30) {
                topCase.push(`<strong>Standard Scoring Ground Volume:</strong> In Standard (Non-PPR) scoring, his heavy carry volume (<strong>${Math.round(topPick.stats.rushAtt)} proj carries</strong>) is vastly more valuable than ${alt.Player}'s catch-dependent profile.`);
            }
            if (topPick.bmi && topPick.bmi >= 31.0 && alt.weight && parseInt(alt.weight, 10) < 200) {
                topCase.push(`<strong>Workhorse Frame:</strong> Carries a prototypical workhorse frame (${topPick.weight} lbs, ${topPick.bmi.toFixed(1)} BMI) built to absorb contact, while ${alt.Player}'s lighter build carries durability concerns.`);
            }
            if (alt._rb3ThreatNote) {
                topCase.push(`<strong>Uncompromised Role:</strong> Has a clean grasp on backfield volume, while ${alt.Player}'s touch ceiling is actively threatened by rotational backs.`);
            }
            if (topPick._backupThreatLevel === 'Low Standalone Threat') {
                topCase.push(`<strong>Clean Backfield Monopoly:</strong> Backup (${topPick._backupName || 'depth'}) is graded as a Low Threat, giving ${topPick.Player.split(' ').slice(-1)[0]} total control of high-value touches.`);
            }
        }
        
        // WR/TE Specific Clashes
        if (['WR', 'TE'].includes(topPick.Pos) && ['WR', 'TE'].includes(alt.Pos)) {
            if ((topPick.targetShare || 0) > (alt.targetShare || 0) + 4.0) {
                topCase.push(`<strong>Target Share Command:</strong> Commands a significantly larger slice of his team's passing attack (<strong>${topPick.targetShare}% vs ${alt.targetShare || 0}%</strong>).`);
            }
            if (topPick.wopr && alt.wopr && topPick.wopr > alt.wopr + 0.10) {
                topCase.push(`<strong>Weighted Opportunity (WOPR):</strong> Dominates his team's passing tree with an elite <strong>${topPick.wopr.toFixed(2)} WOPR</strong> vs ${alt.wopr.toFixed(2)} for ${alt.Player}.`);
            }
            if (topPick.Pos === 'WR' && alt.Pos === 'WR' && topPick._passingTreeType === 'Concentrated 2-Man Funnel' && alt._passingTreeType !== 'Concentrated 2-Man Funnel') {
                topCase.push(`<strong>Passing Funnel Focus:</strong> Operates in a highly concentrated passing attack, avoiding the target-share volatility that ${alt.Player} faces in a crowded room.`);
            }
            if (topPick._isProvenMultiYearAlpha && !alt._isProvenMultiYearAlpha) {
                topCase.push(`<strong>Multi-Year Alpha Record:</strong> Brings a verified multi-year track record of commanding 24%+ target share, carrying far less projection risk than ${alt.Player}.`);
            }
            if (topPick.Pos === 'TE' && alt._teCommitteeThreat) {
                topCase.push(`<strong>Full Route Participation:</strong> Commands complete route participation, whereas ${alt.Player} splits routes in 12-personnel formations with a capable secondary tight end.`);
            }
            if (topPick.Pos === 'WR' && alt._targetCompressionRisk) {
                topCase.push(`<strong>Target Hierarchy Security:</strong> Operates as the clear focal point of his offense, avoiding target-cannibalization alongside high-end teammates.`);
            }
        }

        // Format & Scoring Rules
        if ((State.scoring.tePremium || 0) > 0 && topPick.Pos === 'TE' && ['WR', 'RB'].includes(alt.Pos)) {
            topCase.push(`<strong>TE-Premium Arbitrage:</strong> Capitalizes directly on your league's TE-Premium rule (+${State.scoring.tePremium} pts/rec), elevating his receptions above standard skill scoring.`);
        }

        // QB Specific Clashes
        if (topPick.Pos === 'QB' && alt.Pos === 'QB') {
            if ((topPick.stats?.rushYds || 0) > (alt.stats?.rushYds || 0) + 150) {
                topCase.push(`<strong>Dual-Threat Rushing Floor:</strong> Projects for <strong>${topPick.stats?.rushYds} rush yards</strong> vs ${alt.stats?.rushYds || 0} for ${alt.Player}, establishing a safe ground floor.`);
            }
            if (topPick.p2s && alt.p2s && topPick.p2s < alt.p2s - 6.0) {
                topCase.push(`<strong>Pocket Escapability:</strong> Possesses superior pocket escapability (${topPick.p2s.toFixed(1)}% P2S), avoiding the drive-killing sacks that plague ${alt.Player} (${alt.p2s.toFixed(1)}%).`);
            }
            if ((topPick._eliteWeaponCount || 0) > (alt._eliteWeaponCount || 0)) {
                topCase.push(`<strong>Surrounding Arsenal:</strong> Operates with a stronger pass-catching arsenal (${topPick._eliteWeaponCount} elite separators), sustaining drives and red-zone efficiency better than ${alt.Player}.`);
            }
            if (alt._shortLeashRisk && !topPick._shortLeashRisk) {
                topCase.push(`<strong>Franchise Job Security:</strong> Enjoys total job security as an uncontested franchise starter, whereas ${alt.Player} carries in-season benching risk with a backup behind him.`);
            }
        }

        // Environmental Disparity (YBC)
        if (topPick.Pos === 'RB' && alt.Pos === 'RB' && topRush?.ybcAtt && altRush?.ybcAtt && topRush.ybcAtt >= altRush.ybcAtt + 0.3) {
            topCase.push(`<strong>Run-Blocking Quality:</strong> Runs behind a significantly more dominant run-blocking unit, getting <strong>${topRush.ybcAtt.toFixed(1)} Yards Before Contact</strong> per attempt vs just ${altRush.ybcAtt.toFixed(1)} for ${alt.Player}.`);
        }

        // Schedule & Health
        if (topEarlySos >= 3.4 && altEarlySos <= 2.8) {
            topCase.push(`<strong>Fast-Start Matchup Slate:</strong> Enjoys a soft opening schedule (⭐<strong>${topEarlySos.toFixed(1)} SOS</strong> in Wks 1–4), providing immediate starting production while ${alt.Player} navigates a difficult early gauntlet (⭐${altEarlySos.toFixed(1)}).`);
        }
        if (topPick._isFullyCleared && alt._isMajorReturn) {
            topCase.push(`<strong>Clean Health Baseline:</strong> Enters the season with 100% health, whereas ${alt.Player} is returning from a major procedure and may see managed snap counts early on.`);
        }
        if (alt.byeWeek && alt.byeWeek !== 'N/A') {
            let sameByeCount = (team.roster || []).filter(r => String(r.byeWeek) === String(alt.byeWeek)).length;
            if (sameByeCount >= 3) {
                topCase.push(`<strong>Bye-Week Insulation:</strong> Drafting him avoids creating a severe Week ${alt.byeWeek} bye-week hole (${sameByeCount} of your players are already off that week).`);
            }
        }
        if (topPick.nflDraftPick && topPick.nflDraftPick <= 32 && alt.draftRound && alt.draftRound >= 4) {
            topCase.push(`<strong>Draft Capital Commitment:</strong> Backed by 1st-round NFL draft capital and organizational commitment, securing him a much longer leash during slumps than ${alt.Player}.`);
        }

        if (topCase.length === 0) topCase.push(`Provides a slightly better overall blend of usage metrics and matchup stability.`);

        // =========================================================
        // 3. THE CASE FOR THE ALTERNATIVE (Why Pivot to Alt?)
        // =========================================================
        let altCase = [];
        
        // --- A. CROSS-POSITIONAL PIVOTS: When Alt is WR/TE and Top is RB ---
        if (['WR', 'TE'].includes(alt.Pos) && topPick.Pos === 'RB') {
            if ((alt.targetShare || 0) >= 20.0 || (alt.stats?.targets || 0) >= 110) {
                altCase.push(`<strong>PPR Volume Foundation:</strong> ${alt.Player} commands a massive <strong>${alt.targetShare || 24}% target share</strong> (${alt.stats?.targets || 120}+ proj targets), providing an elite, script-independent PPR floor.`);
            }
            altCase.push(`<strong>Roster Anti-Fragility (WR Longevity):</strong> Elite pass-catchers suffer significantly lower in-season injury attrition than high-touch running backs, giving your starting lineup superior full-season stability.`);
            if (alt.ceilingPpg && alt.ceilingPpg >= 22.0) {
                altCase.push(`<strong>Slate-Breaking Aerial Ceiling:</strong> In shootouts, his ceiling reaches <strong>${alt.ceilingPpg.toFixed(1)} PPG</strong> (${alt.aDOT ? alt.aDOT + ' aDOT' : 'deep air yards'}), creating matchup-winning spike weeks through the air.`);
            }
            if (isAltStarterNeeded) {
                altCase.push(`<strong>Positional Anchor:</strong> Locks in a foundational ${alt.Pos}1 slot before talent drops into volatile replacement tiers.`);
            }
        }

        // --- B. CROSS-POSITIONAL PIVOTS: When Alt is RB and Top is WR/TE ---
        else if (alt.Pos === 'RB' && ['WR', 'TE'].includes(topPick.Pos)) {
            altCase.push(`<strong>Workhorse RB Scarcity:</strong> True three-down running backs disappear immediately; taking ${alt.Player} locks in <strong>${Math.round(alt.stats?.rushAtt || 200)}+ carries</strong> before the board hits committee territory.`);
            if ((alt.stats?.rushTd || 0) >= 7 || (alt.rzAtt || 0) >= 20 || alt._isGoalLineHammer) {
                altCase.push(`<strong>Goal-Line TD Monopoly:</strong> Monopolizes high-leverage short-yardage carries (projected for <strong>${alt.stats?.rushTd || 8}+ rush TDs</strong>), generating touchdown equity receivers cannot match.`);
            }
            if ((alt.targetShare || 0) >= 10.0 || (alt.stats?.targets || 0) >= 40) {
                altCase.push(`<strong>Dual-Threat Pass Catching:</strong> Highly involved as a receiver (${alt.targetShare || 12}% target share), protecting him against negative game scripts.`);
            }
        }

        // --- C. POSITIONAL SCARCITY & ROSTER CONTEXT ---
        const altTier = this.getTierDetails(alt);
        const topTier = this.getTierDetails(topPick);
        if (altTier.isLastInTier && altTier.tierNum <= 4 && !topTier.isLastInTier) {
            altCase.push(`<strong>Positional Scarcity:</strong> ${alt.Player} is the LAST remaining player in ${altTier.tierName}. The ${topPick.Pos} board is deeper, allowing you to wait.`);
        }
        if (alt._stackPartner) {
            altCase.push(`<strong>Correlation Stacking:</strong> You want to complete the ${alt.Team} passing stack with ${alt._stackPartner}, exponentially raising your weekly ceiling.`);
        }
        let userOwnsAltStarter = alt.starterName && (team.roster || []).some(r => r._cleanName === State.normalizeName(alt.starterName));
        if (userOwnsAltStarter) {
            altCase.push(`<strong>Roster Insurance:</strong> He is the direct handcuff to your starter (${alt.starterName}), securing your backfield from injury risk.`);
        }

        const topCarries = Math.round(topPick.stats?.rushAtt || 0);
        const altCarries = Math.round(alt.stats?.rushAtt || 0);

        // --- D. DEEP RB NUANCE ---
        if (alt.Pos === 'RB' && topPick.Pos === 'RB') {
            if ((alt.targetShare || 0) > (topPick.targetShare || 0) + 4.0 && State.scoring.ppr >= 0.5) {
                altCase.push(`<strong>PPR Scoring Rules:</strong> You want to heavily exploit PPR scoring, as ${alt.Player} commands elite pass-catching volume (${alt.targetShare}% vs ${topPick.targetShare || 0}%) compared to ${topPick.Player}'s ground-heavy role.`);
            }
            if (altCarries >= topCarries + 15) {
                altCase.push(`<strong>Pure Rushing Workload:</strong> Projects for a heavier pure carry volume (<strong>${altCarries} carries</strong> vs ${topCarries} for ${topPick.Player}), providing immense game-script protection when nursing leads.`);
            }
            if (alt._isGoalLineHammer && !topPick._isGoalLineHammer) {
                altCase.push(`<strong>Touchdown Equity:</strong> You prefer a back who monopolizes high-leverage goal-line carries over a between-the-20s grinder.`);
            }
            if (alt.yacAtt && alt.yacAtt >= 2.9 && (!topPick.yacAtt || alt.yacAtt > topPick.yacAtt + 0.3)) {
                altCase.push(`<strong>Independent Creator:</strong> You trust ${alt.Player}'s elite tackle-breaking ability (<strong>${alt.yacAtt.toFixed(1)} YAC/Att</strong>) over ${topPick.Player}'s scheme dependence.`);
            }
            if (alt._isAscendingRole && !topPick._isAscendingRole) {
                altCase.push(`<strong>Breakout Trajectory:</strong> You are betting on ${alt.Player}'s rapidly expanding mid-season role over ${topPick.Player}'s static workload.`);
            }
            if (alt._inheritsGoalLineWork && !topPick._inheritsGoalLineWork) {
                altCase.push(`<strong>Goal-Line Monopoly:</strong> He inherits vacated short-yardage carries from departed personnel, giving him direct multi-touchdown upside.`);
            }
            if (alt.speedScore && alt.speedScore >= 108.0 && (!topPick.speedScore || alt.speedScore > topPick.speedScore + 6.0)) {
                altCase.push(`<strong>Elite Athletic Profile:</strong> Boasts a rare <strong>${alt.speedScore} Speed Score</strong> (${alt.fortyTime || '4.45'}s at ${alt.weight || 215} lbs), giving him breakaway home-run gear.`);
            }
            if (altRush?.ybcAtt && topRush?.ybcAtt && altRush.ybcAtt >= topRush.ybcAtt + 0.3) {
                altCase.push(`<strong>Superior Blocking Lanes:</strong> His offensive line creates <strong>${altRush.ybcAtt.toFixed(1)} Yards Before Contact</strong> per carry, allowing him to reach the second level cleanly.`);
            }
            if (topPick._backupThreatLevel === 'Goal-Line Vulture Threat' && alt._backupThreatLevel !== 'Goal-Line Vulture Threat') {
                altCase.push(`<strong>Zero Vulture Risk:</strong> ${alt.Player} owns his team's red-zone work, whereas ${topPick.Player}'s touchdown ceiling is actively threatened by ${topPick._backupName || 'a short-yardage vulture'}.`);
            }
            if (alt._vacatedCarries && alt._vacatedCarries >= 45) {
                altCase.push(`<strong>Massive Vacated Volume:</strong> Steps into <strong>+${alt._vacatedCarries} vacated carries</strong> and <strong>+${alt._vacatedRzAtt || 0} red-zone looks</strong> left behind by ${alt._departedBackfieldNames?.slice(0, 2).join(', ') || 'departures'}.`);
            }
        } 
        
        // --- E. DEEP WR/TE NUANCE ---
        if (['WR', 'TE'].includes(alt.Pos) && ['WR', 'TE'].includes(topPick.Pos)) {
            if (alt._isShortAdotOperator && topPick._isSpikeWeekWeapon && State.scoring.ppr >= 0.5) {
                altCase.push(`<strong>PPR Consistency:</strong> You want to avoid weekly volatility and prefer a safe, high-volume underneath chain-mover over a boom/bust deep threat.`);
            } else if (alt._isSpikeWeekWeapon && topPick._isShortAdotOperator) {
                altCase.push(`<strong>Slate-Breaking Ceiling:</strong> You need ceiling and are willing to trade target consistency for ${alt.Player}'s massive depth-of-target (<strong>${alt.aDOT} aDOT</strong>) and splash-play upside.`);
            }
            if (alt._vacatedTgts && alt._vacatedTgts >= 50 && (!topPick._vacatedTgts || topPick._vacatedTgts < 30)) {
                altCase.push(`<strong>Vacated Volume:</strong> You are betting on ${alt.Player} absorbing the massive <strong>+${alt._vacatedTgts} targets</strong> vacated by his team's offseason departures.`);
            }
            if (alt.unrealizedAirYards && alt.unrealizedAirYards >= 550 && alt.racr && alt.racr < 0.72) {
                altCase.push(`<strong>Unrealized Air Yards:</strong> ${alt.Player} is sitting on <strong>${alt.unrealizedAirYards} unrealized air yards</strong> with an artificially low ${alt.racr.toFixed(2)} RACR; positive conversion regression gives him huge breakout upside.`);
            }
            if (alt.tps && alt.tps >= 0.22 && (!topPick.tps || alt.tps > topPick.tps + 0.04)) {
                altCase.push(`<strong>Elite Route Separation:</strong> He commands targets on <strong>${(alt.tps * 100).toFixed(1)}% of his snaps (TPS)</strong>, proving his individual separation skills create independent looks.`);
            }
            if (alt.Pos === 'WR' && alt.height && alt.weight && parseInt(alt.weight, 10) >= 212 && (topPick.weight || 200) < 192) {
                altCase.push(`<strong>Red-Zone Box-Out Frame:</strong> Offers imposing boundary size (${alt.height}, ${alt.weight} lbs) that creates natural mismatch and touchdown leverage near the goal line.`);
            }
            if (alt.Pos === 'TE' && topPick.Pos === 'TE' && alt._teArchetype === 'Detached Alpha "Big Slot"' && topPick._teArchetype !== 'Detached Alpha "Big Slot"') {
                altCase.push(`<strong>Hybrid Slot Alignment:</strong> He runs routes detached from the line like a wide receiver, avoiding the inline blocking responsibilities that cap ${topPick.Player}'s route participation.`);
            }
            if (topPick._targetCompressionRisk && !alt._targetCompressionRisk) {
                altCase.push(`<strong>Uncontested Alpha Status:</strong> Avoids the target cannibalization that ${topPick.Player} faces alongside high-end receiving teammates.`);
            }
        }

        // --- F. FORMAT & SCORING RULES ---
        if ((State.scoring.tePremium || 0) > 0 && alt.Pos === 'TE' && ['WR', 'RB'].includes(topPick.Pos)) {
            altCase.push(`<strong>TE-Premium Arbitrage:</strong> In this format (+${State.scoring.tePremium} TE bonus), ${alt.Player}'s target volume scales with premium value, giving him a structural edge over standard flex options.`);
        }
        if (State.scoring.useMilestones && alt._isSpikeWeekWeapon && !topPick._isSpikeWeekWeapon) {
            altCase.push(`<strong>Milestone Hunter:</strong> His vertical profile (${alt.aDOT} aDOT) makes him far more likely to trigger your league's 100-yard and 20+ yard bonus thresholds for slate-breaking scores.`);
        }

        // --- G. DEEP QB NUANCE ---
        if (alt.Pos === 'QB' && topPick.Pos === 'QB') {
            if (alt.stats?.rushYds && topPick.stats?.rushYds && alt.stats.rushYds > topPick.stats.rushYds + 180) {
                altCase.push(`<strong>Konami Code Upside:</strong> You want to chase the elite dual-threat rushing floor that ${alt.Player} provides (<strong>${alt.stats.rushYds} rush yds</strong>) over a traditional pocket passer.`);
            }
            if (altPass?.rpoPlays && altPass.rpoPlays >= 70) {
                altCase.push(`<strong>RPO Scheme Engine:</strong> Operates in a heavy RPO offense (${altPass.rpoPlays} RPO designs) that freezes second-level defenders and creates wide-open passing lanes.`);
            }
        }

        // --- H. SCHEME, MATCHUP & CONTEXT NUANCES ---
        if (['WR', 'TE'].includes(alt.Pos) && altPass?.playActionYds >= 900 && (topPass?.playActionYds || 0) < 700) {
            let altQB = State.allPlayers.find(q => State.normalizeTeam(q.Team) === altTeam && q.Pos === 'QB' && q.depthChart === 1);
            altCase.push(`<strong>Play-Action Scheme Boost:</strong> He plays in a scheme generating <strong>${altPass.playActionYds} passing yards off play-action</strong> with ${altQB ? altQB.Player : 'his QB'}, creating wide-open chunk targets.`);
        }
        if (alt._garbageTimeInsulated && !topPick._garbageTimeInsulated) {
            altCase.push(`<strong>Garbage-Time Equity:</strong> His underneath target role provides built-in script insulation, keeping his PPR floor active even when his team is trailing in negative game scripts.`);
        }
        if (alt.playoffSOS && topPick.playoffSOS && alt.playoffSOS >= topPick.playoffSOS + 0.4) {
            altCase.push(`<strong>Championship Schedule:</strong> He enjoys a significantly softer matchup slate during the fantasy playoffs (⭐<strong>${alt.playoffSOS.toFixed(1)}</strong> vs ⭐${topPick.playoffSOS.toFixed(1)} SOS in Weeks 15–17).`);
        }
        let isAltInDome = State.stadiumClimates?.Dome?.includes(altTeam);
        if (topPick._coldWeatherRisk && isAltInDome) {
            altCase.push(`<strong>Climate-Controlled Schedule:</strong> He avoids the severe cold-weather December matchups that could drag down ${topPick.Player}'s late-season passing/kicking environment.`);
        }
        if (altEarlySos >= 3.4 && topEarlySos <= 2.8) {
            altCase.push(`<strong>Fast-Start Schedule:</strong> He steps into a favorable opening month (⭐<strong>${altEarlySos.toFixed(1)} SOS</strong> in Weeks 1–4), giving your starting lineup an immediate early-season boost.`);
        }
        if (alt._healthyPpg && alt.Min_Missed_26 > 0 && alt._healthyPpg > ((topPick.ProjPts || 0) / 17)) {
            altCase.push(`<strong>Per-Game Dominance:</strong> If you have early-season roster depth, his <strong>${alt._healthyPpg.toFixed(1)} Healthy PPG</strong> provides elite, championship-winning production the moment he returns.`);
        }
        if (alt._isSuspended) {
            altCase.push(`<strong>Playoff Freshness:</strong> While he misses early games, he will return with full health and fresh legs for the stretch run and fantasy playoffs.`);
        }

        // --- I. MARKET / MACRO PIVOTS ---
        if (alt.adp && alt.adp < currentPickNum - 8) {
            altCase.push(`<strong>Draft Value Slide:</strong> ${alt.Player} has fallen noticeably past his ADP (#${alt.adp.toFixed(0)}), and you want to catch the falling value.`);
        }
        if (alt.age && topPick.age && alt.age <= 23 && topPick.age >= 28) {
            altCase.push(`<strong>Youth & Fresh Legs:</strong> You want to avoid the looming age cliff of ${topPick.Player} (Age ${topPick.age}) and bet on the ascending physical prime of ${alt.Player} (Age ${alt.age}).`);
        }
        if (alt.ceilingPpg && topPick.ceilingPpg && alt.ceilingPpg >= topPick.ceilingPpg + 2.0) {
            altCase.push(`<strong>Slate-Breaking Ceiling:</strong> In maximum-efficiency scenarios, his ceiling reaches <strong>${alt.ceilingPpg.toFixed(1)} PPG</strong>, offering the week-winning upside that ${topPick.Player} lacks.`);
        }
        let altUpside = alt.upsideScore || altVBD;
        let topUpside = topPick.upsideScore || topVBD;
        if (altUpside > topUpside + 5.0) {
            altCase.push(`<strong>Swinging for the Fences:</strong> ${alt.Player} possesses mathematical, week-winning upside that ${topPick.Player} currently lacks.`);
        }

        if (altCase.length === 0) {
            altCase.push(`You simply prefer ${alt.Player}'s offensive environment, scheme fit, and talent profile.`);
        }

        return `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-5">
                <!-- HEADER -->
                <div class="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                        <h5 class="font-black text-slate-900 text-lg">
                            ${alt.Player} <span class="text-sm text-slate-500 font-semibold ml-1">(${alt.Pos} • ${alt.Team})</span>
                        </h5>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-bold text-slate-400 block uppercase">Projected PPG</span>
                        <span class="text-sm font-black text-indigo-700">${altPpg} PPG <span class="text-xs text-slate-500 font-normal">(${(alt.AdvVBD || alt.VBD || 0).toFixed(1)} VBD)</span></span>
                    </div>
                </div>
                
                <!-- THE ANALYST'S TAKE -->
                <div class="mb-4">
                    <h6 class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">The Analyst's Take</h6>
                    <p class="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">${analystTake}</p>
                </div>
                
                <!-- PROS AND CONS DISCUSSION -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-indigo-50/40 rounded-xl p-4 border border-indigo-100">
                        <h6 class="text-[11px] font-extrabold uppercase tracking-wider text-indigo-950 mb-2 flex items-center gap-1.5">
                            <span>🛡️</span> The Case for ${topSurname}
                        </h6>
                        <ul class="text-xs text-slate-700 space-y-2">
                            ${topCase.slice(0, 5).map(c => `<li class="flex items-start"><span class="text-indigo-500 mr-2 font-black">•</span> <span class="leading-snug">${c}</span></li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="bg-emerald-50/40 rounded-xl p-4 border border-emerald-100">
                        <h6 class="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950 mb-2 flex items-center gap-1.5">
                            <span>🔄</span> Why Pivot to ${altSurname}?
                        </h6>
                        <ul class="text-xs text-slate-700 space-y-2">
                            ${altCase.slice(0, 5).map(c => `<li class="flex items-start"><span class="text-emerald-500 mr-2 font-black">•</span> <span class="leading-snug">${c}</span></li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
};
