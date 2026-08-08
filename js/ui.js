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

        const isOffense = ['QB', 'RB', 'WR', 'TE'].includes(pos);
        const isDST = pos === 'DST';
        const isPK = pos === 'PK';

        // -------------------------------------------------------------
        // INHERITED ROLE & SCHEME CONTEXT (Rookies & Team Changers)
        // -------------------------------------------------------------
        let inheritedContextHTML = "";

        // Robust team normalization matcher (Fixes ARI vs ARZ bug)
        const teamDist = State.teamTargetsMap ? State.teamTargetsMap[tTeam] : null;
        const rushEnv = State.teamAdvRush ? State.teamAdvRush[tTeam] : null;
        const passEnv = State.teamAdvPass ? State.teamAdvPass[tTeam] : null;

        // Fail-safe trigger: Rookie (Age <= 22), isNewRole flag, No 2025 games, or Top 2 Depth Chart
        const pAge = p.age || p.Age;
        const isRookieOrYoung = pAge && pAge <= 22;
        const hasNoPastStats = !p.pastStats || !p.pastStats.gp || p.pastStats.gp === 0;
        const isTargetRole = p.isNewRole || isRookieOrYoung || hasNoPastStats || (p.depthChart && p.depthChart <= 2);

        if (isTargetRole) {
            let roleTitle = (p.isNewRole || isRookieOrYoung || hasNoPastStats)
                ? `📋 Inherited Role & Opportunity Analysis (${p.Team})`
                : `🔄 Team Scheme & Volume Context (${p.Team})`;

            let opportunityBullets = [];

            if (pos === 'RB') {
                if (teamDist && teamDist['RB %']) {
                    let rbPct = teamDist['RB %'];
                    let rbTgts = teamDist['RB Targets'] || 0;
                    let totalTgts = teamDist['Total Targets'] || 0;
                    opportunityBullets.push(`<strong>Pass-Game Funnel:</strong> ${p.Team}'s scheme funneled <strong>${rbPct}% of total passes</strong> (${rbTgts} targets out of ${totalTgts}) to running backs last season.`);
                }
                if (rushEnv && rushEnv.ybcAtt) {
                    let blockingQuality = rushEnv.ybcAtt >= 2.6 ? "High-Quality" : (rushEnv.ybcAtt <= 2.0 ? "Struggling" : "Average");
                    opportunityBullets.push(`<strong>Blocking Environment:</strong> ${p.Team} generated <strong>${rushEnv.ybcAtt} Yards Before Contact</strong> per carry (${blockingQuality} run-blocking scheme).`);
                }
                if (opportunityBullets.length === 0) {
                    opportunityBullets.push(`<strong>Inherited Workload:</strong> ${p.Player} enters the ${p.Team} backfield as a primary workload candidate.`);
                }
            } else if (['WR', 'TE'].includes(pos)) {
                if (teamDist && teamDist[`${pos} %`]) {
                    let posPct = teamDist[`${pos} %`];
                    let posTgts = teamDist[`${pos} Targets`] || 0;
                    let totalTgts = teamDist['Total Targets'] || 0;
                    opportunityBullets.push(`<strong>Positional Target Funnel:</strong> ${p.Team}'s offense funneled <strong>${posPct}% of total team targets</strong> (${posTgts} targets out of ${totalTgts}) to ${pos}s last season.`);
                }
                if (passEnv && passEnv.playActionYds) {
                    opportunityBullets.push(`<strong>Play-Action Scheme:</strong> ${p.Team} generated <strong>${passEnv.playActionYds} passing yards off Play-Action</strong>.`);
                }
                if (opportunityBullets.length === 0) {
                    opportunityBullets.push(`<strong>Target Opportunity:</strong> ${p.Player} enters the ${p.Team} passing attack with starting route potential.`);
                }
            } else if (pos === 'QB') {
                if (passEnv && passEnv.pktTime) {
                    opportunityBullets.push(`<strong>Pocket Protection:</strong> ${p.Team}'s offensive line allowed <strong>${passEnv.pktTime}s pocket time</strong> with a <strong>${passEnv.prssPct}% pressure rate</strong> last season.`);
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
        // 0. DETERMINISTIC SEED HASH (Varied phrasing per player)
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
        // 1. POSITIONAL RANK & ULTRA-ELITE CHECK
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
        // 2. PLAYER ARCHETYPE DETECTION
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
            if (p.stats && p.stats.rushAtt >= 60) {
                archetypeNote = pickVar([
                    "His Konami-code rushing floor provides week-winning stability regardless of passing script.",
                    "Dual-threat mobility gives him a massive fantasy foundation that pure pocket passers can't match.",
                    "Designed rushing opportunities elevate his weekly floor into elite territory."
                ]);
            } else {
                archetypeNote = pickVar([
                    "As a pocket passer, his upside relies heavily on passing volume, TD efficiency, and line protection.",
                    "Lacking high-volume rushing stats, his fantasy floor is tied directly to passing volume and red-zone conversions.",
                    "He relies on sharp pocket execution and high completion rates to fuel his fantasy production."
                ]);
            }
        } else if (pos === 'RB') {
            if (p.hvo && p.hvo >= 70) {
                archetypeNote = pickVar([
                    "Dominating high-value opportunities (receiving work + red-zone carries), his role is tailored for fantasy success.",
                    "His monopoly over money touches—receptions and inside-the-10 carries—makes him a usage monster.",
                    "He captures the coveted dual-threat RB role, taking pass-game targets alongside goal-line work."
                ]);
            } else if (p.targetShare && p.targetShare >= 12) {
                archetypeNote = pickVar([
                    "His pass-catching involvement builds a resilient PPR floor even when negative game scripts limit carries.",
                    "Passive receiving work elevates his floor, making him script-independent in high-scoring games.",
                    "Operating as a receiving outlet gives him steady week-in, week-out PPR value."
                ]);
            } else {
                archetypeNote = pickVar([
                    "His fantasy production relies heavily on positive game scripts, rushing volume, and touchdown conversions.",
                    "Operating primarily as an early-down grinder, his floor requires sustained lead-state game scripts.",
                    "He relies on ground volume and goal-line conversions to carry his fantasy output."
                ]);
            }
        } else if (pos === 'WR') {
            if (p.targetShare && p.targetShare >= 23) {
                archetypeNote = pickVar([
                    "Demanding alpha target share, he functions as the undeniable focal point of his team's air attack.",
                    "As a true high-volume target magnet, he commands the passing game with bulletproof opportunity.",
                    "His heavy target command builds an elite PPR foundation that few defenses can disrupt."
                ]);
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
            if (posRank <= 6 || (p.targetShare && p.targetShare >= 18)) {
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

        // -------------------------------------------------------------
        // 3. DYNAMIC SCOUTING NARRATIVE WITH 2025 ACTUALS
        // -------------------------------------------------------------
        let pastStatsContext = "";
        if (p.pastStats && p.pastPpg > 0 && (isOffense || isDST)) {
            const ps = p.pastStats;
            const totalTds = isDST ? ((ps.defTd || 0) + (ps.spcTd || 0)) : (ps.totalTd || 0);
            const tdText = isDST ? `${totalTds} DEF/ST TDs` : `${totalTds} total TDs`;
            const pronoun = isDST ? "They are" : "He is";
            pastStatsContext = ` ${pronoun} coming off a 2025 campaign averaging <strong>${p.pastPpg.toFixed(1)} PPG</strong> over ${ps.gp || 17} games (${tdText}).`;
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
                narrativeBlurb = `${pickVar(ultraIntros)}${pastStatsContext} ${archetypeNote} Fantasy managers can construct rosters around his bulletproof baseline.`;
            } else if (posRank <= 12) {
                const starterIntros = [
                    `${p.Player} headlines the ${p.Team} skill group as a high-end ${tierLabel} candidate.`,
                    `Locking in ${p.Player} gives fantasy managers a foundational weekly starter projected for ${ppg} PPG.`,
                    `The ${p.Team} offense relies heavily on ${p.Player}, positioning him firmly in the ${tierLabel} tier.`
                ];
                narrativeBlurb = `${pickVar(starterIntros)}${pastStatsContext} ${archetypeNote}`;
            } else if (posRank <= 24) {
                const solidIntros = [
                    `${p.Player} offers reliable weekly starting value as a ${tierLabel} for ${p.Team}.`,
                    `Expect a steady diet of opportunities for ${p.Player}, who projects for ${ppg} PPG (${proj.toFixed(1)} total points).`,
                    `Navigating the middle rounds with ${p.Player} secures a functional ${tierLabel} with manageable variance.`
                ];
                narrativeBlurb = `${pickVar(solidIntros)}${pastStatsContext} ${archetypeNote}`;
            } else {
                if (age && age >= 30) {
                    const veteranIntros = [
                        `A seasoned veteran, ${p.Player} provides experienced depth for ${p.Team}, though his weekly ceiling may be restricted by age-related volume decline (${ppg} PPG proj).`,
                        `While long past his physical prime, ${p.Player} remains a functional piece of the ${p.Team} offense and a viable bench stash (${ppg} PPG proj).`,
                        `${p.Player} offers veteran savvy and depth for your roster, though fantasy managers should temper expectations for explosive upside (${ppg} PPG proj).`
                    ];
                    narrativeBlurb = `${pickVar(veteranIntros)}${pastStatsContext} ${archetypeNote}`;
                } else {
                    const depthIntros = [
                        `${p.Player} fits the mold of an upside bench stash on ${p.Team}.`,
                        `Drafting ${p.Player} is a bet on contingent volume and match-up-dependent flexibility (${ppg} PPG proj).`,
                        `${p.Player} enters the year as a depth option with potential for expanded usage should injury strike.`
                    ];
                    narrativeBlurb = `${pickVar(depthIntros)}${pastStatsContext} ${archetypeNote}`;
                }
            }
        }

        // -------------------------------------------------------------
        // 4. CASUAL METRIC PRIMER
        // -------------------------------------------------------------
        let metricGuideHTML = "";
        if (pos === 'RB') {
            metricGuideHTML = `
                <div class="bg-slate-100 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-700">
                    <h5 class="font-bold text-slate-900 mb-1">💡 Fantasy Primer for RBs:</h5>
                    <p>In fantasy, Running Backs earn 2–3x more points on <strong>receptions</strong> and <strong>red-zone carries</strong> than empty carries between the 20s (called <strong>High-Value Opportunities / HVO</strong>). A top <strong>O-Line Tier</strong> grants yards before contact so the RB isn't hit behind the line.</p>
                </div>`;
        } else if (pos === 'WR') {
            metricGuideHTML = `
                <div class="bg-slate-100 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-700">
                    <h5 class="font-bold text-slate-900 mb-1">💡 Fantasy Primer for WRs:</h5>
                    <p>Wide Receiver success relies on <strong>Target Share</strong> (% of team passes aimed at him) and <strong>aDOT</strong> (Average Depth of Target). High Target Share builds a safe PPR floor, while high aDOT fuels explosive touchdown ceiling.</p>
                </div>`;
        } else if (pos === 'QB') {
            metricGuideHTML = `
                <div class="bg-slate-100 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-700">
                    <h5 class="font-bold text-slate-900 mb-1">💡 Fantasy Primer for QBs:</h5>
                    <p>Rushing is the cheat code—10 rushing yards equals 25 passing yards. High <strong>Pressure Rates</strong> force bad throws/sacks, while <strong>True Accuracy</strong> keeps scoring drives alive.</p>
                </div>`;
        } else if (pos === 'TE') {
            metricGuideHTML = `
                <div class="bg-slate-100 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-700">
                    <h5 class="font-bold text-slate-900 mb-1">💡 Fantasy Primer for TEs:</h5>
                    <p>Tight Ends are scarce. Look for TEs who function as top-2 passing options on their team rather than glorified inline blocking tight ends.</p>
                </div>`;
        } else if (pos === 'DST') {
            metricGuideHTML = `<div class="bg-slate-100 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-700"><h5 class="font-bold text-slate-900 mb-1">💡 Fantasy Primer for DSTs:</h5><p>Defense scoring is highly volatile week-to-week. <strong>Sacks</strong> and <strong>Turnovers</strong> drive massive point swings; look for defenses facing bad offensive lines or rookie QBs.</p></div>`;
        }

        // -------------------------------------------------------------
        // 5. DYNAMIC BULL CASE (PROS)
        // -------------------------------------------------------------
        let pros = [];

        if (isOffense) {
            if (p.pastStats) {
                const ps = p.pastStats;
                if (ps.bigPlays && ps.bigPlays >= 12) {
                    pros.push(`<strong>Proven Explosive Playmaker:</strong> Logged <strong>${ps.bigPlays} big plays</strong> (20+ yards) last season.`);
                }
                if (p.pastPpg && p.pastPpg >= 15.0) {
                    pros.push(`<strong>Proven High-End Output:</strong> Delivered an elite <strong>${p.pastPpg.toFixed(1)} PPG</strong> in 2025.`);
                }
                if (pos === 'RB' && ps.rushYpa && ps.rushYpa >= 4.8 && ps.rushAtt >= 100) {
                    pros.push(`<strong>High Ground Efficiency:</strong> Averaged a stellar <strong>${ps.rushYpa.toFixed(1)} YPC</strong> on ${ps.rushAtt} carries last season.`);
                }
            }

            if (p.targetShare && p.targetShare >= 22) {
                pros.push(pickVar([
                    `<strong>Alpha Target Command:</strong> Soaks up a dominant ${p.targetShare}% target share in the passing attack.`,
                    `<strong>Target Magnet:</strong> Vacuuming up ${p.targetShare}% of team pass attempts as the focal point.`
                ]));
            }
            if (p.hvo && p.hvo >= 70) {
                pros.push(pickVarShift([
                    `<strong>High-Value Opportunities:</strong> Generates elite goal-line & receiving usage (${p.hvo} HVO).`,
                    `<strong>Money-Touch Monopoly:</strong> Dominates high-leverage touches with ${p.hvo} combined receptions & RZ carries.`
                ], 1));
            }
            if (p.olTier === 'S' || p.olTier === 'A') {
                pros.push(pickVarShift([
                    `<strong>Elite Trench Protection:</strong> Operates behind a top-tier Tier ${p.olTier} Offensive Line.`
                ], 2));
            }
            if (p.aDOT && p.aDOT >= 12) {
                pros.push(pickVarShift([
                    `<strong>Deep Threat Upside:</strong> High ${p.aDOT} aDOT creates explosive chunk-play potential.`
                ], 3));
            }
            if (p.avgStars && p.avgStars >= 3.3) {
                pros.push(`<strong>Soft Overall Schedule:</strong> Favorable ${p.avgStars.toFixed(2)}/5.0 Strength of Schedule rating.`);
            }
            if (p.snapShare && p.snapShare >= 75) {
                pros.push(`<strong>Workhorse Snap Share:</strong> On the field for ${p.snapShare.toFixed(0)}% of offensive snaps.`);
            }
            if (p._addedPPW && p._addedPPW >= 0.3 && !p._byeFillWeek) {
                pros.push(`<strong>Lineup Difference Maker:</strong> Adds +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
            }
            if (p.isRBStarter && p.handcuffName) {
                pros.push(`<strong>Clear Backfield Lead:</strong> Uncontested RB1 status with designated handcuff (${p.handcuffName}).`);
            }

            const passEnv = State.teamAdvPass ? State.teamAdvPass[tTeam] : null;
            const rushEnv = State.teamAdvRush ? State.teamAdvRush[tTeam] : null;
            if (pos === 'RB' && rushEnv && rushEnv.ybcAtt >= 2.8) pros.push(`<strong>YBC Scheme Boost:</strong> Blocking scheme generates ${rushEnv.ybcAtt} Yards Before Contact per carry.`);
            if (['WR', 'TE'].includes(pos) && passEnv && passEnv.playActionYds >= 950) pros.push(`<strong>Play-Action Heavy:</strong> Scheme generates ${passEnv.playActionYds} yards off play-action concepts.`);
        }

        if (isDST && p.stats) {
            const ds = p.stats;
            if (ds.sack && ds.sack >= 45) pros.push(`<strong>Elite Pass Rush:</strong> Generated a massive <strong>${ds.sack} sacks</strong> last season.`);
            const to = (ds.defInt || 0) + (ds.defFum || 0);
            if (to >= 25) pros.push(`<strong>Turnover Magnet:</strong> Forced <strong>${to} total turnovers</strong> (INTs & Fumbles) last season.`);
            if (ds.defTd && ds.defTd >= 3) pros.push(`<strong>Scoring Threat:</strong> Scored <strong>${ds.defTd} defensive touchdowns</strong> last season.`);
            if (ds.papg && ds.papg <= 19) pros.push(`<strong>Stingy Scoring Defense:</strong> Allowed just <strong>${ds.papg.toFixed(1)} Points Per Game</strong>.`);
        }

        if (isPK && p.stats) {
            if (p.stats.fgTotal && p.stats.fgTotal >= 30) pros.push(`<strong>High Volume Kicker:</strong> Made <strong>${p.stats.fgTotal} Field Goals</strong> last season.`);
        }

        if (!isOffense) {
            if (p.avgStars && p.avgStars >= 3.3) pros.push(`<strong>Soft Overall Schedule:</strong> Favorable ${p.avgStars.toFixed(2)}/5.0 Strength of Schedule rating.`);
            if (p._addedPPW && p._addedPPW >= 0.3 && !p._byeFillWeek) pros.push(`<strong>Lineup Difference Maker:</strong> Adds +${p._addedPPW.toFixed(1)} Points Per Week directly to your optimal starters.`);
        }

        if (p._byeFillWeek) {
            pros.push(`<strong>Bye Week Insurance:</strong> Provides a critical +${p._byeFillPts.toFixed(1)} point boost during Week ${p._byeFillWeek}.`);
        }

        if (pros.length === 0) pros.push("Solid baseline candidate with standard positional volume.");

        // -------------------------------------------------------------
        // 6. DYNAMIC BEAR CASE (CONS - NEGATIVE STATS & RISKS)
        // -------------------------------------------------------------
        let cons = [];
        let riskScore = 0;

        if (isOffense) {
            if (p.pastStats) {
                const ps = p.pastStats;
                let totalTouches = (ps.rushAtt || 0) + (ps.rec || 0);

                // 1. The Curse of 300 Touches
                if (p.Pos === 'RB' && totalTouches >= 300) {
                    cons.push(`<strong>The '300-Touch' Curse:</strong> Logged a grueling ${totalTouches} touches last season. Running backs historically suffer sharp efficiency drops or injuries the year following a 300+ touch workload.`);
                    riskScore += 2;
                }

                // 2. Durability Concerns
                if (ps.gp && ps.gp < 12) {
                    cons.push(`<strong>Durability Risk:</strong> Missed significant time last season, playing only <strong>${ps.gp} games</strong>. Injury variance lowers his floor.`);
                    riskScore += 2;
                }

                if (pos === 'QB' && ps.int && ps.int >= 10) { cons.push(`<strong>Turnover Concerns:</strong> Threw <strong>${ps.int} interceptions</strong> last season.`); riskScore += 1; }
                if (ps.fum && ps.fum >= 3) { cons.push(`<strong>Ball Security Issues:</strong> Coughed up <strong>${ps.fum} fumbles lost</strong> last season.`); riskScore += 1; }
                if (pos === 'RB' && ps.rushYpa && ps.rushYpa < 3.8 && ps.rushAtt && ps.rushAtt >= 80) { cons.push(`<strong>Low Ground Efficiency:</strong> Averaged just <strong>${ps.rushYpa.toFixed(1)} YPC</strong> last season.`); riskScore += 1; }
                if (p.pastPpg && (p.pastPpg - Number(ppg)) >= 3.0) { cons.push(`<strong>Expected Production Regression:</strong> 2026 projection (${ppg} PPG) marks a notable step back from last year's output (${p.pastPpg.toFixed(1)} PPG).`); riskScore += 1; }
            }
            if (pos === 'QB' && p.trueAccuracy && p.trueAccuracy < 64.0) { cons.push(`<strong>Sub-Par Pass Accuracy:</strong> True Accuracy rating sits at a low <strong>${p.trueAccuracy.toFixed(1)}%</strong>.`); riskScore += 1; }
            if (['WR', 'TE'].includes(pos) && p.ypt && p.ypt < 7.0) { cons.push(`<strong>Low Target Efficiency:</strong> Generated only <strong>${p.ypt.toFixed(1)} Yards Per Target</strong> last season.`); riskScore += 1; }
            if (p.dropRate && p.dropRate >= 7.5) { cons.push(`<strong>Elevated Drop Rate:</strong> Posted a high <strong>${p.dropRate.toFixed(1)}% drop rate</strong> on catchable targets.`); riskScore += 1; }
            if (p.pressureRate && p.pressureRate > 22.0) { cons.push(`<strong>Pressure Vulnerability:</strong> Faced a high <strong>${p.pressureRate.toFixed(1)}% pressure rate</strong> in the pocket.`); riskScore += 1; }

            if (age) {
                if (pos === 'RB' && age >= 27) { cons.push(`<strong>Age Curve Warning:</strong> At ${age} y/o, faces steep historical efficiency decline at RB.`); riskScore += 2; }
                if (pos === 'WR' && age >= 31) { cons.push(`<strong>Veteran Age Risk:</strong> Age ${age} puts him past the peak WR productivity curve.`); riskScore += 2; }
            }
            if (p.olTier === 'D' || p.olTier === 'F') { cons.push(`<strong>Poor O-Line Environment:</strong> Struggling Tier ${p.olTier} offensive line could cap overall efficiency.`); riskScore += 1; }
            if (p.depthChart && p.depthChart > 1) { cons.push(`<strong>Depth Chart Trait:</strong> Currently slotted at Depth #${p.depthChart} on the team.`); riskScore += 1; }

            // Structural offensive risks for non-elites
            if (!isUltraElite) {
                riskScore += 1;
                if (pos === 'RB' && !p.hvo) {
                    cons.push(pickVar([
                        `<strong>Game-Script Dependency:</strong> Lacks pass-game work; vulnerable if ${p.Team} falls behind.`,
                        `<strong>Script Sensitivity:</strong> Production drops if negative game scripts force ${p.Team} to pass.`
                    ]));
                } else if (pos === 'WR' && (!p.targetShare || p.targetShare < 20)) {
                    cons.push(pickVarShift([
                        `<strong>Target Volatility:</strong> Target share isn't bulletproof; weekly floor relies on TD efficiency.`,
                        `<strong>Volume Variance:</strong> Secondary target role leaves him susceptible to low-target games.`
                    ], 1));
                } else if (pos === 'QB') {
                    cons.push(pickVar([
                        `<strong>Limited Rushing Floor:</strong> Lack of rushing mobility places heavy burden on pass volume and TDs.`,
                        `<strong>Passing-Only Floor:</strong> Lacks rushing yards to salvage bad passing performances.`
                    ]));
                } else if (pos === 'TE') {
                    cons.push(pickVar([
                        `<strong>Touchdown Dependency:</strong> Lower weekly target floor makes him prone to bust weeks without a TD.`,
                        `<strong>Volatile TE Floor:</strong> Susceptible to low target output in games where he blocks heavily.`
                    ]));
                } else if (cons.length === 0) {
                    cons.push(`<strong>Offensive Environment Variance:</strong> Floor is tied to ${p.Team}'s overall offensive pacing.`);
                }
            } else {
                if (cons.length === 0) {
                    cons.push(`<strong>Heavy Workload Wear:</strong> Extremely high usage creates standard injury and fatigue variance.`);
                }
            }
        }

        if (isDST && p.stats) {
            const ds = p.stats;
            if (ds.sack && ds.sack < 30) { cons.push(`<strong>Weak Pass Rush:</strong> Generated only <strong>${ds.sack} sacks</strong> last season.`); riskScore += 1; }
            if (ds.papg && ds.papg >= 24) { cons.push(`<strong>Vulnerable Defense:</strong> Yielded a high <strong>${ds.papg.toFixed(1)} Points Allowed Per Game</strong>.`); riskScore += 1; }
            if (!isUltraElite) cons.push(`<strong>Defensive Volatility:</strong> Defensive scoring heavily relies on opponent turnovers, making it difficult to predict week-to-week.`);
        }

        if (p.avgStars && p.avgStars <= 2.7) { cons.push(`<strong>Tough Overall Schedule:</strong> Faces a grueling ${p.avgStars.toFixed(2)}/5.0 star schedule.`); riskScore += 1; }

        let riskBadge = `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">🛡️ LOW RISK</span>`;
        if (riskScore >= 3) riskBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">⚠️ ELEVATED RISK</span>`;
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

                <!-- Inherited Role & Scheme Analysis for Rookies/Team-Changers -->
                ${inheritedContextHTML}

                <!-- Metric Educational Guide for Casuals -->
                ${metricGuideHTML}

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

        // Environmental Badges (Offense Only)
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
                <button id="btn-tab-writeup" onclick="UI.switchPlayerCardTab('writeup')" class="px-4 py-2 font-bold text-xs rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">Scout Report</button>
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
            // Tight slope in early rounds (0.25), wide/forgiving in late rounds (0.05)
            let slope = Math.max(0.04, 0.30 - (currentRound * 0.015));
            return 1 / (1 + Math.exp(-slope * diff));
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
                let drop = ((lastPlayer.AdvVBD || lastPlayer.VBD) - nextTop);
                if (drop >= 6.0) {
                    lastPlayer._tierCliffTag = `⚡ Last Tier 1 ${pos}`;
                }
            }
        });

        let viablePlayers = State.availablePlayers.filter(p => {
            let pos = p.Pos;
            if (pos === 'PK' && currentRound <= totalRounds - 3) return false;

            let posRoster = State.settings.roster[pos];
            let starterMax = posRoster ? posRoster.max : 1;

            if (userTeam.counts[pos] < starterMax) return true;
            if (['RB', 'WR'].includes(pos) && userTeam.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) return true;
            if (['RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) return true;
            if (['QB', 'RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) return true;
            if (userTeam.counts['Bench'] < State.settings.roster.Bench.max) return true;
            return false;
        });

        // User drafted QBs for Stacking Logic (Point 2)
        let userQBs = userRoster.filter(r => r.Pos === 'QB');

        viablePlayers.forEach(p => {
            // Base score relies strictly on true VBD Value (Keep negative scores negative!)
            let score = p.AdvVBD || p.VBD;

            // Add Urgency Factor (Draft Market Value) - Only for positive VBD
            if (score > 0) {
                let survivalProb = getSurvivalProb(p.adp);
                let urgency = 1 - survivalProb;
                score += (score * 0.25 * urgency);
            }

            // ===========================================================
            // POINT 2: QB-WR/TE STACKING SYNERGY BOOST
            // ===========================================================
            let matchingQB = userQBs.find(qb => qb._cleanTeam === p._cleanTeam);
            if (matchingQB && ['WR', 'TE'].includes(p.Pos) && score > 0) {
                score += Math.max(3.0, (p.AdvVBD || p.VBD) * 0.12);
                p._stackPartner = matchingQB.Player;
            } else {
                p._stackPartner = null;
            }

            // ===========================================================
            // POINT 3: LATE-ROUND CEILING / UPSIDE BOOST (Rounds 9+)
            // ===========================================================
            if (currentRound >= 9 && p.upsideScore && (p.AdvVBD || p.VBD) > 0) {
                let ceilingGain = (p.upsideScore - (p.AdvVBD || p.VBD)) * 0.75;
                score += Math.max(0, ceilingGain);
            }

            let posRoster = State.settings.roster[p.Pos];
            let starterMax = posRoster ? posRoster.max : 0;
            let currentCount = userTeam.counts[p.Pos] || 0;

            let isStarterOpen = currentCount < starterMax;
            let isFlexRBWROpen = ['RB', 'WR'].includes(p.Pos) && (userTeam.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0));
            let isFlexOpen = ['RB', 'WR', 'TE'].includes(p.Pos) && (userTeam.counts['Flex'] < (State.settings.roster.Flex?.max || 0));
            let isSuperflexOpen = ['QB', 'RB', 'WR', 'TE'].includes(p.Pos) && (userTeam.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0));

            // Restrict Bench Value
            if (!isStarterOpen && !(isFlexRBWROpen || isFlexOpen || isSuperflexOpen)) {
                let overage = currentCount - starterMax;
                let penalty = State.isPositionFlexEligible(p.Pos)
                    ? Math.pow(0.5, overage + 1)  // RBs/WRs decay slowly on bench
                    : (overage === 0 ? 0.05 : 0.01); // 2nd QBs/TEs drop heavily

                if (score > 0) {
                    score *= penalty;
                } else {
                    score /= penalty; // If score is -10, dividing by 0.05 pushes it to -200 (sending them to the bottom!)
                }
            }

            let userOwnsStarter = p.starterName && userRoster.some(r => r._cleanName === State.normalizeName(p.starterName));
            if (userOwnsStarter) score += 5;

            if (['QB', 'TE'].includes(p.Pos) && userTeam.counts[p.Pos] >= 1) {
                const starter = userRoster.find(r => r.Pos === p.Pos);
                if (starter && starter.byeWeek === p.byeWeek && p.byeWeek !== 'N/A') {
                    if (score > 0) score *= 0.5;
                    else score *= 2.0; // Pushes negative scores further down
                }
            }

            p._recScore = score;
        });

        let bestFit = [...viablePlayers]
            .filter(p => {
                let posRoster = State.settings.roster[p.Pos];
                let starterMax = posRoster ? posRoster.max : 1;
                // Exclude drafting a 2nd QB/TE/PK/DST as the "Best Addition" until Round 12
                if (['QB', 'PK', 'DST'].includes(p.Pos) && userTeam.counts[p.Pos] >= starterMax && currentRound < 12) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => b._recScore - a._recScore)[0];

        // Lower threshold so Best Fit still recommends late-round flex stashes and handcuffs
        if (bestFit && (bestFit._addedPPW || 0) <= 0.0 && !bestFit._byeFillWeek && !bestFit.starterName) {
            bestFit = null;
        }

        let sortedByRec = [...viablePlayers].sort((a, b) => b._recScore - a._recScore);
        let vbdRecs = sortedByRec.filter(p => p !== bestFit).slice(0, 3);

        let htmlStr = strategyBanner;

        if (bestFit) {
            let survivalProb = getSurvivalProb(bestFit.adp);
            let ppwText = '';
            if (bestFit._addedPPW >= 1.0 || (bestFit._addedPPW > 0 && !bestFit._byeFillWeek)) {
                ppwText = `+${bestFit._addedPPW.toFixed(2)} PPW`;
            } else if (bestFit._byeFillWeek) {
                ppwText = `Wk ${bestFit._byeFillWeek} Bye Fill`;
            } else {
                ppwText = `Flex Depth`;
            }
            let stackBadge = bestFit._stackPartner ? ` • ⚡ Stack w/ ${bestFit._stackPartner}` : '';
            let cliffBadge = bestFit._tierCliffTag ? ` • <span class="text-amber-200 font-bold">${bestFit._tierCliffTag}</span>` : '';

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

            // ⚡ Full Decision Tree (Tier Cliff + Stacks + Urgency + Need)
            let highlight = '';
            if (p._tierCliffTag) highlight = `<span class="text-amber-300 font-bold">${p._tierCliffTag}</span>`;
            else if (p._stackPartner) highlight = `⚡ Stack with ${p._stackPartner}`;
            else if (currentRound >= 9 && p.upsideScore > (p.AdvVBD || p.VBD) * 1.1) highlight = `🚀 High Ceiling Target`;
            else if (survivalProb < 0.15 && (isStarterNeeded || hasPositiveValue)) highlight = `⚡ High Urgency (Gone by Pick ${nextUserOverallPick})`;
            else if (p.adp && (p.adp < currentOverallPick)) highlight = `ADP Value (Passed ADP ${p.adp.toFixed(0)})`;
            else if (isStarterNeeded) highlight = `Strong Team Need`;
            else highlight = `Flex / Bench Depth`;

            // ⚡ Raw Points Per Week Added Badge
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
        <!-- Left Side: Rank, Player Name, Position, Strategy Tag -->
        <div>
            <h4 class="font-bold text-xs text-white">${bestFit ? i + 2 : i + 1}. ${p.Player} <span class="text-[10px] font-normal text-indigo-300">(${p.Team})</span></h4>
            <p class="text-[10px] text-indigo-200 font-medium mt-0.5">${p.Pos} • ${highlight}${stackBadge}</p>
        </div>
        
        <!-- Right Side: Lineup PPW Impact (Completes justify-between) -->
        <div class="text-right shrink-0 ml-2">
            <span class="text-[10px] font-extrabold text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-2 py-0.5 rounded shadow-sm">${ppwVal}</span>
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