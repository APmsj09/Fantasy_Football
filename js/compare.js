window.Compare = {
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

        // 1. Raw Value vs Positional Need
        if ((alt.AdvVBD || alt.VBD) > (topPick.AdvVBD || topPick.VBD)) {
            let diff = ((alt.AdvVBD || alt.VBD) - (topPick.AdvVBD || topPick.VBD)).toFixed(1);
            prosForAlt.push(`<strong>Higher Absolute Value:</strong> In a vacuum, ${alt.Player} has a mathematically higher value (+${diff} VBD) regardless of roster needs.`);
            
            if (team.counts[topPick.Pos] < team.counts[alt.Pos]) {
                consForAlt.push(`<strong>Roster Logjam:</strong> You already have depth at ${alt.Pos}. Taking ${topPick.Player} (${topPick.Pos}) fills a bigger structural hole on your team.`);
            }
        }

        // 2. Draft Urgency (ADP Comparison)
        if (alt.adp && topPick.adp) {
            if (alt.adp > topPick.adp + 10) {
                consForAlt.push(`<strong>You Can Wait:</strong> ${alt.Player}'s ADP is ${alt.adp.toFixed(1)}. You have a much higher chance of snagging him in the next round. ${topPick.Player} won't make it back.`);
            } else if (topPick.adp > alt.adp + 10) {
                prosForAlt.push(`<strong>Extreme ADP Value:</strong> ${alt.Player} is sliding way past his ADP (${alt.adp.toFixed(1)}), presenting massive market value.`);
            }
        }

        // 3. Lineup Optimization
        let topPPW = topPick._addedPPW || 0;
        let altPPW = alt._addedPPW || 0;
        if (altPPW > topPPW + 0.5) {
            prosForAlt.push(`<strong>Better Lineup Booster:</strong> Actually adds more points (+${altPPW.toFixed(1)} PPW) to your specific optimal starting lineup than ${topPick.Player}.`);
        } else if (topPPW > altPPW + 0.5) {
            consForAlt.push(`<strong>Bench Warmer Risk:</strong> Because of your current roster, ${alt.Player} only adds +${altPPW.toFixed(1)} PPW to your starters, whereas ${topPick.Player} slides right into your lineup (+${topPPW.toFixed(1)} PPW).`);
        }

        // 4. Boom/Bust Consistency Check
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

        // 5. Positional Head-to-Head
        if (topPick.Pos === alt.Pos) {
            let topTierDrop = topPick._tierCliffTag;
            if (topTierDrop) {
                consForAlt.push(`<strong>Tier Cliff:</strong> Taking ${alt.Player} means missing out on the last player in a major tier (${topPick.Player}). The drop-off after ${topPick.Player} is steep.`);
            }
            if (topPick.targetShare && alt.targetShare && topPick.targetShare > alt.targetShare + 5) {
                consForAlt.push(`<strong>Inferior Volume:</strong> Commands significantly less target share (${alt.targetShare}%) compared to ${topPick.Player} (${topPick.targetShare}%).`);
            }
        }

        // Fallbacks if arrays are empty
        if (prosForAlt.length === 0) prosForAlt.push(`Provides excellent depth as a highly-rated ${alt.Pos}.`);
        if (consForAlt.length === 0) consForAlt.push(`Simply edged out by ${topPick.Player}'s slightly superior overall metrics and team fit.`);

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