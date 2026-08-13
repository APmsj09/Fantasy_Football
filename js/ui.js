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

            // Fix: Filter out OL badges for DST & Kickers
            let isOffense = !['DST', 'PK'].includes(p.Pos);
            let olTag = (isOffense && p.olTier) ? `<span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">OL ${p.olTier}</span>` : '';

            let injBadge = '';
            if (p.injuryStatus) {
                let abbr = p.injuryStatus === 'Questionable' ? 'Q' : (p.injuryStatus === 'Doubtful' ? 'D' : p.injuryStatus);
                let color = ['Out', 'IR', 'PUP'].includes(p.injuryStatus) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                injBadge = `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${color}">${abbr}</span>`;
            }

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

        let passVolume = teamDist ? (teamDist['Total Targets'] || 550) : 550;
        let offensePace = "balanced";
        if (passVolume > 580) offensePace = "pass-heavy";
        else if (passVolume < 520) offensePace = "run-heavy";

        // Find starting QB 
        let qbName = "their starting QB";
        if (pos !== 'QB') {
            let teamQB = State.allPlayers.find(q => q._cleanTeam === tTeam && q._cleanPos === 'QB' && q.depthChart === 1);
            if (!teamQB) teamQB = State.allPlayers.filter(q => q._cleanTeam === tTeam && q._cleanPos === 'QB').sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0))[0];
            if (teamQB) qbName = teamQB.Player;
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

            // 2. Reference Team Positional Usage with Scaled Raw Volume + Target %
            if (pos === 'RB') {
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
                    opportunityBullets.push(`<strong>Target Opportunity:</strong> ${p.Player} enters the ${p.Team} passing attack with starting route potential.`);
                }
            } else if (pos === 'QB') {
                if (passEnv && passEnv.pktTime) {
                    let pkt = passEnv.pktTime;
                    let grade = pkt >= 2.5 ? "[GREAT POCKET PROTECTION]" : (pkt >= 2.3 ? "[AVERAGE PROTECTION]" : "[POOR PROTECTION - High Pressure]");
                    opportunityBullets.push(`<strong>Pocket Protection:</strong> ${p.Team}'s line allowed <strong>${pkt}s pocket time</strong> with a <strong>${passEnv.prssPct}% pressure rate</strong> <span class="text-indigo-800 font-bold">${grade}</span>.`);
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

            // REPLACE THE RB ARCHETYPE LOGIC WITH THIS UPDATED VERSION:
            if (p.hvo && p.hvo >= 70) {
                archetypeNote = pickVar([
                    "Dominating high-value opportunities (receiving work + red-zone carries), his role is tailored for fantasy success.",
                    "His monopoly over money touches—receptions and inside-the-10 carries—makes him a usage monster.",
                    "He captures the coveted dual-threat RB role, taking pass-game targets alongside goal-line work."
                ]);
            } else if (p._isHandcuffPlus) {
                archetypeNote = "Operating as a high-end '1B' back, he provides standalone Flex value while carrying league-winning contingent upside if the starter goes down.";
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
            } else if (p._isEmptyCalories) {
                archetypeNote = "An 'Empty Calories' profile: He sees significant target volume, but his dismal efficiency yields a safe floor with virtually zero weekly ceiling.";
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
            let lineContext = p.olTier ? ` behind a <strong>Tier ${p.olTier} offensive line</strong>` : '';
            archetypeNote += ` Directing a <strong>${offensePace}</strong> offense${lineContext}, his overall fantasy ceiling is strongly influenced by passing volume and the playmaking ability of his receiving corps.`;
        }

        // Past Stats Context Sentence
        let pastStatsContext = "";
        if (p.pastStats && p.pastPpg > 0 && (isOffense || isDST) && !showPastStatsInBox) {
            const ps = p.pastStats;
            const totalTds = isDST ? ((ps.defTd || 0) + (ps.spcTd || 0)) : (ps.totalTd || 0);
            const tdText = isDST ? `${totalTds} DEF/ST TDs` : `${totalTds} total TDs`;
            const pronoun = isDST ? "They are" : "He is";
            pastStatsContext = ` ${pronoun} coming off a 2025 campaign averaging <strong>${p.pastPpg.toFixed(1)} PPG</strong> over ${ps.gp || 17} games (${tdText}).`;
        }

        let statProof = "";
        if (isOffense) {
            let specificStats = [];
            if (p.targetShare && p.targetShare >= 15) specificStats.push(`commands a massive <strong>${p.targetShare}% target share</strong>`);
            if (p.hvo && p.hvo >= 40) specificStats.push(`dominates with <strong>${p.hvo} high-value opportunities</strong> (RZ carries + targets)`);
            if (p.aDOT && p.aDOT >= 12.0) specificStats.push(`stretches the field with an elite <strong>${p.aDOT} aDOT</strong>`);
            if (p.pastStats && p.pastStats.bigPlays >= 8) specificStats.push(`generated <strong>${p.pastStats.bigPlays} explosive plays</strong> (20+ yards)`);
            if (p.wopr && p.wopr >= 0.55) specificStats.push(`boasts a dominant <strong>${p.wopr.toFixed(2)} WOPR</strong>`);
            if (p.Pos === 'QB' && p.stats && p.stats.rushAtt >= 50) specificStats.push(`adds crucial rushing floor with <strong>${p.stats.rushAtt} projected carries</strong>`);
            if (p.snapShare && p.snapShare >= 75) specificStats.push(`rarely leaves the field (<strong>${p.snapShare.toFixed(0)}% snap share</strong>)`);

            if (specificStats.length > 0) {
                statProof = ` His elite profile is backed by raw data: he ${specificStats.slice(0, 2).join(', and ')}.`;
            }
        }

        let narrativeBlurb = "";
        if (isDST || isPK) {
            if (posRank <= 5) {
                narrativeBlurb = pickVar([
                    `${p.Player} stands as a premier option, offering weekly stability at a highly volatile position. Projected for ${ppg} PPG, they bring immense floor to your lineup.`,
                    `Locking in ${p.Player} gives you an elite advantage at a position where most managers stream. Expect a reliable ${ppg} PPG baseline.`,
                    `Ranked as an elite unit, ${p.Player} minimizes weekly headache at the position and projects for a robust ${ppg} PPG.`
                ]) + pastStatsContext + " " + archetypeNote;
            } else if (posRank <= 12) {
                narrativeBlurb = pickVar([
                    `${p.Player} projects as a reliable starting option that you can confidently plug into your weekly lineup (${ppg} PPG proj).`,
                    `Providing steady positional value, ${p.Player} is a rock-solid starter for your roster (${ppg} PPG proj).`,
                    `You can draft ${p.Player} as an every-week starter without having to play the waiver wire (${ppg} PPG proj).`
                ]) + pastStatsContext + " " + archetypeNote;
            } else {
                narrativeBlurb = pickVar([
                    `${p.Player} enters the year as a matchup-dependent streaming option (${ppg} PPG proj). You will likely need to rotate based on schedule.`,
                    `View ${p.Player} as a situational play. They project for ${ppg} PPG and will require careful matchup management.`,
                    `Drafting ${p.Player} means playing the matchups week-to-week, as their ${ppg} PPG projection lacks elite safety.`
                ]) + pastStatsContext + " " + archetypeNote;
            }
        } else {
            if (isUltraElite) {
                const ultraIntros = [
                    `${p.Player} stands as a crown-jewel fantasy selection, commanding an undeniable role as the ${posRankStr} (#${overallRank} overall).`,
                    `Few players match the combination of raw ceiling and floor that ${p.Player} brings as the ${posRankStr} (#${overallRank} overall).`,
                    `Anchor your draft with ${p.Player}, a top-tier centerpiece in the ${p.Team} attack projected for ${ppg} PPG.`
                ];
                narrativeBlurb = `${pickVar(ultraIntros)}${pastStatsContext} ${archetypeNote}${statProof} Fantasy managers can construct rosters around his bulletproof baseline.`;
            } else if (posRank <= 12) {
                const starterIntros = [
                    `${p.Player} headlines the ${p.Team} skill group as a premier ${tierLabel} candidate.`,
                    `Locking in ${p.Player} gives fantasy managers a foundational weekly starter projected for ${ppg} PPG.`,
                    `The ${p.Team} offense relies heavily on ${p.Player}, positioning him firmly in the ${tierLabel} tier.`
                ];
                narrativeBlurb = `${pickVar(starterIntros)}${pastStatsContext} ${archetypeNote}${statProof}`;
            } else if (posRank <= 24) {
                const solidIntros = [
                    `${p.Player} offers reliable weekly starting value as a ${tierLabel} for ${p.Team}.`,
                    `Expect a steady diet of opportunities for ${p.Player}, who projects for ${ppg} PPG (${proj.toFixed(1)} total points).`,
                    `Navigating the middle rounds with ${p.Player} secures a functional ${tierLabel} with manageable variance.`
                ];
                narrativeBlurb = `${pickVar(solidIntros)}${pastStatsContext} ${archetypeNote}${statProof}`;
            } else if (posRank <= 36) {
                const flexIntros = [
                    `${p.Player} enters the conversation as a viable ${tierLabel} with situational starting appeal.`,
                    `Drafting ${p.Player} secures a functional ${tierLabel} who projects for ${ppg} PPG in the ${p.Team} offense.`,
                    `While he may lack elite every-week certainty, ${p.Player} provides strong ${tierLabel} value projected for ${ppg} PPG.`
                ];
                narrativeBlurb = `${pickVar(flexIntros)}${pastStatsContext} ${archetypeNote}${statProof}`;
            } else {
                if (age && age >= 30) {
                    const veteranIntros = [
                        `A seasoned veteran, ${p.Player} provides experienced depth for ${p.Team}, though his weekly ceiling may be restricted by age-related volume decline (${ppg} PPG proj).`,
                        `While long past his physical prime, ${p.Player} remains a functional piece of the ${p.Team} offense and a viable bench stash (${ppg} PPG proj).`,
                        `${p.Player} offers veteran savvy and depth for your roster, though fantasy managers should temper expectations for explosive upside (${ppg} PPG proj).`
                    ];
                    narrativeBlurb = `${pickVar(veteranIntros)}${pastStatsContext} ${archetypeNote}${statProof}`;
                } else {
                    const depthIntros = [
                        `${p.Player} fits the mold of an upside bench stash on ${p.Team}.`,
                        `Drafting ${p.Player} is a bet on contingent volume and match-up-dependent flexibility (${ppg} PPG proj).`,
                        `${p.Player} enters the year as a depth option with potential for expanded usage should injury strike.`
                    ];
                    narrativeBlurb = `${pickVar(depthIntros)}${pastStatsContext} ${archetypeNote}${statProof}`;
                }
            }
        }

        // -------------------------------------------------------------
        // DYNAMIC BULL CASE (PROS)
        // -------------------------------------------------------------
        let pros = [];
        let hasDepthChartPro = false;

        let isReceivingSpecialist = (p.targetShare && p.targetShare >= 10) || (p.pastStats && p.pastStats.rec >= 35);
        let isGoalLineVulture = (p.rzAtt && p.rzAtt >= 25) || (p.pastStats && p.pastStats.rushTd >= 8);

        if (isOffense) {
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
                    pros.push(`<strong>Superstar Production:</strong> Delivered an elite <strong>${p.pastPpg.toFixed(1)} PPG</strong> in 2025, anchoring fantasy lineups.`);
                } else if (p.pastPpg && p.pastPpg >= 14.5) {
                    pros.push(`<strong>Proven High-End Output:</strong> Delivered a strong <strong>${p.pastPpg.toFixed(1)} PPG</strong> in 2025.`);
                }

                // Tiered Ground Efficiency
                if (pos === 'RB' && ps.rushYpa && ps.rushYpa >= 5.2 && ps.rushAtt >= 100) {
                    pros.push(`<strong>Hyper-Efficient Rusher:</strong> Averaged a staggering <strong>${ps.rushYpa.toFixed(1)} YPC</strong> on ${ps.rushAtt} carries last season.`);
                } else if (pos === 'RB' && ps.rushYpa && ps.rushYpa >= 4.7 && ps.rushAtt >= 100) {
                    pros.push(`<strong>High Ground Efficiency:</strong> Averaged a stellar <strong>${ps.rushYpa.toFixed(1)} YPC</strong> on ${ps.rushAtt} carries last season.`);
                }

                // Positive TD Regression (RB)
                const touches = (ps.rushAtt || 0) + (ps.rec || 0);
                if (pos === 'RB' && touches >= 100 && ps.totalTd !== undefined) {
                    const tdRate = ps.totalTd / touches;
                    if (tdRate <= 0.01) {
                        pros.push(`<strong>Massive TD Regression Candidate:</strong> Scored only ${ps.totalTd} TDs on an absurd ${touches} touches last year. Scoring output is mathematically guaranteed to bounce back.`);
                    } else if (tdRate <= 0.02) {
                        pros.push(`<strong>Positive TD Regression Candidate:</strong> Scored just ${ps.totalTd} TDs on ${touches} touches last year. Expect better end-zone luck this season.`);
                    }
                }

                // Positive TD Regression (WR/TE)
                if (['WR', 'TE'].includes(pos) && (Number(ps.targets) || 0) >= 60) {
                    const recTd = Number(ps.recTd) || 0;
                    const targets = Number(ps.targets) || 1;
                    const tdRate = recTd / targets;
                    if (tdRate <= 0.01) {
                        pros.push(`<strong>Massive TD Regression Candidate:</strong> Caught only ${recTd} TDs on ${targets} targets last year. Scoring output is mathematically guaranteed to positively regress.`);
                    } else if (tdRate <= 0.03) {
                        pros.push(`<strong>Positive TD Regression Candidate:</strong> Caught only ${recTd} TDs on ${targets} targets last year. Expect scoring output to bounce back toward league averages.`);
                    }
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
                pros.push(`<strong>Elite High-Value Opportunities:</strong> Generates massive usage with <strong>${hvoPerGame.toFixed(1)} HVO per game</strong> (Receptions + RZ carries). This is the exact role that prints top-5 RB seasons.`);
            } else if (hvoPerGame >= 3.8) {
                pros.push(`<strong>High-Value Opportunities:</strong> Secures highly profitable touches with <strong>${hvoPerGame.toFixed(1)} combined receptions & RZ carries per game</strong>.`);
            }

            // Committee RB Strengths
            if (pos === 'RB' && p.snapShare && p.snapShare >= 40 && p.snapShare <= 65) {
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

            if (p._addedPPW && p._addedPPW >= 1.0) {
                pros.push(`<strong>Elite Lineup Difference Maker:</strong> Adds a massive +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
            } else if (p._addedPPW && p._addedPPW >= 0.3 && !p._byeFillWeek) {
                pros.push(`<strong>Lineup Difference Maker:</strong> Adds +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
            }

            if (p.isRBStarter && p.handcuffName) {
                pros.push(`<strong>Clear Backfield Lead:</strong> Uncontested RB1 status with a designated handcuff (${p.handcuffName}).`);
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
                pros.push(`<strong>Run-Heavy Offense:</strong> Operating in a run-first system ensures a massive baseline of rushing attempts and positive game scripts to churn out the clock.`);
            }
            if (pos === 'RB' && rushEnv && rushEnv.ybcAtt >= 2.9) {
                pros.push(`<strong>Elite YBC Scheme Boost:</strong> Elite run-blocking scheme generates ${rushEnv.ybcAtt} Yards Before Contact (YBC) per carry, giving him massive open space before taking a hit.`);
            } else if (pos === 'RB' && rushEnv && rushEnv.ybcAtt >= 2.6) {
                pros.push(`<strong>YBC Scheme Boost:</strong> Run-blocking scheme generates ${rushEnv.ybcAtt} Yards Before Contact (YBC) per carry.`);
            }

            if (isRookieOrYoung && posRank <= 36) {
                pros.push(`<strong>Fresh Legs & Youth Ceiling:</strong> At just ${pAge} years old, enters the season with high-end athletic potential and minimal NFL workload wear.`);
            }
        }

        if (isDST && p.stats) {
            const ds = p.stats;
            if (ds.sack && ds.sack >= 50) pros.push(`<strong>Fearsome Pass Rush:</strong> Generated a league-wrecking <strong>${ds.sack} sacks</strong> last season.`);
            else if (ds.sack && ds.sack >= 40) pros.push(`<strong>Elite Pass Rush:</strong> Generated a massive <strong>${ds.sack} sacks</strong> last season.`);

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

        if (p.bmi && p.bmi >= 31.5 && p.Pos === 'RB') {
            let hMatch = String(p.height).match(/(\d+)['\-]+(\d+)/);
            let formattedH = hMatch ? `${hMatch[1]}'${hMatch[2]}"` : (!isNaN(p.height) ? `${Math.floor(p.height / 12)}'${p.height % 12}"` : p.height);
            pros.push(`<strong>Elite Power Profile:</strong> At ${formattedH} and ${p.weight} lbs, possesses prototypical workhorse size and short-yardage gravity.`);
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

                // 2. Tiered Durability Concerns
                if (games <= 8 && games > 0) {
                    cons.push(`<strong>Severe Durability Risk:</strong> Missed over half the season, playing only <strong>${games} games</strong>. Staying on the field is a major question mark.`);
                    riskScore += 3;
                } else if (games <= 12 && games > 0) {
                    cons.push(`<strong>Durability Risk:</strong> Missed significant time last season, playing only <strong>${games} games</strong>. Injury variance lowers his floor.`);
                    riskScore += 2;
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

                // 7. Tiered TD Regression Warning (RB)
                if (pos === 'RB' && totalTouches >= 100) {
                    const totalTd = Number(ps.totalTd) || 0;
                    const tdRate = totalTd / totalTouches;
                    const isTrueGoalLineWorkhorse = (p.rzAtt && p.rzAtt >= 25);

                    if (tdRate >= 0.12 && !isTrueGoalLineWorkhorse) {
                        cons.push(`<strong>Extreme TD Regression Warning:</strong> Scored ${totalTd} TDs on ${totalTouches} touches (${(tdRate * 100).toFixed(1)}% TD rate). This is mathematically unsustainable.`);
                        riskScore += 2;
                    } else if (tdRate >= 0.085 && !isTrueGoalLineWorkhorse) {
                        cons.push(`<strong>TD Regression Warning:</strong> Scored ${totalTd} TDs on ${totalTouches} touches (${(tdRate * 100).toFixed(1)}% TD rate). Sustaining this TD efficiency without a massive red-zone role may be difficult.`);
                        riskScore += 1;
                    }
                }

                // 8. Tiered TD Regression Warning (WR/TE)
                if (['WR', 'TE'].includes(pos) && (Number(ps.targets) || 0) >= 60) {
                    const recTd = Number(ps.recTd) || 0;
                    const targets = Number(ps.targets) || 1;
                    const tdRate = recTd / targets;

                    if (tdRate >= 0.15) {
                        cons.push(`<strong>Extreme TD Regression:</strong> Caught ${recTd} TDs on just ${targets} targets (${(tdRate * 100).toFixed(1)}% rate). This scoring pace is practically impossible to sustain.`);
                        riskScore += 2;
                    } else if (tdRate >= 0.10) {
                        cons.push(`<strong>Unsustainable TD Efficiency:</strong> Caught ${recTd} TDs on ${targets} targets (${(tdRate * 100).toFixed(1)}% TD/target rate). Expect TD output to regress toward league averages.`);
                        riskScore += 1;
                    }
                }
            }

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

            let teamTopTargetShare = Math.max(...State.allPlayers.filter(x => x._cleanTeam === tTeam).map(x => x.targetShare || 0));

            if (['WR', 'TE'].includes(pos) && teamTopTargetShare > 0 && teamTopTargetShare < 20.0 && (!p.targetShare || p.targetShare < 20.0)) {
                cons.push(`<strong>Lack of Alpha Target Share:</strong> The offensive system spreads the ball evenly across multiple receivers (no player on the team commands a 20%+ target share). This lack of a concentrated alpha role creates volatile weekly floors.`);
                riskScore += 1;
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

            if (['WR', 'TE'].includes(pos) && offensePace === 'run-heavy') {
                cons.push(`<strong>Low-Volume Passing Attack:</strong> Playing in a <strong>run-heavy offense</strong> severely limits the overall passing pie, mathematically capping his week-to-week target ceiling.`);
                riskScore += 1;
                hasLowVolumeCon = true;
            }
            if (pos === 'RB' && offensePace === 'pass-heavy' && (!p.targetShare || p.targetShare < 5)) {
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
                cons.push(`<strong>Low Target Efficiency:</strong> Generated only <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season.`);
                riskScore += 1;
            }

            if (p.dropRate && p.dropRate >= 10.0) {
                cons.push(`<strong>Stone Hands:</strong> Plagued by an awful <strong>${p.dropRate.toFixed(1)}% drop rate</strong>, which threatens his standing on the depth chart.`);
                riskScore += 2;
            } else if (p.dropRate && p.dropRate >= 7.0) {
                cons.push(`<strong>Elevated Drop Rate:</strong> Posted a high <strong>${p.dropRate.toFixed(1)}% drop rate</strong> on catchable targets.`);
                riskScore += 1;
            }

            if (p.pressureRate && p.pressureRate > 27.0) {
                if (p.olTier === 'S' || p.olTier === 'A') {
                    cons.push(`<strong>Holds the Ball Too Long:</strong> Faced a catastrophic <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong> despite elite O-Line play. He frequently creates his own pressure by failing to process quickly.`);
                } else {
                    cons.push(`<strong>Under Constant Siege:</strong> Faced a catastrophic <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong>. Offensive line play completely derails his timing.`);
                }
                riskScore += 2;
            } else if (p.pressureRate && p.pressureRate > 22.0) {
                if (p.olTier === 'S' || p.olTier === 'A') {
                    cons.push(`<strong>Slow Processor:</strong> Faced a high <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong> despite strong blocking, indicating he holds the ball too long.`);
                } else {
                    cons.push(`<strong>Pressure Vulnerability:</strong> Faced a high <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong> in the pocket.`);
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
                let bustTolerance = p.Pos === 'WR' ? 28 : (p.Pos === 'QB' ? 18 : 22);
                if (p.boomBust.bust > bustTolerance) {
                    let excessBust = p.boomBust.bust - bustTolerance;
                    cons.push(`<strong>🚨 High Bust Volatility:</strong> Busted in <strong>${p.boomBust.bust}%</strong> of games last season (exceeds ${p.Pos} baseline tolerance of ${bustTolerance}%).`);
                    riskScore += excessBust >= 10 ? 2 : 1;
                }
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
                let hasModerateReceiving = (p.targetShare && p.targetShare >= 5) || (p.pastStats && p.pastStats.rec >= 20);

                if (pos === 'RB' && (!p.hvo || p.hvo < 40) && !hasScriptDependencyCon && !hasModerateReceiving) {
                    cons.push(pickVar([
                        `<strong>Game-Script Dependency:</strong> Lacks pass-game work; vulnerable if ${p.Team} falls behind.`,
                        `<strong>Script Sensitivity:</strong> Production drops if negative game scripts force ${p.Team} to pass.`
                    ]));
                    riskScore += 1;
                } else if (['WR', 'TE'].includes(pos) && (!p.targetShare || p.targetShare < 18)) {
                    let hasBuriedCon = p.depthChart && p.depthChart >= 3;
                    if (!hasBuriedCon) {
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

        // 🚑 INJURY CHECKS (MUST BE BEFORE RISK BADGE EVALUATION)
        if (p.injuryStatus) {
            if (['Out', 'IR', 'PUP'].includes(p.injuryStatus)) {
                cons.push(`<strong>Currently Injured (${p.injuryStatus}):</strong> Expected to miss significant time. Drafting him requires stash capacity and patience.`);
                riskScore += 2;
            } else if (['Questionable', 'Doubtful'].includes(p.injuryStatus)) {
                cons.push(`<strong>Currently ${p.injuryStatus}:</strong> Dealing with an active injury designation leading into the season.`);
                riskScore += 1;
            }
        }

        if (cons.length === 0) {
            cons.push(`<strong>Standard Game-Flow Variance:</strong> Subject to standard week-to-week game script fluctuations.`);
        }

        // 🛡️ RISK BADGE (DECLARED ONCE HERE)
        let riskBadge = `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">🛡️ LOW RISK</span>`;
        if (riskScore >= 6) riskBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">🚨 HIGH RISK</span>`;
        else if (riskScore >= 4) riskBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">⚠️ ELEVATED RISK</span>`;
        else if (riskScore >= 2) riskBadge = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">⚡ MODERATE RISK</span>`;

        // -------------------------------------------------------------
        // RANGE OF OUTCOMES
        // -------------------------------------------------------------
        let varianceSpread = 0.22; // Neutral baseline spread

        // 1. Role & Archetype Volatility
        if (p.isRBHandcuff) varianceSpread += 0.08;
        if (p._isFlyer) varianceSpread += 0.04;

        // 2. Continuous Age Volatility (Decays smoothly from 21yo to 24yo)
        if (pAge && pAge <= 24) {
            varianceSpread += (25 - pAge) * 0.025; // 21yo = +0.10, 22yo = +0.075, 24yo = +0.025
        }

        // 3. Continuous Depth of Target (aDOT) Volatility
        if (p.aDOT) {
            // Neutral aDOT baseline is 9.5 yds. Downfield routes = wider variance; short routes = tight PPR floor
            let aDotDelta = p.aDOT - 9.5;
            varianceSpread += (aDotDelta * 0.012); 
        }

        // 4. Continuous Target Share Stability (Higher Share = Tightened Floor)
        if (p.targetShare && ['WR', 'TE', 'RB'].includes(pos)) {
            if (p.targetShare > 12.0) {
                varianceSpread -= Math.min(0.08, (p.targetShare - 12.0) * 0.004); 
            }
        }

        // 5. Continuous QB Rushing Mobility
        if (pos === 'QB' && p.stats && p.stats.rushAtt) {
            varianceSpread += Math.min(0.10, (p.stats.rushAtt / 100) * 0.07); 
        }

        // 6. Safe Floor Qualifier Adjustment
        if (p._isSafeFloor) varianceSpread -= 0.03;

        // 7. Historical Boom / Bust Continuous Scaling
        if (p.boomBust && p.boomBust.games >= 4) {
            let bb = p.boomBust;
            let sampleWeight = Math.min(1.0, bb.games / 12);
            let bustTolerance = pos === 'WR' ? 28 : (pos === 'QB' ? 18 : 22);
            let top12Baseline = pos === 'QB' ? 58 : (pos === 'TE' ? 42 : 48);

            // High bust rate widens the spread (lowers floor)
            if (bb.bust > bustTolerance) {
                varianceSpread += ((bb.bust - bustTolerance) * 0.005) * sampleWeight;
            }
            // High Top-12 rate tightens the spread (raises floor)
            if (bb.top12 > top12Baseline) {
                varianceSpread -= ((bb.top12 - top12Baseline) * 0.003) * sampleWeight;
            }
        }

        // Final Bounds Safety Check
        varianceSpread = Math.max(0.08, Math.min(0.55, varianceSpread));

        let baselinePpg = Number(ppg) || 0;
        let floorPpg = (baselinePpg * Math.max(0.40, 1 - varianceSpread)).toFixed(1);

        // Ceiling PPG scales dynamically off varianceSpread and the continuous upsideScore
        let maxMultiplier = 1 + varianceSpread;
        if (p.upsideScore > 0 && p.AdvVBD > 0) {
            let ratio = p.upsideScore / p.AdvVBD;
            if (Number.isFinite(ratio) && ratio > 1.0) {
                maxMultiplier = Math.max(maxMultiplier, ratio);
            }
        }

        let ceilingPpg = (baselinePpg * maxMultiplier).toFixed(1);

        // Market Value Check
        let marketValueHTML = "";
        if (p.adp) {
            const diff = p.adp - overallRank;
            if (diff >= 12) {
                marketValueHTML = `<div class="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-200">🔥 <strong>Market Value Steal:</strong> Ranked #<strong>${overallRank}</strong> overall in VBD, but drafted later at ADP #<strong>${p.adp.toFixed(0)}</strong> (+${diff.toFixed(0)} draft value).</div>`;
            } else if (diff <= -12) {
                marketValueHTML = `<div class="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-200">⚠️ <strong>Market Premium / Reach:</strong> Current ADP (#<strong>${p.adp.toFixed(0)}</strong>) requires drafting him ahead of his #<strong>${overallRank}</strong> VBD Rank.</div>`;
            }
        }

        return `
            <div class="space-y-4 text-xs leading-relaxed">
                <!-- Executive Summary Box -->
                <div class="bg-indigo-950 text-indigo-100 p-4 rounded-xl border border-indigo-800 shadow-sm">
                    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
                        <div class="flex items-center space-x-2">
                            <span class="font-extrabold text-white text-sm uppercase tracking-wider">${posRankStr} (${tierLabel})</span>
                            <span class="bg-indigo-800/80 text-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">Rank #${overallRank} Overall</span>
                        </div>
                        <div>${riskBadge}</div>
                    </div>
                    <p class="text-indigo-200 text-xs leading-relaxed mt-1">
                        ${narrativeBlurb}
                    </p>
                </div>

                <!-- Inherited Role & Scheme Analysis -->
                ${inheritedContextHTML}

                <!-- Market Value Check -->
                ${marketValueHTML}

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

        // Environmental Badges
        if (isOffense) {
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
            if (p.olTier === 'S' || p.olTier === 'A') {
                envBadges.push(`<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">🛡️ Elite O-Line (Tier ${p.olTier})</span>`);
            } else if (p.olTier === 'D' || p.olTier === 'F') {
                envBadges.push(`<span class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">⚠️ Poor O-Line (Tier ${p.olTier})</span>`);
            }
        }

        let envBadgesHTML = envBadges.length > 0 ? `<div class="flex flex-wrap gap-2 mb-2">${envBadges.join('')}</div>` : '';

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
            if (p.airYards) barHTML += buildBar('Total Air Yards', p.airYards, 2000, ' yds', 'amber');
            if (p.yacAtt) barHTML += buildBar('Yards After Contact', p.yacAtt, 4, ' yds', 'purple');
            if (p.brokenTackles) barHTML += buildBar('Broken Tackles', p.brokenTackles, 30, '', 'red');
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
            let volumeStr = '';
            let tdCount = ps.totalTd || 0;

            if (p.Pos === 'QB') {
                volumeStr = `${ps.passYds || 0} Pass Yds (${ps.passTd || 0} TD / ${ps.int || 0} INT) • ${ps.rushYds || 0} Rush Yds (${ps.rushTd || 0} TD)`;
            } else if (p.Pos === 'RB') {
                volumeStr = `${ps.rushYds || 0} Rush Yds (${ps.rushTd || 0} TD) • ${ps.rec || 0}/${ps.targets || 0} Rec (${ps.recYds || 0} Yds, ${ps.recTd || 0} TD)`;
            } else if (['WR', 'TE'].includes(p.Pos)) {
                volumeStr = `${ps.rec || 0}/${ps.targets || 0} Rec (${ps.recYds || 0} Yds, ${ps.recTd || 0} TD)${ps.targetShare ? ` [${ps.targetShare}% Tgt Share]` : ''}`;
                if (ps.rushYds && ps.rushYds > 0) volumeStr += ` • ${ps.rushYds} Rush Yds`;
            } else if (p.Pos === 'DST') {
                let turnovers = (ps.defInt || 0) + (ps.defFum || 0);
                let tds = (ps.defTd || 0) + (ps.spcTd || 0);
                volumeStr = `${ps.sack || 0} Sacks • ${turnovers} Turnovers Forced • ${tds} Def TDs`;
            } else if (p.Pos === 'PK') {
                volumeStr = `${ps.fgTotal || 0} FGs Made • ${ps.xp || 0} PATs Made`;
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
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rush Yds / YPC</span> ${s.rushYds} yds <span class="text-emerald-600 font-bold">(${(s.rushYds / s.rushAtt).toFixed(1)} YPC)</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rush TDs</span> ${s.rushTd} TD</div>
                    ` : ''}

                    ${s.targets > 0 ? `
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Receiving Vol</span> ${s.rec} Rec / ${s.targets} Tgt</div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rec Yds / YPR</span> ${s.recYds} yds <span class="text-indigo-600 font-bold">(${s.recAvg} YPR)</span></div>
                        <div><span class="font-bold text-gray-400 block text-[10px] uppercase">Rec TDs</span> ${s.recTd} TD</div>
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
                        <span class="block text-[10px] text-indigo-200 mt-1">${(s.defInt || 0) + (s.defFum || 0)} Turnovers | ${s.papg || 18.0} PAPG</span>
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
        if (p.isRBStarter && p.handcuffName) {
            handcuffBadge = `<span class="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">🛡️ Handcuff: ${p.handcuffName}</span>`;
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
                <div class="mb-3">${envBadgesHTML}${ppwBadge}</div>
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

        displayList.forEach(p => {
            // Tier Drop-off Logic (Only show when sorting by VBD and no search filters applied)
            let currentVBD = p.AdvVBD || p.VBD;
            let isTierDrop = previousVBD !== null && (previousVBD - currentVBD >= 18.0);
            previousVBD = currentVBD;

            if (isTierDrop && (State.draftSortKey === 'AdvVBD' || !State.draftSortKey) && !search && !filterPos) {
                htmlStr += `<tr><td colspan="10" class="px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold text-center border-y border-rose-200 tracking-widest uppercase">⬇️ Significant Value Drop-Off ⬇️</td></tr>`;
            }

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


            let ppwVal = (p._addedPPW !== undefined && p._addedPPW > 0) ? p._addedPPW : 0;
            let ppwStr = '';
            if (ppwVal >= 1.0 || (ppwVal > 0 && !p._byeFillWeek)) {
                ppwStr = `<span class="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">+${ppwVal.toFixed(2)}/wk</span>`;
            } else if (p._byeFillWeek) {
                ppwStr = `<span class="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">Wk ${p._byeFillWeek} Fill</span>`;
            } else {
                ppwStr = `<span class="text-gray-300 text-[10px] font-mono">0.00</span>`;
            }
            let isOffense = !['DST', 'PK'].includes(p.Pos);
            let ageStr = p.age ? `<span class="text-[9px] font-semibold text-slate-400 ml-1">Age ${p.age}</span>` : '';
            let olBadge = (isOffense && p.olTier) ? `<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">OL ${p.olTier}</span>` : '';
            let sosBadge = p.avgStars ? `<span class="ml-1 inline-flex items-center text-[10px] font-bold text-amber-500">⭐ ${p.avgStars.toFixed(1)}</span>` : '';

            // --- ADD INJURY BADGE ---
            let injBadge = '';
            if (p.injuryStatus) {
                let abbr = p.injuryStatus === 'Questionable' ? 'Q' : (p.injuryStatus === 'Doubtful' ? 'D' : p.injuryStatus);
                let color = ['Out', 'IR', 'PUP'].includes(p.injuryStatus) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                injBadge = `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${color}">${abbr}</span>`;
            }

            htmlStr += `
                <tr class="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer" onclick="if (!event.target.closest('.draft-btn')) UI.showPlayerCard('${p._cleanName}')">
                    <td class="px-2 py-2 text-center text-[10px] leading-tight">
                        <span class="font-extrabold text-gray-900">#${p.ovrRank}</span><br>
                        <span class="font-bold text-gray-400">${p.posRank}</span>
                    </td>
                    <td class="px-3 py-2 text-[11px] font-bold text-gray-900 min-w-[200px]">
                        <div class="flex items-center">
                            <span>${p.Player}</span>
                            <span class="font-normal text-gray-400 ml-1.5">${p.Team}</span>
                            ${ageStr} ${olBadge} ${sosBadge}
                        </div>
                        ${tagHTML}
                    </td>
                    <td class="px-2 py-2 text-center text-[11px] text-gray-600 font-medium">${p.Pos}</td>
                    <td class="px-2 py-2 text-right text-[11px] font-bold text-indigo-600">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-2 py-2 text-right text-[11px] font-extrabold text-indigo-900">${(p.AdvVBD || p.VBD).toFixed(1)}</td>
                    <td class="px-2 py-2 text-center text-[11px]">${ppwStr}</td>
                    <td class="px-2 py-2 text-center text-[11px] text-gray-600">${adpStr}</td>
                    <td class="px-2 py-2 text-center text-[11px] text-gray-600">${byeStr}</td>
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
            if (!adp) return 1.0;
            let diff = adp - nextUserOverallPick;
            let slope = Math.max(0.04, 0.30 - (currentRound * 0.015));
            return 1 / (1 + Math.exp(-slope * diff));
        };

        // ===========================================================
        // PRE-LOOP: EVALUATE TEAM NEEDS & STRATEGY
        // ===========================================================
        let userRoster = userTeam.roster;
        let earlyRBs = userRoster.filter(p => p.Pos === 'RB' && (p.draftPickNum || 99) <= 60).length;
        let earlyWRs = userRoster.filter(p => p.Pos === 'WR' && (p.draftPickNum || 99) <= 60).length;

        let strategyBanner = "";
        let buildStrategy = "Balanced";

        // Determine Roster Strategy Build
        if (currentRound <= 7) {
            if (earlyRBs === 0 && userRoster.length >= 2) {
                buildStrategy = "Zero-RB";
                strategyBanner = `<div class="p-2 mb-2 bg-indigo-950 border border-indigo-700 rounded-lg text-[10px] text-indigo-200">🛡️ <strong>Zero-RB Build:</strong> Target WR/TE depth. Avoid early RBs and look for high-HVO passing RBs in Rnds 7-10.</div>`;
            } else if (earlyRBs === 1 && earlyWRs >= 2) {
                buildStrategy = "Hero-RB";
                strategyBanner = `<div class="p-2 mb-2 bg-emerald-950 border border-emerald-700 rounded-lg text-[10px] text-emerald-200">🦸 <strong>Hero-RB Build:</strong> Anchor RB locked. Focus heavily on WR/TE value before filling RB2.</div>`;
            } else if (earlyRBs >= 3) {
                buildStrategy = "Robust-RB";
                strategyBanner = `<div class="p-2 mb-2 bg-amber-950 border border-amber-700 rounded-lg text-[10px] text-amber-200">💪 <strong>Robust-RB Build:</strong> RB foundation set. Heavily target WR/TE depth to balance roster.</div>`;
            }
        }

        let userQBs = userRoster.filter(r => r.Pos === 'QB');

        // Calculate Tier Drops
        ['RB', 'WR', 'TE', 'QB'].forEach(pos => {
            let tiers = State.getPositionalTiers(pos);
            if (tiers.length > 0 && tiers[0].length === 1) {
                let lastPlayer = tiers[0][0];
                let nextTop = tiers[1] ? (tiers[1][0].AdvVBD || tiers[1][0].VBD) : 0;
                let drop = ((lastPlayer.AdvVBD || lastPlayer.VBD) - nextTop);
                if (drop >= 6.0) {
                    lastPlayer._tierCliffTag = `⚡ Last Tier 1 ${pos}`;
                }
            }
        });

        // Filter valid players
        let viablePlayers = State.availablePlayers.filter(p => {
            let pos = p.Pos;
            if (['PK', 'DST'].includes(pos) && currentRound <= totalRounds - 3) return false;

            let posRoster = State.settings.roster[pos];
            let starterMax = posRoster ? posRoster.max : 1;

            if (userTeam.counts[pos] < starterMax) return true;
            if (['RB', 'WR'].includes(pos) && userTeam.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) return true;
            if (['RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) return true;
            if (['QB', 'RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) return true;
            if (userTeam.counts['Bench'] < State.settings.roster.Bench.max) return true;
            return false;
        });

        // Helper to scale positive and negative scores accurately
        const applyFactor = (s, f) => s >= 0 ? s * f : (f >= 1 ? s / f : s * (1 / f));

        // ===========================================================
        // LOOP: EVALUATE INDIVIDUAL PLAYERS
        // ===========================================================
        viablePlayers.forEach(p => {
            let score = p.AdvVBD || p.VBD;

            // 1. Urgency / ADP Check (Dampened if a superior player exists at the same position)
            if (score > 0) {
                let survivalProb = getSurvivalProb(p.adp);
                let urgency = 1 - survivalProb;

                // Don't let ADP urgency force a lower-projecting player over a better player at the same position
                let betterSamePosPlayer = viablePlayers.find(other => 
                    other.Pos === p.Pos && 
                    (other.AdvVBD || other.VBD) > (p.AdvVBD || p.VBD) && 
                    (other._addedPPW || 0) >= (p._addedPPW || 0)
                );
                if (betterSamePosPlayer) urgency *= 0.15; // Suppress urgency boost

                // REPLACE THIS LINE: score += (score * 0.25 * urgency);
                let urgencyBoost = Math.min(8.0, score * 0.10 * urgency);
                score += urgencyBoost;
            }

            // 2. QB/Pass-Catcher Stacking (Tiered by Receiver Quality)
            let matchingQB = userQBs.find(qb => qb._cleanTeam === p._cleanTeam);
            let userReceivers = userRoster.filter(r => ['WR', 'TE'].includes(r.Pos));
            let matchingReceiver = userReceivers.find(r => r._cleanTeam === p._cleanTeam);

            if (matchingQB && ['WR', 'TE'].includes(p.Pos) && score > 0) {
                // Base 5% boost. Scales up to 15-20% based on Target Share or Depth Chart.
                let stackBoost = 1.05;
                if (p.targetShare) stackBoost += (Math.min(30, p.targetShare) * 0.005); 
                else if (p.depthChart === 1) stackBoost += 0.10;
                else if (p.depthChart === 2) stackBoost += 0.05;
                
                score = applyFactor(score, stackBoost);
                p._stackPartner = matchingQB.Player;
            } else if (matchingReceiver && p.Pos === 'QB' && score > 0) {
                // NEW: Reverse Stack - Boost QB if we already have his elite weapon
                let stackBoost = 1.10; 
                score = applyFactor(score, stackBoost);
                p._stackPartner = matchingReceiver.Player;
            } else {
                p._stackPartner = null;
            }

            // 3. Late-Round Upside Shift
            if (currentRound >= 9) {
                let upsideWeight = Math.min(1.0, (currentRound - 8) * 0.15);
                let floorWeight = 1.0 - upsideWeight;

                let floorScore = score;
                let ceilingScore = p.upsideScore || score;
                score = (floorScore * floorWeight) + (ceilingScore * upsideWeight);

                if (p.Pos !== 'PK' && p.Pos !== 'DST') {
                    if (p.isRBHandcuff || (p.age && p.age <= 22)) {
                        score += (currentRound * 0.8);
                    }
                }
            } else if (p.upsideScore && (p.AdvVBD || p.VBD) > 0) {
                let ceilingGain = (p.upsideScore - (p.AdvVBD || p.VBD)) * 0.25;
                score += Math.max(0, ceilingGain);
            }

            // 3.5 STRATEGY MATHEMATICAL ENFORCEMENT (ADP-Aware)
            if (currentRound <= 6) {
                let isSlippingValue = p.adp && (currentOverallPick - p.adp >= 10);
                let adpBuffer = isSlippingValue ? 1.35 : 1.0;

                let needsRB2 = userTeam.counts['RB'] < (State.settings.roster.RB?.max || 2);
                let needsBothRBs = userTeam.counts['RB'] === 0;
                let wrStarterSlotsFull = (userTeam.counts['WR'] + userTeam.counts['Flex']) >= 3;

                if (buildStrategy === 'Zero-RB') {
                    // Stop penalizing RBs in Round 5+ if WR starters are full or user has 0 RBs
                    let penalizeRB = (currentRound <= 4) || (currentRound <= 6 && !needsBothRBs && !wrStarterSlotsFull);
                    if (['WR', 'TE', 'QB'].includes(p.Pos) && !wrStarterSlotsFull) score = applyFactor(score, 1.25);
                    if (p.Pos === 'RB' && penalizeRB) score = applyFactor(score, 0.40 * adpBuffer);
                } else if (buildStrategy === 'Hero-RB') {
                    // Stop penalizing RBs in Round 5+ if RB2 is needed or WR starter slots are full
                    let penalizeRB = (currentRound <= 4) && !needsRB2;
                    if (p.Pos === 'RB' && penalizeRB) score = applyFactor(score, 0.60 * adpBuffer);
                    if (['WR', 'TE'].includes(p.Pos) && currentRound <= 4) score = applyFactor(score, 1.15);
                } else if (buildStrategy === 'Robust-RB') {
                    if (['WR', 'TE'].includes(p.Pos)) score = applyFactor(score, 1.30);
                }
            }

            // 4. Positional Safety Deficit & Continuous Portfolio Balancing
            p._rosterContextBadge = null;
            let posMax = State.settings.roster[p.Pos]?.max || 1;
            let posSafeCount = userRoster.filter(r => r.Pos === p.Pos && r._isSafeFloor).length;
            let posSafetyDeficit = Math.max(0, (posMax - posSafeCount) / posMax);

            if (currentRound >= 3 && currentRound <= 11) {
                let contextMultiplier = 1.0;
                if (p._isSafeFloor && posSafetyDeficit > 0) {
                    contextMultiplier += (posSafetyDeficit * 0.22);
                    p._rosterContextBadge = `🛡️ Safe ${p.Pos} Floor (Needs ${p.Pos} Safety)`;
                }
                if (p._isFlyer && posSafetyDeficit < 0.5) {
                    contextMultiplier += ((1.0 - posSafetyDeficit) * 0.18);
                    if (!p._rosterContextBadge) p._rosterContextBadge = `🚀 ${p.Pos} Upside Flyer (${p.Pos} Floor Secured)`;
                }
                score = applyFactor(score, contextMultiplier);
            }

            // 5. Roster Limit / Overage Penalties
            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 0;
            let totalPosCount = userRoster.filter(r => r.Pos === p.Pos).length;
            let currentCount = userTeam.counts[p.Pos] || 0;

            let isStarterOpen = currentCount < starterMax;
            let isFlexRBWROpen = ['RB', 'WR'].includes(p.Pos) && (userTeam.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0));
            let isFlexOpen = ['RB', 'WR', 'TE'].includes(p.Pos) && (userTeam.counts['Flex'] < (State.settings.roster.Flex?.max || 0));
            let isSuperflexOpen = ['QB', 'RB', 'WR', 'TE'].includes(p.Pos) && (userTeam.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0));

            if (!isStarterOpen && !(isFlexRBWROpen || isFlexOpen || isSuperflexOpen)) {
                let overage = totalPosCount - starterMax;
                let penalty = State.isPositionFlexEligible(p.Pos)
                    ? Math.pow(0.5, overage + 1)
                    : (overage === 0 ? 0.05 : 0.01);

                score = applyFactor(score, penalty);
            }

            // 6. Handcuff Starter Bonus & Bye Week Penalty
            let userOwnsStarter = p.starterName && userRoster.some(r => r._cleanName === State.normalizeName(p.starterName));
            
            // REMOVE THIS LINE: if (userOwnsStarter) score += 5;

            if (['QB', 'TE', 'PK', 'DST'].includes(p.Pos) && userTeam.counts[p.Pos] >= 1) {
                const starter = userRoster.find(r => r.Pos === p.Pos);
                if (starter && starter.byeWeek === p.byeWeek && p.byeWeek !== 'N/A') {
                    let draftProgress = Math.min(1.0, currentRound / totalRounds);
                    let byePenalty = 0.50 + (draftProgress * 0.35); 
                    score = applyFactor(score, byePenalty);
                }
            }

            // 7. Late-Round Sleeper & Handcuff Badges (Rounds 8+, Scaled by Round)
            p._sleeperBadge = null;
            if (currentRound >= 8 && ['RB', 'WR', 'TE', 'QB'].includes(p.Pos)) {
                let roundScale = Math.min(1.0, (currentRound - 7) * 0.25);

                if (userOwnsStarter) {
                    // REPLACE THIS LINE: score += (22.0 * roundScale);
                    score += (12.0 * roundScale);
                    p._sleeperBadge = `🔒 Handcuff for ${p.starterName}`;
                } else if (p.isRBHandcuff) {
                    // REPLACE THIS LINE: score += (14.0 * roundScale);
                    score += (8.0 * roundScale);
                    p._sleeperBadge = `🎲 Lottery Ticket (${p.starterName}'s Backup)`;
                } else if (p.age && p.age <= 22) {
                    score += (10.0 * roundScale);
                    p._sleeperBadge = `🌱 Rookie Breakout (Age ${p.age})`;
                } else if (p.targetShare && p.targetShare >= 15.0) {
                    score += (8.0 * roundScale);
                    p._sleeperBadge = `🎯 ${p.targetShare}% Target Share Sleeper`;
                } else if (p.aDOT && p.aDOT >= 12.0) {
                    score += (8.0 * roundScale);
                    p._sleeperBadge = `🚀 Deep Threat (${p.aDOT} aDOT)`;
                }
                
                let playerAge = p.age || p.Age;
                if (playerAge && playerAge <= 24 && !p._sleeperBadge) {
                    score += (6.0 * roundScale);
                    p._sleeperBadge = `🌱 Youth Breakout (Age ${playerAge})`;
                }
            }

            // --- NEW: PLAYOFF MATCHUP TIEBREAKER (WEEKS 15-17) ---
            if (p.playoffSOS && p.playoffSOS >= 4.0) {
                score += 4.5;
                if (!p._sleeperBadge && currentRound >= 8) {
                    p._sleeperBadge = `🏆 Soft Playoff Schedule (⭐${p.playoffSOS.toFixed(1)})`;
                }
            } else if (p.playoffSOS && p.playoffSOS <= 2.0) {
                score -= 3.0;
            }

            p._recScore = score;
        });

        // ===========================================================
        // POST-LOOP: SORT AND DEDICATE SLOTS (Caps Kicker/DST to 1 Slot Max)
        // ===========================================================
        let needsPK = userTeam.counts['PK'] < (State.settings.roster.PK?.max || 1);
        let needsDST = userTeam.counts['DST'] < (State.settings.roster.DST?.max || 1);

        let skillPlayers = viablePlayers.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.Pos))
            .sort((a, b) => b._recScore - a._recScore);

        let kDstPlayers = viablePlayers.filter(p => ['PK', 'DST'].includes(p.Pos))
            .sort((a, b) => b._recScore - a._recScore);

        let finalRecs = [];

        // 1. Fill top 3 slots with skill position sleepers first (keeps #1 spot for skill players)
        for (let p of skillPlayers) {
            if (finalRecs.length >= 3) break;
            if (!finalRecs.includes(p)) finalRecs.push(p);
        }

        // 2. Add 1 K/DST slot in position #4 in late rounds (R13+)
        if ((needsPK || needsDST) && kDstPlayers.length > 0 && currentRound >= totalRounds - 3) {
            if (!finalRecs.includes(kDstPlayers[0])) finalRecs.push(kDstPlayers[0]);
        }

        // 3. Failsafe fill to 4 total recommendations
        for (let p of [...viablePlayers].sort((a, b) => b._recScore - a._recScore)) {
            if (finalRecs.length >= 4) break;
            if (!finalRecs.includes(p)) finalRecs.push(p);
        }

        let bestFit = finalRecs[0];
        let vbdRecs = finalRecs.slice(1, 4);

        let htmlStr = strategyBanner;

        if (bestFit) {
            let ppwText = '';
            if (bestFit._addedPPW >= 1.0 || (bestFit._addedPPW > 0 && !bestFit._byeFillWeek)) {
                ppwText = `+${bestFit._addedPPW.toFixed(2)} PPW`;
            } else if (bestFit._byeFillWeek) {
                ppwText = `Wk ${bestFit._byeFillWeek} Bye Fill`;
            } else {
                ppwText = `Flex Depth`;
            }
            let stackBadge = bestFit._stackPartner ? ` • ⚡ Stack w/ ${bestFit._stackPartner}` : '';

            // Dynamic Context / Upside Badges for Best Fit
            let cliffBadge = '';
            if (bestFit._rosterContextBadge) cliffBadge = ` • <span class="text-amber-200 font-bold">${bestFit._rosterContextBadge}</span>`;
            else if (bestFit._tierCliffTag) cliffBadge = ` • <span class="text-amber-200 font-bold">${bestFit._tierCliffTag}</span>`;
            else if (currentRound >= 9 && bestFit._ceilingTags && bestFit._ceilingTags.length > 0) cliffBadge = ` • <span class="text-amber-200 font-bold">🚀 Upside: ${bestFit._ceilingTags.join(' & ')}</span>`;

            htmlStr += `
            <div class="p-3 bg-gradient-to-br from-emerald-700 to-teal-900 rounded-xl border border-emerald-500/50 flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition mb-2" onclick="UI.showPlayerCard('${bestFit._cleanName}')">
                <div>
                    <span class="text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 mb-1 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Best Lineup Addition
                    </span>
                    <h4 class="font-bold text-sm text-white">${bestFit.Player}</h4>
                    <p class="text-[10px] text-emerald-100 font-medium">${bestFit.Pos} • ${ppwText}${stackBadge}${cliffBadge}</p>
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

            // ⚡ Full Decision Tree (Context Badges + Tier Cliffs + Stacks + Urgency + Need)
            let highlight = '';
            if (p._rosterContextBadge) highlight = `<span class="text-amber-300 font-bold">${p._rosterContextBadge}</span>`;
            else if (p._tierCliffTag) highlight = `<span class="text-amber-300 font-bold">${p._tierCliffTag}</span>`;
            else if (p._stackPartner) highlight = `⚡ Stack with ${p._stackPartner}`;
            else if (currentRound >= 9 && p._ceilingTags && p._ceilingTags.length > 0) highlight = `🚀 Upside: ${p._ceilingTags.join(' & ')}`;
            else if (survivalProb < 0.15 && (isStarterNeeded || hasPositiveValue)) highlight = `⚡ High Urgency (Gone by Pick ${nextUserOverallPick})`;
            else if (p.adp && (p.adp < currentOverallPick)) highlight = `ADP Value (Passed ADP ${p.adp.toFixed(0)})`;
            else if (isStarterNeeded) highlight = `Strong Team Need`;
            else highlight = `Flex / Bench Depth`;

            let ppwVal = '';
            if (p._addedPPW >= 1.0 || (p._addedPPW > 0 && !p._byeFillWeek)) {
                ppwVal = `+${p._addedPPW.toFixed(2)}/wk`;
            } else if (p._byeFillWeek) {
                ppwVal = `Wk ${p._byeFillWeek} Fill`;
            } else {
                let vbdVal = (p.AdvVBD || p.VBD).toFixed(1);
                ppwVal = `${vbdVal >= 0 ? '+' : ''}${vbdVal} VBD`;
            }

            return `
            <div class="p-3 bg-indigo-800/80 rounded-xl border border-indigo-700/50 flex justify-between items-center shadow-inner cursor-pointer hover:bg-indigo-700 transition mb-2" onclick="UI.showPlayerCard('${p._cleanName}')">
                <div>
                    <h4 class="font-bold text-xs text-white">${bestFit ? i + 2 : i + 1}. ${p.Player} <span class="text-[10px] font-normal text-indigo-300">(${p.Team})</span></h4>
                    <p class="text-[10px] text-indigo-200 font-medium mt-0.5">${p.Pos} • ${highlight}${stackBadge}</p>
                </div>
                <div class="text-right shrink-0 ml-2">
                    <span class="text-[10px] font-extrabold text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-2 py-0.5 rounded shadow-sm">${ppwVal}</span>
                </div>
            </div>`;
        }).join('');

        State.currentRecommendations = finalRecs;

        if (finalRecs.length > 1) {
            htmlStr += `
            <button onclick="Compare.showComparison()" class="w-full mt-3 py-2.5 bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/50 rounded-xl text-xs font-bold text-indigo-200 transition-colors flex items-center justify-center gap-2 shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                Compare Recommendations
            </button>`;
        }

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