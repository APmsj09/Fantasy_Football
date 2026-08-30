const UI = {
    databaseSortKey: 'advVbd',
    databaseSortDir: 'desc',

    getPlayerAge(p) {
        if (p?.age !== undefined && p?.age !== null && p.age !== '') return p.age;
        if (p?.Age !== undefined && p?.Age !== null && p.Age !== '') return p.Age;
        return null;
    },

    normalizeSearchText(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
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
            case 'ovrRank':
                return Number(player.ovrRank ?? 9999);
            case 'player':
                return player.Player || '';
            case 'pos':
                return player.Pos || '';
            case 'team':
                return player.Team || '';
            case 'projPts':
                return Number(player.ConsensusPts ?? player.ProjPts ?? 0);
            case 'modelPts':
                return Number(player.ModelPts ?? player.ProjPts ?? 0);
            case 'edge':
                return Number(player.Edge ?? 0);
            case 'overProb':
                return Number(player.OverProb ?? 0.5);
            case 'vbd':
                return Number(player.VBD ?? 0);
            case 'advVbd':
                return Number(player.AdvVBD ?? player.VBD ?? 0);
            case 'ceilingPpg':
                return Number(player.ceilingPpg ?? 0);
            case 'xTD':
                return Number(player.xTD ?? 0);
            case 'avgStars':
                return Number(player.avgStars ?? 0);
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
            let consPts = (p.ConsensusPts || p.ProjPts || 0).toFixed(1);
            let modelPts = (p.ModelPts || p.ProjPts || 0).toFixed(1);
            let vbdVal = (p.VBD ?? 0).toFixed(1);
            let advVbdVal = (p.AdvVBD ?? p.VBD ?? 0).toFixed(1);

            let edgeVal = p.Edge ?? 0;
            let edgeStr = edgeVal >= 0 
                ? `<span class="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">+${edgeVal.toFixed(1)}</span>`
                : `<span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">${edgeVal.toFixed(1)}</span>`;

            let overProb = p.OverProb ? Math.round(p.OverProb * 100) : 50;
            let probColor = overProb >= 65 ? 'text-emerald-600 font-black' : (overProb <= 35 ? 'text-rose-600 font-bold' : 'text-slate-500 font-semibold');

            let floorVal = (p.floorPpg !== undefined ? p.floorPpg : ((p.ProjPts || 0) / 17) * 0.78).toFixed(1);
            let ceilVal = (p.ceilingPpg !== undefined ? p.ceilingPpg : ((p.ProjPts || 0) / 17) * 1.25).toFixed(1);
            let rangeStr = `<span class="text-[10px] font-semibold text-slate-700 whitespace-nowrap"><span class="text-rose-500">${floorVal}</span> - <span class="text-emerald-600">${ceilVal}</span></span>`;

            let xtdStr = p.xTD !== undefined ? `<span class="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">${p.xTD.toFixed(1)}</span>` : '—';
            let stars = p.avgStars ? `⭐ ${p.avgStars.toFixed(1)}` : '-';
            let bye = p.byeWeek && p.byeWeek !== 'N/A' ? `Wk ${p.byeWeek}` : '-';
            let age = this.getPlayerAge(p) !== null ? `${this.getPlayerAge(p)}` : '—';
            let adp = p.adp !== undefined && p.adp !== null ? `${p.adp.toFixed(0)}` : '—';
            let depth = p.depthChart !== undefined && p.depthChart !== null ? `#${p.depthChart}` : '—';
            let snap = p.snapShare !== undefined && p.snapShare !== null ? `${p.snapShare.toFixed(0)}%` : '—';

            let isOffense = !['DST', 'PK'].includes(p.Pos);
            let olTag = (isOffense && p.olTier) ? `<span class="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">OL ${p.olTier}</span>` : '';

            let injBadge = '';
            if (p.injuryStatus) {
                let abbr = p.injuryStatus === 'Questionable' ? 'Q' : (p.injuryStatus === 'Doubtful' ? 'D' : p.injuryStatus);
                let color = ['Out', 'IR', 'PUP', 'SUS'].includes(p.injuryStatus) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                injBadge = `<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${color}">${abbr}</span>`;
            }

            let vbdColor = (p.VBD || 0) >= 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-medium';
            let advVbdColor = (p.AdvVBD || 0) >= 0 ? 'text-indigo-700 font-black' : 'text-rose-500 font-bold';

            htmlStr += `
                <tr class="hover:bg-slate-50 transition-colors cursor-pointer border-b border-gray-100" onclick="UI.showPlayerCard('${p._cleanName}')">
                    <td class="px-2.5 py-2.5 text-center text-[10px] font-extrabold text-slate-400">#${p.ovrRank || '-'}</td>
                    <td class="px-3.5 py-2.5 text-xs font-bold text-gray-900">
                        <div class="flex items-center flex-wrap gap-1">
                            <span>${p.Player}</span>
                            ${olTag}${injBadge}
                        </div>
                    </td>
                    <td class="px-2 py-2.5 text-center text-xs font-bold text-gray-600">${p.Pos}</td>
                    <td class="px-2.5 py-2.5 text-center text-xs font-medium text-slate-500">${p.Team}</td>
                    <td class="px-2.5 py-2.5 text-right text-xs font-medium text-slate-400">${consPts}</td>
                    <td class="px-2.5 py-2.5 text-right text-xs font-black text-indigo-900">${modelPts}</td>
                    <td class="px-2.5 py-2.5 text-center">${edgeStr}</td>
                    <td class="px-2 py-2.5 text-center text-xs ${probColor}">${overProb}%</td>
                    <td class="px-2.5 py-2.5 text-right text-xs ${vbdColor}">${vbdVal}</td>
                    <td class="px-2.5 py-2.5 text-right text-xs ${advVbdColor}">${advVbdVal}</td>
                    <td class="px-2.5 py-2.5 text-center">${rangeStr}</td>
                    <td class="px-2.5 py-2.5 text-center">${xtdStr}</td>
                    <td class="px-2.5 py-2.5 text-center text-xs font-bold text-amber-600">${stars}</td>
                    <td class="px-2 py-2.5 text-center text-xs text-gray-500">${age}</td>
                    <td class="px-2 py-2.5 text-center text-xs text-gray-600 font-semibold">${adp}</td>
                    <td class="px-2 py-2.5 text-center text-xs text-gray-500">${depth}</td>
                    <td class="px-2 py-2.5 text-center text-xs text-gray-500">${snap}</td>
                    <td class="px-2 py-2.5 text-center text-xs text-gray-500">${bye}</td>
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

        const activeGames = (p.stats && p.stats.gp && p.stats.gp > 0) ? p.stats.gp : 17;
        const ppg = (proj / activeGames).toFixed(1);
        const tTeam = State.normalizeTeam(p.Team);

        const isOffense = ['QB', 'RB', 'WR', 'TE'].includes(pos);
        const isDST = pos === 'DST';
        const isPK = pos === 'PK';

        // -------------------------------------------------------------
        // INHERITED ROLE & SCHEME CONTEXT
        // -------------------------------------------------------------
        let inheritedContextHTML = "";
        const teamDist = State.teamTargetsMap ? State.teamTargetsMap[tTeam] : null;
        const rushEnv = State.teamAdvRush ? State.teamAdvRush[tTeam] : null;
        const passEnv = State.teamAdvPass ? State.teamAdvPass[tTeam] : null;
        const recEnv = State.teamAdvRec ? State.teamAdvRec[tTeam] : null;

        let passVolume = teamDist ? (teamDist['Total Targets'] || 550) : 550;
        let offensePace = "balanced";
        if (passVolume > 580) offensePace = "pass-heavy";
        else if (passVolume < 520) offensePace = "run-heavy";

        // Find starting QB matching the player's exact team
        let qbName = "their starting QB";
        if (pos !== 'QB') {
            let teamQBs = State.allPlayers.filter(q => State.normalizeTeam(q.Team) === tTeam && q.Pos === 'QB');
            let teamQB = teamQBs.find(q => q.depthChart === 1) || teamQBs.sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0))[0];
            if (teamQB && teamQB.Player) qbName = teamQB.Player;
        }

        const pAge = p.age || p.Age;
        const isRookieOrYoung = pAge && pAge <= 22;
        const hasNoPastStats = !p.pastStats || !p.pastStats.gp || p.pastStats.gp === 0;

        // Expanded to include WR3s in high-volume passing attacks (570+ targets) or WR-funnel schemes
        const isWR3PassHeavy = (pos === 'WR' && p.depthChart === 3 && (passVolume >= 570 || (teamDist && teamDist['WR %'] >= 60.0)));
        const isTargetRole = p.isNewRole || (isRookieOrYoung && hasNoPastStats) || (p.depthChart && p.depthChart <= 2) || isWR3PassHeavy;

        // Prevents spamming past stats in both the general narrative blurb AND the context box
        const showPastStatsInBox = Boolean(p.pastStats && p.pastStats.gp > 0 && (p.isNewRole || isRookieOrYoung));

        if (isTargetRole && isOffense) {
            let roleTitle = "";
            if (isRookieOrYoung && hasNoPastStats) roleTitle = `🌱 Rookie Profile & Team Context (${p.Team})`;
            else if (isRookieOrYoung) roleTitle = `🌱 Youth Profile & Team Context (${p.Team})`;
            else if (pos === 'WR' && p.depthChart === 3) roleTitle = `🎯 11-Personnel / WR3 Scheme Context (${p.Team})`;
            else if (p.isNewRole || hasNoPastStats) roleTitle = `📋 New Role / Environment Context (${p.Team})`;
            else roleTitle = `🔄 Team Scheme & Volume Context (${p.Team})`;

            let opportunityBullets = [];

            // 1. Reference Player's Previous Stats with Qualitative Grades
            if (showPastStatsInBox) {
                let ps = p.pastStats;
                let contextNote = isRookieOrYoung ? "Prior Production:" : "Previous Season Production:";
                if (pos === 'RB') {
                    let touches = (ps.rushAtt || 0) + (ps.rec || 0);
                    let yds = (ps.rushYds || 0) + (ps.recYds || 0);
                    let volGrade = touches >= 250 ? "[Heavy Workload]" : (touches >= 150 ? "[Moderate Workload]" : "[Light Workload]");
                    opportunityBullets.push(`<strong>${contextNote}</strong> Handled ${touches} touches for ${yds} total yards and ${ps.totalTd || 0} TDs <span class="text-amber-700 font-bold">${volGrade}</span>.`);
                } else if (['WR', 'TE'].includes(pos)) {
                    let tgts = ps.targets || 0;
                    let volGrade = tgts >= 110 ? "[Alpha Target Volume]" : (tgts >= 75 ? "[Solid Volume]" : "[Low Volume]");
                    opportunityBullets.push(`<strong>${contextNote}</strong> Earned ${tgts} targets, securing ${ps.rec || 0} receptions for ${ps.recYds || 0} yards and ${ps.recTd || 0} TDs <span class="text-amber-700 font-bold">${volGrade}</span>.`);
                } else if (pos === 'QB') {
                    opportunityBullets.push(`<strong>${contextNote}</strong> Threw for ${ps.passYds || 0} yards and ${ps.passTd || 0} TDs, while adding ${ps.rushYds || 0} yards and ${ps.rushTd || 0} TDs on the ground.`);
                }
            }

            // 2. Reference Team Positional Usage & Vacated Opportunity Context
            if (pos === 'RB') {
                // Vacated Touches & Backup Context
                if (p._vacatedRzAtt && p._vacatedRzAtt >= 12) {
                    let depList = p._departedBackfieldNames?.length > 0 ? ` (${p._departedBackfieldNames.join(', ')})` : '';
                    opportunityBullets.push(`<strong>Vacated Red-Zone Touches:</strong> Offseason departures${depList} vacated <strong>${p._vacatedRzAtt} Red-Zone carries</strong> and <strong>${p._vacatedCarries} total carries</strong>, opening up prime goal-line opportunities <span class="text-emerald-800 font-bold">[HIGH TD EXPANSION]</span>.`);
                }

                if (p._backupThreatLevel) {
                    let badgeColor = p._backupThreatLevel === 'Low Standalone Threat' ? 'text-emerald-800' : 'text-amber-800';
                    opportunityBullets.push(`<strong>Backfield Competition:</strong> Backup ${p._backupName || 'depth'} graded as <strong>${p._backupThreatLevel}</strong>. ${p._backupThreatNote || ''} <span class="${badgeColor} font-bold">[${p._backupThreatLevel.toUpperCase()}]</span>.`);
                }

                if (teamDist && teamDist['RB %']) {
                    let rbPct = teamDist['RB %'];
                    let rbTgts = teamDist['RB Targets'] || Math.round((passVolume * rbPct) / 100);
                    let totalTgts = teamDist['Total Targets'] || passVolume;

                    let grade = "";
                    if (rbTgts >= 120 || rbPct >= 22.0) grade = "[ELITE - Top 5 in NFL]";
                    else if (rbTgts >= 90 || rbPct >= 17.0) grade = "[GREAT - Above Average]";
                    else if (rbTgts <= 60 || rbPct <= 12.0) grade = "[POOR - Low Passing Focus]";
                    else grade = "[AVERAGE]";

                    opportunityBullets.push(`<strong>Pass-Game Funnel:</strong> ${p.Team}'s scheme funneled <strong>${rbPct}% of total passes</strong> (${rbTgts}/${totalTgts} targets) to running backs <span class="text-indigo-800 font-bold">${grade}</span>.`);
                }
                if (rushEnv && rushEnv.ybcAtt) {
                    let ybc = rushEnv.ybcAtt;
                    let grade = ybc >= 2.8 ? "[ELITE - Massive Open Lanes]" : (ybc >= 2.4 ? "[ABOVE AVERAGE - High-Quality Line]" : (ybc >= 2.0 ? "[AVERAGE]" : "[POOR - Defenders in Backfield]"));
                    opportunityBullets.push(`<strong>Blocking Environment:</strong> ${p.Team} generated <strong>${ybc} Yards Before Contact</strong> per carry <span class="text-indigo-800 font-bold">${grade}</span>.`);
                }
                if (opportunityBullets.length === 0 || (opportunityBullets.length === 1 && showPastStatsInBox)) {
                    opportunityBullets.push(`<strong>Inherited Workload:</strong> ${p.Player} enters the ${p.Team} backfield as a primary workload candidate.`);
                }
            } else if (['WR', 'TE'].includes(pos)) {
                // Tactical Vacated Target, Air-Yard, and Red-Zone Analysis
                if ((p._vacatedTgts && p._vacatedTgts >= 45) || (p._vacatedAirYards && p._vacatedAirYards >= 500)) {
                    let depList = p._departedReceiverNames?.length > 0 ? ` (${p._departedReceiverNames.join(', ')})` : '';
                    
                    if (pos === 'TE') {
                        if (p._vacatedRoleType === 'Detached Hybrid Deep Seam') {
                            opportunityBullets.push(`<strong>Vertical Seam Vacancy:</strong> Departures${depList} vacated <strong>+${p._vacatedAirYards} deep air yards</strong>, unlocking high-aDOT seam opportunities for him in detached move alignments <span class="text-purple-800 font-bold">[HYBRID TE CEILING]</span>.`);
                        } else if (p._vacatedRoleType === 'Short-Yardage Safety Valve') {
                            opportunityBullets.push(`<strong>Underneath Outlet Volume:</strong> Offseason departures${depList} vacated <strong>+${p._vacatedTgts} targets</strong>. He absorbs high-percentage short-yardage and checkdown targets <span class="text-indigo-800 font-bold">[PPR FLOOR]</span>.`);
                        } else {
                            let vacRzStr = (p._vacatedRzTgts && p._vacatedRzTgts > 0) ? ` and <strong>+${p._vacatedRzTgts} Red-Zone targets</strong>` : '';
                            opportunityBullets.push(`<strong>Vacated Red-Zone & MOF Funnel:</strong> Offseason departures${depList} vacated <strong>+${p._vacatedTgts} targets</strong>${vacRzStr}. As an inline/intermediate weapon (aDOT ${p.aDOT || 7.2} yds), he absorbs high-percentage 3rd-down and goal-line targets rather than boundary deep shots <span class="text-emerald-800 font-bold">[TOUCHDOWN & MOF RE-ALLOCATION]</span>.`);
                        }
                    } else {
                        if (p._vacatedRoleType === 'Perimeter Alpha Air Yards') {
                            opportunityBullets.push(`<strong>Vacated Perimeter Air Yards:</strong> Departures${depList} left behind <strong>+${p._vacatedAirYards} deep air yards</strong> and <strong>+${p._vacatedTgts} targets</strong>, unlocking uncontested boundary X/Z route dominance <span class="text-emerald-800 font-bold">[ALPHA AIR SHARE CATALYST]</span>.`);
                        } else if (p._vacatedRoleType === 'Intermediate Chain-Mover') {
                            opportunityBullets.push(`<strong>Vacated Intermediate Targets:</strong> Departures${depList} opened up <strong>+${p._vacatedTgts} targets</strong>, consolidating highly efficient medium-depth routes <span class="text-indigo-800 font-bold">[PPR VOLUME STABILITY]</span>.`);
                        } else {
                            opportunityBullets.push(`<strong>Vacated Underneath Volume:</strong> Departures${depList} opened up <strong>+${p._vacatedTgts} targets</strong> for slot and underneath alignments <span class="text-indigo-800 font-bold">[HIGH CATCH-RATE OUTLET]</span>.`);
                        }
                    }
                }

                if (p._passingTreeType) {
                    let treeColor = p._passingTreeType === 'Concentrated 2-Man Funnel' ? 'text-emerald-800' : (p._passingTreeType === 'Crowded Committee Spread' ? 'text-amber-800' : 'text-indigo-800');
                    opportunityBullets.push(`<strong>Passing Tree Structure:</strong> Graded as a <strong>${p._passingTreeType}</strong>. ${p._treeDescription || ''} <span class="${treeColor} font-bold">[${p._passingTreeType.toUpperCase()}]</span>.`);
                }

                if (teamDist && teamDist[`${pos} %`]) {
                    let posPct = teamDist[`${pos} %`];
                    let posTgts = teamDist[`${pos} Targets`] || Math.round((passVolume * posPct) / 100);
                    let totalTgts = teamDist['Total Targets'] || passVolume;

                    let grade = "";
                    if (pos === 'WR') {
                        if (posTgts >= 370 || (posPct >= 62.0 && passVolume >= 560)) grade = "[ELITE HIGH-VOLUME WR SYSTEM]";
                        else if (posTgts >= 310 || posPct >= 55.0) grade = "[ABOVE AVERAGE WR FOCUS]";
                        else if (posTgts <= 250 || posPct <= 47.0) grade = "[LOW WR FOCUS / RUN-HEAVY]";
                        else grade = "[AVERAGE WR VOLUME]";
                    } else {
                        if (posTgts >= 130 || (posPct >= 24.0 && passVolume >= 550)) grade = "[ELITE TE FUNNEL - Top 5 NFL]";
                        else if (posTgts >= 95 || posPct >= 18.0) grade = "[ABOVE AVERAGE TE FOCUS]";
                        else grade = "[LOW TE FOCUS]";
                    }
                    opportunityBullets.push(`<strong>Positional Target Funnel:</strong> ${p.Team}'s offense funneled <strong>${posPct}% of team targets</strong> (${posTgts}/${totalTgts} targets) to ${pos}s <span class="text-indigo-800 font-bold">${grade}</span>.`);
                    if (pos === 'WR' && p.depthChart === 3) {
                        opportunityBullets.push(`<strong>WR3 / 11-Personnel Role:</strong> In this ${offensePace} attack (${totalTgts} total targets), the WR3 position sees elevated route participation due to heavy 3-receiver sets.`);
                    }
                }
                if (passEnv && passEnv.playActionYds) {
                    let paYds = passEnv.playActionYds;
                    let grade = paYds >= 950 ? "[HEAVY PLAY-ACTION - High Upside Scheme]" : (paYds >= 700 ? "[MODERATE PLAY-ACTION]" : "[LOW PLAY-ACTION]");
                    opportunityBullets.push(`<strong>Play-Action Scheme:</strong> ${p.Team} generated <strong>${paYds} passing yards off Play-Action</strong> <span class="text-indigo-800 font-bold">${grade}</span>.`);
                }
                if (passEnv && passEnv.onTgtPct) {
                    let acc = passEnv.onTgtPct;
                    let grade = acc >= 77.0 ? "[GREAT QB ACCURACY]" : (acc >= 72.0 ? "[AVERAGE QB ACCURACY]" : "[POOR QB ACCURACY]");
                    opportunityBullets.push(`<strong>QB Accuracy Context:</strong> ${p.Team} QBs delivered on-target passes <strong>${acc}%</strong> of the time <span class="text-indigo-800 font-bold">${grade}</span>.`);
                }
                if (opportunityBullets.length === 0 || (opportunityBullets.length === 1 && showPastStatsInBox)) {
                    if (p.depthChart && p.depthChart <= 3) {
                        opportunityBullets.push(`<strong>Target Opportunity:</strong> ${p.Player} enters the ${p.Team} passing attack with starting route potential.`);
                    } else {
                        opportunityBullets.push(`<strong>Depth Role:</strong> Operates primarily as a rotational depth piece in the ${p.Team} passing attack.`);
                    }
                }
            } else if (pos === 'QB') {
                if (p._totalWeaponProj) {
                    let weaponGrade = p._totalWeaponProj >= 500 ? "[ELITE ARSENAL]" : (p._totalWeaponProj >= 350 ? "[ABOVE AVERAGE WEAPONS]" : "[WEAK WEAPON ROOM]");
                    let weaponColor = p._totalWeaponProj >= 500 ? "text-emerald-800" : (p._totalWeaponProj >= 350 ? "text-indigo-800" : "text-rose-800");
                    opportunityBullets.push(`<strong>Surrounding Weapons:</strong> Supported by a receiving corps projecting for a combined ${Math.round(p._totalWeaponProj)} points, featuring ${p._eliteWeaponCount || 0} elite separator(s). <span class="${weaponColor} font-bold">${weaponGrade}</span>.`);
                }
                if (p.olTier) {
                    let lineGrade = ['S', 'A'].includes(p.olTier) ? "[IMPREGNABLE POCKET]" : (['D', 'F'].includes(p.olTier) ? "[POOR PROTECTION]" : "[AVERAGE LINE]");
                    let lineColor = ['S', 'A'].includes(p.olTier) ? "text-emerald-800" : (['D', 'F'].includes(p.olTier) ? "text-rose-800" : "text-indigo-800");
                    opportunityBullets.push(`<strong>Trench Protection:</strong> Operates behind a <strong>Tier ${p.olTier} Offensive Line</strong>. <span class="${lineColor} font-bold">${lineGrade}</span>.`);
                }
                if (p._inEliteOffense || p._inAnemicOffense) {
                    let offGrade = p._inEliteOffense ? "[ELITE OFFENSIVE ECOSYSTEM]" : "[ANEMIC SCORING ENVIRONMENT]";
                    let offColor = p._inEliteOffense ? "text-emerald-800" : "text-rose-800";
                    opportunityBullets.push(`<strong>Offensive Grade:</strong> Directing a scheme graded as a ${p._inEliteOffense ? 'Top-Tier' : 'Bottom-Tier'} NFL scoring ecosystem. <span class="${offColor} font-bold">${offGrade}</span>.`);
                }
                if (p._hasGoalLineRushingEquity) {
                    opportunityBullets.push(`<strong>Goal-Line Rushing Equity:</strong> Commands designed goal-line sneaks/keeper plays (${p.stats?.rushTd || 0} proj rush TDs), providing a significant rushing floor boost <span class="text-emerald-800 font-bold">[KONAMI CODE BOOST]</span>.`);
                }
                if (passEnv && passEnv.pktTime) {
                    let pkt = passEnv.pktTime;
                    let grade = pkt >= 2.5 ? "[GREAT POCKET TIME]" : (pkt >= 2.3 ? "[AVERAGE POCKET TIME]" : "[HIGH PRESSURE / QUICK THROWS]");
                    opportunityBullets.push(`<strong>Pocket Dynamics:</strong> ${p.Team}'s scheme allows <strong>${pkt}s pocket time</strong> with a <strong>${passEnv.prssPct}% pressure rate</strong> <span class="text-indigo-800 font-bold">${grade}</span>.`);
                }
            }

            if (opportunityBullets.length > 0) {
                inheritedContextHTML = `
                    <div class="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-xl mb-3 text-amber-950">
                        <h5 class="font-extrabold text-amber-900 text-xs uppercase tracking-wider mb-1.5 flex items-center">
                            <span class="mr-1.5">🎯</span> ${roleTitle}
                        </h5>
                        <ul class="space-y-1.5 text-xs">
                            ${opportunityBullets.map(b => `<li class="flex items-start"><span class="text-amber-600 mr-1.5 font-bold">•</span><div>${b}</div></li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }

        // =========================================================================
        // TEAM SITUATION, SUPPORTING CAST & USAGE COMPETITION MATRIX
        // =========================================================================
        let situationMatrixHTML = "";
        if (isOffense) {
            let supportingCastBullets = [];
            let competitionBullets = [];

            // Supporting Cast Analysis
            if (pos === 'RB') {
                if (p.olTier) {
                    supportingCastBullets.push(`<strong>Offensive Line:</strong> Graded as <strong>Tier ${p.olTier}</strong> (Run Block #${p.olRunBlk || 16}, Pass Block #${p.olPassBlk || 16}), generating <strong>${rushEnv?.ybcAtt || 2.4} Yards Before Contact</strong> per carry.`);
                }
                supportingCastBullets.push(`<strong>Quarterback Gravity:</strong> Handing off from <strong>${qbName}</strong> in a <strong>${offensePace}</strong> system (${passVolume} team pass attempts).`);
            } else if (['WR', 'TE'].includes(pos)) {
                supportingCastBullets.push(`<strong>Quarterback Connection:</strong> Catching passes from <strong>${qbName}</strong> (${passEnv?.onTgtPct || 74}% on-target accuracy, ${passEnv?.pktTime || 2.4}s pocket protection time).`);
                if (passEnv?.playActionYds && passEnv.playActionYds >= 800) {
                    supportingCastBullets.push(`<strong>Play-Action Scheme:</strong> Scheme generates <strong>${passEnv.playActionYds} yards off Play-Action</strong>, creating open intermediate passing lanes.`);
                }
            } else if (pos === 'QB') {
                supportingCastBullets.push(`<strong>Pass Protection:</strong> Protected by a <strong>Tier ${p.olTier || 'C'} offensive line</strong> (${passEnv?.pktTime || 2.4}s pocket time, ${passEnv?.prssPct || 22}% pressure rate).`);
                supportingCastBullets.push(`<strong>Receiving Arsenal:</strong> Backed by <strong>${p._eliteWeaponCount || 0} elite separator(s)</strong> (${Math.round(p._totalWeaponProj || 0)} combined projected weapon points).`);
            }

            // Touch & Target Competition Analysis
            if (pos === 'RB') {
                if (p._backupThreatLevel) {
                    let alertColor = p._backupThreatLevel.includes('Threat') ? 'text-amber-700' : 'text-emerald-700';
                    competitionBullets.push(`<strong>Backfield Hierarchy:</strong> Backup <strong>${p._backupName || 'depth'}</strong> is graded as a <strong class="${alertColor}">${p._backupThreatLevel}</strong>. ${p._backupThreatNote || ''}`);
                }
                if (p._vacatedCarries && p._vacatedCarries >= 30) {
                    let rzCarriesStr = (p._vacatedRzAtt && p._vacatedRzAtt > 0) ? ` and <strong>+${p._vacatedRzAtt} Red-Zone carries</strong>` : '';
                    competitionBullets.push(`<strong>Vacated Volume:</strong> Offseason departures (${p._departedBackfieldNames?.slice(0, 3).join(', ') || 'departures'}) vacated <strong>+${p._vacatedCarries} carries</strong>${rzCarriesStr}.`);
                }
                if (p._rb3ThreatNote) {
                    competitionBullets.push(`<strong>Rotational Risk:</strong> ${p._rb3ThreatNote}`);
                }
                if (p._qbSneakContext) {
                    competitionBullets.push(`<strong>Goal-Line Dynamics:</strong> ${p._qbSneakContext}`);
                }
            } else if (['WR', 'TE'].includes(pos)) {
                if (p._passingTreeType) {
                    competitionBullets.push(`<strong>Passing Tree Hierarchy:</strong> Graded as a <strong>${p._passingTreeType}</strong>. ${p._treeDescription || ''}`);
                }
                if (p._vacatedTgts && p._vacatedTgts >= 40) {
                    let vacAirStr = (p._vacatedAirYards && p._vacatedAirYards > 0) ? ` and <strong>+${p._vacatedAirYards} air yards</strong>` : '';
                    competitionBullets.push(`<strong>Vacated Target Share:</strong> Departures (${p._departedReceiverNames?.slice(0, 3).join(', ') || 'departures'}) opened up <strong>+${p._vacatedTgts} targets</strong>${vacAirStr}.`);
                }
                if (p._incomingCompetitionNote) {
                    competitionBullets.push(`<strong>Incoming Competition:</strong> ${p._incomingCompetitionNote}`);
                }
                if (p._wr2Note) {
                    competitionBullets.push(`<strong>Target Distribution:</strong> ${p._wr2Note}`);
                }
                if (p._teCommitteeNote) {
                    competitionBullets.push(`<strong>Route Split Risk:</strong> ${p._teCommitteeNote}`);
                }
            } else if (pos === 'QB') {
                if (p._shortLeashRisk) {
                    competitionBullets.push(`<strong>Job Security Warning:</strong> ${p._shortLeashNote || 'Bridge starter risk: could face benching pressure if the team struggles.'}`);
                } else if (p.depthChart === 1) {
                    competitionBullets.push(`<strong>Franchise Job Security:</strong> Uncontested franchise starter with full scheme command.`);
                } else {
                    competitionBullets.push(`<strong>Backup / Developmental Role:</strong> Currently slotted behind the starter, requiring an injury, benching, or developmental timeline to see the field.`);
                }
            }

            if (supportingCastBullets.length > 0 || competitionBullets.length > 0) {
                situationMatrixHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-xs">
                        <div class="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                            <h6 class="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                                <span class="text-indigo-600">🛡️</span> Supporting Cast & Trench Quality
                            </h6>
                            <ul class="space-y-1.5 text-slate-700">
                                ${supportingCastBullets.map(b => `<li class="flex items-start"><span class="text-indigo-500 mr-1.5 font-bold">•</span><div>${b}</div></li>`).join('')}
                            </ul>
                        </div>
                        <div class="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                            <h6 class="font-extrabold uppercase text-[10px] text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                                <span class="text-amber-600">⚔️</span> Touch Competition & Hierarchy
                            </h6>
                            <ul class="space-y-1.5 text-slate-700">
                                ${competitionBullets.map(b => `<li class="flex items-start"><span class="text-amber-500 mr-1.5 font-bold">•</span><div>${b}</div></li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            }
        }

        // -------------------------------------------------------------
        // SEED HASH (Deterministic Variety)
        // -------------------------------------------------------------
        const getSeed = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i) | 0;
            return Math.abs(hash);
        };
        const seed = getSeed(p._cleanName || p.Player || 'player');
        const pickVar = (arr) => arr[seed % arr.length];
        const pickVarShift = (arr, shift) => arr[(seed + shift) % arr.length];

        // -------------------------------------------------------------
        // POSITIONAL RANK & TIERS
        // -------------------------------------------------------------
        const posPlayers = State.allPlayers
            .filter(x => x.Pos === pos)
            .sort((a, b) => (b.AdvVBD || b.VBD) - (a.AdvVBD || a.VBD));
        const posRank = posPlayers.findIndex(x => x._cleanName === p._cleanName) + 1;
        const posRankStr = posRank > 0 ? `${pos}${posRank}` : `${pos}`;
        const overallRank = State.allPlayers.findIndex(x => x._cleanName === p._cleanName) + 1;
        const isUltraElite = (overallRank <= 5 || (posRank === 1 && overallRank <= 12));

        let tierLabel = "Starter";
        if (isDST) {
            if (posRank <= 5) tierLabel = "Elite Defense";
            else if (posRank <= 12) tierLabel = "Starting Defense";
            else tierLabel = "Streaming Option";
        } else if (isPK) {
            if (posRank <= 5) tierLabel = "Elite Kicker";
            else if (posRank <= 12) tierLabel = "Starting Kicker";
            else tierLabel = "Streaming Option";
        } else {
            if (posRank <= 12) tierLabel = `High-End ${pos}1`;
            else if (posRank <= 24) tierLabel = `Solid ${pos}2`;
            else if (posRank <= 36) tierLabel = `Flex / ${pos}3`;
            else tierLabel = "Bench Depth";
        }

        // -------------------------------------------------------------
        // ARCHETYPE DETECTION
        // -------------------------------------------------------------
        let archetypeNote = "";
        if (isDST) {
            archetypeNote = pickVar([
                "Defensive fantasy production relies heavily on applying pressure, generating turnovers, and capitalizing on favorable matchups.",
                "Sacks and turnovers dictate a defense's ceiling, making this unit highly dependent on facing mistake-prone opposing quarterbacks.",
                "Their weekly floor is tied directly to their pass rush ability and how frequently they can force opponents into negative game scripts."
            ]);
        } else if (isPK) {
            archetypeNote = pickVar([
                "Kicker production is directly tied to offensive efficiency, red-zone stalling, and positive game scripts.",
                "Fantasy success here relies on the offense moving the ball well between the 20s but occasionally stalling out before the end zone.",
                "Like most at the position, weekly scoring variance is high and heavily dependent on the overall team offensive environment."
            ]);
        } else if (pos === 'QB') {
            const rawAtt = (p.stats && p.stats.rushAtt) || (p.pastStats && p.pastStats.rushAtt) || 0;
            const rawYds = (p.stats && p.stats.rushYds) || (p.pastStats && p.pastStats.rushYds) || 0;
            const rawTd = (p.stats && p.stats.rushTd) || (p.pastStats && p.pastStats.rushTd) || 0;

            const rushAttPerGame = rawAtt / activeGames;
            const rushYdsPerGame = rawYds / activeGames;
            const rushTdPerGame = rawTd / activeGames;

            if (rushAttPerGame >= 5.5 || rushYdsPerGame >= 25.0 || rushTdPerGame >= 0.4) {
                archetypeNote = "His elite rushing workload provides a week-winning floor and ceiling that pure pocket passers cannot match.";
            }
            else if (rushAttPerGame >= 3.8 || rushYdsPerGame >= 16.0 || rushTdPerGame >= 0.25) {
                archetypeNote = "His dual-threat mobility and scrambling ability add a valuable rushing foundation to supplement his passing production.";
            }
            else if (rushAttPerGame >= 2.0 || rushYdsPerGame >= 9.0) {
                archetypeNote = "Primarily a pocket passer, he possesses enough scramble mobility to extend plays and occasionally add rushing yards.";
            }
            else {
                archetypeNote = "Lacking high-volume rushing stats, his fantasy floor is tied directly to passing volume, TD efficiency, and red-zone conversions.";
            }
        } else if (pos === 'RB') {
            let effTargetShare = p.targetShare || 0;

            // Calculate Target-to-Carry Ratio & Receiving Efficiency
            const projCarries = p.stats?.rushAtt || p.pastStats?.rushAtt || 0;
            const projTargets = p.stats?.targets || p.pastStats?.targets || 0;
            const tgtToCarryRatio = projCarries > 0 ? (projTargets / projCarries) : 0;
            const ypr = p.stats?.recAvg || (p.stats?.recYds && p.stats?.rec ? p.stats.recYds / p.stats.rec : 0);
            const rbWeight = p.weight ? parseInt(p.weight, 10) : 210;

            // THE RB ARCHETYPE LOGIC:
            if (p.hvo && p.hvo >= 70) {
                archetypeNote = pickVar([
                    "Dominating high-value opportunities (receiving work + red-zone carries), his role is tailored for fantasy success.",
                    "His monopoly over money touches—receptions and inside-the-10 carries—makes him a usage monster.",
                    "He captures the coveted dual-threat RB role, taking pass-game targets alongside goal-line work."
                ]);
            } else if (tgtToCarryRatio >= 0.20 && rbWeight >= 222 && ypr >= 9.0) {
                archetypeNote = `A unique 'Power-Hybrid / H-Back' weapon: Combining an imposing ${rbWeight} lb frame with legitimate downfield receiving chops (${ypr.toFixed(1)} YPR), he creates mismatch nightmares against linebackers in the passing game.`;
                p._isHybridReceiver = true;
            } else if (ypr >= 9.0 && p.stats?.rec >= 10) {
                archetypeNote = `An explosive dual-threat receiver out of the backfield (${ypr.toFixed(1)} YPR), capable of generating chunk plays through the air.`;
            } else if (p._isGoalLineHammer) {
                archetypeNote = "A pure 'Goal-Line Hammer': He monopolizes inside-the-5 carries for massive touchdown upside, but offers virtually zero receiving floor in PPR formats.";
            } else if (p._isHandcuffPlus) {
                archetypeNote = "Operating as a high-end '1B' back, he provides standalone Flex value while carrying league-winning contingent upside if the starter goes down.";
            } else if (p._isSatelliteBack) {
                archetypeNote = "Operating as a pure passing-down specialist, he holds immense value in PPR formats but severely lacks the rushing volume to survive in standard leagues.";
            } else if (effTargetShare >= 15.0) {
                archetypeNote = pickVar([
                    "Stepping into a backfield with heavy pass-catching involvement, he projects for a high PPR baseline.",
                    "Involvement in the passing attack elevates his floor, making him script-independent in high-scoring games.",
                    "Capturing pass-catching work out of the backfield gives him steady week-in, week-out PPR value."
                ]);
            } else {
                archetypeNote = pickVar([
                    "His fantasy production relies heavily on positive game scripts, rushing volume, and touchdown conversions.",
                    "Operating primarily on early downs, his floor relies on sustained ground volume and lead-state game scripts.",
                    "He relies on ground volume and goal-line conversions to carry his fantasy output."
                ]);
            }
        } else if (pos === 'WR') {
            let isAlphaRole = (p.targetShare && p.targetShare >= 23) || ((hasNoPastStats || p.isNewRole) && p.depthChart === 1);

            // REPLACE THE WR ARCHETYPE LOGIC WITH THIS UPDATED VERSION:
            if (isAlphaRole) {
                archetypeNote = pickVar([
                    "Demanding alpha target share, he functions as the undeniable focal point of his team's air attack.",
                    "As a true high-volume target magnet, he commands the passing game with bulletproof opportunity.",
                    "His heavy target command builds an elite PPR foundation that few defenses can disrupt."
                ]);
            } else if (p._isSpikeWeekWeapon) {
                archetypeNote = "A 'Spike-Week Weapon': Leveraging extreme downfield depth of target (aDOT), he can singlehandedly win fantasy matchups on 2-3 big plays, despite volatile week-to-week target counts.";
            } else if (p._isEmptyCalories) {
                archetypeNote = "An 'Empty Calories' profile: He sees significant target volume, but his dismal efficiency yields a safe floor with virtually zero weekly ceiling.";
            } else if (p._isCardioKing) {
                archetypeNote = "A true 'Cardio King' profile: Despite rarely leaving the field, he is almost entirely ignored in the passing game, acting as a decoy or pure blocker.";
            } else if (p.aDOT && p.aDOT >= 12.5) {
                archetypeNote = pickVar([
                    "Operating as a downfield weapon, his high aDOT profile equips him with slate-breaking splash-play ceiling.",
                    "His vertical route tree generates massive per-target efficiency and explosive touchdown potential.",
                    "Stretching the field with deep air yards gives him matchup-winning weekly ceiling."
                ]);
            } else {
                archetypeNote = pickVar([
                    "Operating in the intermediate area, he relies on route efficiency and target volume to stay fantasy-relevant.",
                    "Working short-to-medium routes, his value is built on catch-rate stability and PPR floor.",
                    "He serves as a chain-moving option, offering functional floor with situational upside."
                ]);
            }
        } else if (pos === 'TE') {
            let isPrimaryTE = posRank <= 6 || (p.targetShare && p.targetShare >= 18) || ((hasNoPastStats || p.isNewRole) && p.depthChart === 1 && teamDist && teamDist['TE %'] >= 22.0);

            if (isPrimaryTE) {
                archetypeNote = pickVar([
                    "Functioning effectively as a top-two passing option on his team, he bypasses the typical tight-end wasteland.",
                    "His WR-like target volume lifts him above the volatile touchdown-dependent TE pack.",
                    "He operates as a legitimate passing weapon rather than an inline blocking tight end."
                ]);
            } else if (p._isTDorBust) {
                archetypeNote = "The definition of 'Touchdown-or-Bust', his fantasy relevance is entirely dependent on converting his high-leverage red zone targets into scores.";
            } else if (p._isCardioKing) {
                archetypeNote = "Serving primarily as an inline blocker, he is on the field constantly but rarely factors into the passing game design.";
            } else {
                archetypeNote = pickVar([
                    "Like most tight ends in his range, his weekly floor is TD-dependent and relies on red-zone looks.",
                    "He fits into the volatile TE middle class where touchdowns dictate whether he finishes as a starter.",
                    "His fantasy value hinges on end-zone target conversion in a crowded passing hierarchy."
                ]);
            }
        }

        if (pos === 'RB') {
            let recs = (p.pastStats && p.pastStats.rec) ? p.pastStats.rec : 0;
            let share = p.targetShare || 0;

            let rbPassInvolvement = "";
            if (hasNoPastStats || p.isNewRole) {
                let teamRbPct = (teamDist && teamDist['RB %']) ? teamDist['RB %'] : 0;
                if (teamRbPct >= 17.0) {
                    rbPassInvolvement = `steps into a backfield scheme that heavily targets running backs in the passing game`;
                } else if (teamRbPct >= 12.0) {
                    rbPassInvolvement = `steps into a system with moderate running back target involvement`;
                } else {
                    rbPassInvolvement = `enters a system that rarely targets running backs, relying primarily on ground volume`;
                }
            } else {
                if (share >= 10 || recs >= 40) rbPassInvolvement = `is highly involved in the passing game, offering a safe PPR floor`;
                else if (share >= 5 || recs >= 20) rbPassInvolvement = `is moderately involved as a receiver out of the backfield`;
                else rbPassInvolvement = `is minimally targeted in the passing game, relying primarily on ground volume`;
            }

            archetypeNote += ` Operating alongside <strong>${qbName}</strong> in a <strong>${offensePace}</strong> offense, he ${rbPassInvolvement}.`;
        } else if (['WR', 'TE'].includes(pos)) {
            archetypeNote += ` Catching passes from <strong>${qbName}</strong> in a <strong>${offensePace}</strong> offense heavily shapes his weekly volume expectations.`;
        } else if (pos === 'QB') {
            if (p._isPressureLiability) {
                archetypeNote = "A 'Pressure Liability': Frequently under siege behind a weak pass-blocking unit (or holding the ball too long), his drive efficiency and fantasy ceiling are regularly sabotaged by sacks and fumbles.";
            } else {
                let lineContext = p.olTier ? ` behind a <strong>Tier ${p.olTier} offensive line</strong>` : '';
                archetypeNote += ` Directing a <strong>${offensePace}</strong> offense${lineContext}, his overall fantasy ceiling is strongly influenced by passing volume and the playmaking ability of his receiving corps.`;
            }
        }

        // Past Stats Context Sentence
        let pastStatsContext = "";
        if (p.pastStats && p.pastPpg > 0 && (isOffense || isDST) && !showPastStatsInBox) {
            const ps = p.pastStats;
            const totalTds = isDST ? ((ps.defTd || 0) + (ps.spcTd || 0)) : (ps.totalTd || 0);
            const tdText = isDST ? `${totalTds} DEF/ST TDs` : `${totalTds} total TDs`;
            const pronoun = isDST ? "They are" : "He is";
            const sampleCaveat = (!isDST && ps.gp && ps.gp <= 6) ? ` <span class="text-amber-300 font-bold">(limited ${ps.gp}-game sample)</span>` : "";
            pastStatsContext = ` ${pronoun} coming off a 2025 campaign averaging <strong>${p.pastPpg.toFixed(1)} PPG</strong> over ${ps.gp || 17} games (${tdText})${sampleCaveat}.`;
        }

        

        let statProof = "";
        if (isOffense) {
            let specificStats = [];
            if (p.targetShare && p.targetShare >= 15) specificStats.push(`commands a massive <strong>${p.targetShare}% target share</strong>`);
            if (p.tps && p.tps >= 0.22) specificStats.push(`demands targets at an elite rate (<strong>${(p.tps * 100).toFixed(1)}% Targets Per Snap</strong>)`);
            if (p._isIndependentYACCreator) specificStats.push(`creates massive yardage independently of his offensive scheme (<strong>${p.yacAtt.toFixed(1)} YAC/R</strong>)`);
            if (p.hvo && p.hvo >= 40) specificStats.push(`dominates with <strong>${p.hvo} high-value opportunities</strong> (Targets + RZ carries)`);
            if (p.aDOT && p.Pos === 'WR' && p.aDOT >= 12.0) specificStats.push(`stretches the field with an elite <strong>${p.aDOT} aDOT</strong>`);
            if (p.aDOT && p.Pos === 'TE' && p.aDOT >= 8.5) specificStats.push(`stretches the seam with an elite <strong>${p.aDOT} TE aDOT</strong>`);
            if (p.pastStats && p.pastStats.bigPlays >= 8) specificStats.push(`generated <strong>${p.pastStats.bigPlays} explosive plays</strong> (20+ yards)`);
            if (p.wopr && p.wopr >= 0.55) specificStats.push(`boasts a dominant <strong>${p.wopr.toFixed(2)} WOPR</strong>`);
            if (p.Pos === 'QB' && p.stats && p.stats.rushAtt >= 50) specificStats.push(`adds crucial rushing floor with <strong>${p.stats.rushAtt} projected carries</strong>`);
            if (p.p2s && p.p2s <= 14.0) specificStats.push(`boasts elite pocket escapability (converts pressure into plays instead of sacks)`);
            if (p.err && p.err >= 4.5) specificStats.push(`breaks off massive chunk plays with an elite <strong>${p.err.toFixed(1)}% Explosive Run Rate</strong>`);
            if (p.snapShare && p.snapShare >= 75) specificStats.push(`rarely leaves the field (<strong>${p.snapShare.toFixed(0)}% snap share</strong>)`);

            if (specificStats.length > 0) {
                statProof = ` His elite profile is backed by raw data: he ${specificStats.slice(0, 2).join(', and ')}.`;
            }
        }

        // -------------------------------------------------------------
        // DYNAMIC BULL CASE (PROS)
        // -------------------------------------------------------------
        let pros = [];
        let hasDepthChartPro = false;

        let isReceivingSpecialist = (p.targetShare && p.targetShare >= 10) || (p.pastStats && p.pastStats.rec >= 35);
        let isGoalLineVulture = (p.rzAtt && p.rzAtt >= 25) || (p.pastStats && p.pastStats.rushTd >= 8);

        // ENGINEERED PRO: Elite Per-Game Value hidden by Injury
            if (p._healthyPpg && p._healthyPpg > ((p.ProjPts || 0) / 17)) {
                let diff = p._healthyPpg - ((p.ProjPts || 0) / 17);
                if (diff >= 2.0) {
                    pros.push(`<strong>Hidden Elite Ceiling:</strong> Projections suppress his total points assuming an injury absence. However, when active, his <strong>${p._healthyPpg.toFixed(1)} Healthy PPG</strong> paces like an absolute superstar.`);
                }
            }

        if (isOffense) {
            // 1. Past Stats Block (ONLY runs if player has 2025 historical data)
            if (p.pastStats) {
                const ps = p.pastStats;
                const pastGP = (ps && ps.gp > 0) ? ps.gp : 17;
                const bigPlaysPerGame = ps.bigPlays ? (ps.bigPlays / pastGP) : 0;

                // Tiered Big Plays
                if (bigPlaysPerGame >= 1.0) {
                    pros.push(`<strong>Elite Explosive Playmaker:</strong> Logged a massive <strong>${bigPlaysPerGame.toFixed(1)} big plays per game</strong> (20+ yards) last season, demonstrating weekly slate-breaking upside.`);
                } else if (bigPlaysPerGame >= 0.6) {
                    pros.push(`<strong>Proven Explosive Playmaker:</strong> Logged <strong>${bigPlaysPerGame.toFixed(1)} big plays per game</strong> (20+ yards) last season.`);
                }

                // Tiered PPG
                if (p.pastPpg && p.pastPpg >= 18.0) {
                    if (pastGP <= 6) {
                        pros.push(`<strong>Elite Small-Sample Dominance:</strong> Averaged a staggering <strong>${p.pastPpg.toFixed(1)} PPG</strong> in 2025, though across a limited ${pastGP}-game sample.`);
                    } else {
                        pros.push(`<strong>Superstar Production:</strong> Delivered an elite <strong>${p.pastPpg.toFixed(1)} PPG</strong> in 2025, anchoring fantasy lineups.`);
                    }
                } else if (p.pastPpg && p.pastPpg >= 14.5) {
                    if (pastGP <= 6) {
                        pros.push(`<strong>High-Impact Sample:</strong> Produced <strong>${p.pastPpg.toFixed(1)} PPG</strong> across a limited ${pastGP} games in 2025.`);
                    } else {
                        pros.push(`<strong>Proven High-End Output:</strong> Delivered a strong <strong>${p.pastPpg.toFixed(1)} PPG</strong> in 2025.`);
                    }
                }

                // Tiered Ground Efficiency
                if (pos === 'RB' && ps.rushYpa && ps.rushYpa >= 5.2 && ps.rushAtt >= 100) {
                    pros.push(`<strong>Hyper-Efficient Rusher:</strong> Averaged a staggering <strong>${ps.rushYpa.toFixed(1)} YPC</strong> on ${ps.rushAtt} carries last season.`);
                } else if (pos === 'RB' && ps.rushYpa && ps.rushYpa >= 4.7 && ps.rushAtt >= 100) {
                    pros.push(`<strong>High Ground Efficiency:</strong> Averaged a stellar <strong>${ps.rushYpa.toFixed(1)} YPC</strong> on ${ps.rushAtt} carries last season.`);
                }

                // Scheme-Adjusted Expected TD (xTD) Positive Regression
                if (p.xTD !== undefined && ps.totalTd !== undefined && p._positiveTdRegression) {
                    let diff = p.xTD - ps.totalTd;
                    pros.push(`<strong>Massive TD Regression Candidate:</strong> Scored only ${ps.totalTd} TDs last year. However, based on his specific red-zone touch volume and his team's offensive efficiency scheme, his Expected Touchdowns (xTD) was <strong>${p.xTD.toFixed(1)}</strong>. He is mathematically primed to score ~${Math.round(diff)} more touchdowns this season with neutral luck.`);
                }

                // Projected Leap
                const projPpg = Number(ppg) || 0;
                if (p.pastPpg > 0 && pastGP >= 10) {
                    const leap = projPpg - p.pastPpg;
                    if (leap >= 5.5) {
                        pros.push(`<strong>Massive Production Leap:</strong> 2026 projection (${projPpg.toFixed(1)} PPG) anticipates a colossal breakout compared to last year (${p.pastPpg.toFixed(1)} PPG).`);
                    } else if (leap >= 3.0) {
                        pros.push(`<strong>Expected Production Leap:</strong> 2026 projection (${projPpg.toFixed(1)} PPG) marks a significant improvement over last year's output (${p.pastPpg.toFixed(1)} PPG), reflecting a much better role or environment.`);
                    }
                }
            }

            // 2. Archetype & Trait Badges (Runs for ALL players, including Rookies)
            if (p._isGoalLineHammer) {
                pros.push(`<strong>Goal-Line Hammer:</strong> Monopolizes high-value carries inside the 5-yard line, providing elite touchdown conversion upside.`);
            }

            if (p._isSpikeWeekWeapon) {
                pros.push(`<strong>💥 Slate-Breaking Spike Weeks:</strong> Generates massive per-target air yards (<strong>${p.aDOT ? p.aDOT + ' aDOT' : 'Deep Target'}</strong>), giving him matchup-winning ceiling on high-efficiency splash plays.`);
            }

            if (p._isSatelliteBack && State.scoring.ppr >= 0.5) {
                pros.push(`<strong>PPR Cheat Code:</strong> Commands elite passing game usage for a running back, ensuring a rock-solid floor in PPR formats despite a lack of carries.`);
            }

            if (p._isShortAdotOperator && State.scoring.ppr >= 0.5) {
                pros.push(`<strong>Short-aDOT PPR Operator:</strong> Commands high catch volume near the line of scrimmage (<strong>${p.aDOT} aDOT</strong>), building a rock-solid weekly PPR baseline.`);
            }

            if (p._isPlayActionMerchant) {
                pros.push(`<strong>Play-Action Scheme Merchant:</strong> Operates in an elite play-action system that generates wide-open completions and elevated yards per target.`);
            }

            if (p._isRedZoneVulture) {
                pros.push(`<strong>Red Zone Vulture:</strong> Monopolizes high-value inside-the-10 carries despite playing behind a lead back.`);
            }

            // Tiered Target Quality
            if (['WR', 'TE'].includes(pos) && p.catchable && p.pastStats && p.pastStats.targets) {
                const catchableRate = (p.catchable / p.pastStats.targets) * 100;
                if (catchableRate >= 88.0) {
                    pros.push(`<strong>Elite Target Quality:</strong> Benefited from highly accurate QB play, with <strong>${catchableRate.toFixed(1)}%</strong> of his targets deemed catchable.`);
                } else if (catchableRate >= 80.0) {
                    pros.push(`<strong>High Target Quality:</strong> Received catchable passes on <strong>${catchableRate.toFixed(1)}%</strong> of his targets last season.`);
                }
            }

            // Tiered Target Share
            if (p.targetShare >= 27) {
                pros.push(`<strong>Dominant Alpha Target:</strong> Soaks up a massive ${p.targetShare}% target share, guaranteeing a bulletproof weekly floor and absolute scheme priority.`);
            } else if (p.targetShare >= 22) {
                pros.push(`<strong>Strong Target Magnet:</strong> Vacuuming up ${p.targetShare}% of team pass attempts, ensuring consistent script-proof volume.`);
            }

            // Tiered HVO
            const hvoPerGame = p.hvo ? (p.hvo / activeGames) : 0;
            if (hvoPerGame >= 5.2) {
                pros.push(`<strong>Elite High-Value Opportunities:</strong> Generates massive usage with <strong>${hvoPerGame.toFixed(1)} HVO per game</strong> (Targets + RZ carries). This is the exact role that prints top-5 RB seasons.`);
            } else if (hvoPerGame >= 3.8) {
                pros.push(`<strong>High-Value Opportunities:</strong> Secures highly profitable touches with <strong>${hvoPerGame.toFixed(1)} combined targets & RZ carries per game</strong>.`);
            }

            // Committee RB Strengths
            if (pos === 'RB' && p.snapShare && p.snapShare >= 40 && p.snapShare <= 65) {
                if (p._isHandcuffPlus) {
                    pros.push(`<strong>Premium 1B Back:</strong> While technically a backup, his <strong>${p.snapShare.toFixed(0)}% snap share</strong> gives him standalone flex value every week.`);
                }
                if (isReceivingSpecialist) {
                    pros.push(`<strong>PPR Pass Specialist:</strong> Captures high-value receiving work (<strong>${p.targetShare || 10}% target share</strong>), maintaining a solid PPR floor despite a shared backfield.`);
                } else if (isGoalLineVulture) {
                    pros.push(`<strong>Goal-Line Vulture:</strong> Monopolizes high-leverage inside-the-10 carries, providing touchdown-driven upside in a split backfield.`);
                }
            }

            // Tiered YAC
            if (pos === 'RB' && p.yacAtt >= 3.4) {
                pros.push(`<strong>Elite YAC Creator:</strong> Generates a dominant <strong>${p.yacAtt.toFixed(1)} Yards After Contact</strong> per carry, routinely breaking tackles and creating independent yardage.`);
            } else if (pos === 'RB' && p.yacAtt >= 2.9) {
                pros.push(`<strong>Strong YAC Creator:</strong> Generates <strong>${p.yacAtt.toFixed(1)} Yards After Contact</strong> per carry, producing yards independent of offensive line blocking.`);
            }

            // Tiered WOPR
            if (['WR', 'TE'].includes(pos) && p.wopr >= 0.65) {
                pros.push(`<strong>Elite WOPR Command:</strong> Boasts a dominant <strong>${p.wopr.toFixed(2)} WOPR</strong>, combining elite target command with massive deep air yards share.`);
            } else if (['WR', 'TE'].includes(pos) && p.wopr >= 0.55) {
                pros.push(`<strong>Alpha WOPR Profile:</strong> Posts a strong <strong>${p.wopr.toFixed(2)} WOPR</strong>, showing excellent underlying volume metrics.`);
            }

            // Tiered Catch Rate
            if (['WR', 'TE'].includes(pos) && p.trueCatchRate >= 94.0) {
                pros.push(`<strong>Vacuum Hands:</strong> Secured an elite <strong>${p.trueCatchRate.toFixed(1)}% of catchable targets</strong> last season.`);
            } else if (['WR', 'TE'].includes(pos) && p.trueCatchRate >= 90.0) {
                pros.push(`<strong>Reliable Hands:</strong> Secured <strong>${p.trueCatchRate.toFixed(1)}% of catchable targets</strong> last season.`);
            }

            // Tiered YPT
            if (['WR', 'TE'].includes(pos) && p.ypt >= 10.5 && p.targetShare >= 15) {
                pros.push(`<strong>Hyper-Efficient Target:</strong> Generated a staggering <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season.`);
            } else if (['WR', 'TE'].includes(pos) && p.ypt >= 9.0 && p.targetShare >= 15) {
                pros.push(`<strong>Elite Target Efficiency:</strong> Generated a strong <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season.`);
            }

            // Pocket Time & O-Line
            if (pos === 'QB' && passEnv && passEnv.pktTime >= 2.65) {
                pros.push(`<strong>Elite Pocket Time:</strong> Operates behind an O-Line allowing a massive <strong>${passEnv.pktTime}s pocket time</strong>, giving deep routes ample time to develop.`);
            } else if (pos === 'QB' && passEnv && passEnv.pktTime >= 2.45) {
                pros.push(`<strong>Clean Pocket Time:</strong> Operates behind an O-Line allowing <strong>${passEnv.pktTime}s pocket time</strong>, giving routes time to develop.`);
            }
            if (p.olTier === 'S') {
                pros.push(`<strong>Elite Trench Protection:</strong> Operates behind a Tier S Offensive Line. Elite blocking provides QBs impregnable pockets and gives RBs massive running lanes.`);
            } else if (p.olTier === 'A') {
                pros.push(`<strong>Strong Trench Protection:</strong> Operates behind a Tier A Offensive Line, boosting offensive efficiency.`);
            }

            // Tiered aDOT
            if (p.aDOT >= 14.5) {
                pros.push(`<strong>Elite Deep Threat:</strong> Boasts a massive ${p.aDOT} aDOT (Average Depth of Target), routinely stretching the field for splash plays.`);
            } else if (p.aDOT >= 11.5) {
                pros.push(`<strong>Downfield Target:</strong> Leverages an ${p.aDOT} aDOT, giving his targets immense touchdown and chunk-play upside.`);
            }

            // Schedule & Snaps
            if (p.avgStars && p.avgStars >= 3.6) {
                pros.push(`<strong>Cake Overall Schedule:</strong> Extremely favorable ${p.avgStars.toFixed(2)}/5.0 star schedule rating.`);
            } else if (p.avgStars && p.avgStars >= 3.3) {
                pros.push(`<strong>Soft Overall Schedule:</strong> Favorable ${p.avgStars.toFixed(2)}/5.0 Strength of Schedule rating (Meaning easier matchups for fantasy production).`);
            }

            if (p.height && p.weight) {
                let hMatch = String(p.height).match(/(\d+)['\-]+(\d+)/);
                let inches = hMatch ? ((parseInt(hMatch[1]) * 12) + parseInt(hMatch[2])) : parseInt(p.height, 10);
                let formattedH = hMatch ? `${hMatch[1]}'${hMatch[2]}"` : (!isNaN(p.height) ? `${Math.floor(p.height / 12)}'${p.height % 12}"` : p.height);
                let weightLbs = parseInt(p.weight, 10);

                if (p.bmi && p.bmi >= 31.5 && p.Pos === 'RB') {
                    pros.push(`<strong>Elite Power Profile:</strong> At ${formattedH} and ${weightLbs} lbs, possesses prototypical workhorse size and short-yardage gravity.`);
                } else if (p.Pos === 'WR' && (inches >= 74 || weightLbs >= 210)) {
                    pros.push(`<strong>Big-Bodied Target:</strong> At ${formattedH} and ${weightLbs} lbs, offers imposing boundary size and red-zone leverage.`);
                } else if (p.Pos === 'TE' && (inches >= 77 || weightLbs >= 250)) {
                    pros.push(`<strong>Prototypical TE Frame:</strong> At ${formattedH} and ${weightLbs} lbs, provides elite size as an end-zone and seam mismatch.`);
                }
            }

            if (['RB', 'WR', 'TE'].includes(pos) && p.snapShare >= 85) {
                pros.push(`<strong>Every-Down Workhorse:</strong> Never leaves the field (<strong>${p.snapShare.toFixed(0)}% snap share</strong>). True bellcow deployment completely immunizes him from substitution risk.`);
            } else if (['RB', 'WR', 'TE'].includes(pos) && p.snapShare >= 72) {
                pros.push(`<strong>High Snap Share:</strong> On the field for ${p.snapShare.toFixed(0)}% of offensive snaps (High snap volume minimizes the risk of losing touches to backups).`);
            }

            if (pos === 'QB' && p.stats && p.stats.rushYds >= 600) {
                pros.push(`<strong>Konami Code Upside:</strong> Projected for <strong>${p.stats.rushYds} rushing yards</strong>. Elite rushing mobility gives him an unmatched weekly floor and ceiling combination.`);
            } else if (pos === 'QB' && p.stats && p.stats.rushYds >= 350) {
                pros.push(`<strong>Dual-Threat Asset:</strong> Projected for <strong>${p.stats.rushYds} rushing yards</strong>, padding his fantasy output on the ground.`);
            }

            if (p.boomBust && p.boomBust.games >= 4) {
                let bb = p.boomBust;
                let boomTarget = p.Pos === 'TE' ? 12 : (p.Pos === 'QB' ? 22 : 16);
                let top12Target = p.Pos === 'QB' ? 58 : (p.Pos === 'TE' ? 42 : 48);

                if (bb.boom >= boomTarget) {
                    pros.push(`<strong>💥 Elite Spike-Week Upside:</strong> Posted a "Boom" week in <strong>${bb.boom}%</strong> of starts (vs ${p.Pos} baseline of ${boomTarget}%).`);
                }
                if (bb.top12 >= top12Target) {
                    pros.push(`<strong>🛡️ High Starter Consistency:</strong> Finished as a Top-12 ${p.Pos} in <strong>${bb.top12}%</strong> of games last season.`);
                }
                if (bb.boom >= boomTarget && bb.bust <= 18) {
                    pros.push(`<strong>⭐ Ideal Volatility Profile:</strong> High boom rate (${bb.boom}%) coupled with an exceptionally low bust rate (${bb.bust}%).`);
                }
            }

            if (p._isAscendingRole) {
                if (p.isNewRole || !p._growthPct) {
                    pros.push(`<strong>📈 Emerging Workload:</strong> Steps into a highly prominent offensive role as an ascending prospect. His projection reflects a clean-slate infusion of high-value touches based on vacated team volume.`);
                } else {
                    pros.push(`<strong>📈 Ascending Workload Leap:</strong> Projected for a <strong>+${p._growthPct}% surge in touches per game</strong> compared to 2025 actuals, reflecting an expanding featured role rather than a restricted split.`);
                }
            }

            if (p.isTeamChanger && p._envDelta && p._envDelta >= 0.015) {
                let volNote = ['WR', 'TE'].includes(p.Pos) ? "passing efficiency and QB accuracy" : "run-blocking environment";
                pros.push(`<strong>🔄 Lucrative Scheme Upgrade:</strong> Offseason move from <strong>${p.pastTeam} to ${p.Team}</strong> places him in a substantially more efficient ${volNote}.`);
            }

            if (p._addedPPW && p._addedPPW >= 1.0) {
                pros.push(`<strong>Elite Lineup Difference Maker:</strong> Adds a massive +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
            } else if (p._addedPPW && p._addedPPW >= 0.3 && !p._byeFillWeek) {
                pros.push(`<strong>Lineup Difference Maker:</strong> Adds +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
            }

            if (p.isRBStarter && p.handcuffName) {
                if (p._backupThreatLevel === '1B Committee Threat' || p._backupThreatLevel === 'Passing Down Threat') {
                    pros.push(`<strong>Primary Early-Down Back:</strong> Holds the designated starting role ahead of ${p.handcuffName}.`);
                } else if (p._backupThreatLevel === 'Goal-Line Vulture Threat') {
                    pros.push(`<strong>Lead Early-Down & Pass Back:</strong> Commands the primary early-down and receiving workload with ${p.handcuffName} designated as the short-yardage spell.`);
                } else {
                    pros.push(`<strong>Clear Backfield Lead:</strong> Uncontested RB1 status with designated handcuff protection (${p.handcuffName}).`);
                }
            }

            // Depth Chart Pros
            if (['WR', 'TE'].includes(pos) && p.depthChart === 2 && p.targetShare >= 18) {
                pros.push(`<strong>Co-Primary Target:</strong> Slotted at Depth #2, but commands a heavy <strong>${p.targetShare}% target share</strong> alongside his team's WR1.`);
                hasDepthChartPro = true;
            } else if (pos === 'WR' && p.depthChart === 2 && teamDist && teamDist['WR %'] >= 58.0) {
                pros.push(`<strong>High-Volume WR Room:</strong> ${p.Team} funnels <strong>${teamDist['WR %']}% of targets to WRs</strong>, ensuring strong volume even as the WR2.`);
                hasDepthChartPro = true;
            }

            // System & Scheme Pros
            if (['WR', 'TE'].includes(pos) && offensePace === 'pass-heavy') {
                pros.push(`<strong>Pass-Heavy Offense:</strong> The team's high passing volume elevates his weekly target ceiling and guarantees a safer baseline for PPR formats.`);
            }
            if (pos === 'QB' && offensePace === 'pass-heavy') {
                pros.push(`<strong>High-Volume Scheme:</strong> Directing a pass-heavy attack naturally pads his fantasy floor with raw volume and increased touchdown opportunities.`);
            }
            if (pos === 'RB' && offensePace === 'run-heavy') {
                if (p.depthChart === 1 || p.isRBStarter) {
                    pros.push(`<strong>Run-Heavy Offense:</strong> Operating as the lead back in a run-first system ensures a massive baseline of rushing attempts and positive game scripts to churn out the clock.`);
                } else {
                    pros.push(`<strong>Run-Heavy Environment:</strong> Plays in a run-first scheme that generates elevated total backfield volume, increasing touch opportunities for rotational backs.`);
                }
            }
            if (pos === 'RB' && rushEnv && rushEnv.ybcAtt >= 2.9) {
                pros.push(`<strong>Elite YBC Scheme Boost:</strong> Elite run-blocking scheme generates ${rushEnv.ybcAtt} Yards Before Contact (YBC) per carry, giving him massive open space before taking a hit.`);
            } else if (pos === 'RB' && rushEnv && rushEnv.ybcAtt >= 2.6) {
                pros.push(`<strong>YBC Scheme Boost:</strong> Run-blocking scheme generates ${rushEnv.ybcAtt} Yards Before Contact (YBC) per carry.`);
            }

            if (p._inEliteOffense) {
                pros.push(`<strong>Elite Scoring Ecosystem:</strong> Plays in a top-tier NFL offense, guaranteeing high drive-sustainment, frequent red-zone trips, and elevated scoring opportunities across the board.`);
            }

            if (isRookieOrYoung && posRank <= 36) {
                if (p.syntheticBoost && p.syntheticBoost >= 0.08) {
                    pros.push(`<strong>Elite Scheme Inheritance:</strong> As a rookie/new starter, he inherits an incredibly lucrative offensive environment that mathematically places him on equal footing with elite volume veterans.`);
                } else {
                    pros.push(`<strong>Fresh Legs & Youth Ceiling:</strong> At just ${pAge} years old, enters the season with high-end athletic potential and minimal NFL workload wear.`);
                }
            }
        }

        if (isDST && p.stats) {
            const ds = p.stats;
            if (p.havocPerGame && p.havocPerGame >= 6.5) pros.push(`<strong>Elite Havoc Rating:</strong> Created massive offensive disruption, generating <strong>${p.havocPerGame.toFixed(1)} havoc events</strong> (Sacks + Turnovers + TFLs) per game.`);
            else if (ds.sack && ds.sack >= 45) pros.push(`<strong>Elite Pass Rush:</strong> Generated a massive <strong>${ds.sack} sacks</strong> last season.`);

            const to = (ds.defInt || 0) + (ds.defFum || 0);
            if (to >= 30) pros.push(`<strong>Elite Turnover Magnet:</strong> Forced a staggering <strong>${to} total turnovers</strong> (INTs & Fumbles) last season.`);
            else if (to >= 24) pros.push(`<strong>Turnover Magnet:</strong> Forced <strong>${to} total turnovers</strong> (INTs & Fumbles) last season.`);

            if (ds.defTd && ds.defTd >= 3) pros.push(`<strong>Scoring Threat:</strong> Scored <strong>${ds.defTd} defensive touchdowns</strong> last season.`);

            if (ds.papg && ds.papg <= 17.5) pros.push(`<strong>Impenetrable Defense:</strong> Allowed an incredibly low <strong>${ds.papg.toFixed(1)} Points Per Game</strong>.`);
            else if (ds.papg && ds.papg <= 19.5) pros.push(`<strong>Stingy Scoring Defense:</strong> Allowed just <strong>${ds.papg.toFixed(1)} Points Per Game</strong>.`);
        }

        if (isPK && p.stats) {
            if (p.stats.fgTotal && p.stats.fgTotal >= 35) pros.push(`<strong>Elite Volume Kicker:</strong> Made a massive <strong>${p.stats.fgTotal} Field Goals</strong> last season.`);
            else if (p.stats.fgTotal && p.stats.fgTotal >= 30) pros.push(`<strong>High Volume Kicker:</strong> Made <strong>${p.stats.fgTotal} Field Goals</strong> last season.`);
        }

        if (!isOffense) {
            if (p.avgStars && p.avgStars >= 3.3) pros.push(`<strong>Soft Overall Schedule:</strong> Favorable ${p.avgStars.toFixed(2)}/5.0 Strength of Schedule rating.`);
            if (p._addedPPW && p._addedPPW >= 0.3 && !p._byeFillWeek) pros.push(`<strong>Lineup Difference Maker:</strong> Adds +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
        }

        if (p._byeFillWeek) {
            pros.push(`<strong>Bye Week Insurance:</strong> Provides a critical +${p._byeFillPts.toFixed(1)} point boost during Week ${p._byeFillWeek}.`);
        }

        if (pros.length === 0) {
            pros.push(`<strong>Dependable Volume Role:</strong> Projected for a reliable ${proj.toFixed(1)} season points as the ${posRankStr} in fantasy.`);
        }

        // -------------------------------------------------------------
        // DYNAMIC BEAR CASE (CONS)
        // -------------------------------------------------------------
        let cons = [];
        let riskScore = 0;
        let hasScriptDependencyCon = false;
        let hasLowVolumeCon = false;

        // ENGINEERED CON: Timeline Volatility
            if (p.Min_Missed_26 !== undefined && p.Max_Missed_26 !== undefined) {
                let gap = Number(p.Max_Missed_26) - Number(p.Min_Missed_26);
                if (gap >= 3) {
                    cons.push(`<strong>Recovery Volatility:</strong> Massive uncertainty surrounds his timeline (projected to miss between ${p.Min_Missed_26} and ${p.Max_Missed_26} games). This wide variance makes him a high-risk IR stash.`);
                    riskScore += 2;
                } else if (Number(p.Max_Missed_26) >= 4) {
                    cons.push(`<strong>Roster Clog:</strong> Expected to miss significant time (up to ${p.Max_Missed_26} games). Will burn a valuable bench/IR spot for multiple weeks before contributing.`);
                    riskScore += 1;
                }
            }

        if (isOffense) {
            if (p.pastStats) {
                const ps = p.pastStats;
                const totalTouches = (Number(ps.rushAtt) || 0) + (Number(ps.rec) || 0);
                const games = Number(ps.gp) || 17;

                // 1. Tiered Curse of 300 Touches
                if (pos === 'RB' && totalTouches >= 360) {
                    cons.push(`<strong>Extreme Workload Hangover:</strong> Logged an exhausting ${totalTouches} touches last season. The risk of a major physical drop-off or injury is highly elevated.`);
                    riskScore += 3;
                } else if (pos === 'RB' && totalTouches >= 300) {
                    cons.push(`<strong>The '300-Touch' Curse:</strong> Logged a grueling ${totalTouches} touches last season. Running backs historically suffer sharp efficiency drops or injuries the year following a 300+ touch workload.`);
                    riskScore += 2;
                }

                // 2. Context-Aware Durability vs. Non-Injury / Developmental Sample Check
                const isDevelopmentalDepth = totalTouches <= 15 && (pAge <= 23 || p.isNewRole);
                const isNonInjuryAbsence = p._isPastNonInjury || (p._injuryPenalty === 'past_non_injury');

                if (isNonInjuryAbsence && games <= 14) {
                    // Suppress false "Injury Durability" alarms for past suspensions/holdouts (e.g. Rashee Rice)
                    cons.push(`<strong>Shortened 2025 Sample (${games} GP):</strong> Missed games last season due to a non-injury absence${p._injuryNote ? ` (${p._injuryNote})` : ''}. His per-game output reflects elite efficiency over a truncated schedule.`);
                } else if (games <= 8 && games > 0 && !isDevelopmentalDepth) {
                    cons.push(`<strong>Severe Durability Risk:</strong> Missed over half the season, playing only <strong>${games} games</strong>. Staying on the field is a major question mark.`);
                    riskScore += 3;
                    if (games <= 6) {
                        cons.push(`<strong>Small Sample Volatility:</strong> 2025 efficiency metrics are based on just <strong>${games} games</strong>. Rates like PPG and TD frequency carry elevated regression risk over a full 17-game slate.`);
                    }
                } else if (games <= 12 && games > 0 && !isDevelopmentalDepth) {
                    cons.push(`<strong>Durability Risk:</strong> Missed significant time last season, playing only <strong>${games} games</strong>. Injury variance lowers his floor.`);
                    riskScore += 2;
                } else if (isDevelopmentalDepth) {
                    cons.push(`<strong>Developmental Sample:</strong> Logged limited active snaps (${games} GP, ${totalTouches} touches) as a rotational depth piece; projection relies on expanding future opportunity.`);
                }

                // 3. Tiered Turnover Concerns
                const interceptions = Number(ps.int) || 0;
                if (pos === 'QB' && interceptions >= 17) {
                    cons.push(`<strong>Turnover Prone:</strong> Threw an alarming <strong>${interceptions} interceptions</strong> last season, risking defensive scoring penalties and benchings.`);
                    riskScore += 2;
                } else if (pos === 'QB' && interceptions >= 13) {
                    cons.push(`<strong>Turnover Concerns:</strong> Threw <strong>${interceptions} interceptions</strong> last season.`);
                    riskScore += 1;
                }

                // 4. Ball Security
                const fumbles = Number(ps.fum) || 0;
                if (fumbles >= 6) {
                    cons.push(`<strong>Severe Ball Security Issues:</strong> Coughed up <strong>${fumbles} fumbles lost</strong> last season, a critical flaw that endangers playing time.`);
                    riskScore += 2;
                } else if (fumbles >= 4) {
                    cons.push(`<strong>Ball Security Issues:</strong> Coughed up <strong>${fumbles} fumbles lost</strong> last season.`);
                    riskScore += 1;
                }

                // 5. Tiered Low Ground Efficiency
                const rushAtt = Number(ps.rushAtt) || 0;
                const rushYds = Number(ps.rushYds) || 0;
                const rushYpc = Number(ps.rushYpa) || (rushAtt > 0 ? rushYds / rushAtt : 0);
                if (pos === 'RB' && rushAtt >= 100 && rushYpc <= 3.4 && rushYpc > 0) {
                    cons.push(`<strong>Dismal Ground Efficiency:</strong> Plodded for just <strong>${rushYpc.toFixed(1)} YPC</strong> on ${rushAtt} carries last season, putting his starting role severely at risk.`);
                    riskScore += 2;
                } else if (pos === 'RB' && rushAtt >= 100 && rushYpc <= 3.8 && rushYpc > 0) {
                    cons.push(`<strong>Sub-Par Ground Efficiency:</strong> Averaged just <strong>${rushYpc.toFixed(1)} YPC</strong> on ${rushAtt} carries last season.`);
                    riskScore += 1;
                }

                // 6. Expected Production Regression
                const pastPpg = Number(p.pastPpg) || 0;
                const projPpg = Number(ppg) || 0;
                if (pastPpg > 0 && games >= 10) {
                    const drop = pastPpg - projPpg;
                    if (drop >= 6.0) {
                        cons.push(`<strong>Steep Production Regression:</strong> 2026 projection (${projPpg.toFixed(1)} PPG) signals a massive drop-off from last year (${pastPpg.toFixed(1)} PPG) due to structural or role changes.`);
                        riskScore += 2;
                    } else if (drop >= 3.5) {
                        cons.push(`<strong>Expected Production Regression:</strong> 2026 projection (${projPpg.toFixed(1)} PPG) marks a notable step back from last year's output (${pastPpg.toFixed(1)} PPG).`);
                        riskScore += 1;
                    }
                }

                // 7. Scheme-Adjusted Expected TD (xTD) Negative Regression
                if (p.xTD !== undefined && ps.totalTd !== undefined && p._isFlukeTDScorer) {
                    let diff = ps.totalTd - p.xTD;
                    cons.push(`<strong>Extreme TD Regression Warning:</strong> Scored an unsustainable ${ps.totalTd} TDs last year. Based on his actual touch locations and his team's offensive efficiency scheme, his Expected Touchdowns (xTD) was only <strong>${p.xTD.toFixed(1)}</strong>. Unless his red-zone role significantly increases, expect a sharp drop in scoring.`);
                    riskScore += 2;
                }
            } // <<< CLOSE p.pastStats BLOCK HERE

            // 9. Tiered Target Quality Check
            if (['WR', 'TE'].includes(pos) && p.catchable && p.pastStats && (Number(p.pastStats.targets) || 0) > 0) {
                const targets = Number(p.pastStats.targets);
                const catchableRate = (Number(p.catchable) / targets) * 100;

                if (catchableRate <= 55.0) {
                    cons.push(`<strong>Dismal Target Quality:</strong> Only an abysmal <strong>${catchableRate.toFixed(1)}%</strong> of his targets were catchable last season, rendering volume highly inefficient.`);
                    riskScore += 2;
                } else if (catchableRate <= 68.0) {
                    cons.push(`<strong>Suppressed Target Quality:</strong> Only <strong>${catchableRate.toFixed(1)}%</strong> of targets were catchable last season due to off-target throws.`);
                    riskScore += 1;
                }
            }

            let teamTopTargetShare = Math.max(0, ...State.allPlayers.filter(x => x._cleanTeam === tTeam).map(x => x.targetShare || 0));

            // Only flag Lack of Alpha Target Share if the player is NOT projected for high volume (≥ 110 targets)
            if (['WR', 'TE'].includes(pos) && teamTopTargetShare > 0 && teamTopTargetShare < 20.0 && (!p.targetShare || p.targetShare < 20.0) && (!p.stats || p.stats.targets < 110)) {
                cons.push(`<strong>Lack of Alpha Target Share:</strong> The offensive system spreads the ball evenly across multiple receivers (no player on the team commands a 20%+ target share). This lack of a concentrated alpha role creates volatile weekly floors.`);
                riskScore += 1;
            }

            // ===========================================================
            // 10. ARCHETYPE RISK WARNINGS (SAFE FOR ALL PLAYERS / ROOKIES)
            // ===========================================================

            // Satellite Back in Standard Scoring (Unique Single Check)
            if (p._isSatelliteBack && State.scoring.ppr === 0) {
                cons.push(`<strong>Lacks Rushing Floor:</strong> Barely utilized in the traditional running game, making him incredibly difficult to start in Standard (Non-PPR) scoring formats.`);
                riskScore += 2;
            }

            // Goal-Line Hammer in PPR Scoring
            if (p._isGoalLineHammer && State.scoring.ppr >= 0.5) {
                cons.push(`<strong>Zero Pass-Catching Floor:</strong> Virtually non-existent in the passing game, making his weekly fantasy output 100% dependent on scoring touchdowns.`);
                riskScore += 1;
            }

            // Cardio King
            if (p._isCardioKing) {
                cons.push(`<strong>Cardio King / Decoy:</strong> Logged a massive <strong>${p.snapShare ? p.snapShare.toFixed(0) : '75+'}% snap share</strong> but an abysmal <strong>${p.targetShare}% target share</strong>. He is on the field constantly just to run wind sprints and block.`);
                riskScore += 2;
            }

            // Empty Calories Receiver
            if (p._isEmptyCalories) {
                cons.push(`<strong>Empty Calories Trap:</strong> Despite seeing heavy volume, his atrocious <strong>${p.ypt ? p.ypt.toFixed(1) : 'low'} YPT</strong> mathematically destroys his fantasy ceiling.`);
                riskScore += 1;
            }

            // Short-aDOT PPR Operator
            if (p._isShortAdotOperator && State.scoring.ppr === 0) {
                cons.push(`<strong>Capped Downfield Ceiling:</strong> Low aDOT (<strong>${p.aDOT || '6.5'} yds</strong>) limits explosive play upside; relies entirely on PPR catch volume to remain fantasy relevant.`);
                riskScore += 1;
            }

            // Spike-Week Floor Volatility
            if (p._isSpikeWeekWeapon) {
                cons.push(`<strong>Volatile Target Floor:</strong> Lower overall target share leaves him susceptible to low-point duds when deep passes don't connect.`);
            }

            // TD-or-Bust Tight End
            if (p._isTDorBust) {
                cons.push(`<strong>Touchdown Dependent:</strong> Lacks consistent between-the-20s target volume. If he doesn't score a touchdown, he will likely ruin your weekly matchup.`);
                riskScore += 1;
            }

            // Red Zone Vulture
            if (p._isRedZoneVulture) {
                cons.push(`<strong>Game-Script Sensitive Vulture:</strong> Low snap share (<strong>${p.snapShare || '40'}%</strong>) makes his weekly baseline heavily dependent on the team reaching the red zone.`);
                riskScore += 1;
            }

            // Pressure Liability QB
            if (p._isPressureLiability) {
                cons.push(`<strong>🚨 Heavy Sack & Pressure Risk:</strong> Faces relentless pressure in the pocket, leading to drive-killing sacks, intentional grounding, and fumble risks.`);
                riskScore += 2;
            }

            // Play-Action Merchant Drop-Back Risk
            if (p._isPlayActionMerchant) {
                cons.push(`<strong>Drop-Back Passing Risk:</strong> Highly dependent on play-action designs; can struggle when trailing and forced into obvious drop-back passing situations.`);
            }

            // Tiered Committee Risk
            if (pos === 'RB' && p.snapShare && p.snapShare <= 65) {
                if (!isReceivingSpecialist && !isGoalLineVulture && !p.isRBStarter) {
                    if (p.snapShare <= 40) {
                        cons.push(`<strong>Buried in Committee:</strong> Sees the field on only <strong>${p.snapShare.toFixed(0)}% of snaps</strong>. Barely playable without an injury to the starter.`);
                        riskScore += 2;
                    } else {
                        cons.push(`<strong>Committee Grinder:</strong> Trapped in a shared backfield (<strong>${p.snapShare.toFixed(0)}% snap share</strong>) without receiving or goal-line monopoly.`);
                        riskScore += 1;
                    }
                }
            }

            // Suppress the Low-Volume Passing Attack penalty if the receiver is a projected Alpha target hog (≥23% Tgt Share or ≥125 Proj Targets)
            let isAlphaVolumeWR = (p.targetShare && p.targetShare >= 23) || (p.stats && p.stats.targets >= 125);
            if (['WR', 'TE'].includes(pos) && offensePace === 'run-heavy' && !isAlphaVolumeWR) {
                cons.push(`<strong>Low-Volume Passing Attack:</strong> Playing in a <strong>run-heavy offense</strong> limits the overall passing pie, capping his week-to-week target ceiling.`);
                riskScore += 1;
                hasLowVolumeCon = true;
            }

            // Suppress the RB receiving penalty if he has meaningful pass-game work in projections or past stats
            let hasPassGameRole = (p.targetShare && p.targetShare >= 6.0) || (p.stats && p.stats.targets >= 35) || (p.pastStats && p.pastStats.targets >= 30);
            if (pos === 'RB' && offensePace === 'pass-heavy' && !hasPassGameRole) {
                cons.push(`<strong>Negative Scheme Fit:</strong> Operates in a <strong>pass-heavy offense</strong> but lacks receiving involvement, leaving him vulnerable to being scripted out of games if the team falls behind.`);
                riskScore += 1;
                hasScriptDependencyCon = true;
            }
            if (pos === 'QB' && offensePace === 'run-heavy' && (!p.stats || p.stats.rushAtt < 40)) {
                cons.push(`<strong>Capped Passing Ceiling:</strong> Directing a <strong>run-heavy offense</strong> restricts his passing attempts. Without elite rushing ability to compensate, his fantasy upside is strictly limited by scheme.`);
                riskScore += 1;
            }

            // Tiered Bad YBC Scheme
            if (pos === 'RB' && rushEnv && rushEnv.ybcAtt <= 1.8) {
                cons.push(`<strong>Catastrophic Blocking Scheme:</strong> The offensive line generates an abysmal <strong>${rushEnv.ybcAtt} Yards Before Contact (YBC)</strong>, meaning he is hit in the backfield almost instantly.`);
                riskScore += 2;
            } else if (pos === 'RB' && rushEnv && rushEnv.ybcAtt <= 2.2) {
                cons.push(`<strong>Poor Blocking Scheme:</strong> The offensive line generates a dismal <strong>${rushEnv.ybcAtt} Yards Before Contact (YBC)</strong>. He frequently faces defenders in the backfield and must work incredibly hard for every yard.`);
                riskScore += 1;
            }

            if (pos === 'WR' && p.height && p.weight) {
                let hMatch = String(p.height).match(/(\d+)['\-]+(\d+)/);
                let inches = hMatch ? ((parseInt(hMatch[1]) * 12) + parseInt(hMatch[2])) : parseInt(p.height, 10);
                let weightLbs = parseInt(p.weight, 10);
                if (inches > 0 && inches <= 69 && weightLbs <= 182) {
                    cons.push(`<strong>Slight Frame:</strong> At ${Math.floor(inches / 12)}'${inches % 12}" and ${weightLbs} lbs, faces press-coverage and durability concerns against physical DBs.`);
                    riskScore += 1;
                }
            }

            // QB Receiver Drops
            if (pos === 'QB' && passEnv && passEnv.dropPct >= 9.0) {
                cons.push(`<strong>Plagued by Drops:</strong> His pass-catchers posted an atrocious <strong>${passEnv.dropPct}% drop rate</strong>, destroying his completion percentage and killing drives.`);
                riskScore += 2;
            } else if (pos === 'QB' && passEnv && passEnv.dropPct >= 6.5) {
                cons.push(`<strong>Unreliable Receivers:</strong> His pass-catchers posted a frustrating <strong>${passEnv.dropPct}% drop rate</strong>, actively hurting his completion percentage and leaving valuable passing yards on the field.`);
                riskScore += 1;
            }

            if (pos === 'QB' && p.trueAccuracy && p.trueAccuracy < 60.0) {
                cons.push(`<strong>Inaccurate Passer:</strong> True Accuracy rating sits at an alarming <strong>${p.trueAccuracy.toFixed(1)}%</strong>. Severe passing inefficiency limits his offense.`);
                riskScore += 2;
            } else if (pos === 'QB' && p.trueAccuracy && p.trueAccuracy < 65.0) {
                cons.push(`<strong>Sub-Par Pass Accuracy:</strong> True Accuracy rating sits at a low <strong>${p.trueAccuracy.toFixed(1)}%</strong> (accounting for drops and throwaways, this highlights underlying passing inefficiency).`);
                riskScore += 1;
            }

            if (['WR', 'TE'].includes(pos) && p.ypt && p.ypt < 6.0) {
                cons.push(`<strong>Dismal Target Efficiency:</strong> Generated only <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season (meaning his targets are painfully inefficient).`);
                riskScore += 2;
            } else if (['WR', 'TE'].includes(pos) && p.ypt && p.ypt < 7.2) {
                // ADD THIS FOR THE EMPTY CALORIE TIER:
                if (!p._isEmptyCalories) {
                    cons.push(`<strong>Low Target Efficiency:</strong> Generated only <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season.`);
                    riskScore += 1;
                } else {
                    cons.push(`<strong>Low Target Efficiency:</strong> Generated only <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season.`);
                    riskScore += 1;
                }
            }

            if (p.dropRate && p.dropRate >= 10.0) {
                cons.push(`<strong>Stone Hands:</strong> Plagued by an awful <strong>${p.dropRate.toFixed(1)}% drop rate</strong>, which threatens his standing on the depth chart.`);
                riskScore += 2;
            } else if (p.dropRate && p.dropRate >= 7.0) {
                cons.push(`<strong>Elevated Drop Rate:</strong> Posted a high <strong>${p.dropRate.toFixed(1)}% drop rate</strong> on catchable targets.`);
                riskScore += 1;
            }

            if (p.p2s && p.p2s >= 24.0) {
                let isScrambler = (p.stats && p.stats.rushAtt >= 50) || (p.pastStats && p.pastStats.rushAtt >= 50);
                let sackNote = isScrambler 
                    ? `Frequent scrambling and extending broken plays leads to elevated negative sack yardage (<strong>${p.p2s.toFixed(1)}% Pressure-to-Sack Rate</strong>).`
                    : `An alarming <strong>${p.p2s.toFixed(1)}% Pressure-to-Sack Rate</strong> indicates difficulty navigating collapsing pockets.`;
                cons.push(`<strong>Takes Drive-Killing Sacks:</strong> ${sackNote}`);
                riskScore += 2;
            } else if (p.p2s && p.p2s >= 19.0) {
                cons.push(`<strong>Poor Escapability:</strong> High Pressure-to-Sack Rate (${p.p2s.toFixed(1)}%) indicates he struggles to throw the ball away or escape when the pocket breaks down.`);
                riskScore += 1;
            }

            if (p.pressureRate && p.pressureRate > 27.0) {
                if (p.olTier === 'S' || p.olTier === 'A') {
                    cons.push(`<strong>Holds the Ball Too Long:</strong> Faced a catastrophic <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong> despite elite O-Line play. He frequently creates his own pressure.`);
                } else {
                    cons.push(`<strong>Under Constant Siege:</strong> Faced a catastrophic <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong>. Offensive line play completely derails his timing.`);
                }
                riskScore += 1;
            }

            if (pAge) {
                if (pos === 'RB' && pAge >= 29) {
                    cons.push(`<strong>Dangerous Age Cliff:</strong> At ${pAge} y/o, he is well past the historical RB expiration date. The risk of total physical collapse is extremely high.`);
                    riskScore += 2;
                } else if (pos === 'RB' && pAge >= 27) {
                    cons.push(`<strong>Age Curve Warning:</strong> At ${pAge} y/o, faces steep historical efficiency decline at RB.`);
                    riskScore += 1;
                }

                if (pos === 'WR' && pAge >= 33) {
                    cons.push(`<strong>Dangerous Age Cliff:</strong> At ${pAge} y/o, the risk of sudden athletic drop-off and persistent soft tissue injuries is severe.`);
                    riskScore += 2;
                } else if (pos === 'WR' && pAge >= 31) {
                    cons.push(`<strong>Veteran Age Risk:</strong> Age ${pAge} puts him past the peak WR productivity curve.`);
                    riskScore += 1;
                }
            }
            if (p.boomBust && p.boomBust.games >= 4) {
                let bustTolerance = pos === 'WR' ? 28 : (pos === 'QB' ? 18 : 22);
                
                let pastTouches = (p.pastStats?.rushAtt || 0) + (p.pastStats?.rec || 0);
                let pastTargets = p.pastStats?.targets || 0;
                let pastPassAtt = p.pastStats?.passAtt || 0;
                let hasSignificantPastVolume = (pos === 'RB' && pastTouches >= 100) || (['WR', 'TE'].includes(pos) && pastTargets >= 60) || (pos === 'QB' && pastPassAtt >= 200);

                let isRoleExpansion = (p._isAscendingRole || p.isNewRole || (p._vacatedTgts >= 30) || (p._vacatedCarries >= 60) || p._inheritsGoalLineWork) && !hasSignificantPastVolume;
                if (isRoleExpansion) {
                    bustTolerance += 20; // Soften the UI penalty threshold for players taking on bigger roles
                }

                if (p.boomBust.bust > bustTolerance) {
                    let excessBust = p.boomBust.bust - bustTolerance;
                    cons.push(`<strong>🚨 High Bust Volatility:</strong> Busted in <strong>${p.boomBust.bust}%</strong> of games last season (exceeds ${p.Pos} baseline tolerance of ${bustTolerance}%).`);
                    riskScore += excessBust >= 10 ? 2 : 1;
                }
            }

            if (p._isDecliningRole) {
                cons.push(`<strong>📉 Contracting Workload:</strong> Projected for a <strong>-${p._declinePct}% drop in touches per game</strong> vs 2025, indicating lost volume to backfield competition or scheme changes.`);
                riskScore += 1;
            }

            if (p.isTeamChanger && p._envDelta && p._envDelta <= -0.015) {
                let volNote = ['WR', 'TE'].includes(p.Pos) ? "passing efficiency and QB accuracy" : "run-blocking environment";
                cons.push(`<strong>🔄 Negative Scheme Migration:</strong> Offseason transition from <strong>${p.pastTeam} to ${p.Team}</strong> drops him into a substantially worse ${volNote}, capping his overall efficiency.`);
                riskScore += 1;
            }

            if (p._inAnemicOffense) {
                cons.push(`<strong>Anemic Scoring Ecosystem:</strong> Trapped in a bottom-tier NFL offense. Frequent 3-and-outs and rare red-zone trips will severely suppress his touchdown ceiling.`);
                riskScore += 1;
            }

            if (p.olTier === 'F') {
                cons.push(`<strong>Disastrous O-Line Environment:</strong> Operating behind a bottom-tier (Tier ${p.olTier}) offensive line that routinely sabotages play development.`);
                riskScore += 2;
            } else if (p.olTier === 'D') {
                cons.push(`<strong>Poor O-Line Environment:</strong> Struggling Tier ${p.olTier} offensive line could cap overall efficiency.`);
                riskScore += 1;
            }

            // Depth Chart + Team Target Funnel Context
            if (['WR', 'TE'].includes(pos) && p.depthChart && p.depthChart >= 2) {
                if (teamDist && teamDist[`${pos} %`] < 48.0 && (!p.targetShare || p.targetShare < 18) && !hasDepthChartPro && !hasLowVolumeCon) {
                    cons.push(`<strong>Low-Volume Receiver Room:</strong> Slotted as the #${p.depthChart} option in an offense that funnels only <strong>${teamDist[`${pos} %`]}% of passes to ${pos}s</strong>.`);
                    riskScore += 1;
                } else if (p.depthChart >= 3 && (!p.targetShare || p.targetShare < 15)) {
                    cons.push(`<strong>Buried on Depth Chart:</strong> Listed as Depth #${p.depthChart}, requiring an injury ahead of him to see consistent target volume.`);
                    riskScore += 1;
                }
            }

            // Structural Flaws for Non-Elites
            if (!isUltraElite) {
                // Account for rookies/projected roles in high RB target schemes
                let hasModerateReceiving = (p.targetShare && p.targetShare >= 5) ||
                    (p.pastStats && p.pastStats.rec >= 20) ||
                    (p.stats && p.stats.rec >= 25) ||
                    (teamDist && teamDist['RB %'] >= 16.0);

                if (pos === 'RB' && (!p.hvo || p.hvo < 40) && !hasScriptDependencyCon && !hasModerateReceiving && !p._isHybridReceiver) {
                    cons.push(pickVar([
                        `<strong>Game-Script Dependency:</strong> Lacks pass-game work; vulnerable if ${p.Team} falls behind.`,
                        `<strong>Script Sensitivity:</strong> Production drops if negative game scripts force ${p.Team} to pass.`
                    ]));
                    riskScore += 1;
                } else if (['WR', 'TE'].includes(pos) && (!p.targetShare || p.targetShare < 18) && (!p.stats || p.stats.targets < 115)) {
                    let hasBuriedCon = p.depthChart && p.depthChart >= 3;
                    if (!hasBuriedCon && !hasLowVolumeCon) {
                        cons.push(pickVarShift([
                            `<strong>Target Volatility:</strong> Target share isn't bulletproof; weekly floor relies on TD efficiency.`,
                            `<strong>Volume Variance:</strong> Secondary target role leaves him susceptible to low-target games.`
                        ], 1));
                        riskScore += 1;
                    }
                } else if (pos === 'QB' && (!p.stats || (p.stats.rushAtt || 0) < 40)) {
                    cons.push(pickVar([
                        `<strong>Limited Rushing Floor:</strong> Lack of rushing mobility places heavy burden on pass volume and TDs.`,
                        `<strong>Passing-Only Floor:</strong> Lacks rushing yards to salvage bad passing performances.`
                    ]));
                    riskScore += 1;
                }
            } else {
                if (cons.length === 0) {
                    cons.push(`<strong>Heavy Workload Wear:</strong> Extremely high usage creates standard injury and fatigue variance.`);
                }
            }
        }

        if (isDST && p.stats) {
            const ds = p.stats;
            if (ds.sack && ds.sack < 24) { cons.push(`<strong>Anemic Pass Rush:</strong> Generated an abysmal <strong>${ds.sack} sacks</strong> last season. Opposing QBs face no pressure.`); riskScore += 2; }
            else if (ds.sack && ds.sack < 32) { cons.push(`<strong>Weak Pass Rush:</strong> Generated only <strong>${ds.sack} sacks</strong> last season.`); riskScore += 1; }

            if (ds.papg && ds.papg >= 27) { cons.push(`<strong>Porous Defense:</strong> Bled points constantly, yielding a high <strong>${ds.papg.toFixed(1)} Points Allowed Per Game</strong>.`); riskScore += 2; }
            else if (ds.papg && ds.papg >= 24) { cons.push(`<strong>Vulnerable Defense:</strong> Yielded an elevated <strong>${ds.papg.toFixed(1)} Points Allowed Per Game</strong>.`); riskScore += 1; }

            if (!isUltraElite) cons.push(`<strong>Defensive Volatility:</strong> Defensive scoring heavily relies on opponent turnovers, making it difficult to predict week-to-week.`);
        }

        if (p.avgStars && p.avgStars <= 2.2) { cons.push(`<strong>Brutal Overall Schedule:</strong> Faces a grueling ${p.avgStars.toFixed(2)}/5.0 star schedule loaded with elite offenses.`); riskScore += 2; }
        else if (p.avgStars && p.avgStars <= 2.8) { cons.push(`<strong>Tough Overall Schedule:</strong> Faces a difficult ${p.avgStars.toFixed(2)}/5.0 star schedule.`); riskScore += 1; }

        // 🚑 SLEEPER-DRIVEN INJURY CHECKS WITH TSV CONTEXT
        if (p.injuryStatus) {
            let customNote = p._injuryNote ? ` (${p._injuryNote})` : '';
            let dispStatus = p.injuryStatus;
            
            if (p._isSeasonIR || dispStatus === 'Out for Season' || dispStatus === 'IR') {
                cons.push(`<strong>Injured Reserve (${dispStatus}):</strong> Listed on IR by team reports${customNote}. Drafting him requires active IR-slot management.`);
                riskScore += 3;
            } else if (p._isSuspended || dispStatus === 'Suspended') {
                cons.push(`<strong>Serving Suspension (${p._gamesSuspended || 4} Games):</strong> Out for the start of the season${customNote}. Requires bench capacity, but provides fresh legs and full health for the fantasy playoffs.`);
                riskScore += 2;
            } else if (['Out', 'PUP', 'Short-Term IR'].includes(dispStatus) || p._isPupList || p._isShortIR) {
                cons.push(`<strong>Extended Absence (${dispStatus}):</strong> Expected to miss early regular season games${customNote}. Drafting him requires active stash management.`);
                riskScore += 2;
            } else if (['Questionable', 'Doubtful'].includes(dispStatus)) {
                let timing = p._injuryTiming || 'camp_recent';

                if (p._isSoftTissueRisk) {
                    cons.push(`<strong>Live Soft Tissue Caution:</strong> Listed as ${dispStatus} with a muscle strain${customNote}. Soft tissue injuries carry elevated re-injury and mid-game exit risk.`);
                    riskScore += 2;
                } else if (timing === 'offseason_rehab') {
                    cons.push(`<strong>Offseason Surgical Rehab:</strong> Listed as ${dispStatus} while managing an offseason procedure${customNote}. Had several months to rehab, but snap counts may be monitored over early weeks.`);
                    riskScore += 1;
                } else if (p._isSlowRampUp) {
                    cons.push(`<strong>Live Structural Recovery:</strong> Listed as ${dispStatus} with a recent structural injury${customNote}. Expect limited or ramp-up workloads over the opening weeks.`);
                    riskScore += 2;
                } else {
                    cons.push(`<strong>Currently ${dispStatus}:</strong> Dealing with an active designation leading into Week 1${customNote}.`);
                    riskScore += 1;
                }
            }
        } // 👈 Added missing closing bracket for if (p.injuryStatus)

        // SUPPRESS generic "Durability Risk" if it's already classified as a Major Procedure Return
        if (p._isMajorReturn) {
            cons.push(`<strong>Early-Season Ramp-Up Friction (${p._injuryNote || '2025 Procedure'}):</strong> Cleared for Week 1, but historical return trends suggest limited snap shares and efficiency dips over opening weeks before reaching full speed.`);
            riskScore += 2;
        } else if (p.pastStats && p.pastStats.gp <= 8 && p.pastStats.gp > 0) {
            cons.push(`<strong>Severe Durability Risk:</strong> Missed over half the season, playing only <strong>${p.pastStats.gp} games</strong>. Staying on the field is a major question mark.`);
            riskScore += 3;
        }

        if (p._isMajorReturn && (p.adp && p.adp >= 35)) {
            pros.push(`<strong>🏆 Second-Half Championship Ceiling:</strong> Cleared and Active for Week 1 (${p._injuryNote || 'Major Procedure'}). While early weeks may feature load management, his depressed draft price offers massive fresh-legged upside for the fantasy playoffs.`);
        } else if (p._injuryNote && p._isFullyCleared) {
            pros.push(`<strong>Clean Bill of Health (${p._injuryNote}):</strong> Listed as fully active on team reports with no ongoing workload restrictions.`);
        }
        if (cons.length === 0) {
            cons.push(`<strong>Standard Game-Flow Variance:</strong> Subject to standard week-to-week game script fluctuations.`);
        }

        // Buffer risk score for young players (under 25) and proven low-bust floor anchors
        if (pAge && pAge <= 24) riskScore = Math.max(0, riskScore - 2);
        if (p.boomBust && p.boomBust.bust <= 10) riskScore = Math.max(0, riskScore - 2);

        // 🛡️ RISK BADGE
        let riskBadge = `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">🛡️ LOW RISK</span>`;
        if (riskScore >= 6) riskBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">🚨 HIGH RISK</span>`;
        else if (riskScore >= 4) riskBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">⚠️ ELEVATED RISK</span>`;
        else if (riskScore >= 2) riskBadge = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">⚡ MODERATE RISK</span>`;

        // 📝 SYNTHESIZE FULL NARRATIVE BLURB
        const narrativeBlurb = `${archetypeNote}${pastStatsContext}${statProof}`.trim();

        // -------------------------------------------------------------
        // RANGE OF OUTCOMES (Reads pre-computed State values)
        // -------------------------------------------------------------
        let floorPpg = (p.floorPpg !== undefined ? p.floorPpg : (Number(ppg) || 0) * 0.78).toFixed(1);
        let ceilingPpg = (p.ceilingPpg !== undefined ? p.ceilingPpg : (Number(ppg) || 0) * 1.25).toFixed(1);

        // Algorithm Verdict Transparency Box
        let algorithmVerdictHTML = "";
        if (isOffense) {
            let baseVBD = p.VBD || 0;
            let advVBD = p.AdvVBD || 0;
            let vbdShift = advVBD - baseVBD;

            // Only show if there's a meaningful mathematical shift (> 5% shift and > 1.0 VBD point)
            if (Math.abs(vbdShift) >= 1.0 && baseVBD > 0 && Math.abs(vbdShift / baseVBD) >= 0.05) {
                let shiftPct = ((vbdShift / baseVBD) * 100).toFixed(1);

                let drivers = [];
                // Collect positive drivers
                if (vbdShift > 0) {
                    if (p.targetShare >= 23 || p.hvo >= 50) drivers.push("elite volume command");
                    if (p.olTier === 'S' || p.olTier === 'A' || p._inEliteOffense) drivers.push("top-tier offensive environment");
                    if (p._isIndependentYACCreator || (p.ypt && p.ypt >= 9.5)) drivers.push("premium per-touch efficiency");
                    if (p._positiveTdRegression) drivers.push("strong positive touchdown regression indicators");
                    if (p.syntheticBoost >= 0.05) drivers.push("highly favorable scheme fit/inherited role");
                    if (p.p2s && p.p2s <= 15.0) drivers.push("elite pocket escapability");
                }
                // Collect negative drivers
                else {
                    if (p.olTier === 'D' || p.olTier === 'F' || p._inAnemicOffense) drivers.push("a restrictive/anemic offensive environment");
                    if (p._isDecliningRole || (p.targetShare && p.targetShare < 15)) drivers.push("poor volume/role trajectory");
                    if (p.injuryStatus || (p.pastStats && p.pastStats.gp <= 10)) drivers.push("elevated durability/injury risk");
                    if (p.dropRate >= 8.0 || p.pressureRate >= 25.0) drivers.push("concerning advanced inefficiency metrics");
                    if (p._isFlukeTDScorer) drivers.push("heavy negative touchdown regression indicators");
                }

                // Format the drivers into a clean sentence
                let driversText = drivers.length > 0
                    ? `driven primarily by ${drivers.slice(0, -1).join(', ')}${drivers.length > 1 ? ', and ' : ''}${drivers[drivers.length - 1]}`
                    : `driven by advanced scheme and situational modeling`;

                if (vbdShift > 0) {
                    algorithmVerdictHTML = `
                        <div class="bg-indigo-50/80 border border-indigo-200 p-3 rounded-xl mb-3">
                            <h5 class="font-extrabold text-indigo-900 text-[10px] uppercase tracking-wider mb-1 flex items-center">
                                <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                Algorithm Verdict: UPGRADE (+${shiftPct}%)
                            </h5>
                            <p class="text-indigo-800 text-xs">Draft Pro upgraded his raw projection by <strong>+${vbdShift.toFixed(1)} VBD</strong>, ${driversText}.</p>
                        </div>
                    `;
                } else {
                    algorithmVerdictHTML = `
                        <div class="bg-rose-50/80 border border-rose-200 p-3 rounded-xl mb-3">
                            <h5 class="font-extrabold text-rose-900 text-[10px] uppercase tracking-wider mb-1 flex items-center">
                                <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                                Algorithm Verdict: DOWNGRADE (${shiftPct}%)
                            </h5>
                            <p class="text-rose-800 text-xs">Draft Pro penalized his raw projection by <strong>${vbdShift.toFixed(1)} VBD</strong>, ${driversText}.</p>
                        </div>
                    `;
                }
            }
        }

        // Market Value Check
        let marketValueHTML = "";
        if (p.adp) {
            const diff = p.adp - overallRank;
            if (diff >= 12) {
                marketValueHTML = `<div class="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-200 mb-3 text-xs">🔥 <strong>Market Value Steal:</strong> Ranked #<strong>${overallRank}</strong> overall in VBD, but drafted later at ADP #<strong>${p.adp.toFixed(0)}</strong> (+${diff.toFixed(0)} draft value).</div>`;
            } else if (diff <= -12) {
                marketValueHTML = `<div class="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-200 mb-3 text-xs">⚠️ <strong>Market Premium / Reach:</strong> Current ADP (#<strong>${p.adp.toFixed(0)}</strong>) requires drafting him ahead of his #<strong>${overallRank}</strong> VBD Rank.</div>`;
            }
        }

        let overProb = p.OverProb ? Math.round(p.OverProb * 100) : 50;
        let edgeVal = p.Edge ?? 0;
        
        let verdictBadge, verdictText, verdictBg;
        if (overProb >= 65) {
            verdictBadge = '🚀 Strong OVER';
            verdictText = `The model projects major market inefficiency (+${edgeVal.toFixed(1)} pts). Underlying usage, scheme environment, and efficiency metrics indicate a high probability of outperforming consensus projections.`;
            verdictBg = 'bg-gradient-to-r from-emerald-950 to-teal-950 border-emerald-700 text-emerald-100';
        } else if (overProb >= 55) {
            verdictBadge = '🟢 Lean OVER';
            verdictText = `The model favors his profile (+${edgeVal.toFixed(1)} pts). Offensive line continuity, target distribution, and workload trajectory suggest he will mildly beat market consensus.`;
            verdictBg = 'bg-gradient-to-r from-emerald-900 to-slate-900 border-emerald-700 text-emerald-50';
        } else if (overProb >= 45) {
            verdictBadge = '⚪ Fair Value';
            verdictText = `Consensus pricing is highly accurate (${edgeVal >= 0 ? '+' : ''}${edgeVal.toFixed(1)} pts). His professional projection accurately reflects his role and historical baseline.`;
            verdictBg = 'bg-slate-900 border-slate-700 text-slate-200';
        } else if (overProb >= 31) {
            verdictBadge = '🟠 Lean UNDER';
            verdictText = `The model flags caution (${edgeVal.toFixed(1)} pts). Touch competition, age curve, or negative touchdown regression point to mild downside risk.`;
            verdictBg = 'bg-gradient-to-r from-amber-950 to-slate-900 border-amber-700 text-amber-50';
        } else {
            verdictBadge = '🔴 Strong UNDER';
            verdictText = `The model aggressively fades this projection (${edgeVal.toFixed(1)} pts). Committee timeshares, poor trench blocking, or high bust volatility present severe downside risk.`;
            verdictBg = 'bg-gradient-to-r from-rose-950 to-slate-900 border-rose-800 text-rose-100';
        }

        return `
            <div class="space-y-4 text-xs leading-relaxed">
                <!-- 1. THE MARKET PROJECTION EDGE VERDICT -->
                <div class="${verdictBg} p-4 rounded-xl border shadow-sm">
                    <div class="flex justify-between items-center mb-3 pb-3 border-b border-white/10">
                        <div>
                            <span class="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Consensus Proj</span>
                            <div class="text-xl font-bold">${(p.ConsensusPts || p.ProjPts).toFixed(1)} <span class="text-xs font-medium opacity-60">pts</span></div>
                        </div>
                        <div class="text-center">
                            <span class="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Model Expectation</span>
                            <div class="text-xl font-black">${(p.ModelPts || p.ProjPts).toFixed(1)} <span class="text-xs font-medium opacity-60">pts</span></div>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Model Edge</span>
                            <div class="text-xl font-black ${edgeVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${edgeVal >= 0 ? '+' : ''}${edgeVal.toFixed(1)}</div>
                        </div>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-base font-black tracking-tight">${verdictBadge} (${overProb}% Probability)</span>
                        ${riskBadge}
                    </div>
                    <p class="mt-2 text-xs opacity-90 leading-relaxed">${verdictText}</p>
                </div>

                <!-- 2. EXECUTIVE SCOUTING REPORT (Full Nuance Narrative) -->
                <div class="bg-indigo-950 text-indigo-100 p-4 rounded-xl border border-indigo-800/80 shadow-sm">
                    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
                        <div class="flex items-center space-x-2">
                            <span class="font-extrabold text-white text-xs uppercase tracking-wider">${posRankStr} • ${tierLabel}</span>
                            <span class="bg-indigo-800/80 text-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">Ovr Rank #${overallRank}</span>
                        </div>
                        ${p._isProvenMultiYearAlpha ? '<span class="bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded text-[10px] font-bold">⭐ Proven Multi-Year Alpha</span>' : ''}
                    </div>
                    <p class="text-indigo-200 text-xs leading-relaxed mt-1">
                        ${narrativeBlurb}
                    </p>
                </div>    

                <!-- 3. INHERITED ROLE & SCHEME TARGET FUNNEL -->
                ${inheritedContextHTML}

                <!-- 4. SUPPORTING CAST & TOUCH COMPETITION MATRIX -->
                ${situationMatrixHTML}

                <!-- 5. MARKET VALUE & DRAFT ARBITRAGE -->
                ${marketValueHTML}

                <!-- 6. THE DRIVERS & DOWNSIDE (PROS & CONS) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                        <h5 class="font-extrabold text-emerald-900 text-xs uppercase tracking-wider mb-2.5 flex items-center">
                            <span class="mr-1.5">📈</span> The Drivers (Why Model is High)
                        </h5>
                        <ul class="space-y-2 text-emerald-950">
                            ${pros.map(pro => `<li class="flex items-start"><span class="text-emerald-600 mr-2 font-bold">•</span><div>${pro}</div></li>`).join('')}
                        </ul>
                    </div>
                    <div class="bg-rose-50/70 border border-rose-200 p-4 rounded-xl">
                        <h5 class="font-extrabold text-rose-900 text-xs uppercase tracking-wider mb-2.5 flex items-center">
                            <span class="mr-1.5">📉</span> The Downside (Structural Risks)
                        </h5>
                        <ul class="space-y-2 text-rose-950">
                            ${cons.map(con => `<li class="flex items-start"><span class="text-rose-600 mr-2 font-bold">•</span><div>${con}</div></li>`).join('')}
                        </ul>
                    </div>
                </div>

                <!-- 7. 3-TIER RANGE OF OUTCOMES (PPG) -->
                <div class="bg-slate-900 text-white p-4 rounded-xl border border-slate-800">
                    <h4 class="font-extrabold text-xs uppercase tracking-wider mb-3 text-amber-400">Range of Outcomes (Weekly PPG Trajectory)</h4>
                    <div class="grid grid-cols-3 gap-3 text-center">
                        <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                            <span class="text-[10px] text-slate-400 uppercase font-bold block">Floor Scenario</span>
                            <span class="text-base font-extrabold text-rose-400">${floorPpg} PPG</span>
                            <span class="text-[9px] text-slate-400 block mt-0.5">Role shrinkage / Low TDs</span>
                        </div>
                        <div class="bg-slate-800/80 p-2.5 rounded-lg border border-indigo-500/50">
                            <span class="text-[10px] text-indigo-300 uppercase font-bold block">Median Expectation</span>
                            <span class="text-base font-extrabold text-white">${ppg} PPG</span>
                            <span class="text-[9px] text-indigo-200 block mt-0.5">Base expected volume</span>
                        </div>
                        <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                            <span class="text-[10px] text-slate-400 uppercase font-bold block">Ceiling Scenario</span>
                            <span class="text-base font-extrabold text-emerald-400">${ceilingPpg} PPG</span>
                            <span class="text-[9px] text-slate-400 block mt-0.5">Max TD Luck & YAC burst</span>
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
        const recEnv = State.teamAdvRec ? State.teamAdvRec[tTeam] : null;

        // Environmental Badges
        if (isOffense) {
            if (p._isAscendingRole) {
                if (p.isNewRole || !p._growthPct) {
                    envBadges.push(`<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200" title="Inheriting vacated team volume">📈 Emerging Role (Inherited Volume)</span>`);
                } else {
                    envBadges.push(`<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">📈 Ascending Role (+${p._growthPct}% Touches)</span>`);
                }
            } else if (p._isDecliningRole) {
                envBadges.push(`<span class="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">📉 Contracting Role (-${p._declinePct}% Touches)</span>`);
            }

            if (p.isTeamChanger && Math.abs(p._envDelta || 0) >= 0.015) {
                // Only flag significant shifts (> 1.5% VBD shift) to prevent badge spam on neutral team changes
                let deltaText = p._envDelta > 0 ? '(Scheme Upgrade)' : '(Scheme Downgrade)';
                let deltaColor = p._envDelta > 0 ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-amber-100 text-amber-800 border-amber-200';
                envBadges.push(`<span class="${deltaColor} text-xs font-bold px-2.5 py-1 rounded-full border">🔄 Team Change: ${p.pastTeam} ➔ ${p.Team} ${deltaText}</span>`);
            }

            if (rushEnv && rushEnv.ybcAtt >= 2.8 && p.Pos === 'RB') {
                envBadges.push(`<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">⚡ High YBC Scheme (${rushEnv.ybcAtt} YBC)</span>`);
            }
            if (passEnv && passEnv.onTgtPct >= 76.0 && ['WR', 'TE'].includes(p.Pos)) {
                envBadges.push(`<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">🎯 High QB Accuracy Env (${passEnv.onTgtPct}%)</span>`);
            }
            if (passEnv && passEnv.playActionYds >= 950 && ['QB', 'WR', 'TE'].includes(p.Pos)) {
                envBadges.push(`<span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200">🚀 Play-Action Heavy Scheme</span>`);
            }
            if (passEnv && passEnv.rpoPlays >= 85 && ['QB', 'WR', 'RB'].includes(p.Pos)) {
                envBadges.push(`<span class="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">🔄 RPO Heavy Offense</span>`);
            }
            if (p._isSchemeYACBeneficiary && ['WR', 'TE'].includes(p.Pos)) {
                envBadges.push(`<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">🏃 Scheme-Manufactured YAC</span>`);
            } else if (p._isIndependentYACCreator && ['WR', 'TE'].includes(p.Pos)) {
                envBadges.push(`<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">⚡ Independent YAC Creator</span>`);
            }
            if (passEnv && passEnv.prssPct >= 25.0) {
                envBadges.push(`<span class="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">⚠️ High Pass Pressure Env (${passEnv.prssPct}%)</span>`);
            }
            if (p.olTier === 'S' || p.olTier === 'A') {
                envBadges.push(`<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">🛡️ Elite O-Line (Tier ${p.olTier})</span>`);
            } else if (p.olTier === 'D' || p.olTier === 'F') {
                envBadges.push(`<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">⚠️ Poor O-Line (Tier ${p.olTier})</span>`);
            }
        }

        let envBadgesHTML = envBadges.length > 0 ? `<div class="flex flex-wrap gap-2 mb-2">${envBadges.join('')}</div>` : '';

        let combineBadges = [];
        if (p.isRookie || p.draftRound) {
            if (p.draftRound) {
                let pickStr = p.nflDraftPick ? ` (Pick #${p.nflDraftPick})` : '';
                combineBadges.push(`<span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200">🎓 NFL Draft: Rnd ${p.draftRound}${pickStr}</span>`);
            }
            if (p.fortyTime) {
                combineBadges.push(`<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">⏱️ 40yd: ${p.fortyTime}s</span>`);
            }
            if (p.speedScore) {
                combineBadges.push(`<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">⚡ Speed Score: ${p.speedScore}</span>`);
            }
            if (p.combineStats && p.combineStats.vertical) {
                combineBadges.push(`<span class="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200">Vertical: ${p.combineStats.vertical}"</span>`);
            }
        }
        let combineBadgesHTML = combineBadges.length > 0 ? `<div class="flex flex-wrap gap-2 mb-2">${combineBadges.join('')}</div>` : '';

        let ppwBadge = '';
        if (p._addedPPW >= 1.0 || (p._addedPPW > 0.1 && !p._byeFillWeek)) {
            ppwBadge = `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">📈 +${p._addedPPW.toFixed(1)} PPW Lineup Fit</span>`;
        } else if (p._byeFillWeek) {
            ppwBadge = `<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">🔄 Wk ${p._byeFillWeek} Bye Fill (+${p._byeFillPts.toFixed(1)} pts)</span>`;
        }
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
            if (p.tps) barHTML += buildBar('Targets Per Snap', (p.tps * 100).toFixed(1), 28, '%', 'purple');
            if (p.airYards) barHTML += buildBar('Total Air Yards', p.airYards, 2000, ' yds', 'amber');
            if (p.yacAtt) barHTML += buildBar('Yards After Contact', p.yacAtt, 4, ' yds', 'purple');
            if (p.brokenTackles) barHTML += buildBar('Broken Tackles', p.brokenTackles, 30, '', 'red');
            if (p.err) barHTML += buildBar('Explosive Run Rate', p.err.toFixed(1), 8, '%', 'amber');
            if (p.hvo) barHTML += buildBar('High-Value Opps (Tgt + RZ)', p.hvo, 130, '', 'emerald');
            if (p.ypt) barHTML += buildBar('Yards Per Target', p.ypt.toFixed(1), 12, ' yds', 'blue');
            if (p.xTD) barHTML += buildBar('Expected TDs (xTD)', p.xTD.toFixed(1), 12, '', 'emerald');

            if (p.pressureRate) barHTML += buildBar('Pressure Rate Faced', p.pressureRate.toFixed(1), 30, '%', 'rose');
            if (p.p2s) barHTML += buildBar('Pressure-to-Sack Rate', p.p2s.toFixed(1), 30, '%', 'rose');

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

        let bbWidgetHTML = '';
        if (p.boomBust && p.boomBust.games >= 4) {
            let bb = p.boomBust;
            bbWidgetHTML = `
                <div class="bg-slate-900 text-white p-3 rounded-xl mb-4 border border-slate-800 shadow-sm flex items-center justify-between text-xs">
                    <span class="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">2025 Weekly Finishes (${bb.games} G)</span>
                    <div class="flex gap-2">
                        <span class="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold" title="Explosive Overall Finish">💥 ${bb.boom}% Boom</span>
                        <span class="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-bold" title="Top 12 Positional Finish">🥇 ${bb.top12}% Top 12</span>
                        <span class="${bb.bust >= 25 ? 'bg-rose-950 text-rose-400 border-rose-800' : 'bg-slate-800 text-slate-300 border-slate-700'} border px-2 py-0.5 rounded font-bold" title="Sub-par / Unstartable Finish">🚨 ${bb.bust}% Bust</span>
                    </div>
                </div>
            `;
        }

        let pastStatsHTML = '';
        if (p.pastStats && p.pastPts !== undefined) {
            let ps = p.pastStats;
            let s24 = p.stats2024;
            let ppgStr = p.pastPpg ? `${p.pastPpg.toFixed(1)} PPG` : 'N/A';
            let bigPlayStr = ps.bigPlays ? `<span class="ml-2 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">💥 ${ps.bigPlays} Big Plays</span>` : '';

            let multiYearBadge = '';
            if (p._isProvenMultiYearAlpha) multiYearBadge = `<span class="ml-2 text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">⭐ 2-Yr Alpha Target</span>`;
            else if (p._isAscendingCareerArc) multiYearBadge = `<span class="ml-2 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">📈 3-Yr Ascending Arc</span>`;
            else if (p._isInjuryBounceback) multiYearBadge = `<span class="ml-2 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">🔄 Health Bounceback Profile</span>`;

            let stats2025Text = '';
            let stats2024Text = '';
            let no2024Text = '<div class="text-gray-400 text-[11px] italic">No 2024 data (Rookie/Inactive)</div>';

            // Branch text formatting based on position
            if (p.Pos === 'DST') {
                stats2025Text = `${(ps.defTd || 0) + (ps.spcTd || 0)} TD • ${ps.sack || 0} Sacks • ${(ps.defInt || 0) + (ps.defFum || 0)} TOs`;
                no2024Text = ''; // Hide 2024 warning for defenses
            } else if (p.Pos === 'PK') {
                stats2025Text = `${ps.fgTotal || 0} FGM • ${ps.xp || 0} PATs`;
                no2024Text = ''; // Hide 2024 warning for kickers
            } else {
                stats2025Text = `${ps.totalTd || 0} TD • ${((ps.passYds || 0) + (ps.rushYds || 0) + (ps.recYds || 0)).toLocaleString()} Total Yds`;
                if (s24) {
                    stats2024Text = `${s24.ppg ? s24.ppg.toFixed(1) + ' PPG • ' : ''}${s24.totalTd || 0} TD • ${((s24.passYds || 0) + (s24.rushYds || 0) + (s24.recYds || 0)).toLocaleString()} Total Yds`;
                }
            }

            pastStatsHTML = `
                <div class="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-xl mb-4 shadow-sm">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Multi-Year Actuals${bigPlayStr}${multiYearBadge}</span>
                        <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">2025: ${ppgStr}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-indigo-100/60">
                        <div>
                            <span class="text-[10px] text-gray-500 block uppercase font-semibold">2025 (${ps.gp || 17}G)</span>
                            <span class="font-bold text-gray-900">${stats2025Text}</span>
                        </div>
                        ${s24 ? `
                        <div>
                            <span class="text-[10px] text-gray-500 block uppercase font-semibold">2024 (${s24.gp || 17}G)</span>
                            <span class="font-bold text-gray-700">${stats2024Text}</span>
                        </div>` : no2024Text}
                    </div>
                </div>
            `;
        }
        let statsDashboard = '';
        if (isOffense) {
            let isQB = p.Pos === 'QB';
            let opps = Math.round(isQB ? ((s.passAtt || 0) + (s.rushAtt || 0)) : ((s.rushAtt || 0) + (s.targets || 0)));
            let oppsLabel = isQB ? 'Pass Att + Rush Att' : 'Touches / Tgts';

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
                        <span class="block text-[10px] text-indigo-200 mt-1">${oppsLabel}</span>
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
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Pass Comp / Att</span> ${Math.round(s.passCmp || 0)} / ${Math.round(s.passAtt || 0)}</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Pass Yds / Rating</span> ${Math.round(s.passYds || 0)} <span class="text-gray-400">(${s.passerRating})</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">TD : INT</span> <span class="text-emerald-600 font-bold">${Math.round(s.passTd || 0)} TD</span> / <span class="text-red-500">${Math.round(s.int || 0)} INT</span></div>
                        ${p.trueAccuracy ? `<div><span class="font-bold text-gray-400 block text-[10px] uppercase">True Accuracy</span> ${p.trueAccuracy.toFixed(1)}%</div>` : ''}
                    ` : ''}

                    ${s.rushAtt > 0 ? `
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rushing Vol</span> ${Math.round(s.rushAtt || 0)} Att</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rush Yds / YPC</span> ${Math.round(s.rushYds || 0)} yds <span class="text-emerald-600 font-bold">(${((s.rushYds || 0) / (s.rushAtt || 1)).toFixed(1)} YPC)</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rush TDs</span> ${Math.round(s.rushTd || 0)} TD</div>
                    ` : ''}

                    ${s.targets > 0 ? `
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Receiving Vol</span> ${Math.round(s.rec || 0)} Rec / ${Math.round(s.targets || 0)} Tgt</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rec Yds / YPR</span> ${Math.round(s.recYds || 0)} yds <span class="text-indigo-600 font-bold">(${typeof s.recAvg === 'number' ? s.recAvg.toFixed(1) : (s.recYds && s.rec ? (s.recYds/s.rec).toFixed(1) : '0.0')} YPR)</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rec TDs</span> ${Math.round(s.recTd || 0)} TD</div>
                    ` : ''}
                </div>
            `;
        } else if (p.Pos === 'DST') {
            statsDashboard = `
                <div class="bg-indigo-900 text-white p-4 rounded-xl border border-indigo-800 mb-4 shadow-sm text-xs grid grid-cols-3 gap-3">
                    <div class="p-2">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Projected Output</span>
                        <span class="text-lg font-extrabold text-white">${p.ProjPts.toFixed(1)} Pts</span>
                        <span class="block text-[10px] text-emerald-400 font-bold mt-1">Adv VBD: ${(p.AdvVBD || p.VBD).toFixed(1)}</span>
                    </div>
                    <div class="p-2 border-l border-indigo-700/50">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Schedule Grade</span>
                        <span class="text-lg font-extrabold text-amber-400">⭐ ${p.avgStars ? p.avgStars.toFixed(2) : '3.0'}</span>
                        <span class="block text-[10px] text-indigo-200 mt-1">Playoffs: ⭐${(p.playoffSOS || p.avgStars || 3.0).toFixed(1)}</span>
                    </div>
                    <div class="p-2 border-l border-indigo-700/50">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Defensive Profile</span>
                        <span class="text-lg font-extrabold text-white">${s.sack || 0} Sacks</span>
                        <span class="block text-[10px] text-indigo-200 mt-1">${(s.defInt || 0) + (s.defFum || 0)} Turnovers | ${typeof s.papg === 'number' ? s.papg.toFixed(1) : '18.0'} PAPG</span>
                    </div>
                </div>
            `;
        } else if (p.Pos === 'PK') {
            statsDashboard = `
                <div class="bg-indigo-900 text-white p-4 rounded-xl border border-indigo-800 mb-4 shadow-sm text-xs grid grid-cols-2 gap-3">
                    <div class="p-2">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Projected Output</span>
                        <span class="text-lg font-extrabold text-white">${p.ProjPts.toFixed(1)} Pts</span>
                        <span class="block text-[10px] text-emerald-400 font-bold mt-1">Adv VBD: ${(p.AdvVBD || p.VBD).toFixed(1)}</span>
                    </div>
                    <div class="p-2 border-l border-indigo-700/50">
                        <span class="text-indigo-300 block text-[10px] font-bold uppercase tracking-wider">Kicking Profile</span>
                        <span class="text-lg font-extrabold text-white">${s.fgTotal || 0} FGs</span>
                        <span class="block text-[10px] text-indigo-200 mt-1">${s.xp || 0} PATs</span>
                    </div>
                </div>
            `;
        }

        let handcuffBadge = '';
        if (p.isRBStarter && p.handcuffName && p.handcuffName !== '—' && p.handcuffName !== '') {
            if (p._backupThreatLevel === '1B Committee Threat' || p._backupThreatLevel === 'Passing Down Threat') {
                pros.push(`<strong>Primary Early-Down Back:</strong> Holds the designated starting role ahead of ${p.handcuffName}.`);
            } else {
                pros.push(`<strong>Clear Backfield Lead:</strong> Uncontested RB1 status with designated backup (${p.handcuffName}).`);
            }
        } else if ((p.isRBHandcuff || p.depthChart >= 2) && p._contingentTier) {
            let badgeCls = p._contingentTier.includes('Diamond') ? 'bg-purple-100 text-purple-800 border-purple-300' : (p._contingentTier.includes('High-Ceiling') ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300');
            handcuffBadge = `<span class="text-xs border ${badgeCls} px-2 py-0.5 rounded-full font-bold">${p._contingentTier}</span>`;
        } else if (p.isRBHandcuff && p.starterName) {
            handcuffBadge = `<span class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">🔒 Handcuff for ${p.starterName}</span>`;
        }

        let injModalBadge = '';
        if (p.injuryStatus) {
            let color = ['Out', 'IR', 'PUP'].includes(p.injuryStatus) ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200';
            injModalBadge = `<span class="text-xs border ${color} px-2 py-0.5 rounded-full font-bold">🏥 ${p.injuryStatus}</span>`;
        }

        let hMatch = p.height ? String(p.height).match(/(\d+)['\-]+(\d+)/) : null;
        let formattedHeight = hMatch ? `${hMatch[1]}'${hMatch[2]}"` : (!isNaN(p.height) ? `${Math.floor(p.height / 12)}'${p.height % 12}"` : p.height);
        let sizeBadge = (p.height && p.weight) ? `<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">${formattedHeight}, ${p.weight} lbs</span>` : '';

        let modalTitle = `<div class="flex items-center flex-wrap gap-2">
            <span>${p.Player}</span>
            <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-normal">${p.Pos} • ${p.Team}</span>
            ${injModalBadge}
            ${sizeBadge}
            ${handcuffBadge}
            ${ageDisplay ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Age ${ageDisplay}</span>` : ''}
            ${p.byeWeek && p.byeWeek !== 'N/A' ? `<span class="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Wk ${p.byeWeek} Bye</span>` : ''}
        </div>`;

        const writeupHTML = this.generatePlayerWriteup(p);

        UI.showMessage(modalTitle, `
            <div class="flex gap-2 mb-4 border-b border-gray-100 pb-3">
                <button id="btn-tab-overview" onclick="UI.switchPlayerCardTab('overview')" class="px-4 py-2 font-bold text-xs rounded-xl bg-indigo-600 text-white shadow-sm transition-all">Overview & Analytics</button>
                <button id="btn-tab-writeup" onclick="UI.switchPlayerCardTab('writeup')" class="px-4 py-2 font-bold text-xs rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Scout Report</button>
            </div>

            <div id="card-tab-overview">
                <div class="mb-3">${combineBadgesHTML}${envBadgesHTML}${ppwBadge}</div>
                ${statsDashboard}
                ${bbWidgetHTML}
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

            if (typeof window.Chart !== 'function' || !p.weeklyProjections || Object.keys(p.weeklyProjections).length === 0) {
                if (ctx.parentElement) {
                    ctx.parentElement.innerHTML = '<div class="flex h-full items-center justify-center text-sm text-gray-500">No weekly projection data available.</div>';
                }
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

        const numTeams = parseInt(document.getElementById('setting-teams')?.value) || 12;
        const userPick = parseInt(document.getElementById('setting-user-pick')?.value) || 1;
        const draftMode = document.getElementById('setting-draft-type')?.value || 'live';

        let profiles = Object.values(State.managerProfiles);
        let optionsHtml = `<option value="">Random AI</option>`;
        profiles.forEach(p => {
            optionsHtml += `<option value="${p.name}">${p.name}</option>`;
        });

        // Save existing input values before re-rendering so you don't lose typed names
        const prevNames = {};
        const prevProfiles = {};
        for (let i = 1; i <= 32; i++) {
            let nameEl = document.getElementById(`custom-name-team-${i}`);
            if (nameEl) prevNames[i] = nameEl.value;
            let profEl = document.getElementById(`profile-team-${i}`);
            if (profEl) prevProfiles[i] = profEl.value;
        }

        container.innerHTML = '';
        for (let i = 1; i <= numTeams; i++) {
            let isUser = (i === userPick);
            let defaultName = isUser ? "Maryland Madness" : `Team ${i}`;
            let savedName = prevNames[i] !== undefined ? prevNames[i] : defaultName;

            if (draftMode === 'live') {
                // 🏈 LIVE DRAFT MODE: Clean Custom Team Name Text Inputs for all managers
                container.innerHTML += `
                    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <label class="text-slate-700 block mb-1 text-[11px] font-extrabold uppercase flex justify-between items-center">
                            <span>Pick #${i}</span>
                            ${isUser ? '<span class="text-indigo-600 font-extrabold text-[10px] bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">YOU</span>' : '<span class="text-slate-400 font-semibold text-[10px]">Opponent</span>'}
                        </label>
                        <input type="text" id="custom-name-team-${i}" value="${savedName}" placeholder="Manager / Team Name" 
                            class="w-full border-gray-300 border rounded-lg p-2 text-xs font-bold text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm">
                    </div>
                `;
            } else {
                // 🤖 MOCK DRAFT MODE: Team Name + AI Personality Profile Selector
                container.innerHTML += `
                    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                        <label class="text-slate-700 block text-[11px] font-extrabold uppercase flex justify-between items-center">
                            <span>Pick #${i}</span>
                            ${isUser ? '<span class="text-indigo-600 font-extrabold text-[10px] bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">YOU</span>' : ''}
                        </label>
                        <input type="text" id="custom-name-team-${i}" value="${savedName}" placeholder="Team Name" 
                            class="w-full border-gray-300 border rounded-lg p-1.5 text-xs font-bold text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                        ${!isUser ? `
                        <select id="profile-team-${i}" class="w-full border-gray-300 border rounded-lg p-1.5 text-[11px] bg-white text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none font-medium">
                            ${optionsHtml}
                        </select>` : ''}
                    </div>
                `;
            }
        }

        // Restore profile selections in mock mode
        if (draftMode === 'mock') {
            for (let i = 1; i <= numTeams; i++) {
                let el = document.getElementById(`profile-team-${i}`);
                if (el && prevProfiles[i]) el.value = prevProfiles[i];
            }
        }
    },

    updateDraftBoard() {
        if (!State.draftStarted) return;

        const userTeam = State.teamsById[State.userTeamId];
        State.evaluateRosterFits(userTeam, State.availablePlayers);

        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        document.getElementById('current-round').textContent = round;
        document.getElementById('current-pick-number').textContent = (State.currentPick % State.settings.numTeams) + 1;
        const overallPickEl = document.getElementById('overall-pick-number');
        if (overallPickEl) overallPickEl.textContent = State.currentPick + 1;

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
            
            // ⚡ MUST BE IN THIS EXACT ORDER:
            // 1. Generate the advanced analytics, Monte Carlo sims, and grades first
            if (window.DraftRecap) window.DraftRecap.generateRecaps();
            
            // 2. Render the standings using the advanced data
            this.renderStandings();
            
            // 3. Flip to the screen
            this.switchTab('summary-screen');
        }

        this.renderRecommendations();       
        this.renderDraftAvailablePlayers(); 
        this.renderMyRoster();
        this.renderRosters();
        this.renderDraftBoardGrid();
    },

    renderDraftAvailablePlayers() {
        const tbody = document.getElementById('draft-players-body');
        if (!tbody) return;

        const userTeam = State.teamsById[State.userTeamId];
        const userRoster = userTeam?.roster || [];

        let filterPos = document.getElementById('draft-position-filter')?.value || '';
        let search = this.normalizeSearchText(document.getElementById('draft-search')?.value || '');
        let searchTerms = search.split(/\s+/).filter(Boolean);

        let filteredList = State.availablePlayers.filter(p => {
            if (filterPos && p.Pos !== filterPos) return false;

            const searchableText = [
                p.Player, p.Team, p.Pos, p._cleanName, p._cleanTeam
            ].filter(Boolean).join(' ').toLowerCase();

            if (!searchTerms.length) return true;
            return searchTerms.every(term => searchableText.includes(term));
        });

        let displayList = filteredList.slice(0, 100);
        let isMock = State.settings.draftMode === 'mock';
        let onClockId = State.draftOrder[State.currentPick];
        let isUserTurn = isMock && (onClockId === State.userTeamId);

        let previousVBD = null;
        let htmlStr = '';

        displayList.forEach(p => {
            let currentVBD = p.AdvVBD || p.VBD;
            let isTierDrop = previousVBD !== null && (previousVBD - currentVBD >= 18.0);
            previousVBD = currentVBD;

            if (isTierDrop && (State.draftSortKey === 'AdvVBD' || !State.draftSortKey) && !search && !filterPos) {
                htmlStr += `<tr><td colspan="14" class="px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold text-center border-y border-rose-200 tracking-widest uppercase">⬇️ Significant Value Drop-Off ⬇️</td></tr>`;
            }

            let btnHtml = "";
            let safeName = p._cleanName;

            if (isMock && !isUserTurn) {
                btnHtml = `<button class="bg-gray-200 text-gray-400 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-not-allowed" disabled>Wait</button>`;
            } else {
                btnHtml = `<button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-[11px] font-bold shadow-sm draft-btn transition-colors" data-player="${safeName}">Draft</button>`;
            }

            let depthStr = p.depthChart ? `#${p.depthChart}` : '-';

            // Intelligent Bye Week Detector
            let byeStr = '-';
            if (p.byeWeek && p.byeWeek !== 'N/A') {
                const sameByeRoster = userRoster.filter(r => String(r.byeWeek) === String(p.byeWeek));
                const samePosByeRoster = sameByeRoster.filter(r => r.Pos === p.Pos);
                const totalByeCount = sameByeRoster.length;
                const posByeCount = samePosByeRoster.length;

                const isOnesie = ['QB', 'TE', 'PK', 'DST'].includes(p.Pos);
                const hasOnesieStarterConflict = isOnesie && posByeCount >= 1;

                if (hasOnesieStarterConflict) {
                    byeStr = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-sm" title="Warning: Shares Week ${p.byeWeek} bye with drafted ${p.Pos} (${samePosByeRoster.map(x=>x.Player).join(', ')})">Wk ${p.byeWeek} 🚨 ${p.Pos}</span>`;
                } else if (totalByeCount >= 3 || posByeCount >= 2) {
                    byeStr = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200" title="Heavy Collision: ${totalByeCount} drafted player(s) already on Week ${p.byeWeek} bye">Wk ${p.byeWeek} (${totalByeCount} 🚨)</span>`;
                } else if (totalByeCount === 2 || posByeCount === 1) {
                    byeStr = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title="Caution: ${totalByeCount} player(s) sharing Week ${p.byeWeek} bye">Wk ${p.byeWeek} (${totalByeCount} ⚠️)</span>`;
                } else if (totalByeCount === 1) {
                    byeStr = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">Wk ${p.byeWeek} <span class="text-[9px] text-slate-400 ml-0.5">(1)</span></span>`;
                } else {
                    byeStr = `<span class="text-slate-600 font-medium">Wk ${p.byeWeek}</span>`;
                }
            }

            // Market Edge & Probability Styling
            let edgeVal = p.Edge ?? 0;
            let edgeStr = edgeVal >= 0 
                ? `<span class="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">+${edgeVal.toFixed(1)}</span>` 
                : `<span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">${edgeVal.toFixed(1)}</span>`;

            let overProb = p.OverProb ? Math.round(p.OverProb * 100) : 50;
            let probColor = overProb >= 65 ? 'text-emerald-600 font-black' : (overProb <= 35 ? 'text-rose-600 font-bold' : 'text-slate-500 font-semibold');
            let probStr = `<span class="text-[11px] ${probColor}">${overProb}%</span>`;

            // Floor & Ceiling PPG Range
            let floorVal = (p.floorPpg !== undefined ? p.floorPpg : (p.ProjPts / 17) * 0.78).toFixed(1);
            let ceilVal = (p.ceilingPpg !== undefined ? p.ceilingPpg : (p.ProjPts / 17) * 1.25).toFixed(1);
            let rangeDisplay = `<span class="text-[10px] font-semibold text-slate-700 whitespace-nowrap"><span class="text-rose-500 font-bold">${floorVal}</span> - <span class="text-emerald-600 font-bold">${ceilVal}</span></span>`;

            // Lineup Impact (+PPW / Bye Fill)
            let ppwVal = (p._addedPPW !== undefined && p._addedPPW > 0) ? p._addedPPW : 0;
            let ppwStr = '';
            if (ppwVal >= 0.5 || (ppwVal > 0 && !p._byeFillWeek)) {
                ppwStr = `<span class="font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 text-[10px]">+${ppwVal.toFixed(1)}/wk</span>`;
            } else if (p._byeFillWeek) {
                ppwStr = `<span class="font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 text-[10px]">Wk ${p._byeFillWeek} Fill</span>`;
            } else {
                ppwStr = `<span class="text-gray-300 text-[10px] font-mono">0.0</span>`;
            }

            // ADP & Survival Probability
            let survPct = p._survivalProb !== undefined ? Math.round(p._survivalProb * 100) : (p.adp ? 50 : 100);
            let survColor = survPct < 25 ? 'text-rose-600 font-bold' : (survPct > 75 ? 'text-slate-400' : 'text-amber-600 font-semibold');
            let adpDisplayStr = p.adp ? `${p.adp.toFixed(0)}` : '-';
            let survDisplayStr = `<span class="${survColor} text-[11px]">${survPct}%</span>`;

            // Rich Tactical Badges
            let advTags = [];
            if (p._rbArchetype) advTags.push(`<span class="bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.5 rounded text-[9px] font-bold">${p._rbArchetype}</span>`);
            else if (p._wrArchetype) advTags.push(`<span class="bg-blue-50 text-blue-700 border border-blue-200/60 px-1.5 py-0.5 rounded text-[9px] font-bold">${p._wrArchetype}</span>`);
            else if (p._teArchetype) advTags.push(`<span class="bg-purple-50 text-purple-700 border border-purple-200/60 px-1.5 py-0.5 rounded text-[9px] font-bold">${p._teArchetype}</span>`);
            else if (p._qbArchetype) advTags.push(`<span class="bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 rounded text-[9px] font-bold">${p._qbArchetype}</span>`);

            if (p._contingentTier && p._contingentTier.includes('Diamond')) advTags.push(`<span class="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[9px]">${p._contingentTier}</span>`);
            if (p._positiveTdRegression) advTags.push(`<span class="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9px]">📈 +xTD Rebound</span>`);
            if (p.isTeamChanger && p._envDelta && p._envDelta >= 0.02) advTags.push(`<span class="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[9px]">🔄 Scheme Upgrade</span>`);

            let tagHTML = advTags.length > 0 ? `<div class="flex flex-wrap gap-1 mt-1">${advTags.join('')}</div>` : '';

            let isOffense = !['DST', 'PK'].includes(p.Pos);
            let playerAge = UI.getPlayerAge(p);
            let ageStr = playerAge ? `<span class="text-[9px] font-semibold text-slate-400 ml-1">Age ${playerAge}</span>` : '';
            let olBadge = (isOffense && p.olTier) ? `<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">OL ${p.olTier}</span>` : '';
            let sosBadge = p.avgStars ? `<span class="ml-1 inline-flex items-center text-[10px] font-bold text-amber-500">⭐ ${p.avgStars.toFixed(1)}</span>` : '';

            let injBadge = '';
            if (p.injuryStatus) {
                let abbr = p.injuryStatus === 'Questionable' ? 'Q' : (p.injuryStatus === 'Doubtful' ? 'D' : p.injuryStatus);
                let color = ['Out', 'IR', 'PUP', 'SUS'].includes(p.injuryStatus) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                injBadge = `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${color}">${abbr}</span>`;
            }

            // Key Stats Line
            let keyStatsHTML = '';
            if (p.stats) {
                let st = p.stats;
                const r = (val) => Math.round(Number(val) || 0);

                if (p.Pos === 'QB') keyStatsHTML = `<span class="text-slate-500">${r(st.passAtt)} Pass Att • ${r(st.passYds)} Pass Yds • ${r(st.rushAtt)} Rush Att • ${r(st.rushYds)} Rush Yds</span>`;
                else if (p.Pos === 'RB') keyStatsHTML = `<span class="text-slate-500">${r(st.rushAtt)} Rush Att • ${r(st.rushYds)} Rush Yds • ${r(st.targets)} Tgt • ${r(st.rec)} Rec</span>`;
                else if (['WR', 'TE'].includes(p.Pos)) keyStatsHTML = `<span class="text-slate-500">${r(st.targets)} Tgt • ${r(st.rec)} Rec • ${r(st.recYds)} Rec Yds • ${r(st.recTd)} TD</span>`;
                else if (p.Pos === 'DST') keyStatsHTML = `<span class="text-slate-500">${r(st.sack)} Sacks • ${r((st.defInt || 0) + (st.defFum || 0))} Turnovers • ${(Number(st.papg) || 18.0).toFixed(1)} PAPG</span>`;
                else if (p.Pos === 'PK') keyStatsHTML = `<span class="text-slate-500">${r(st.fgTotal)} FGs • ${r(st.xp)} PATs</span>`;
            }
            let statsDiv = keyStatsHTML ? `<div class="text-[10px] font-medium mt-0.5 tracking-tight">${keyStatsHTML}</div>` : '';

            htmlStr += `
                <tr class="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer" onclick="if (!event.target.closest('.draft-btn')) UI.showPlayerCard('${p._cleanName}')">
                    <td class="px-2 py-2 text-center text-[10px] leading-tight">
                        <span class="font-extrabold text-gray-900">#${p.ovrRank}</span><br>
                        <span class="font-bold text-gray-400">${p.posRank}</span>
                    </td>
                    <td class="px-3 py-2 text-[11px] font-bold text-gray-900 min-w-[210px]">
                        <div class="flex items-center">
                            <span>${p.Player}</span>
                            <span class="font-normal text-gray-400 ml-1.5">${p.Team}</span>
                            ${ageStr} ${olBadge} ${sosBadge} ${injBadge}
                        </div>
                        ${statsDiv}
                        ${tagHTML}
                    </td>
                    <td class="px-2 py-2 text-center text-[11px] text-gray-600 font-medium">${p.Pos}</td>
                    <td class="px-2 py-2 text-right text-[11px] font-medium text-slate-400">${(p.ConsensusPts || p.ProjPts).toFixed(1)}</td>
                    <td class="px-2 py-2 text-right text-[11px] font-extrabold text-indigo-900">${(p.ModelPts || p.ProjPts).toFixed(1)}</td>
                    <td class="px-2 py-2 text-center">${edgeStr}</td>
                    <td class="px-2 py-2 text-center">${probStr}</td>
                    <td class="px-2 py-2 text-center">${rangeDisplay}</td>
                    <td class="px-2 py-2 text-center">${ppwStr}</td>
                    <td class="px-2 py-2 text-center text-[11px] text-gray-600">${adpDisplayStr}</td>
                    <td class="px-2 py-2 text-center">${survDisplayStr}</td>
                    <td class="px-2 py-2 text-center text-[11px]">${byeStr}</td>
                    <td class="px-2 py-2 text-center text-[11px] text-gray-600">${depthStr}</td>
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

            const getSortVal = (player, k) => {
                if (k === 'Edge') return Number(player.Edge ?? 0);
                if (k === 'OverProb') return Number(player.OverProb ?? 0.5);
                if (k === 'ModelPts') return Number(player.ModelPts ?? player.ProjPts ?? 0);
                if (k === 'ConsensusPts' || k === 'ProjPts') return Number(player.ConsensusPts ?? player.ProjPts ?? 0);
                if (k === 'AdvVBD') return Number(player.AdvVBD ?? player.VBD ?? 0);
                if (k === 'upsideScore') return Number(player.upsideScore ?? player.AdvVBD ?? 0);
                if (k === 'floorPpg') return Number(player.floorPpg ?? 0);
                if (k === 'ceilingPpg') return Number(player.ceilingPpg ?? 0);
                if (k === 'adp' || k === 'depthChart' || k === 'byeWeek') {
                    const raw = player[k];
                    const num = Number(raw);
                    return raw === undefined || raw === null || raw === '' || isNaN(num) ? Number.POSITIVE_INFINITY : num;
                }
                if (k === '_addedPPW') return Number(player._addedPPW ?? 0);
                if (k === 'ovrRank') return Number(player.ovrRank ?? 9999);
                return player[k] ?? '';
            };

            State.availablePlayers.sort((a, b) => {
                let valA = getSortVal(a, key);
                let valB = getSortVal(b, key);
                
                // If either value is a string (e.g. "N/A"), coerce both and use string comparison to avoid NaN
                if (typeof valA === 'string' || typeof valB === 'string') {
                    let strA = String(valA);
                    let strB = String(valB);
                    return State.draftSortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
                }
                
                return State.draftSortAsc ? valA - valB : valB - valA;
            });
            this.renderDraftAvailablePlayers();
        }
    },

    // ⚡ FULL RECOMMENDATIONS ENGINE (STRATEGY BANNER + LOOKAHEAD + PINNED COMPARE)
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

        // =========================================================================
        // UNIVERSAL MULTI-WINDOW DRAFT LOOKAHEAD ENGINE
        // =========================================================================
        let userRemainingPicks = [];
        State.draftOrder.forEach((teamId, idx) => {
            if (idx >= State.currentPick && teamId === State.userTeamId) {
                userRemainingPicks.push(idx + 1);
            }
        });

        // 1. Build Remaining Pick Windows
        let currentWindow = [];
        let nextWindow = [];

        for (let i = 0; i < userRemainingPicks.length; i++) {
            let pick = userRemainingPicks[i];
            if (currentWindow.length === 0 || (pick - currentWindow[currentWindow.length - 1]) <= 2) {
                currentWindow.push(pick);
            } else if (nextWindow.length === 0 || (pick - nextWindow[nextWindow.length - 1]) <= 2) {
                nextWindow.push(pick);
            } else {
                break;
            }
        }

        // 2. Identify Target Window (Current upcoming pick vs Next round pick)
        const isUserCurrentlyPicking = (State.draftOrder[State.currentPick] === State.userTeamId);

        let targetPick;
        if (isUserCurrentlyPicking) {
            // You are picking right now: calculate who survives to your NEXT round (e.g. Pick 60)
            targetPick = nextWindow.length > 0 ? nextWindow[0] : (currentOverallPick + (State.settings.numTeams * 2));
        } else {
            // Someone else is picking: calculate who survives to your UPCOMING turn (e.g. Pick 36)
            targetPick = currentWindow.length > 0 ? currentWindow[0] : (currentOverallPick + State.settings.numTeams);
        }

        const nextActiveWindowPick = targetPick;

        // 3. Collect All Teams Drafting Between Now and Your Target Pick
        let interveningTeamIds = [];
        let startIdx = isUserCurrentlyPicking ? (State.currentPick + 1) : State.currentPick;
        let nextPickIndex = nextActiveWindowPick - 1; 

        for (let i = startIdx; i < nextPickIndex; i++) {
            if (State.draftOrder[i] && State.draftOrder[i] !== State.userTeamId) {
                interveningTeamIds.push(State.draftOrder[i]);
            }
        }
        interveningTeamIds = [...new Set(interveningTeamIds)];

        // 4. Natural Bell-Curve Survival Probability Model
        const getSurvivalProb = (player) => {
            let adp = player.adp;
            if (!adp) return 1.0;

            // Empirical standard deviation (variance scales with round depth)
            let sigma = Math.max(3.0, 2.5 + (0.12 * adp));

            // Count positional need among intervening teams
            let threatCount = 0;
            let safetyCount = 0;
            let posRoster = State.settings.roster[player.Pos];
            let starterMax = posRoster ? posRoster.max : 1;

            interveningTeamIds.forEach(teamId => {
                let t = State.teamsById[teamId];
                if (!t) return;
                let count = t.counts[player.Pos] || 0;
                
                if (['QB', 'TE', 'PK', 'DST'].includes(player.Pos)) {
                    if (count >= starterMax) safetyCount++;
                    else threatCount++;
                } else {
                    let needsStarter = count < starterMax;
                    let hasFlex = (t.counts['Flex'] || 0) < (State.settings.roster.Flex?.max || 0) || 
                                  (t.counts['FlexRBWR'] || 0) < (State.settings.roster.FlexRBWR?.max || 0);
                    if (needsStarter || hasFlex) threatCount++;
                    else safetyCount++;
                }
            });

            // Adjust target line based on positional demand
            let needShift = 0;
            if (['QB', 'TE', 'PK', 'DST'].includes(player.Pos)) {
                if (safetyCount === interveningTeamIds.length && interveningTeamIds.length > 0) {
                    needShift = +6.0; // All intervening teams filled starter slot; player slides
                } else {
                    needShift = -(threatCount * 1.5);
                }
            } else {
                needShift = -(threatCount * 0.8);
            }

            // Normal Logistic Z-Score
            let effectivePick = nextActiveWindowPick + needShift;
            let z = (adp - effectivePick) / sigma;
            let prob = 1 / (1 + Math.exp(-1.6 * z));

            return Math.max(0.0, Math.min(1.0, prob));
        };

        // 5. Store Computed Probability on Available Players
        State.availablePlayers.forEach(p => {
            p._survivalProb = getSurvivalProb(p);
        });

        // =========================================================================
        // 🎯 4-TIER ROSTER FRAGILITY & DYNAMIC STRUCTURAL STRATEGY ENGINE
        // =========================================================================
        let userRoster = userTeam.roster;
        let earlyRBs = userRoster.filter(p => p.Pos === 'RB' && (p.draftPickNum || 99) <= 60).length;
        let earlyWRs = userRoster.filter(p => p.Pos === 'WR' && (p.draftPickNum || 99) <= 60).length;
        let highBustStarters = userRoster.filter(p => (p.draftPickNum || 99) <= 72 && p.boomBust && p.boomBust.bust >= 35).length;
        let isGlassCannon = highBustStarters >= 3;

        let totalBustRisk = 0;
        let coreStarters = userRoster.filter(p => (p.draftPickNum || 99) <= 72);
        coreStarters.forEach(p => {
            totalBustRisk += (p.boomBust && p.boomBust.bust) ? p.boomBust.bust : 20.0;
        });
        let avgRosterBustRate = coreStarters.length > 0 ? (totalBustRisk / coreStarters.length) : 20.0;

        let strategyBanner = "";
        if (currentRound <= 9) {
            let fragilityTag = isGlassCannon 
                ? `<span class="bg-rose-950 text-rose-300 border border-rose-700 px-2 py-0.5 rounded font-bold ml-1.5">🚨 Fragile 'Glass Cannon' Build</span>` 
                : `<span class="bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-bold ml-1.5">🛡️ Solid Foundation</span>`;

            if (earlyRBs === 0 && userRoster.length >= 2) {
                strategyBanner = `<div class="p-2 mb-2 bg-indigo-950 border border-indigo-700 rounded-xl text-[10px] text-indigo-200 flex justify-between items-center shadow-sm">
                    <span>📡 <strong>Zero-RB Build:</strong> Hammering WR/TE alphas. Target high-HVO space backs & handcuffs in R7–R11.</span>
                    ${fragilityTag}
                </div>`;
            } else if (earlyRBs === 1 && earlyWRs >= 2) {
                strategyBanner = `<div class="p-2 mb-2 bg-emerald-950 border border-emerald-700 rounded-xl text-[10px] text-emerald-200 flex justify-between items-center shadow-sm">
                    <span>🦸 <strong>Hero-RB Build:</strong> Anchor RB secured. Evaluating Best Player Available across WR/TE/Flex.</span>
                    ${fragilityTag}
                </div>`;
            } else if (earlyRBs >= 2) {
                strategyBanner = `<div class="p-2 mb-2 bg-amber-950 border border-amber-700 rounded-xl text-[10px] text-amber-200 flex justify-between items-center shadow-sm">
                    <span>🚜 <strong>Robust-RB Ground Attack:</strong> Backfield foundation established. Flex slots optimizing dynamically.</span>
                    ${fragilityTag}
                </div>`;
            } else if (isGlassCannon) {
                strategyBanner = `<div class="p-2 mb-2 bg-rose-950 border border-rose-700 rounded-xl text-[10px] text-rose-200 flex justify-between items-center shadow-sm">
                    <span>⚠️ <strong>Volatility Warning:</strong> Multiple high-bust starters detected. Prioritizing high-floor insulation assets.</span>
                    ${fragilityTag}
                </div>`;
            }
        }

        let userQBs = userRoster.filter(r => r.Pos === 'QB');

        // ⚡ Calculate Positional Scarcity Panic (Tier Cliffs)
        let scarcity = {};
        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
            let tiers = State.getPositionalTiers(pos);
            if (tiers.length > 1 && tiers[0].length <= 3) {
                let lastInTopTier = tiers[0][tiers[0].length - 1];
                let firstInNextTier = tiers[1][0];
                let drop = (lastInTopTier.AdvVBD || lastInTopTier.VBD || 0) - (firstInNextTier.AdvVBD || firstInNextTier.VBD || 0);
                let urgencyMult = tiers[0].length === 1 ? 1.0 : (tiers[0].length === 2 ? 0.7 : 0.4);
                scarcity[pos] = Math.max(0, drop) * urgencyMult;
            } else {
                scarcity[pos] = 0;
            }
        });

        // Filter roster-eligible players
        let viablePlayers = State.availablePlayers.filter(p => {
            let pos = p.Pos;
            let posRoster = State.settings.roster[pos];
            let starterMax = posRoster ? posRoster.max : 1;

            if (userTeam.counts[pos] < starterMax) return true;
            if (['RB', 'WR'].includes(pos) && userTeam.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) return true;
            if (['RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) return true;
            if (['QB', 'RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) return true;
            if (userTeam.counts['Bench'] < (State.settings.roster.Bench?.max || 6)) return true;
            return false;
        });

        // Canonical Evaluation Engine Call
        let context = {
            currentRound,
            currentOverallPick,
            nextActiveWindowPick,
            isCPU: false
        };

        viablePlayers.forEach(p => {
            let evalResult = State.evaluateDraftValue(p, userTeam, context);
            p._recScore = evalResult.totalDraftValue;
        });

        // Positional Slots Allocation
        let pkMax = State.settings.roster.PK?.max ?? 0;
        let dstMax = State.settings.roster.DST?.max ?? 0;
        let needsPK = pkMax > 0 && (userTeam.counts['PK'] || 0) < pkMax;
        let needsDST = dstMax > 0 && (userTeam.counts['DST'] || 0) < dstMax;

        let skillPlayers = viablePlayers.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.Pos))
            .sort((a, b) => b._recScore - a._recScore);

        let kDstPlayers = viablePlayers.filter(p => ['PK', 'DST'].includes(p.Pos))
            .sort((a, b) => b._recScore - a._recScore);

        let finalRecs = [];

        // 1. Fill top slots with skill positions first (up to 9)
        for (let p of skillPlayers) {
            if (finalRecs.length >= 9) break;
            if (!finalRecs.includes(p)) finalRecs.push(p);
        }

        // 2. In final 2 rounds, promote needed DST and PK straight to the top of list
        if (currentRound >= totalRounds - 2) {
            let bestDST = kDstPlayers.find(p => p.Pos === 'DST');
            let bestPK = kDstPlayers.find(p => p.Pos === 'PK');

            if (needsDST && bestDST && !finalRecs.includes(bestDST)) {
                finalRecs.unshift(bestDST);
            }
            if (needsPK && bestPK && !finalRecs.includes(bestPK)) {
                finalRecs.splice(1, 0, bestPK);
            }
        }

        // 3. Fill remaining slots up to 10 recommendations
        for (let p of [...viablePlayers].sort((a, b) => b._recScore - a._recScore)) {
            if (finalRecs.length >= 10) break;
            if (!finalRecs.includes(p)) finalRecs.push(p);
        }

        let bestFit = finalRecs[0];
        let vbdRecs = finalRecs.slice(1, 10);
        let bpaPlayer = [...viablePlayers].sort((a, b) => (b.AdvVBD || b.VBD) - (a.AdvVBD || a.VBD))[0];

        let htmlStr = strategyBanner;

        // 6. #1 Pick Hero Card (Full Badges Preserved)
        if (bestFit) {
            let isStarterNeeded = userTeam.counts[bestFit.Pos] < (State.settings.roster[bestFit.Pos]?.max || 1);
            let ppwText = '';
            if (bestFit._byeFillWeek) {
                ppwText = `Wk ${bestFit._byeFillWeek} Bye Fill`;
            } else if (currentRound >= 5 && bestFit._addedPPW >= 0.5) {
                ppwText = `+${bestFit._addedPPW.toFixed(1)} PPW Lineup Fit`;
            } else if (isStarterNeeded) {
                ppwText = `Core Starter (${bestFit.Pos})`;
            } else {
                ppwText = `Bench Stash / Upside`;
            }

            let stackBadge = bestFit._stackPartner ? ` • ⚡ Stack w/ ${bestFit._stackPartner}` : '';
            let cliffBadge = '';
            if (bestFit._byeWarningTag) cliffBadge = ` • <span class="text-rose-300 font-bold">${bestFit._byeWarningTag}</span>`;
            else if (bestFit._rosterContextBadge) cliffBadge = ` • <span class="text-amber-200 font-bold">${bestFit._rosterContextBadge}</span>`;
            else if (bestFit._tierCliffTag) cliffBadge = ` • <span class="text-amber-200 font-bold">${bestFit._tierCliffTag}</span>`;

            let recBadgeTitle = (bestFit._addedPPW && bestFit._addedPPW >= 1.0 && currentRound >= 5) ? "#1 Lineup Fit" : "#1 Recommended Pick";
            htmlStr += `
            <div class="p-3 bg-gradient-to-br from-emerald-800 to-teal-950 rounded-2xl border border-emerald-500/50 flex justify-between items-center shadow-md cursor-pointer hover:brightness-110 transition mb-2 shrink-0" onclick="UI.showPlayerCard('${bestFit._cleanName}')">
                <div class="min-w-0 pr-2">
                    <div class="flex items-center gap-1.5 leading-none mb-1">
                        <span class="text-[9px] font-black uppercase tracking-wider text-emerald-300">${recBadgeTitle}</span>
                        <span class="text-[9px] text-emerald-200 font-bold">(${bestFit.Pos})</span>
                    </div>
                    <h4 class="font-black text-sm text-white truncate leading-tight">${bestFit.Player} <span class="text-[11px] font-normal text-emerald-200">(${bestFit.Team} • Wk ${bestFit.byeWeek || '-'})</span></h4>
                    <p class="text-[10px] text-emerald-100 font-medium truncate mt-0.5">${ppwText}${stackBadge}${cliffBadge}</p>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-[11px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-2 py-1 rounded-lg">${(bestFit.AdvVBD || bestFit.VBD).toFixed(1)} VBD</span>
                </div>
            </div>`;
        }

        // 7. #2–#10 Recommendations (Every Badge & Calculation Restored)
        htmlStr += vbdRecs.map((p, i) => {
            let stackBadge = p._stackPartner ? ` • ⚡ ${p._stackPartner}` : '';
            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 1;
            let isStarterNeeded = userTeam.counts[p.Pos] < starterMax;
            let hasPositiveValue = (p.AdvVBD || p.VBD) > 0;

            let highlight = '';
            if (p._byeWarningTag) {
                highlight = `<span class="text-rose-300 font-extrabold">${p._byeWarningTag}</span>`;
            } else if (p === bpaPlayer) {
                highlight = `<span class="text-fuchsia-300 font-extrabold">💎 Highest Raw Value (BPA)</span>`;
            } else if (p.contingentDraftEquity && p.contingentDraftEquity >= 25.0) {
                highlight = `<span class="text-purple-300 font-bold">👑 ${p._contingentTier || 'Diamond Stash'}</span>`;
            } else if (p._sleeperBadge) {
                highlight = `<span class="text-emerald-300 font-bold">${p._sleeperBadge}</span>`;
            } else if (p._rosterContextBadge) {
                highlight = `<span class="text-amber-300 font-bold">${p._rosterContextBadge}</span>`;
            } else if (p._positiveTdRegression) {
                highlight = `<span class="text-emerald-300 font-bold">📈 Positive TD Rebound (~${p.xTD ? p.xTD.toFixed(0) : 'High'} xTD)</span>`;
            } else if (p.adp && p._survivalProb < 0.20 && (isStarterNeeded || hasPositiveValue)) {
                highlight = `<span class="text-rose-300 font-bold">⚡ Last Chance (ADP ${p.adp.toFixed(0)})</span>`;
            } else if (p.adp && (currentOverallPick - p.adp >= 10)) {
                highlight = `<span class="text-emerald-300 font-bold">🔥 Value Slide (+${Math.round(currentOverallPick - p.adp)} past ADP)</span>`;
            } else if (p.adp && p._survivalProb > 0.75 && currentRound <= 9) {
                highlight = `<span class="text-slate-400 font-medium">⏳ Exploit Public ADP (${p.adp.toFixed(0)})</span>`;
            } else if (isStarterNeeded) {
                highlight = `<span class="text-amber-300 font-semibold">📋 Core Starter Need</span>`;
            } else {
                highlight = `<span class="text-slate-400">Bench Stash / Upside</span>`;
            }

            let ppwVal = '';
            if (p._byeFillWeek) {
                ppwVal = `Wk ${p._byeFillWeek} Fill`;
            } else if (currentRound >= 5 && p._addedPPW >= 0.5) {
                ppwVal = `+${p._addedPPW.toFixed(1)}/wk`;
            } else {
                let vbdVal = (p.AdvVBD || p.VBD).toFixed(1);
                ppwVal = `${vbdVal >= 0 ? '+' : ''}${vbdVal} VBD`;
            }

            return `
            <div class="p-2.5 bg-indigo-950/70 rounded-xl border border-indigo-800/60 flex flex-col justify-between cursor-pointer hover:bg-indigo-900/80 transition mb-2 shadow-sm" onclick="UI.showPlayerCard('${p._cleanName}')">
                <!-- Line 1: Rank, Name, Pos/Team & Score -->
                <div class="flex justify-between items-center mb-1">
                    <div class="flex items-center min-w-0 pr-1 truncate">
                        <span class="text-indigo-400 font-black text-xs w-4 shrink-0">${bestFit ? i + 2 : i + 1}.</span>
                        <span class="font-bold text-xs text-white truncate">${p.Player}</span>
                        <span class="text-[10px] text-indigo-300 font-medium ml-1.5 shrink-0">(${p.Pos} • ${p.Team})</span>
                    </div>
                    <span class="text-[10px] font-black text-emerald-300 bg-emerald-950/90 border border-emerald-800/80 px-1.5 py-0.5 rounded shrink-0 leading-none">${ppwVal}</span>
                </div>
                <!-- Line 2: Context / Reasoning Badge -->
                <div class="text-[10px] font-medium truncate flex items-center pl-4">
                    ${highlight}${stackBadge}
                </div>
            </div>`;
        }).join('');

        State.currentRecommendations = finalRecs;
        container.innerHTML = htmlStr;

        // Sync Pinned Compare Button
        const compWrapper = document.getElementById('compare-button-wrapper');
        const compCount = document.getElementById('compare-target-count');
        if (compWrapper) {
            if (finalRecs.length > 1) {
                compWrapper.classList.remove('hidden');
                if (compCount) compCount.textContent = Math.min(finalRecs.length, 10);
            } else {
                compWrapper.classList.add('hidden');
            }
        }
    },
    
    renderMyRoster() {
        const container = document.getElementById('my-roster-container');
        if (!container) return;

        const userTeam = State.teamsById[State.userTeamId];
        if (!userTeam) return;

        const r = State.settings.roster;
        const totalSize = r.totalSize || 16;
        const countBadge = document.getElementById('my-roster-count');
        if (countBadge) countBadge.textContent = `${userTeam.roster.length}/${totalSize} Filled`;

        // 1. Build Ordered Slot Lists
        let starterSlots = [];
        let benchSlots = [];

        const addStarterSlot = (label, maxCount, posType) => {
            for (let i = 1; i <= maxCount; i++) {
                let display = maxCount > 1 ? `${label}${i}` : label;
                starterSlots.push({ slotKey: label, displayLabel: display, posType: posType });
            }
        };

        if (r.QB?.max > 0) addStarterSlot('QB', r.QB.max, 'QB');
        if (r.RB?.max > 0) addStarterSlot('RB', r.RB.max, 'RB');
        if (r.WR?.max > 0) addStarterSlot('WR', r.WR.max, 'WR');
        if (r.TE?.max > 0) addStarterSlot('TE', r.TE.max, 'TE');
        if (r.FlexRBWR?.max > 0) addStarterSlot('FLX(W/R)', r.FlexRBWR.max, 'FlexRBWR');
        if (r.Flex?.max > 0) addStarterSlot('FLEX', r.Flex.max, 'Flex');
        if (r.Superflex?.max > 0) addStarterSlot('SFLEX', r.Superflex.max, 'Superflex');
        if (r.PK?.max > 0) addStarterSlot('K', r.PK.max, 'PK');
        if (r.DST?.max > 0) addStarterSlot('DST', r.DST.max, 'DST');

        let benchMax = r.Bench?.max || 6;
        for (let i = 1; i <= benchMax; i++) {
            benchSlots.push({ slotKey: 'BN', displayLabel: `BN${i}`, posType: 'Bench' });
        }

        // 2. Match Players to Slots
        let remainingPlayers = [...userTeam.roster];

        const matchSlots = (slotList) => {
            return slotList.map(slot => {
                let matchedIdx = -1;
                if (slot.posType === 'Bench') {
                    matchedIdx = 0;
                } else {
                    matchedIdx = remainingPlayers.findIndex(p => {
                        if (slot.posType === 'QB') return p.Pos === 'QB';
                        if (slot.posType === 'RB') return p.Pos === 'RB';
                        if (slot.posType === 'WR') return p.Pos === 'WR';
                        if (slot.posType === 'TE') return p.Pos === 'TE';
                        if (slot.posType === 'FlexRBWR') return ['RB', 'WR'].includes(p.Pos);
                        if (slot.posType === 'Flex') return ['RB', 'WR', 'TE'].includes(p.Pos);
                        if (slot.posType === 'Superflex') return ['QB', 'RB', 'WR', 'TE'].includes(p.Pos);
                        if (slot.posType === 'PK') return p.Pos === 'PK';
                        if (slot.posType === 'DST') return p.Pos === 'DST';
                        return false;
                    });
                }

                if (matchedIdx !== -1 && remainingPlayers.length > 0) {
                    let player = remainingPlayers.splice(matchedIdx, 1)[0];
                    return { ...slot, player };
                }
                return { ...slot, player: null };
            });
        };

        const filledStarters = matchSlots(starterSlots);
        const filledBench = matchSlots(benchSlots);

        // 3. Render 2-Column Starter Grid
        let htmlStr = `
            <div class="mb-3">
                <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>⚔️ Starting Lineup</span>
                    <span class="text-indigo-600 font-bold">${filledStarters.filter(s => s.player).length}/${filledStarters.length}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
        `;

        filledStarters.forEach(s => {
            if (s.player) {
                let p = s.player;
                htmlStr += `
                    <div class="bg-indigo-50/70 border border-indigo-200/80 p-2 rounded-xl flex items-center justify-between cursor-pointer hover:border-indigo-400 transition min-w-0 shadow-sm" onclick="UI.showPlayerCard('${p._cleanName}')">
                        <div class="flex items-center min-w-0 pr-1 truncate">
                            <span class="bg-indigo-600 text-white font-black text-[9px] uppercase px-1.5 py-0.5 rounded mr-1.5 shrink-0">${s.displayLabel}</span>
                            <span class="font-extrabold text-xs text-slate-900 truncate leading-tight">${p.Player}</span>
                        </div>
                        <span class="text-[10px] font-black text-indigo-700 shrink-0">${(p.ModelPts || p.ProjPts || 0).toFixed(0)}p</span>
                    </div>
                `;
            } else {
                htmlStr += `
                    <div class="border border-dashed border-slate-200 bg-slate-50/50 p-2 rounded-xl flex items-center justify-between min-w-0 text-slate-400">
                        <div class="flex items-center min-w-0">
                            <span class="bg-slate-200 text-slate-500 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded mr-1.5 shrink-0">${s.displayLabel}</span>
                            <span class="text-xs italic truncate">Open</span>
                        </div>
                        <span class="text-[10px] opacity-40">—</span>
                    </div>
                `;
            }
        });

        htmlStr += `
                </div>
            </div>
            
            <!-- 4. Bench Pill Grid -->
            <div>
                <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>🛡️ Bench Stash</span>
                    <span class="text-slate-500 font-bold">${filledBench.filter(b => b.player).length}/${filledBench.length}</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5">
        `;

        filledBench.forEach(b => {
            if (b.player) {
                let p = b.player;
                htmlStr += `
                    <div class="bg-slate-100 border border-slate-200 p-1.5 rounded-lg flex items-center justify-between cursor-pointer hover:border-slate-400 transition min-w-0" onclick="UI.showPlayerCard('${p._cleanName}')">
                        <span class="font-bold text-xs text-slate-800 truncate pr-1">${p.Player.split(' ').slice(-1)[0]}</span>
                        <span class="text-[10px] font-bold text-slate-500 shrink-0">${p.Pos}</span>
                    </div>
                `;
            } else {
                htmlStr += `
                    <div class="border border-dashed border-slate-200 p-1.5 rounded-lg text-center text-slate-400 text-[10px] font-semibold">
                        ${b.displayLabel}
                    </div>
                `;
            }
        });

        htmlStr += `
                </div>
            </div>
        `;

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
        let htmlStr = '';

        // Check if DraftRecap has generated the advanced data
        if (window.DraftRecap && DraftRecap.sortedTeams && DraftRecap.sortedTeams.length > 0) {
            DraftRecap.sortedTeams.forEach((t, i) => {
                let isUser = t.id === State.userTeamId;
                
                // Highlight the user's team with a pop of color
                let bg = isUser ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/30 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md';
                let text = isUser ? 'text-indigo-900' : 'text-slate-900';
                
                htmlStr += `
                    <div class="${bg} p-4 sm:p-5 rounded-2xl mb-3 transition-all cursor-pointer group" 
                         onclick="document.getElementById('recap-team-select').value='${t.id}'; document.getElementById('recap-team-select').dispatchEvent(new Event('change')); document.getElementById('recap-team-select').scrollIntoView({behavior: 'smooth', block: 'start'})">
                        
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            
                            <!-- Left: Rank, Name, Grade & Odds -->
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full ${isUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'} flex items-center justify-center font-black text-lg shrink-0 group-hover:scale-105 transition-transform">
                                    ${i + 1}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="text-lg sm:text-xl font-black ${text}">${t.name}</h3>
                                        ${isUser ? '<span class="px-2 py-0.5 bg-indigo-200 text-indigo-800 text-[10px] font-bold uppercase tracking-wider rounded">Your Team</span>' : ''}
                                    </div>
                                    <div class="text-xs font-medium text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span>Grade: <span class="${t.analysis.color} font-black text-sm drop-shadow-sm">${t.analysis.grade}</span></span>
                                        <span class="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                                        <span class="font-semibold text-slate-600">Proj: ${t.simRecord}</span>
                                        <span class="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                                        <span class="text-emerald-600 font-bold">${t.playoffOdds}% Playoffs</span>
                                        <span class="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                                        <span>${t.analysis.persona.icon} ${t.analysis.persona.label}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Right: The 3-Tier Range (Floor / Median / Ceiling) -->
                            <div class="flex items-center gap-3 sm:gap-6 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/60 shrink-0">
                                <div class="text-center">
                                    <span class="block text-[10px] uppercase font-bold text-rose-500 mb-0.5 tracking-wider">Floor</span>
                                    <span class="font-bold text-slate-600 text-xs">${t.floorPts.toFixed(1)}</span>
                                </div>
                                <div class="text-center px-3 sm:px-4 border-l border-r border-slate-200">
                                    <span class="block text-[10px] uppercase font-bold text-indigo-600 mb-0.5 tracking-wider">Median</span>
                                    <span class="font-black text-indigo-700 text-lg sm:text-xl">${t.basePts.toFixed(1)}</span>
                                </div>
                                <div class="text-center">
                                    <span class="block text-[10px] uppercase font-bold text-emerald-500 mb-0.5 tracking-wider">Ceiling</span>
                                    <span class="font-bold text-slate-600 text-xs">${t.ceilingPts.toFixed(1)}</span>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                `;
            });
        } 
        list.innerHTML = htmlStr;
    }
};

window.UI = UI;
