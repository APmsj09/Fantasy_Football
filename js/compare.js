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
        const alternatives = recs.slice(1, 10);
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
                <!-- THE PRIMARY TARGET (Writeup Style) -->
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
                    
                    <div class="text-sm leading-relaxed text-slate-700 space-y-3">
                        <p>${this.generateMacroThoughtProcess(topPick, userTeam, nextUserOverallPick)}</p>
                        <p>${this.generateTopPickHighlights(topPick, userTeam, nextUserOverallPick)}</p>
                    </div>
                </div>
                
                <div class="flex items-center gap-3">
                    <div class="h-px bg-slate-200 flex-1"></div>
                    <h4 class="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Alternative Considerations</h4>
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
        let narrative = `The algorithm suggests prioritizing <strong>${p.Player}</strong> at this spot. `;
        const tierInfo = this.getTierDetails(p);
        let posRoster = State.settings.roster[p.Pos];
        let isStarterNeeded = team.counts[p.Pos] < (posRoster ? posRoster.max : 1);
        
        let reasons = [];

        // 1. Lineup Value (+PPW) & Critical Bye-Week Plug
        if (p._byeFillWeek) {
            reasons.push(`he acts as a <strong>critical Week ${p._byeFillWeek} bye-week plug</strong>, insulating a major hole on your roster for a projected <strong>+${p._byeFillPts.toFixed(1)} fill points</strong>`);
        } else if (isStarterNeeded) {
            reasons.push(`he fills an open starting ${p.Pos} slot, directly boosting your optimal weekly lineup by <strong>+${(p._addedPPW || 0).toFixed(2)} Points Per Week</strong>`);
        } else if (p._addedPPW && p._addedPPW >= 1.0) {
            reasons.push(`he forces his way into your starting Flex rotation, adding a massive <strong>+${p._addedPPW.toFixed(2)} Points Per Week</strong> over your current starters`);
        }

        // 2. Positional Scarcity / Tiers
        if (tierInfo.isLastInTier && tierInfo.tierNum <= 4) {
            reasons.push(`he is the <strong>last remaining player in ${tierInfo.tierName}</strong>, preventing a steep positional cliff`);
        } 

        // 3. Market Urgency & Exact Survival Probability %
        if (p.adp && p._survivalProb !== undefined && p._survivalProb < 0.25) {
            let survPct = Math.round(p._survivalProb * 100);
            reasons.push(`board momentum indicates he has only a <strong>${survPct}% chance of surviving</strong> until your next pick (#${nextPick})`);
        } else if (p.adp && (State.currentPick + 1) - p.adp >= 10) {
            reasons.push(`he is experiencing a notable draft-day slide past his ADP of ${p.adp.toFixed(0)}, offering huge surplus value`);
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

    generateTopPickHighlights(p) {
        let highlights = [];

        // Lineup Value / Bye-Week Plug Highlights
        if (p._byeFillWeek) {
            highlights.push(`<strong>Bye-Week Insulation:</strong> Bridges a critical roster vacancy in Week ${p._byeFillWeek} (+${p._byeFillPts.toFixed(1)} fill points).`);
        } else if (p._addedPPW && p._addedPPW >= 1.0) {
            highlights.push(`<strong>Starting Lineup Maximizer:</strong> Adds +${p._addedPPW.toFixed(2)} Points Per Week directly to your optimal starting score.`);
        }

        // Draft Board Urgency
        if (p._survivalProb !== undefined && p._survivalProb < 0.20 && nextPick) {
            highlights.push(`<strong>High Draft Urgency:</strong> Only a ${Math.round(p._survivalProb * 100)}% chance to reach your next pick at #${nextPick}.`);
        }

        // Stacks & Handcuffs
        if (p._stackPartner) highlights.push(`Drafting him completes a highly correlated passing stack with ${p._stackPartner}, raising your weekly ceiling significantly.`);
        else if (p.starterName) highlights.push(`He acts as the direct handcuff to your starter (${p.starterName}), securing an impenetrable insurance policy for your backfield.`);

        // Vacated Target/Carry Nuance
        if (p._vacatedTgts && p._vacatedTgts >= 50) highlights.push(`He enters the season inheriting +${p._vacatedTgts} vacated targets from offseason departures.`);
        else if (p._vacatedCarries && p._vacatedCarries >= 80) highlights.push(`With +${p._vacatedCarries} vacated carries in the backfield, he is positioned for a massive workload expansion.`);

        // Volume Nuance
        if (p.targetShare && p.targetShare >= 22.0) highlights.push(`He commands an elite ${p.targetShare}% target share, insulating his floor from negative game scripts.`);
        else if (p.hvo && p.hvo >= 50) highlights.push(`His profile is built on ${p.hvo} High-Value Opportunities (red-zone touches and targets), which is the exact usage that prints elite fantasy seasons.`);

        // Scheme / Environment Nuance
        if (p.isTeamChanger && p._envDelta && p._envDelta > 0.02) highlights.push(`His offseason move to ${p.Team} places him in a vastly superior offensive environment.`);
        else if (p.olTier === 'S' || p.olTier === 'A') highlights.push(`He operates behind a Tier ${p.olTier} Offensive Line, granting him premium blocking leverage.`);

        // Regression / Upside Nuance
        if (p._positiveTdRegression) highlights.push(`He is mathematically primed for positive touchdown regression based on his actual red-zone usage from last season.`);
        else if (p._isAscendingRole) highlights.push(`We project a significant workload trajectory bump for him this year as he steps into a larger featured role.`);
        
        // QB/TE Specific
        if (p.Pos === 'QB' && p.stats?.rushYds >= 350) highlights.push(`His dual-threat ability adds ${p.stats.rushYds} projected rushing yards to his passing baseline.`);
        if (p.Pos === 'TE' && p.aDOT && p.aDOT >= 8.5) highlights.push(`His elite tight end depth-of-target (${p.aDOT} aDOT) generates WR-like upside.`);

        // Multi-Year Proven Command
        if (p._isProvenMultiYearAlpha) {
            highlights.push(`He has demonstrated multi-year dominance, sustaining a 24%+ target share across consecutive campaigns rather than relying on a one-year projection spike.`);
        } else if (p._isAscendingCareerArc) {
            highlights.push(`His efficiency and per-game opportunity have climbed year-over-year, indicating he is entering the peak breakout window of his career.`);
        }

        // Deep Route & Pocket Time Synergy
        if (p._deepRoutePocketSynergy) {
            highlights.push(`His vertical route tree (${p.aDOT} aDOT) pairs perfectly with an offensive line affording over 2.5s of pocket protection, giving deep concepts time to develop.`);
        }

        // Hidden Injury PPG Edge
        if (p._healthyPpg && p._healthyPpg >= ((p.ProjPts || 0) / 17) + 2.0) {
            highlights.push(`While season totals reflect projected games missed, his underlying ${p._healthyPpg.toFixed(1)} Healthy PPG produces like an elite starter when active.`);
        }

        // Garbage-Time / Script-Proof PPR Insulation
        if (p._garbageTimeInsulated) {
            highlights.push(`His heavy underneath target role creates script-proof garbage time equity, insulating his weekly floor even when trailing.`);
        }

        if (highlights.length === 0) return `From a pure talent perspective, his underlying metrics support a highly stable baseline for the upcoming season.`;

        return highlights.slice(0, 2).join(' ');
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

        // =========================================================
        // 1. THE ANALYST'S TAKE (Macro Rationale)
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
        // 2. THE CASE FOR THE TOP PICK (Defending the Math)
        // =========================================================
        let topCase = [];
        
        // Structural
        if (topPick.Pos !== alt.Pos && isTopStarterNeeded && !isAltStarterNeeded) {
            topCase.push(`Addresses an immediate starting need at ${topPick.Pos}, whereas ${alt.Player} would likely begin as a bench or rotational player.`);
        }
        if (vbdGap > 5.0) {
            topCase.push(`Carries a noticeably safer baseline projection (+${vbdGap.toFixed(1)} VBD).`);
        }

        // Deep Nuance (Floor, Efficiency, Scheme)
        if (topPick.boomBust && alt.boomBust && topPick.boomBust.bust < alt.boomBust.bust - 8.0) {
            topCase.push(`Offers a much safer weekly floor; he busted in only ${topPick.boomBust.bust}% of games last year compared to a volatile ${alt.boomBust.bust}% for ${alt.Player}.`);
        }
        if (topPick._positiveTdRegression && alt._isFlukeTDScorer) {
            topCase.push(`Primed for positive touchdown regression based on his actual red-zone usage, whereas ${alt.Player}'s scoring rate last year was mathematically unsustainable.`);
        }
        if (topPick.olTier === 'S' || (topPick.olTier === 'A' && ['D', 'F'].includes(alt.olTier))) {
            topCase.push(`Benefits from elite trench play behind a Tier ${topPick.olTier} offensive line, while ${alt.Player} faces severe blocking concerns.`);
        }

        // RB specific nuances
        if (topPick.Pos === 'RB' && alt.Pos === 'RB') {
            if (topPick._rbArchetype === 'Bellcow Alpha' && alt._rbArchetype !== 'Bellcow Alpha') {
                topCase.push(`Operates as a true three-down bellcow, insulating his floor with guaranteed volume that ${alt.Player} lacks in a ${alt._rbArchetype || 'shared'} role.`);
            } else if (topPick.hvo && alt.hvo && topPick.hvo > alt.hvo + 15) {
                topCase.push(`Commands significantly more High-Value Opportunities (${topPick.hvo} vs ${alt.hvo} HVO), which are the primary driver of elite RB scoring.`);
            } else if (topPick._inheritsGoalLineWork && !alt._inheritsGoalLineWork) {
                topCase.push(`Inherits massive vacated goal-line work from offseason departures, unlocking a touchdown ceiling that ${alt.Player} doesn't have.`);
            }
        }
        
        // WR/TE specific nuances
        if (['WR', 'TE'].includes(topPick.Pos) && ['WR', 'TE'].includes(alt.Pos)) {
            if (topPick.targetShare > (alt.targetShare || 0) + 6.0) {
                topCase.push(`Commands a significantly larger slice of his team's passing attack (${topPick.targetShare}% vs ${alt.targetShare || 0}%).`);
            } else if (topPick.wopr && alt.wopr && topPick.wopr > alt.wopr + 0.15) {
                topCase.push(`Dominates his team's passing tree with an elite ${topPick.wopr.toFixed(2)} WOPR, guaranteeing a safer target floor.`);
            } else if (topPick._passingTreeType === 'Concentrated 2-Man Funnel' && alt._passingTreeType !== 'Concentrated 2-Man Funnel') {
                topCase.push(`Operates in a highly concentrated passing attack, avoiding the target-share volatility that ${alt.Player} faces in a crowded receiver room.`);
            }
        }

        // QB specific nuances
        if (topPick.Pos === 'QB' && alt.Pos === 'QB') {
            if (topPick.p2s && alt.p2s && topPick.p2s < alt.p2s - 8.0) {
                topCase.push(`Possesses far superior pocket escapability, converting pressure into positive plays rather than taking the drive-killing sacks that plague ${alt.Player}.`);
            }
        }

        // 1. Efficiency & Opportunity Quality (YPT / RACR / Catch Rate)
        if (topPick.ypt && alt.ypt && topPick.ypt >= alt.ypt + 2.0 && (topPick.targetShare || 0) >= 16) {
            topCase.push(`Generates far more yardage per look (${topPick.ypt.toFixed(1)} vs ${alt.ypt.toFixed(1)} YPT), maximizing his opportunities rather than relying on empty volume.`);
        }
        if (topPick.trueCatchRate && alt.dropRate && topPick.trueCatchRate >= 90.0 && alt.dropRate >= 8.0) {
            topCase.push(`Displays elite hands (${topPick.trueCatchRate.toFixed(1)}% catch rate on catchable balls), while ${alt.Player} has struggled with drive-killing drops (${alt.dropRate.toFixed(1)}% drop rate).`);
        }

        // 2. Tackle Breaking & Run Creation (YAC / ERR)
        if (topPick.Pos === 'RB' && alt.Pos === 'RB') {
            if (topPick.err && alt.err && topPick.err >= alt.err + 1.8) {
                topCase.push(`Possesses superior big-play burst with a ${topPick.err.toFixed(1)}% Explosive Run Rate compared to ${alt.Player}'s ${alt.err.toFixed(1)}% mark.`);
            }
            if (topPick.fumbleRate && alt._fumbleRisk) {
                topCase.push(`Carries far lower benching risk; ${alt.Player} has shown persistent ball-security issues that could cost him high-leverage touches.`);
            }
        }

        // 3. Quarterback Supporting Cast & Protection
        if (topPick.Pos === 'QB' && alt.Pos === 'QB') {
            if (topPick._eliteWeaponCount > (alt._eliteWeaponCount || 0)) {
                topCase.push(`Operates with a much stronger pass-catching arsenal (${topPick._eliteWeaponCount} elite separators), allowing him to sustain drives and red-zone efficiency better than ${alt.Player}.`);
            }
            if (alt._shortLeashRisk && !topPick._shortLeashRisk) {
                topCase.push(`Enjoys total job security as an uncontested franchise starter, whereas ${alt.Player} carries in-season benching risk with a high-pedigree backup behind him.`);
            }
        }

        // 4. Offensive Environment & Blocking Lanes (YBC)
        let topTeam = State.normalizeTeam(topPick.Team);
        let altTeam = State.normalizeTeam(alt.Team);
        let topRush = State.teamAdvRush?.[topTeam];
        let altRush = State.teamAdvRush?.[altTeam];

        if (topPick.Pos === 'RB' && alt.Pos === 'RB' && topRush?.ybcAtt && altRush?.ybcAtt) {
            if (topRush.ybcAtt >= altRush.ybcAtt + 0.5) {
                topCase.push(`Runs behind a significantly more dominant run-blocking unit, getting ${topRush.ybcAtt.toFixed(1)} Yards Before Contact per attempt vs just ${altRush.ybcAtt.toFixed(1)} for ${alt.Player}.`);
            }
        }

        // 5. Multi-Year Track Record vs. Projection Fluke
        if (topPick._isProvenMultiYearAlpha && !alt._isProvenMultiYearAlpha) {
            topCase.push(`Brings a verified multi-year track record of commanding high-volume target share, carrying far less projection risk than ${alt.Player}.`);
        }
        if (alt._isSystemDependentRB && topPick._isIndependentYACCreator) {
            topCase.push(`Creates his own yardage after contact (${topPick.yacAtt?.toFixed(1)} YAC), whereas ${alt.Player}'s historical production was heavily propped up by system blocking lanes.`);
        }

        if (topCase.length === 0) topCase.push(`Provides a slightly better overall blend of usage metrics and matchup stability.`);
        
        // Non-PPR / Standard Scoring Ground Dominance
        if (State.scoring.ppr === 0 && topPick.Pos === 'RB' && (topPick.stats?.rushAtt || 0) > (alt.stats?.rushAtt || 0) + 40) {
            topCase.push(`In Standard (Non-PPR) scoring, his heavy carry volume (${Math.round(topPick.stats.rushAtt)} proj carries) is vastly more valuable than ${alt.Player}'s catch-dependent profile.`);
        }

        // TE-Premium Advantage
        if ((State.scoring.tePremium || 0) > 0 && topPick.Pos === 'TE' && ['WR', 'RB'].includes(alt.Pos)) {
            topCase.push(`Capitalizes directly on your league's TE-Premium rule (+${State.scoring.tePremium} pts/rec), mathematically elevating his receptions above standard skill-position scoring.`);
        }

        // Prototype Workhorse Frame vs Slight Frame
        if (topPick.Pos === 'RB' && topPick.bmi && topPick.bmi >= 31.0 && alt.weight && parseInt(alt.weight, 10) < 200) {
            topCase.push(`Carries a prototypical workhorse frame (${topPick.weight} lbs, ${topPick.bmi.toFixed(1)} BMI) built to absorb full-season contact, while ${alt.Player}'s lighter build carries durability concerns.`);
        }

        // 1st Round NFL Capital vs Late-Round Pick
        if (topPick.nflDraftPick && topPick.nflDraftPick <= 32 && alt.draftRound && alt.draftRound >= 4) {
            topCase.push(`Backed by 1st-round NFL draft capital and long-term organizational commitment, securing him a much longer leash during slumps than ${alt.Player}.`);
        }

        // Uncontested Route Monopoly vs 12-Personnel Timeshare (TEs)
        if (topPick.Pos === 'TE' && alt._teCommitteeThreat) {
            topCase.push(`Commands complete route participation, whereas ${alt.Player} splits routes in heavy 12-personnel formations with a capable secondary tight end.`);
        }

        // Alpha Focus vs Target Compression (WRs)
        if (topPick.Pos === 'WR' && alt._targetCompressionRisk) {
            topCase.push(`Operates as the clear focal point of his offense, avoiding the target-cannibalization that ${alt.Player} faces alongside another elite teammate.`);
        }

        // Clean Backfield Lead vs 3-Back Committee Drag (RBs)
        if (topPick.Pos === 'RB' && alt._rb3ThreatNote) {
            topCase.push(`Has a clean grasp on backfield volume, while ${alt.Player}'s touch ceiling is actively threatened by multiple rotational backs.`);
        }

        // Early-Season Soft Schedule (Weeks 1-4)
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

        if (topEarlySos >= 3.6 && altEarlySos <= 2.5) {
            topCase.push(`Enjoys a soft opening schedule (⭐${topEarlySos.toFixed(1)} SOS in Wks 1–4), providing immediate starting production while ${alt.Player} navigates a difficult early gauntlet.`);
        }

        // Avoiding Bye Week Stacking
        if (alt.byeWeek && alt.byeWeek !== 'N/A') {
            let sameByeCount = team.roster.filter(r => String(r.byeWeek) === String(alt.byeWeek)).length;
            if (sameByeCount >= 3) {
                topCase.push(`Drafting him avoids creating a severe Week ${alt.byeWeek} bye-week hole (${sameByeCount} of your players are already off that week).`);
            }
        }

        // Tight Variance Band (High Floor Security)
        if (topPick.floorPpg && alt.floorPpg && topPick.floorPpg >= alt.floorPpg + 2.5) {
            topCase.push(`Establishes a rock-solid floor (${topPick.floorPpg.toFixed(1)} Floor PPG vs ${alt.floorPpg.toFixed(1)} for ${alt.Player}), giving you reliable weekly output without dud risk.`);
        }

        // Clean Bill of Health vs Post-Surgery Pitch Count
        if (topPick._isFullyCleared && alt._isMajorReturn) {
            topCase.push(`Enters the season with 100% health, whereas ${alt.Player} is returning from a major procedure and may see managed snap counts early on.`);
        }

        // =========================================================
        // 3. THE CASE FOR THE ALTERNATIVE (When to Pivot)
        // =========================================================
        let altCase = [];
        
        // Positional & Scarcity Pivots
        if (topPick.Pos !== alt.Pos && isAltStarterNeeded) {
            altCase.push(`If securing your starting ${alt.Pos} slot feels more urgent to you right now than taking the raw value at ${topPick.Pos}.`);
        }
        const altTier = this.getTierDetails(alt);
        const topTier = this.getTierDetails(topPick);
        if (altTier.isLastInTier && altTier.tierNum <= 4 && !topTier.isLastInTier) {
            altCase.push(`<strong>Positional Scarcity:</strong> ${alt.Player} is the LAST remaining player in ${altTier.tierName}. The ${topPick.Pos} board is deeper, allowing you to wait.`);
        }

        // Synergy Pivots
        if (alt._stackPartner) {
            altCase.push(`<strong>Correlation Stacking:</strong> You want to complete the ${alt.Team} passing stack with ${alt._stackPartner}, exponentially raising your weekly ceiling.`);
        }
        let userOwnsAltStarter = alt.starterName && team.roster.some(r => r._cleanName === State.normalizeName(alt.starterName));
        if (userOwnsAltStarter) {
            altCase.push(`<strong>Roster Insurance:</strong> He is the direct handcuff to your starter (${alt.starterName}), securing your backfield from injury risk.`);
        }

        // Deep Nuance Pivots (Archetypes & Traits)
        if (alt.Pos === 'RB' && topPick.Pos === 'RB') {
            if (alt.targetShare > (topPick.targetShare || 0) + 5.0 && State.scoring.ppr >= 0.5) {
                altCase.push(`<strong>PPR Scoring Rules:</strong> You want to heavily exploit PPR scoring, as ${alt.Player} commands elite pass-catching volume compared to ${topPick.Player}'s ground-heavy role.`);
            } else if (alt._isGoalLineHammer && !topPick._isGoalLineHammer) {
                altCase.push(`<strong>Touchdown Equity:</strong> You prefer a back who monopolizes high-leverage goal-line carries over a between-the-20s grinder.`);
            } else if (alt.yacAtt && topPick.yacAtt && alt.yacAtt > topPick.yacAtt + 0.5) {
                altCase.push(`<strong>Independent Creator:</strong> You trust ${alt.Player}'s elite tackle-breaking ability (${alt.yacAtt.toFixed(1)} YAC/Att) over ${topPick.Player}'s scheme dependence.`);
            } else if (alt._isAscendingRole && !topPick._isAscendingRole) {
                altCase.push(`<strong>Breakout Trajectory:</strong> You are betting on ${alt.Player}'s rapidly expanding mid-season role over ${topPick.Player}'s static workload.`);
            }
        } 
        else if (['WR', 'TE'].includes(alt.Pos) && ['WR', 'TE'].includes(topPick.Pos)) {
            if (alt._isShortAdotOperator && topPick._isSpikeWeekWeapon && State.scoring.ppr >= 0.5) {
                altCase.push(`<strong>PPR Consistency:</strong> You want to avoid weekly volatility and prefer a safe, high-volume underneath chain-mover over a boom/bust deep threat.`);
            } else if (alt._isSpikeWeekWeapon && topPick._isShortAdotOperator) {
                altCase.push(`<strong>Slate-Breaking Ceiling:</strong> You need ceiling and are willing to trade target consistency for ${alt.Player}'s massive depth-of-target (${alt.aDOT} aDOT) and splash-play upside.`);
            } else if (alt._vacatedTgts && alt._vacatedTgts >= 60 && (!topPick._vacatedTgts || topPick._vacatedTgts < 30)) {
                altCase.push(`<strong>Vacated Volume:</strong> You are betting on ${alt.Player} absorbing the massive +${alt._vacatedTgts} targets vacated by his team's offseason departures.`);
            }
        }
        else if (alt.Pos === 'QB' && topPick.Pos === 'QB') {
            if (alt.stats?.rushYds && topPick.stats?.rushYds && alt.stats.rushYds > topPick.stats.rushYds + 200) {
                altCase.push(`<strong>Konami Code Upside:</strong> You want to chase the elite dual-threat rushing floor that ${alt.Player} provides over a traditional pocket passer.`);
            }
        }

        // Market / Macro Pivots
        if (alt.adp && alt.adp < currentPickNum - 10) {
            altCase.push(`<strong>Draft Value Slide:</strong> ${alt.Player} has fallen noticeably past his ADP (${alt.adp.toFixed(0)}), and you want to catch the falling value.`);
        }
        if (alt.age && topPick.age && alt.age <= 23 && topPick.age >= 28) {
            altCase.push(`<strong>Youth & Fresh Legs:</strong> You want to avoid the looming age cliff of ${topPick.Player} and bet on the ascending physical prime of ${alt.Player}.`);
        }
        
        let altUpside = alt.upsideScore || altVBD;
        let topUpside = topPick.upsideScore || topVBD;
        if (altUpside > topUpside + 6.0) {
            altCase.push(`<strong>Swinging for the Fences:</strong> ${alt.Player} possesses mathematical, week-winning upside that ${topPick.Player} currently lacks.`);
        }

        // Fallback Pivot
        if (altCase.length === 0) altCase.push(`You simply prefer ${alt.Player}'s offensive environment, scheme fit, and talent profile.`);

        // 1. Unrealized Air Yards & RACR Positive Regression
        if (alt.unrealizedAirYards && alt.unrealizedAirYards >= 600 && alt.racr && alt.racr < 0.70) {
            altCase.push(`<strong>Unrealized Air Yards:</strong> ${alt.Player} is sitting on ${alt.unrealizedAirYards} unrealized air yards with an artificially low ${alt.racr.toFixed(2)} RACR; if his target conversion regresses positively, he has slate-breaking upside.`);
        }

        // 2. Per-Route Target Command (TPS)
        if (alt.tps && alt.tps >= 0.22 && (!topPick.tps || alt.tps > topPick.tps + 0.04)) {
            altCase.push(`<strong>Elite Route Separation:</strong> He commands targets on ${(alt.tps * 100).toFixed(1)}% of his snaps (TPS), proving his individual separation skills create independent opportunity.`);
        }

        // 3. Environmental Scheme & Play-Action / RPO Upgrades
        let altPass = State.teamAdvPass?.[altTeam];
        let topPass = State.teamAdvPass?.[topTeam];
        
        if (['WR', 'TE'].includes(alt.Pos) && altPass?.playActionYds >= 950 && (topPass?.playActionYds || 0) < 700) {
            altCase.push(`<strong>Play-Action Scheme Boost:</strong> He plays in a scheme generating ${altPass.playActionYds} passing yards off play-action, creating wide-open chunk targets compared to ${topPick.Player}'s drop-back heavy offense.`);
        }

        // 4. O-Line & Yards Before Contact Edge
        if (alt.Pos === 'RB' && altRush?.ybcAtt && topRush?.ybcAtt && altRush.ybcAtt >= topRush.ybcAtt + 0.4) {
            altCase.push(`<strong>Superior Blocking Lanes:</strong> His offensive line creates ${altRush.ybcAtt.toFixed(1)} Yards Before Contact per carry, allowing him to reach the second level before taking contact.`);
        }

        // 5. Tight End Route Detachment & Alignment
        if (alt.Pos === 'TE' && topPick.Pos === 'TE') {
            if (alt._teArchetype === 'Detached Alpha "Big Slot"' && topPick._teArchetype !== 'Detached Alpha "Big Slot"') {
                altCase.push(`<strong>Hybrid Slot Alignment:</strong> He runs routes detached from the line like a wide receiver, avoiding the inline blocking responsibilities that cap ${topPick.Player}'s route participation.`);
            }
        }

        // 6. Playoff Matchup & Weather Insulation
        if (alt.playoffSOS && topPick.playoffSOS && alt.playoffSOS >= topPick.playoffSOS + 0.5) {
            altCase.push(`<strong>Championship Schedule:</strong> He enjoys a significantly softer matchup slate during the fantasy playoffs (⭐${alt.playoffSOS.toFixed(1)} vs ⭐${topPick.playoffSOS.toFixed(1)} SOS in Weeks 15–17).`);
        }
        if (topPick._coldWeatherRisk && !alt._coldWeatherRisk) {
            altCase.push(`<strong>Climate-Controlled Schedule:</strong> He avoids the severe cold-weather December matchups that could drag down ${topPick.Player}'s late-season passing/kicking environment.`);
        }

        // 7. Healthy PPG Valuation on Injured Players
        if (alt._healthyPpg && alt.Min_Missed_26 > 0 && alt._healthyPpg > ((topPick.ProjPts || 0) / 17)) {
            altCase.push(`<strong>Per-Game Dominance:</strong> If you have early-season roster depth, his ${alt._healthyPpg.toFixed(1)} Healthy PPG provides elite, championship-winning production the moment he returns.`);
        }

        // 8. Goal-Line & Red-Zone Monopoly
        if (alt.Pos === 'RB' && alt._inheritsGoalLineWork && !topPick._inheritsGoalLineWork) {
            altCase.push(`<strong>Goal-Line Monopoly:</strong> He inherits vacated short-yardage carries from departed personnel, giving him direct multi-touchdown upside on a weekly basis.`);
        }

        // TE-Premium Pivot
        if ((State.scoring.tePremium || 0) > 0 && alt.Pos === 'TE' && ['WR', 'RB'].includes(topPick.Pos)) {
            altCase.push(`<strong>TE-Premium Arbitrage:</strong> In this format (+${State.scoring.tePremium} TE bonus), ${alt.Player}'s target volume scales with premium value, giving him an structural edge over standard flex options.`);
        }

        // Big-Play Milestone Bonuses
        if (State.scoring.useMilestones && alt._isSpikeWeekWeapon && !topPick._isSpikeWeekWeapon) {
            altCase.push(`<strong>Milestone Hunter:</strong> His vertical profile (${alt.aDOT} aDOT) makes him far more likely to trigger your league's 100-yard and 20+ yard bonus thresholds for slate-breaking scores.`);
        }

        // Elite Speed Score Athlete
        if (alt.speedScore && alt.speedScore >= 110.0 && (!topPick.speedScore || alt.speedScore > topPick.speedScore + 8.0)) {
            altCase.push(`<strong>Elite Athletic Profile:</strong> Boasts a rare ${alt.speedScore} Speed Score (${alt.fortyTime}s at ${alt.weight} lbs), giving him the breakaway gear to turn routine touches into 50+ yard touchdowns.`);
        }

        // Imposing Boundary WR Size (Red-Zone Box-Out)
        if (alt.Pos === 'WR' && alt.height && alt.weight && parseInt(alt.weight, 10) >= 215 && (topPick.weight || 200) < 190) {
            altCase.push(`<strong>Red-Zone Box-Out Frame:</strong> Offers imposing boundary size (${alt.height}, ${alt.weight} lbs) that creates natural mismatch and touchdown leverage near the goal line.`);
        }

        // Heavy RPO & Play-Action Attack
        if (alt.Pos === 'QB' && State.teamAdvPass?.[altTeam]?.rpoPlays >= 75) {
            altCase.push(`<strong>RPO Scheme Engine:</strong> Operates in a heavy RPO offense (${State.teamAdvPass[altTeam].rpoPlays} RPO designs) that freezes second-level defenders and creates wide-open passing lanes.`);
        }

        // Trailing-Script PPR Garbage Time Insulation
        if (alt._garbageTimeInsulated && !topPick._garbageTimeInsulated) {
            altCase.push(`<strong>Garbage-Time Equity:</strong> His underneath target role provides built-in script insulation, keeping his PPR floor active even when his team is trailing in negative game scripts.`);
        }

        // Soft Opening Schedule
        if (altEarlySos >= 3.6 && topEarlySos <= 2.6) {
            altCase.push(`<strong>Fast-Start Schedule:</strong> He steps into a favorable opening month (⭐${altEarlySos.toFixed(1)} SOS in Weeks 1–4), giving your starting lineup an immediate early-season boost.`);
        }

        // Sky-High Ceiling Scenario
        if (alt.ceilingPpg && topPick.ceilingPpg && alt.ceilingPpg >= topPick.ceilingPpg + 3.0) {
            altCase.push(`<strong>Slate-Breaking Ceiling:</strong> In maximum-efficiency scenarios, his ceiling reaches ${alt.ceilingPpg.toFixed(1)} PPG, offering the week-winning upside that ${topPick.Player} lacks.`);
        }

        // Post-Suspension / Late-Season Fresh Legs
        if (alt._isSuspended) {
            altCase.push(`<strong>Playoff Freshness:</strong> While he misses early games, he will return with full health and fresh legs for the stretch run and fantasy playoffs.`);
        }

         // Ensure only the top 3 most distinct arguments are displayed
        let finalTopCase = topCase.slice(0, 4);
        let finalAltCase = altCase.slice(0, 4);


        // =========================================================
        // 4. RENDER THE CARD
        // =========================================================
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
