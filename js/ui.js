const UI = {
    databaseSortKey: 'advVbd',
    databaseSortDir: 'desc',

    getPlayerAge(p) {
        if (p?.age !== undefined && p?.age !== null && p.age !== '') return p.age;
        if (p?.Age !== undefined && p?.Age !== null && p.Age !== '') return p.Age;
        return null;
    },

    normalizeSearchText(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    },

    sortDatabase(key) {
        if (this.databaseSortKey === key) {
            this.databaseSortDir = this.databaseSortDir === 'desc' ? 'asc' : 'desc';
        } else {
            this.databaseSortKey = key;
            this.databaseSortDir = 'desc';
        }
        this.renderDatabase();
    },

    getDatabaseSortValue(player, key) {
        switch (key) {
            case 'player':
                return player.Player || '';
            case 'pos':
                return player.Pos || '';
            case 'team':
                return player.Team || '';
            case 'projPts':
                return Number(player.ProjPts || 0);
            case 'vbd':
                return Number(player.VBD || 0);
            case 'advVbd':
                return Number(player.AdvVBD || player.VBD || 0);
            case 'avgStars':
                return Number(player.avgStars || 0);
            case 'age': {
                const age = this.getPlayerAge(player);
                return age === null || age === undefined || age === '' ? Number.NEGATIVE_INFINITY : Number(age);
            }
            case 'adp': {
                const adp = player.adp;
                return adp === undefined || adp === null || adp === '' ? Number.POSITIVE_INFINITY : Number(adp);
            }
            case 'depth': {
                const depth = player.depthChart;
                const numDepth = Number(depth);
                return depth === undefined || depth === null || depth === '' || Number.isNaN(numDepth) ? Number.POSITIVE_INFINITY : numDepth;
            }
            case 'snap': {
                const snap = player.snapShare;
                return snap === undefined || snap === null || snap === '' ? Number.NEGATIVE_INFINITY : Number(snap);
            }
            case 'bye': {
                const bye = player.byeWeek;
                const numBye = Number(bye);
                return bye === undefined || bye === null || bye === '' || Number.isNaN(numBye) ? Number.POSITIVE_INFINITY : numBye;
            }
            default:
                return Number(player.AdvVBD || player.VBD || 0);
        }
    },

    switchTab(targetId) {
        const targetScreen = document.getElementById(targetId);
        if (!targetScreen) return;

        document.querySelectorAll('.screen').forEach(screen => {
            const isActive = screen.id === targetId;
            screen.classList.toggle('active', isActive);
            screen.classList.toggle('hidden', !isActive);
        });

        document.querySelectorAll('.nav-btn').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-target') === targetId);
        });

        if (targetId === 'player-db-screen') this.renderDatabase();
    },

    showMessage(title, message) {
        const titleEl = document.getElementById('message-modal-title');
        titleEl.innerHTML = title;
        const contentEl = document.getElementById('message-modal-content');
        contentEl.innerHTML = message;
        contentEl.scrollTop = 0;
        const modalEl = document.getElementById('message-modal');
        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
    },

    renderDatabase() {
        const tbody = document.getElementById('db-players-body');
        if (!tbody) return;

        let filterPos = document.getElementById('db-position')?.value || '';
        let search = this.normalizeSearchText(document.getElementById('db-search')?.value || '');
        let searchTerms = search.split(/\s+/).filter(Boolean);

        let filtered = State.allPlayers.filter(p => {
            if (filterPos && p.Pos !== filterPos) return false;

            const searchableText = [
                p.Player,
                p.Team,
                p.Pos,
                p._cleanName,
                p._cleanTeam,
                p._cleanPos
            ].filter(Boolean).join(' ').toLowerCase();

            if (!searchTerms.length) return true;
            return searchTerms.every(term => searchableText.includes(term));
        });

        filtered = [...filtered].sort((a, b) => {
            let aVal = this.getDatabaseSortValue(a, this.databaseSortKey);
            let bVal = this.getDatabaseSortValue(b, this.databaseSortKey);

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const comparison = aVal.localeCompare(bVal);
                return this.databaseSortDir === 'desc' ? -comparison : comparison;
            }

            if (aVal === bVal) {
                const fallback = (a.Player || '').localeCompare(b.Player || '');
                return fallback;
            }

            const direction = this.databaseSortDir === 'desc' ? -1 : 1;
            return (aVal > bVal ? 1 : -1) * direction;
        });

        let htmlStr = '';

        filtered.slice(0, 200).forEach(p => {
            let vbdVal = p.VBD.toFixed(1);
            let advVbdVal = (p.AdvVBD || p.VBD).toFixed(1);
            let stars = p.avgStars ? `⭐ ${p.avgStars.toFixed(2)}` : '-';
            let bye = p.byeWeek && p.byeWeek !== 'N/A' ? `Wk ${p.byeWeek}` : '-';
            let age = this.getPlayerAge(p) !== null ? `${this.getPlayerAge(p)} y/o` : '—';
            let adp = p.adp !== undefined && p.adp !== null ? `${p.adp.toFixed(1)}` : '—';
            let depth = p.depthChart !== undefined && p.depthChart !== null ? `${p.depthChart}` : '—';
            let snap = p.snapShare !== undefined && p.snapShare !== null ? `${p.snapShare.toFixed(0)}%` : '—';
            let olTag = p.olTier ? `<span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">OL ${p.olTier}</span>` : '';

            let vbdColor = p.VBD >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium';
            let advVbdColor = p.AdvVBD >= 0 ? 'text-indigo-600 font-extrabold' : 'text-red-400 font-bold';

            htmlStr += `
                <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="UI.showWeeklyModal('${p._cleanName}')">
                    <td class="px-6 py-3 text-sm font-medium text-gray-900">${p.Player}${olTag}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${p.Pos}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${p.Team}</td>
                    <td class="px-6 py-3 text-sm font-bold text-indigo-600">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-6 py-3 text-sm ${vbdColor}">${vbdVal}</td>
                    <td class="px-6 py-3 text-sm ${advVbdColor}">${advVbdVal}</td>
                    <td class="px-6 py-3 text-sm font-semibold text-amber-600">${stars}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${age}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${adp}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${depth}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${snap}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${bye}</td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlStr;
    },

    switchPlayerCardTab(tabName) {
        const overviewTab = document.getElementById('card-tab-overview');
        const writeupTab = document.getElementById('card-tab-writeup');
        const btnOverview = document.getElementById('btn-tab-overview');
        const btnWriteup = document.getElementById('btn-tab-writeup');

        if (!overviewTab || !writeupTab) return;

        if (tabName === 'overview') {
            overviewTab.classList.remove('hidden');
            writeupTab.classList.add('hidden');
            btnOverview.className = "px-4 py-2 font-bold text-xs rounded-xl bg-indigo-600 text-white shadow-sm transition-all";
            btnWriteup.className = "px-4 py-2 font-bold text-xs rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
        } else {
            overviewTab.classList.add('hidden');
            writeupTab.classList.remove('hidden');
            btnWriteup.className = "px-4 py-2 font-bold text-xs rounded-xl bg-indigo-600 text-white shadow-sm transition-all";
            btnOverview.className = "px-4 py-2 font-bold text-xs rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all";
        }
    },

    generatePlayerWriteup(p) {
        const age = this.getPlayerAge(p);
        const pos = p.Pos;
        const proj = p.ProjPts || 0;
        const ppg = (proj / 17).toFixed(1);
        const advVbd = (p.AdvVBD || p.VBD || 0).toFixed(1);
        const tTeam = State.normalizeTeam(p.Team);
        
        // -------------------------------------------------------------
        // 1. POSITIONAL RANK & TIER CONTEXT
        // -------------------------------------------------------------
        const posPlayers = State.allPlayers
            .filter(x => x.Pos === pos)
            .sort((a, b) => (b.AdvVBD || b.VBD) - (a.AdvVBD || a.VBD));
        const posRank = posPlayers.findIndex(x => x._cleanName === p._cleanName) + 1;
        const posRankStr = posRank > 0 ? `${pos}${posRank}` : `${pos}`;
        
        let tierLabel = "Starter";
        if (posRank <= 12) tierLabel = `High-End ${pos}1`;
        else if (posRank <= 24) tierLabel = `Solid ${pos}2`;
        else if (posRank <= 36) tierLabel = `Flex / ${pos}3`;
        else tierLabel = "Bench Depth";

        // -------------------------------------------------------------
        // 2. YEAR-OVER-YEAR TRAJECTORY (2025 Actual vs 2026 Projection)
        // -------------------------------------------------------------
        let trajectoryHTML = "";
        if (p.pastPpg && p.pastPpg > 0) {
            const diff = (Number(ppg) - p.pastPpg).toFixed(1);
            if (diff >= 1.5) {
                trajectoryHTML = `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">📈 Projected Surge (+${diff} PPG vs 2025)</span>`;
            } else if (diff <= -1.5) {
                trajectoryHTML = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">📉 Regression Alert (${diff} PPG vs 2025)</span>`;
            } else {
                trajectoryHTML = `<span class="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">⚖️ Stable PPG Trend (~${p.pastPpg.toFixed(1)} PPG in 2025)</span>`;
            }
        }

        // -------------------------------------------------------------
        // 3. ADP MARKET VALUE ANALYSIS
        // -------------------------------------------------------------
        let marketValueHTML = "";
        if (p.adp) {
            const overallRank = State.allPlayers.findIndex(x => x._cleanName === p._cleanName) + 1;
            const diff = p.adp - overallRank;
            if (diff >= 12) {
                marketValueHTML = `<div class="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-200">🔥 <strong>Massive Market Discount:</strong> VBD ranks him #<strong>${overallRank}</strong> overall, but market ADP is <strong>#${p.adp.toFixed(0)}</strong> (+${diff.toFixed(0)} pick value).</div>`;
            } else if (diff <= -12) {
                marketValueHTML = `<div class="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-200">⚠️ <strong>Market Premium / Reach:</strong> Drafting at ADP #<strong>${p.adp.toFixed(0)}</strong> requires reaching ahead of his #<strong>${overallRank}</strong> VBD Rank.</div>`;
            } else {
                marketValueHTML = `<div class="p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-slate-300">🎯 <strong>Fair Market Alignment:</strong> ADP (#${p.adp.toFixed(0)}) closely tracks overall VBD Model Rank (#${overallRank}).</div>`;
            }
        }

        // -------------------------------------------------------------
        // 4. FANTASY PLAYOFF SCHEDULE (Weeks 15-17)
        // -------------------------------------------------------------
        let playoffSOS = p.playoffSOS || p.avgStars || 3.0;
        let playoffHTML = "";
        if (playoffSOS >= 3.8) {
            playoffHTML = `<div class="p-2.5 bg-amber-950/60 border border-amber-800 rounded-lg text-amber-200">🏆 <strong>Championship Schedule:</strong> Prime playoff SOS (⭐<strong>${playoffSOS.toFixed(2)}</strong>/5.0) in Weeks 15–17.</div>`;
        } else if (playoffSOS <= 2.3) {
            playoffHTML = `<div class="p-2.5 bg-indigo-950/60 border border-indigo-800 rounded-lg text-indigo-200">❄️ <strong>Brutal Playoff Run:</strong> Difficult matchup stretch (⭐<strong>${playoffSOS.toFixed(2)}</strong>/5.0) during fantasy playoffs.</div>`;
        }

        // -------------------------------------------------------------
        // 5. DYNAMIC BULL CASE (Pros)
        // -------------------------------------------------------------
        let pros = [];
        if (p.targetShare && p.targetShare >= 22) pros.push(`<strong>Alpha Target Share:</strong> Commands a dominant ${p.targetShare}% target share in the passing game.`);
        if (p.hvo && p.hvo >= 70) pros.push(`<strong>High-Value Opportunities:</strong> Generates elite goal-line & receiving usage (${p.hvo} HVO).`);
        if (p.olTier === 'S' || p.olTier === 'A') pros.push(`<strong>Elite Trench Protection:</strong> Operates behind an elite Tier ${p.olTier} Offensive Line.`);
        if (p.aDOT && p.aDOT >= 12) pros.push(`<strong>Deep Threat Upside:</strong> Boasts a high ${p.aDOT} aDOT for explosive chunk-play potential.`);
        if (p.avgStars && p.avgStars >= 3.3) pros.push(`<strong>Soft Overall Schedule:</strong> Favorable ${p.avgStars.toFixed(2)}/5.0 Strength of Schedule rating.`);
        if (p.snapShare && p.snapShare >= 75) pros.push(`<strong>Workhorse Snap Share:</strong> On the field for ${p.snapShare.toFixed(0)}% of offensive snaps.`);
        if (p._addedPPW && p._addedPPW >= 0.3) pros.push(`<strong>Lineup Difference Maker:</strong> Adds +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
        if (p.isRBStarter && p.handcuffName) pros.push(`<strong>Clear Backfield Lead:</strong> Uncontested RB1 status with designated handcuff (${p.handcuffName}).`);
        
        // Scheme-Specific Pros
        const passEnv = State.teamAdvPass ? State.teamAdvPass[tTeam] : null;
        const rushEnv = State.teamAdvRush ? State.teamAdvRush[tTeam] : null;
        if (pos === 'RB' && rushEnv && rushEnv.ybcAtt >= 2.8) {
            pros.push(`<strong>YBC Scheme Boost:</strong> Offensive blocking creates ${rushEnv.ybcAtt} Yards Before Contact per carry.`);
        }
        if (['WR', 'TE'].includes(pos) && passEnv && passEnv.playActionYds >= 950) {
            pros.push(`<strong>Play-Action Heavy:</strong> Team generates ${passEnv.playActionYds} yards off play-action setups.`);
        }

        if (pros.length === 0) pros.push("Solid baseline candidate with standard positional volume.");

        // -------------------------------------------------------------
        // 6. DYNAMIC BEAR CASE (Risks / Cons)
        // -------------------------------------------------------------
        let cons = [];
        let riskScore = 0;

        if (age) {
            if (pos === 'RB' && age >= 27) { cons.push(`<strong>Age Cliff Risk:</strong> At ${age} y/o, running backs face steep decline and injury curves.`); riskScore += 2; }
            if (pos === 'WR' && age >= 31) { cons.push(`<strong>Veteran Age Risk:</strong> Age ${age} puts him past the peak WR productivity curve.`); riskScore += 2; }
        }
        if (p.olTier === 'D' || p.olTier === 'F') { cons.push(`<strong>Poor O-Line Environment:</strong> Struggling Tier ${p.olTier} offensive line could cap overall efficiency.`); riskScore += 1; }
        if (p.pressureRate && p.pressureRate > 22) { cons.push(`<strong>Pressure Vulnerability:</strong> Faces heavy defensive pressure (${p.pressureRate.toFixed(1)}% rate).`); riskScore += 1; }
        if (p.dropRate && p.dropRate >= 8) { cons.push(`<strong>Hands / Drop Concerns:</strong> Sufferings from an elevated ${p.dropRate.toFixed(1)}% drop rate.`); riskScore += 1; }
        if (p.avgStars && p.avgStars <= 2.7) { cons.push(`<strong>Tough Overall Schedule:</strong> Faces a grueling ${p.avgStars.toFixed(2)}/5.0 star schedule.`); riskScore += 1; }
        if (p.depthChart && p.depthChart > 1) { cons.push(`<strong>Depth Chart Trait:</strong> Currently slotted at Depth #${p.depthChart} on the team.`); riskScore += 1; }
        
        if (cons.length === 0) cons.push("Minimal red flags based on historical stats and offensive environment.");

        // Risk Badge
        let riskBadge = `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">🛡️ LOW RISK</span>`;
        if (riskScore >= 3) riskBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">⚠️ HIGH RISK</span>`;
        else if (riskScore === 2) riskBadge = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">⚡ MODERATE RISK</span>`;

        // -------------------------------------------------------------
        // 7. RANGE OF OUTCOMES (Floor / Ceiling Calculation)
        // -------------------------------------------------------------
        let ceilingPpg = (Number(ppg) * 1.25).toFixed(1);
        let floorPpg = (Number(ppg) * 0.75).toFixed(1);
        
        if (p.upsideScore && p.AdvVBD) {
            let upsideBoost = Math.min(1.4, Math.max(1.1, p.upsideScore / p.AdvVBD));
            ceilingPpg = (Number(ppg) * upsideBoost).toFixed(1);
        }

        // -------------------------------------------------------------
        // 8. FINAL HTML OUTPUT TEMPLATE
        // -------------------------------------------------------------
        return `
            <div class="space-y-4 text-xs leading-relaxed">
                <!-- Executive Summary Box -->
                <div class="bg-indigo-950 text-indigo-100 p-4 rounded-xl border border-indigo-800 shadow-sm">
                    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
                        <div class="flex items-center space-x-2">
                            <span class="font-extrabold text-white text-sm uppercase tracking-wider">${posRankStr} (${tierLabel})</span>
                            ${trajectoryHTML}
                        </div>
                        <div>${riskBadge}</div>
                    </div>
                    <p class="text-indigo-200">
                        ${p.Player} is projected for <strong>${proj.toFixed(1)} total fantasy pts</strong> (~${ppg} PPG) with an Advanced VBD of <strong>${advVbd}</strong>.
                        ${p.isNewRole ? `Transitioning into a fresh offensive role on ${p.Team}, where touch distributions favor his athletic profile.` : `Remains a focal point in the ${p.Team} attack.`}
                    </p>
                </div>

                <!-- Market Value & Playoff Context Row -->
                ${(marketValueHTML || playoffHTML) ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        ${marketValueHTML || '<div></div>'}
                        ${playoffHTML || '<div></div>'}
                    </div>
                ` : ''}

                <!-- Pros & Cons Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Bull Case -->
                    <div class="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                        <h5 class="font-extrabold text-emerald-900 text-xs uppercase tracking-wider mb-2.5 flex items-center">
                            <span class="mr-1.5">🚀</span> Bull Case (Good Points)
                        </h5>
                        <ul class="space-y-2 text-emerald-950">
                            ${pros.map(pro => `<li class="flex items-start"><span class="text-emerald-600 mr-2 font-bold">•</span><div>${pro}</div></li>`).join('')}
                        </ul>
                    </div>

                    <!-- Bear Case -->
                    <div class="bg-rose-50/70 border border-rose-200 p-4 rounded-xl">
                        <h5 class="font-extrabold text-rose-900 text-xs uppercase tracking-wider mb-2.5 flex items-center">
                            <span class="mr-1.5">⚠️</span> Bear Case (Risks & Flaws)
                        </h5>
                        <ul class="space-y-2 text-rose-950">
                            ${cons.map(con => `<li class="flex items-start"><span class="text-rose-600 mr-2 font-bold">•</span><div>${con}</div></li>`).join('')}
                        </ul>
                    </div>
                </div>

                <!-- Range of Outcomes -->
                <div class="bg-slate-900 text-white p-4 rounded-xl border border-slate-800">
                    <h4 class="font-extrabold text-xs uppercase tracking-wider mb-3 text-amber-400">Range of Outcomes (Weekly Floor / Ceiling)</h4>
                    <div class="grid grid-cols-3 gap-3 text-center">
                        <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                            <span class="text-[10px] text-slate-400 uppercase font-bold block">Floor Scenario</span>
                            <span class="text-base font-extrabold text-rose-400">${floorPpg} PPG</span>
                            <span class="text-[9px] text-slate-400 block mt-0.5">Role shrinkage / Injury risk</span>
                        </div>
                        <div class="bg-slate-800/80 p-2.5 rounded-lg border border-indigo-500/50">
                            <span class="text-[10px] text-indigo-300 uppercase font-bold block">Median Projection</span>
                            <span class="text-base font-extrabold text-white">${ppg} PPG</span>
                            <span class="text-[9px] text-indigo-200 block mt-0.5">Base expected volume</span>
                        </div>
                        <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                            <span class="text-[10px] text-slate-400 uppercase font-bold block">Ceiling Scenario</span>
                            <span class="text-base font-extrabold text-emerald-400">${ceilingPpg} PPG</span>
                            <span class="text-[9px] text-slate-400 block mt-0.5">TD Luck & Max Efficiency</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    showPlayerCard(cleanName) {
        let p = State.allPlayers.find(x => x._cleanName === cleanName);
        if (!p) return;

        let s = p.stats || {};
        let isOffense = !['PK', 'DST'].includes(p.Pos);

        let ageDisplay = this.getPlayerAge(p);

        let envBadges = [];
        const tTeam = State.normalizeTeam(p.Team);
        const passEnv = State.teamAdvPass ? State.teamAdvPass[tTeam] : null;
        const rushEnv = State.teamAdvRush ? State.teamAdvRush[tTeam] : null;

        if (rushEnv && rushEnv.ybcAtt >= 2.8 && p.Pos === 'RB') {
            envBadges.push(`<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">⚡ High YBC Scheme (${rushEnv.ybcAtt} YBC)</span>`);
        }
        if (passEnv && passEnv.onTgtPct >= 76.0 && ['WR', 'TE'].includes(p.Pos)) {
            envBadges.push(`<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">🎯 High QB Accuracy Env (${passEnv.onTgtPct}%)</span>`);
        }
        if (passEnv && passEnv.playActionYds >= 950 && ['QB', 'WR', 'TE'].includes(p.Pos)) {
            envBadges.push(`<span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200">🚀 Play-Action Heavy Scheme</span>`);
        }
        if (passEnv && passEnv.prssPct >= 25.0) {
            envBadges.push(`<span class="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">⚠️ High Pass Pressure Env (${passEnv.prssPct}%)</span>`);
        }

        // Add visual O-Line Badges
        if (p.olTier === 'S' || p.olTier === 'A') {
            envBadges.push(`<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">🛡️ Elite O-Line (Tier ${p.olTier})</span>`);
        } else if (p.olTier === 'D' || p.olTier === 'F') {
            envBadges.push(`<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">⚠️ Poor O-Line (Tier ${p.olTier})</span>`);
        }

        let envBadgesHTML = envBadges.length > 0 ? `<div class="flex flex-wrap gap-2 mb-2">${envBadges.join('')}</div>` : '';

        let ppwBadge = p._addedPPW && p._addedPPW > 0.1
            ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">📈 +${p._addedPPW.toFixed(1)} PPW Lineup Fit</span>`
            : '';

        let advancedMetricsHTML = '';

        if (isOffense) {
            const buildBar = (label, value, max, unit = '', color = 'indigo') => {
                if (value === undefined || value === null) return '';
                let pct = Math.min(100, Math.max(0, (value / max) * 100));
                return `
                <div class="mb-3">
                   <div class="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                       <span>${label}</span>
                       <span class="text-gray-900">${value}${unit}</span>
                   </div>
                   <div class="w-full bg-slate-200 rounded-full h-1.5 shadow-inner">
                       <div class="bg-${color}-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
                   </div>
                </div>`;
            };

            let barHTML = '';
            if (p.targetShare) barHTML += buildBar('Target Share', p.targetShare, 35, '%', 'indigo');
            if (p.snapShare) barHTML += buildBar('Snap Share', p.snapShare, 100, '%', 'emerald');
            if (p.trueCatchRate) barHTML += buildBar('True Catch Rate', p.trueCatchRate.toFixed(1), 100, '%', 'blue');
            if (p.aDOT) barHTML += buildBar('Average Depth of Target', p.aDOT, 15, ' yds', 'amber');
            if (p.airYards) barHTML += buildBar('Total Air Yards', p.airYards, 2000, ' yds', 'amber');
            if (p.yacAtt) barHTML += buildBar('Yards After Contact', p.yacAtt, 4, ' yds', 'purple');
            if (p.brokenTackles) barHTML += buildBar('Broken Tackles', p.brokenTackles, 30, '', 'red');
            // Render Synthesized Pro Metrics
            if (p.hvo) barHTML += buildBar('High-Value Opps (Rec + RZ)', p.hvo, 130, '', 'emerald');
            if (p.ypt) barHTML += buildBar('Yards Per Target', p.ypt.toFixed(1), 12, ' yds', 'blue');
            if (p.pressureRate) barHTML += buildBar('Pressure Rate Faced', p.pressureRate.toFixed(1), 30, '%', 'rose');
            
            if (p.rzTgt || p.rzAtt) barHTML += buildBar('Red Zone Opps', (p.rzTgt || 0) + (p.rzAtt || 0), 60, '', 'slate');
            if (barHTML) {
                advancedMetricsHTML = `
                <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4">
                    <h4 class="font-bold text-xs text-gray-700 uppercase tracking-wider mb-3">Advanced Usage Analytics</h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                        ${barHTML}
                    </div>
                </div>`;
            }
        }

        let pastStatsHTML = '';
        if (p.pastStats && p.pastPts !== undefined) {
            let ps = p.pastStats;
            let volumeStr = '';
            let tdCount = ps.totalTd || 0;

            if (p.Pos === 'QB') {
                volumeStr = `${ps.passYds || 0} Pass Yds (${ps.passTd || 0} TD / ${ps.int || 0} INT) • ${ps.rushYds || 0} Rush Yds (${ps.rushTd || 0} TD)`;
            } else if (p.Pos === 'RB') {
                volumeStr = `${ps.rushYds || 0} Rush Yds (${ps.rushTd || 0} TD) • ${ps.rec || 0}/${ps.targets || 0} Rec (${ps.recYds || 0} Yds, ${ps.recTd || 0} TD)`;
            } else {
                volumeStr = `${ps.rec || 0}/${ps.targets || 0} Rec (${ps.recYds || 0} Yds, ${ps.recTd || 0} TD)${ps.targetShare ? ` [${ps.targetShare}% Tgt Share]` : ''}`;
                if (ps.rushYds && ps.rushYds > 0) volumeStr += ` • ${ps.rushYds} Rush Yds`;
            }

            let ppgStr = p.pastPpg ? `${p.pastPpg.toFixed(1)} PPG` : 'N/A';
            let bigPlayStr = ps.bigPlays ? `<span class="ml-2 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">💥 ${ps.bigPlays} Big Plays (20+)</span>` : '';

            pastStatsHTML = `
                <div class="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-xl mb-4 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">2025 Actual Performance (${ps.gp || 17} Games)${bigPlayStr}</span>
                        <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">${ppgStr}</span>
                    </div>
                    <div class="text-xs font-bold text-indigo-950">${volumeStr}</div>
                </div>
            `;
        }

        let statsDashboard = '';
        if (isOffense) {
            let opps = (s.rushAtt || 0) + (s.targets || 0);
            statsDashboard = `
                <div class="bg-indigo-900 text-white p-4 rounded-xl border border-indigo-800 mb-4 shadow-sm text-xs grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="p-2">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Projected Output</span>
                        <span class="text-lg font-extrabold text-white">${p.ProjPts.toFixed(1)} Pts</span>
                        <span class="block text-[10px] text-emerald-400 font-bold mt-1">Adv VBD: ${(p.AdvVBD || p.VBD).toFixed(1)}</span>
                    </div>
                    <div class="p-2 border-l border-indigo-700/50">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Total Volume</span>
                        <span class="text-lg font-extrabold text-white">${opps}</span>
                        <span class="block text-[10px] text-indigo-200 mt-1">Touches / Tgts</span>
                    </div>
                    <div class="p-2 border-l border-indigo-700/50">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Schedule Grade</span>
                        <span class="text-lg font-extrabold text-amber-400">⭐ ${p.avgStars ? p.avgStars.toFixed(2) : '3.0'}</span>
                        <span class="block text-[10px] text-indigo-200 mt-1">Playoffs: ⭐${(p.playoffSOS || p.avgStars || 3.0).toFixed(1)}</span>
                    </div>
                    <div class="p-2 border-l border-indigo-700/50">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Line Protection</span>
                        <span class="text-lg font-extrabold text-white">${p.olTier ? p.olTier : 'N/A'}</span>
                        ${p.olRunBlk ? `<span class="block text-[10px] text-indigo-200 mt-1">Run Blk #${p.olRunBlk} | Pass Blk #${p.olPassBlk}</span>` : '<span class="block text-[10px] text-indigo-200 mt-1">No Line Data</span>'}
                    </div>
                </div>

                <div class="bg-white p-3.5 rounded-xl border border-slate-200 mb-4 text-xs text-gray-800 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4">
                    ${p.Pos === 'QB' ? `
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Pass Comp / Att</span> ${s.passCmp} / ${s.passAtt}</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Pass Yds / Rating</span> ${s.passYds} <span class="text-gray-400">(${s.passerRating})</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">TD : INT</span> <span class="text-emerald-600 font-bold">${s.passTd} TD</span> / <span class="text-red-500">${s.int} INT</span></div>
                        ${p.trueAccuracy ? `<div><span class="font-bold text-gray-400 block text-[10px] uppercase">True Accuracy</span> ${p.trueAccuracy.toFixed(1)}%</div>` : ''}
                    ` : ''}

                    ${s.rushAtt > 0 ? `
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rushing Vol</span> ${s.rushAtt} Att</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rush Yds / YPC</span> ${s.rushYds} yds <span class="text-emerald-600 font-bold">(${s.rushAvg} YPC)</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rush TDs</span> ${s.rushTd} TD</div>
                    ` : ''}

                    ${s.targets > 0 ? `
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Receiving Vol</span> ${s.rec} Rec / ${s.targets} Tgt</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rec Yds / YPR</span> ${s.recYds} yds <span class="text-indigo-600 font-bold">(${s.recAvg} YPR)</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rec TDs</span> ${s.recTd} TD</div>
                    ` : ''}
                </div>
            `;
        }

        let handcuffBadge = '';
        if (p.isRBStarter && p.handcuffName) {
            handcuffBadge = `<span class="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">🛡️ Handcuff: ${p.handcuffName}</span>`;
        } else if (p.isRBHandcuff && p.starterName) {
            handcuffBadge = `<span class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">🔒 Handcuff for ${p.starterName}</span>`;
        }

        let modalTitle = `<div class="flex items-center flex-wrap gap-2">
            <span>${p.Player}</span>
            <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-normal">${p.Pos} • ${p.Team}</span>
            ${handcuffBadge}
            ${ageDisplay ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Age ${ageDisplay}</span>` : ''}
            ${p.byeWeek && p.byeWeek !== 'N/A' ? `<span class="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Wk ${p.byeWeek} Bye</span>` : ''}
        </div>`;

        const writeupHTML = this.generatePlayerWriteup(p);

        UI.showMessage(modalTitle, `
            <div class="flex gap-2 mb-4 border-b border-gray-100 pb-3">
                <button id="btn-tab-overview" onclick="UI.switchPlayerCardTab('overview')" class="px-4 py-2 font-bold text-xs rounded-xl bg-indigo-600 text-white shadow-sm transition-all">Overview & Analytics</button>
                <button id="btn-tab-writeup" onclick="UI.switchPlayerCardTab('writeup')" class="px-4 py-2 font-bold text-xs rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">🤖 AI Scout Write-Up</button>
            </div>

            <div id="card-tab-overview">
                <div class="mb-3">${envBadgesHTML}${ppwBadge}</div>
                ${statsDashboard}
                ${pastStatsHTML} 
                ${advancedMetricsHTML}
                
                <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <h4 class="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">18-Week Weekly Projection Trajectory</h4>
                    <div class="relative h-40 w-full">
                        <canvas id="player-weekly-chart"></canvas>
                    </div>
                </div>
            </div>

            <div id="card-tab-writeup" class="hidden">
                ${writeupHTML}
            </div>
        `);

        setTimeout(() => {
            const ctx = document.getElementById('player-weekly-chart');
            if (!ctx) return;

            if (window.playerChartInst) {
                window.playerChartInst.destroy();
                window.playerChartInst = null;
            }

            if (!p.weeklyProjections || Object.keys(p.weeklyProjections).length === 0) {
                ctx.innerHTML = '<div class="flex h-full items-center justify-center text-sm text-gray-500">No weekly projection data available.</div>';
                return;
            }

            if (typeof window.Chart !== 'function') {
                ctx.innerHTML = '<div class="flex h-full items-center justify-center text-sm text-gray-500">Chart unavailable in this environment.</div>';
                return;
            }

            let labels = [], data = [], colors = [];
            for (let w = 1; w <= 18; w++) {
                labels.push(`Wk ${w}`);
                let pts = Number(p.weeklyProjections[`W${w}`] || 0);
                data.push(pts);

                if (w >= 15 && w <= 17) colors.push('rgba(245, 158, 11, 0.7)');
                else colors.push('rgba(79, 70, 229, 0.7)');
            }

            window.playerChartInst = new window.Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Projected Fantasy Pts',
                        data: data,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 } } }
                    }
                }
            });
        }, 50);
    },

    showWeeklyModal(cleanName) {
        this.showPlayerCard(cleanName);
    },

    renderProfileAssignments() {
        const container = document.getElementById('profile-assignments-container');
        if (!container) return;

        const numTeams = parseInt(document.getElementById('setting-teams').value) || 12;
        const userPick = parseInt(document.getElementById('setting-user-pick').value) || 1;

        let profiles = Object.values(State.managerProfiles);
        let optionsHtml = `<option value="">Random AI</option>`;
        profiles.forEach(p => {
            optionsHtml += `<option value="${p.name}">${p.name}</option>`;
        });

        const prevSelections = {};
        for (let i = 1; i <= 32; i++) {
            let el = document.getElementById(`profile-team-${i}`);
            if (el) prevSelections[i] = el.value;
        }

        container.innerHTML = '';
        for (let i = 1; i <= numTeams; i++) {
            let isUser = (i === userPick);
            container.innerHTML += `
                <div>
                    <label class="text-gray-600 block mb-1 text-xs font-semibold">Team ${i} ${isUser ? '<span class="text-indigo-600">(You)</span>' : ''}</label>
                    <select id="profile-team-${i}" class="w-full border-gray-300 border rounded-lg p-2 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                        ${optionsHtml}
                    </select>
                </div>
            `;
        }

        for (let i = 1; i <= numTeams; i++) {
            let el = document.getElementById(`profile-team-${i}`);
            if (el && prevSelections[i]) el.value = prevSelections[i];
        }
    },

    updateDraftBoard() {
        if (!State.draftStarted) return;

        const userTeam = State.teamsById[State.userTeamId];
        State.evaluateRosterFits(userTeam, State.availablePlayers);

        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        document.getElementById('current-round').textContent = round;
        document.getElementById('current-pick-number').textContent = (State.currentPick % State.settings.numTeams) + 1;

        if (State.currentPick < State.draftOrder.length) {
            const onClockId = State.draftOrder[State.currentPick];
            const onClockTeam = State.teamsById[onClockId];
            document.getElementById('on-the-clock').textContent = onClockTeam.name;

            let badgeBadge = document.getElementById('drafting-for-badge');
            badgeBadge.textContent = `Drafting for: ${onClockTeam.name}`;

            if (onClockId === State.userTeamId) {
                badgeBadge.className = "text-sm font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full shadow-sm";
            } else {
                badgeBadge.className = "text-sm font-medium px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full shadow-sm";
            }
        } else {
            document.getElementById('on-the-clock').textContent = "Complete";
            document.getElementById('drafting-for-badge').textContent = "Draft Complete";
            this.renderStandings();
            this.switchTab('summary-screen');
        }

        this.renderDraftAvailablePlayers();
        this.renderMyRoster();
        this.renderRecommendations();
        this.renderRosters();
        this.renderDraftBoardGrid();
    },

    renderDraftAvailablePlayers() {
        const tbody = document.getElementById('draft-players-body');
        let htmlStr = '';

        let displayList = State.availablePlayers.slice(0, 100);
        let isMock = State.settings.draftMode === 'mock';
        let onClockId = State.draftOrder[State.currentPick];
        let isUserTurn = isMock && (onClockId === State.userTeamId);

        displayList.forEach(p => {
            let btnHtml = "";
            let safeName = p._cleanName;

            if (isMock && !isUserTurn) {
                btnHtml = `<button class="bg-gray-200 text-gray-400 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-not-allowed" disabled>Wait</button>`;
            } else {
                btnHtml = `<button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-[11px] font-bold shadow-sm draft-btn transition-colors" data-player="${safeName}">Draft</button>`;
            }

            let adpStr = p.adp ? p.adp.toFixed(1) : '-';
            let byeStr = p.byeWeek && p.byeWeek !== 'N/A' ? `Wk ${p.byeWeek}` : '-';
            let depthStr = p.depthChart ? `#${p.depthChart}` : '-';

            let advTags = [];

            if (p.isNewRole && p.depthChart) {
                advTags.push(`<span class="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">📋 ${p.Team} ${p.Pos}${p.depthChart} Role</span>`);
            }
            if (p.targetShare && p.targetShare > 22) advTags.push(`<span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">${p.targetShare}% Tgts</span>`);
            if (p.aDOT && p.aDOT > 12) advTags.push(`<span class="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">${p.aDOT} aDOT</span>`);
            if (p.brokenTackles && p.brokenTackles > 15) advTags.push(`<span class="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">${p.brokenTackles} B-Tkl</span>`);

            const userTeam = State.teamsById[State.userTeamId];
            const userOwnsStarter = p.starterName && userTeam?.roster.some(r => r._cleanName === State.normalizeName(p.starterName));

            if (userOwnsStarter) {
                advTags.push(`<span class="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">🔒 Handcuff for ${p.starterName}</span>`);
            } else if (p.isRBHandcuff) {
                advTags.push(`<span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Handcuff (${p.starterName})</span>`);
            }

            let tagHTML = advTags.length > 0 ? `<div class="flex gap-1 mt-1 text-[9px] font-bold">${advTags.join('')}</div>` : '';

            let ppwStr = p._addedPPW && p._addedPPW > 0.1
                ? `<span class="font-bold text-emerald-600">+${p._addedPPW.toFixed(1)}</span>`
                : `<span class="text-gray-300">-</span>`;

            let ageStr = p.age ? `<span class="text-[9px] font-semibold text-slate-400 ml-1">Age ${p.age}</span>` : '';
            let olBadge = p.olTier ? `<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">OL ${p.olTier}</span>` : '';
            let sosBadge = p.avgStars ? `<span class="ml-1 inline-flex items-center text-[10px] font-bold text-amber-500">⭐ ${p.avgStars.toFixed(1)}</span>` : '';

            htmlStr += `
                <tr class="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer" onclick="if (!event.target.closest('.draft-btn')) UI.showPlayerCard('${p._cleanName}')">
                    <td class="px-3 py-2 text-[11px] font-bold text-gray-900 w-1/3">
                        <div class="flex items-center">
                            <span>${p.Player}</span>
                            <span class="font-normal text-gray-400 ml-1.5">${p.Team}</span>
                            ${ageStr} ${olBadge} ${sosBadge}
                        </div>
                        ${tagHTML}
                    </td>
                    <td class="px-2 py-2 text-[11px] text-gray-600 font-medium">${p.Pos}</td>
                    <td class="px-2 py-2 text-[11px] font-bold text-indigo-600">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-2 py-2 text-[11px] font-extrabold text-indigo-900">${(p.AdvVBD || p.VBD).toFixed(1)}</td>
                    <td class="px-2 py-2 text-[11px]">${ppwStr}</td>
                    <td class="px-2 py-2 text-[11px] text-gray-600">${adpStr}</td>
                    <td class="px-2 py-2 text-[11px] text-gray-600">${byeStr}</td>
                    <td class="px-2 py-2 text-[11px] text-gray-600">${depthStr}</td>
                    <td class="px-3 py-2 text-right">${btnHtml}</td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlStr;
    },

    sortTable(type, key) {
        if (type === 'draft') {
            if (State.draftSortKey === key) State.draftSortAsc = !State.draftSortAsc;
            else { State.draftSortKey = key; State.draftSortAsc = false; }

            State.availablePlayers.sort((a, b) => {
                let valA = a[key] ?? (key === 'AdvVBD' ? (a.AdvVBD || a.VBD) : 0);
                let valB = b[key] ?? (key === 'AdvVBD' ? (b.AdvVBD || b.VBD) : 0);
                if (typeof valA === 'string') return State.draftSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                return State.draftSortAsc ? valA - valB : valB - valA;
            });
            this.renderDraftAvailablePlayers();
        }
    },

    // ⚡ OVERHAULED RECOMMENDATIONS TO MAXIMIZE PPW, MANAGE KICKERS, AND PREVENT SCARCITY DROP-OFFS
    renderRecommendations() {
        const container = document.getElementById('recommendations-container');
        if (!container || State.currentPick >= State.draftOrder.length) return;

        const userTeam = State.teamsById[State.userTeamId];
        if (!userTeam) return;

        const dispNameEl = document.getElementById('user-team-name-disp');
        if (dispNameEl) dispNameEl.textContent = userTeam.name;

        const currentRound = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const totalRounds = State.settings.roster.totalSize;
        const currentOverallPick = State.currentPick + 1;

        let nextPickIdx = State.draftOrder.findIndex((teamId, idx) => idx > State.currentPick && teamId === State.userTeamId);
        let nextUserOverallPick = nextPickIdx !== -1 ? (nextPickIdx + 1) : (currentOverallPick + 2);

        const getSurvivalProb = (adp) => {
            let playerAdp = adp || currentOverallPick;
            let diff = playerAdp - nextUserOverallPick;
            return 1 / (1 + Math.exp(-0.10 * diff));
        };

        const getOpportunityScore = (p) => {
            let baseVal = ((p._addedPPW || 0) * 15) + (p.AdvVBD || p.VBD);
            let survivalProb = getSurvivalProb(p.adp);
            let urgency = 1 - survivalProb; 
            return baseVal * (1 + (0.20 * urgency));
        };

        // ===========================================================
        // POINT 4: ROSTER BUILD STRATEGY ADVISOR
        // ===========================================================
        let userRoster = userTeam.roster;
        let earlyRBs = userRoster.filter(p => p.Pos === 'RB' && (p.draftPickNum || 99) <= 60).length;
        let earlyWRs = userRoster.filter(p => p.Pos === 'WR' && (p.draftPickNum || 99) <= 60).length;
        let strategyBanner = "";

        if (currentRound <= 7) {
            if (earlyRBs === 0 && userRoster.length >= 3) {
                strategyBanner = `<div class="p-2 mb-2 bg-indigo-950 border border-indigo-700 rounded-lg text-[10px] text-indigo-200">🛡️ <strong>Zero-RB Build:</strong> Target WR/TE depth. Look for high-HVO passing RBs in Rnds 7-10.</div>`;
            } else if (earlyRBs === 1 && earlyWRs >= 2) {
                strategyBanner = `<div class="p-2 mb-2 bg-emerald-950 border border-emerald-700 rounded-lg text-[10px] text-emerald-200">🦸 <strong>Hero-RB Build:</strong> Anchor RB locked. Focus on WR/TE value before filling RB2.</div>`;
            } else if (earlyRBs >= 3) {
                strategyBanner = `<div class="p-2 mb-2 bg-amber-950 border border-amber-700 rounded-lg text-[10px] text-amber-200">💪 <strong>Robust-RB Build:</strong> RB foundation set. Heavily target WR/TE depth to balance roster.</div>`;
            }
        }

        // ===========================================================
        // POINT 1: DYNAMIC POSITIONAL TIER CLIFF ALERTS
        // ===========================================================
        let tierAlertsHTML = "";
        ['RB', 'WR', 'TE', 'QB'].forEach(pos => {
            let tiers = State.getPositionalTiers(pos);
            if (tiers.length > 0 && tiers[0].length === 1) {
                let lastPlayer = tiers[0][0];
                let nextTop = tiers[1] ? (tiers[1][0].AdvVBD || tiers[1][0].VBD) : 0;
                let drop = ((lastPlayer.AdvVBD || lastPlayer.VBD) - nextTop).toFixed(1);
                if (drop >= 7.0 && userTeam.counts[pos] < State.settings.roster[pos].max) {
                    tierAlertsHTML += `<div class="p-2 mb-2 bg-rose-950 border border-rose-700 rounded-lg text-[10px] text-rose-200">⚡ <strong>Tier Cliff Alert:</strong> ${lastPlayer.Player} is the LAST ${pos} in Tier 1 (-${drop} VBD drop to Tier 2).</div>`;
                }
            }
        });

        let viablePlayers = State.availablePlayers.filter(p => {
            let pos = p.Pos;
            if (pos === 'PK' && currentRound <= totalRounds - 3) return false;

            let posRoster = State.settings.roster[pos];
            let starterMax = posRoster ? posRoster.max : 1;

            if (userTeam.counts[pos] < starterMax) return true;
            if (State.isPositionFlexEligible(pos) && userTeam.counts['Flex'] < State.settings.roster.Flex.max) return true;
            if (userTeam.counts['Bench'] < State.settings.roster.Bench.max) return true;
            return false;
        });

        // User drafted QBs for Stacking Logic (Point 2)
        let userQBs = userRoster.filter(r => r.Pos === 'QB');

        viablePlayers.forEach(p => {
            let score = ((p._addedPPW || 0) * 20) + ((p.AdvVBD || p.VBD) * 0.5);

            // ===========================================================
            // POINT 2: QB-WR/TE STACKING SYNERGY BOOST
            // ===========================================================
            let matchingQB = userQBs.find(qb => qb._cleanTeam === p._cleanTeam);
            if (matchingQB && ['WR', 'TE'].includes(p.Pos)) {
                score += 10.0; // Recommendation boost
                p._stackPartner = matchingQB.Player;
            } else {
                p._stackPartner = null;
            }

            // ===========================================================
            // POINT 3: LATE-ROUND CEILING / UPSIDE BOOST (Rounds 9+)
            // ===========================================================
            if (currentRound >= 9 && p.upsideScore) {
                let ceilingGain = (p.upsideScore - (p.AdvVBD || p.VBD)) * 0.75;
                score += ceilingGain;
            }

            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 0;
            let currentCount = userTeam.counts[p.Pos] || 0;

            let isStarterOpen = currentCount < starterMax;
            let isFlexOpen = State.isPositionFlexEligible(p.Pos) && (userTeam.counts['Flex'] < State.settings.roster.Flex.max);

            if (isStarterOpen) {
                score += 25;
            } else if (isFlexOpen) {
                score += 18;
            } else {
                let overage = currentCount - starterMax;
                if (State.isPositionFlexEligible(p.Pos)) {
                    score -= (overage * 10);
                } else {
                    score -= 100;
                }
            }

            let userOwnsStarter = p.starterName && userRoster.some(r => r._cleanName === State.normalizeName(p.starterName));
            if (userOwnsStarter) score += 5;

            p._recScore = score;
        });

        let bestFit = [...viablePlayers]
            .filter(p => {
                let posRoster = State.settings.roster[p.Pos];
                let starterMax = posRoster ? posRoster.max : 1;
                if (['QB', 'TE', 'PK', 'DST'].includes(p.Pos) && userTeam.counts[p.Pos] >= starterMax && currentRound < 12) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => getOpportunityScore(b) - getOpportunityScore(a))[0];

        if (bestFit && (bestFit._addedPPW || 0) <= 0.1) bestFit = null;

        let sortedByRec = [...viablePlayers].sort((a, b) => b._recScore - a._recScore);
        let vbdRecs = sortedByRec.filter(p => p !== bestFit).slice(0, 3);

        let htmlStr = strategyBanner + tierAlertsHTML;

        if (bestFit) {
            let survivalProb = getSurvivalProb(bestFit.adp);
            let ppwText = `+${bestFit._addedPPW.toFixed(1)} PPW Lineup Fit`;
            let stackBadge = bestFit._stackPartner ? ` • ⚡ Stack w/ ${bestFit._stackPartner}` : '';
            let urgencyTag = (survivalProb < 0.15 && bestFit.adp && bestFit.adp < nextUserOverallPick) ? ` • ⚡ High Urgency` : ``;

            htmlStr += `
            <div class="p-3 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl border border-emerald-500 flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition mb-2" onclick="UI.showPlayerCard('${bestFit._cleanName}')">
                <div>
                    <span class="text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 mb-1 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Best Lineup Addition
                    </span>
                    <h4 class="font-bold text-sm text-white">${bestFit.Player}</h4>
                    <p class="text-[10px] text-emerald-100 font-medium">${bestFit.Pos} • ${ppwText}${stackBadge}${urgencyTag}</p>
                </div>
            </div>`;
        }

        htmlStr += vbdRecs.map((p, i) => {
            let stackBadge = p._stackPartner ? ` • ⚡ Stack w/ ${p._stackPartner}` : '';
            let survivalProb = getSurvivalProb(p.adp);
            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 1;
            let isStarterNeeded = userTeam.counts[p.Pos] < starterMax;
            let hasPositiveValue = (p.AdvVBD || p.VBD) > 0;

            let highlight = '';
            if (p._stackPartner) highlight = `⚡ Stack with ${p._stackPartner}`;
            else if (currentRound >= 9 && p.upsideScore > p.AdvVBD * 1.1) highlight = `🚀 High Ceiling Target`;
            else if (survivalProb < 0.15 && (isStarterNeeded || hasPositiveValue)) highlight = `⚡ High Urgency (Gone by Pick ${nextUserOverallPick})`;
            else if (p.adp && (p.adp < currentOverallPick)) highlight = `ADP Value (Passed ADP ${p.adp.toFixed(0)})`;
            else if (isStarterNeeded) highlight = `Strong Team Need`;
            else highlight = `Flex / Bench Depth`;

            return `
            <div class="p-3 bg-indigo-800/80 rounded-xl border border-indigo-700/50 flex justify-between items-center shadow-inner cursor-pointer hover:bg-indigo-700 transition mb-2" onclick="UI.showPlayerCard('${p._cleanName}')">
                <div>
                    <h4 class="font-bold text-xs text-white">${bestFit ? i + 2 : i + 1}. ${p.Player} <span class="text-[10px] font-normal text-indigo-300">(${p.Team})</span></h4>
                    <p class="text-[10px] text-indigo-200 font-medium mt-0.5">${p.Pos} • ${highlight}${stackBadge}</p>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = htmlStr;
    },

    renderMyRoster() {
        const container = document.getElementById('my-roster-container');
        if (!container) return;

        const userTeam = State.teamsById[State.userTeamId];
        if (!userTeam) return;

        let htmlStr = `<ul class="space-y-1.5">`;
        userTeam.roster.forEach(p => {
            htmlStr += `
                <li class="text-[11px] bg-slate-50 border border-slate-100 p-2 rounded-lg flex justify-between items-center shadow-sm">
                    <span class="truncate"><strong class="text-indigo-600 mr-1.5 w-6 inline-block text-[9px] uppercase">${p.slottedPos}</strong> <span class="font-bold text-gray-800">${p.Player}</span></span>
                    <span class="text-gray-500 font-medium whitespace-nowrap ml-2">${p.Pos} • <span class="text-emerald-600 font-bold">${p.ProjPts.toFixed(1)}</span></span>
                </li>
            `;
        });
        if (userTeam.roster.length === 0) {
            htmlStr += `<p class="text-[11px] text-gray-400 italic">No players drafted yet.</p>`;
        }
        htmlStr += `</ul>`;
        container.innerHTML = htmlStr;
    },

    renderDraftBoardGrid() {
        const container = document.getElementById('draft-board-grid');
        if (!container) return;

        const numTeams = State.settings.numTeams;
        const totalRounds = State.settings.roster.totalSize;

        let htmlStr = `<table class="min-w-full text-[10px] text-center border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
            <thead class="bg-slate-800 text-white"><tr>
            <th class="p-2 border border-slate-700 w-10">Rnd</th>`;

        for (let i = 0; i < numTeams; i++) {
            let team = State.teamsById[`team-${i + 1}`];
            let isUser = team.id === State.userTeamId;
            htmlStr += `<th class="p-2 border border-slate-700 truncate max-w-[100px] ${isUser ? 'text-emerald-400 font-extrabold' : 'font-semibold'}">${team.name}</th>`;
        }
        htmlStr += `</tr></thead><tbody>`;

        for (let r = 0; r < totalRounds; r++) {
            htmlStr += `<tr><td class="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-500">${r + 1}</td>`;

            for (let c = 0; c < numTeams; c++) {
                let isSnakeReverse = r % 2 !== 0;
                let pickInRound = isSnakeReverse ? (numTeams - 1 - c) : c;
                let overallPick = (r * numTeams) + pickInRound;

                let pickData = State.draftHistory.find(d => d.pickIndex === overallPick);

                if (pickData) {
                    let p = pickData.player;
                    let posColor = '';
                    if (p.Pos === 'RB') posColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    else if (p.Pos === 'WR') posColor = 'bg-blue-50 text-blue-800 border-blue-200';
                    else if (p.Pos === 'QB') posColor = 'bg-red-50 text-red-800 border-red-200';
                    else if (p.Pos === 'TE') posColor = 'bg-amber-50 text-amber-800 border-amber-200';
                    else posColor = 'bg-slate-50 text-slate-800 border-slate-200';

                    htmlStr += `<td class="p-2 border border-slate-200 ${posColor} relative group cursor-pointer hover:opacity-80" onclick="UI.showPlayerCard('${p._cleanName}')">
                        <div class="font-bold truncate max-w-[90px] mx-auto">${p.Player}</div>
                        <div class="text-[9px] opacity-75">${p.Pos} - ${p.Team}</div>
                    </td>`;
                } else if (overallPick === State.currentPick) {
                    htmlStr += `<td class="p-2 border border-amber-400 bg-amber-50 animate-pulse">
                        <div class="text-amber-600 font-bold text-[9px] uppercase tracking-wider">On Clock</div>
                    </td>`;
                } else {
                    htmlStr += `<td class="p-2 border border-slate-200 bg-white"></td>`;
                }
            }
            htmlStr += `</tr>`;
        }
        htmlStr += `</tbody></table>`;
        container.innerHTML = htmlStr;
    },

    renderRosters() {
        const tabs = document.getElementById('roster-tabs');
        const content = document.getElementById('roster-content');
        if (!tabs || !content) return;
        
        let activeTab = localStorage.getItem('activeRosterTab') || State.draftOrder[0] || 'team-1';
        const fragment = document.createDocumentFragment();
        let contentHtml = '';

        Object.values(State.teamsById).forEach(team => {
            const btn = document.createElement('button');
            const isActive = activeTab === team.id;
            const isUser = team.id === State.userTeamId;

            // Sleek Tailwind Pill Button Styling
            if (isActive) {
                btn.className = `px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm whitespace-nowrap transition-all border border-indigo-600 shrink-0`;
            } else if (isUser) {
                btn.className = `px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 whitespace-nowrap transition-all border border-indigo-200 shrink-0`;
            } else {
                btn.className = `px-3.5 py-1.5 text-xs font-medium rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 whitespace-nowrap transition-all border border-slate-200 shrink-0`;
            }

            btn.textContent = team.name;
            btn.onclick = () => { 
                localStorage.setItem('activeRosterTab', team.id); 
                this.renderRosters(); 
            };
            
            fragment.appendChild(btn);
            
            if (isActive) {
                contentHtml = `
                    <div class="p-2">
                        <div class="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                            <h3 class="font-extrabold text-sm text-gray-900">${team.name} Roster</h3>
                            <span class="text-[11px] font-bold bg-slate-100 text-slate-700 px-3 py-1 border border-slate-200 rounded-full">${team.roster.length}/${State.settings.roster.totalSize} Spots Filled</span>
                        </div>
                        <ul class="space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            ${team.roster.map(p => `
                                <li class="text-xs bg-white border border-gray-200 p-2.5 rounded-xl flex justify-between items-center shadow-sm cursor-pointer hover:bg-slate-50 transition-colors" onclick="UI.showPlayerCard('${p._cleanName}')">
                                    <span class="truncate"><strong class="text-indigo-600 mr-2 w-8 inline-block text-[10px] uppercase font-bold">${p.slottedPos}</strong> <span class="font-semibold text-gray-800">${p.Player}</span></span>
                                    <span class="text-gray-500 text-[11px] whitespace-nowrap ml-2">${p.Pos} • <span class="text-emerald-600 font-bold">${p.ProjPts.toFixed(1)} pts</span></span>
                                </li>
                            `).join('')}
                            ${team.roster.length === 0 ? '<p class="text-xs text-gray-400 italic p-2">No players drafted yet.</p>' : ''}
                        </ul>
                    </div>
                `;
            }
        });

        tabs.innerHTML = ''; 
        tabs.appendChild(fragment);
        content.innerHTML = contentHtml;
    },

    renderStandings() {
        const list = document.getElementById('standings-list');
        const startW = State.settings.startWeek || 1;
        const endW = State.settings.endWeek || 17;
        const decimals = State.settings.decimalPlaces || 2;

        let totals = Object.values(State.teamsById).map(team => {
            let seasonStartingPts = 0;
            for (let w = startW; w <= endW; w++) {
                seasonStartingPts += State.calculateOptimalWeeklyScore(team.roster, w);
            }
            return { name: team.name, pts: seasonStartingPts, isUser: team.id === State.userTeamId };
        }).sort((a, b) => b.pts - a.pts);

        let htmlStr = '';
        totals.forEach((t, i) => {
            let bg = t.isUser ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100';
            let text = t.isUser ? 'text-indigo-900' : 'text-gray-900';
            htmlStr += `
                <div class="flex justify-between items-center p-4 border rounded-xl ${bg} mb-3">
                    <span class="text-lg font-bold ${text}"><span class="text-gray-400 mr-2">#${i + 1}</span> ${t.name}</span>
                    <span class="text-lg text-emerald-600 font-extrabold">${t.pts.toFixed(decimals)} pts</span>
                </div>
            `;
        });
        list.innerHTML = htmlStr;
    }
};