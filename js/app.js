window.appGoToSetup = function (mode) {
    document.getElementById('setting-draft-type').value = mode;
    UI.switchTab('setup-screen');
}

document.addEventListener('DOMContentLoaded', () => {

    const resolveClickTarget = (event) => {
        const target = event?.target;
        if (target instanceof Element) return target;
        if (target?.parentElement instanceof Element) return target.parentElement;
        return null;
    };

    const messageModalXClose = document.getElementById('message-modal-x-close');
    if (messageModalXClose) messageModalXClose.addEventListener('click', () => {
        const modal = document.getElementById('message-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });

    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const storedSidebarState = localStorage.getItem('draft-pro-sidebar-collapsed');

    if (sidebar && sidebarToggle) {
        const applySidebarState = (isCollapsed) => {
            sidebar.classList.toggle('sidebar-collapsed', isCollapsed);

            // Toggle Tailwind width classes
            if (isCollapsed) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-16');
            } else {
                sidebar.classList.remove('w-16');
                sidebar.classList.add('w-64');
            }

            // Toggle visibility of text titles and navigation labels
            sidebar.querySelectorAll('.nav-label, .sidebar-title').forEach(el => {
                el.classList.toggle('hidden', isCollapsed);
            });

            // Flip the toggle arrow icon
            const svgIcon = sidebarToggle.querySelector('svg');
            if (svgIcon) {
                svgIcon.classList.toggle('rotate-180', isCollapsed);
            }
        };

        // Restore saved collapsed state on load
        if (storedSidebarState === 'true') {
            applySidebarState(true);
        }

        sidebarToggle.addEventListener('click', () => {
            const isCollapsed = !sidebar.classList.contains('sidebar-collapsed');
            applySidebarState(isCollapsed);
            localStorage.setItem('draft-pro-sidebar-collapsed', String(isCollapsed));
        });
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const triggerEl = resolveClickTarget(e);
            const buttonEl = triggerEl?.closest('button');
            const target = buttonEl?.getAttribute('data-target');
            if (!target) return;

            UI.switchTab(target);

            if (target === 'insights-screen' && State.teamTargets.length > 0) {
                renderTeamInsightsChart();
            }

            if (target === 'research-screen' && window.TeamResearch) {
            TeamResearch.render();
            }
            
        });
    });

    document.querySelectorAll('.draft-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const triggerEl = resolveClickTarget(e);
            const tabButton = triggerEl?.closest('.draft-tab-btn');
            if (!tabButton) return;

            document.querySelectorAll('.draft-tab-btn').forEach(b => {
                b.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600', 'bg-white');
                b.classList.add('text-gray-500', 'hover:bg-gray-100');
            });
            tabButton.classList.remove('text-gray-500', 'hover:bg-gray-100');
            tabButton.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600', 'bg-white');

            document.querySelectorAll('.draft-tab-content').forEach(c => c.classList.add('hidden'));
            const targetContent = document.getElementById(tabButton.getAttribute('data-target'));
            if (targetContent) targetContent.classList.remove('hidden');
        });
    });

    const startBtn = document.getElementById('start-draft-btn');

    async function enrichPlayerData() {
        try {
            // Bumped cache key to ensure fresh fetch with depth chart fields
            const cacheKey = 'sleeper_nfl_players_depth_v3_cache';
            const cacheTimeKey = 'sleeper_nfl_players_time_v3';
            const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
            let minimalData = {};

            if (localStorage.getItem(cacheKey) && (Date.now() - localStorage.getItem(cacheTimeKey) < cacheExpiry)) {
                minimalData = JSON.parse(localStorage.getItem(cacheKey));
            } else {
                const response = await fetch('https://api.sleeper.app/v1/players/nfl');
                if (!response.ok) return;
                const data = await response.json();

                // ⚡ Extract physical attributes, injuries, and live Sleeper depth chart order
                Object.values(data).forEach(entry => {
                    if (entry && entry.full_name) {
                        const nName = State.normalizeName(entry.full_name);
                        const nTeam = State.normalizeTeam(entry.team);
                        const nPos = State.normalizePos(entry.position);
                        const key = `${nName}::${nTeam || 'NONE'}::${nPos || 'NONE'}`;

                        const rawDepth = entry.depth_chart_order;
                        const depthOrder = (rawDepth !== null && rawDepth !== undefined && !isNaN(rawDepth))
                            ? parseInt(rawDepth, 10)
                            : null;

                        minimalData[key] = {
                            a: entry.age,
                            h: entry.height,       // e.g. "5'10" or "6-2"
                            w: entry.weight,       // e.g. 215
                            i: entry.injury_status, // e.g. "Questionable", "Out", "IR", null
                            d: depthOrder,         // Sleeper live depth chart (1, 2, 3, etc.)
                            dp: entry.depth_chart_position || null // e.g. "QB", "RB", "LWR", "RWR", "TE"
                        };
                    }
                });

                try {
                    localStorage.setItem(cacheKey, JSON.stringify(minimalData));
                    localStorage.setItem(cacheTimeKey, Date.now().toString());
                } catch (e) {
                    console.warn('LocalStorage quota exceeded, skipping cache');
                }
            }

            State.allPlayers.forEach(player => {
                const nName = State.normalizeName(player.Player);
                const nTeam = State.normalizeTeam(player.Team);
                const nPos = State.normalizePos(player.Pos);
                const directKey = `${nName}::${nTeam || 'NONE'}::${nPos || 'NONE'}`;
                const fallbackKey = `${nName}::${nTeam || 'NONE'}::NONE`;
                const fallbackNameKey = `${nName}::NONE::NONE`;

                const match = minimalData[directKey] ?? minimalData[fallbackKey] ?? minimalData[fallbackNameKey];

                if (match) {
                    if (player.age === undefined || player.age === null || player.age === '') player.age = match.a;
                    player.height = match.h;
                    player.weight = match.w;
                    player.injuryStatus = match.i;
                    if (match.d !== null && match.d !== undefined) {
                        player.depthChart = match.d;
                    }
                    if (match.dp) {
                        player.depthChartPos = match.dp;
                    }
                }
            });

            if (typeof UI.renderDatabase === 'function') UI.renderDatabase();
            if (typeof UI.renderDraftAvailablePlayers === 'function' && State.draftStarted) UI.renderDraftAvailablePlayers();
        } catch (err) {
            console.warn('Could not load player metadata');
        }
    }

    window.enrichPlayerData = enrichPlayerData;

    async function autoLoadData() {
        const loadBtn = document.getElementById('load-data-button');
        if (loadBtn) loadBtn.textContent = "Fetching Projections & Advanced Data...";

        const fetchOpts = { cache: 'no-store' };

        try {
            const SEASON = "26";
            const PREV_SEASON = "25";
            const HIST_SEASON = "24";
            const DATA_DIR = `./data/20${SEASON}`;
            const PREV_DATA_DIR = `./data/20${PREV_SEASON}`;
            const HIST_DATA_DIR = `./data/20${HIST_SEASON}`;

            const fetchTSV = async (fileName, parser, merger) => {
                try {
                    const res = await fetch(fileName, fetchOpts);
                    if (res.ok) {
                        const parsed = parser(await res.text());
                        if (merger) merger(parsed);
                        return parsed;
                    }
                } catch (e) {
                    console.warn(`Failed to load ${fileName}`, e);
                }
            };

            // Base projections MUST load sequentially first to build the base array
            State.allPlayers = [];
            await Promise.all([
                fetchTSV(`${DATA_DIR}/QB_CBS_${SEASON}.tsv`, State.parseCBS_QB.bind(State), data => State.allPlayers.push(...data)),
                fetchTSV(`${DATA_DIR}/RB_CBS_${SEASON}.tsv`, State.parseCBS_RB.bind(State), data => State.allPlayers.push(...data)),
                fetchTSV(`${DATA_DIR}/WR_CBS_${SEASON}.tsv`, State.parseCBS_WR.bind(State), data => State.allPlayers.push(...data)),
                fetchTSV(`${DATA_DIR}/TE_CBS_${SEASON}.tsv`, State.parseCBS_TE.bind(State), data => State.allPlayers.push(...data)),
                State.fetchSleeperProjections(SEASON) // <-- PULLS DIRECTLY FROM SLEEPER API
            ]);
            State.enrichPlayerMap();
            State.buildPlayerIndex(); // Build O(1) Lookup Table

            // Load all advanced metrics concurrently (swapped to enrichPlayerData)
            await Promise.all([
                enrichPlayerData(),
                // Current Year Data (2026)
                fetchTSV(`${DATA_DIR}/Schedule_${SEASON}.tsv`, State.parseScheduleData.bind(State)),
                fetchTSV(`${DATA_DIR}/SOS_${SEASON}.tsv`, State.parseSOSData.bind(State), State.mergeSOSData.bind(State)),
                fetchTSV(`${DATA_DIR}/RB_Handcuffs_${SEASON}.tsv`, State.parseHandcuffData.bind(State), State.mergeHandcuffData.bind(State)),
                fetchTSV(`${DATA_DIR}/ADP_${SEASON}.tsv`, State.parseADPData.bind(State), State.mergeADPData.bind(State)),
                fetchTSV(`${DATA_DIR}/Depth_Chart_${SEASON}.tsv`, State.parseDepthChartData.bind(State), State.mergeDepthChartData.bind(State)),
                fetchTSV(`${DATA_DIR}/OL_Rank_${SEASON}.tsv`, State.parseOLRankData.bind(State), State.mergeOLRankData.bind(State)),

                // Draft History kept in root
                fetchTSV(`./DraftHistory.tsv`, State.parseHistory.bind(State), () => {
                    if (typeof renderInsightsTable === "function") renderInsightsTable();
                    if (typeof UI.renderProfileAssignments === "function") UI.renderProfileAssignments();
                }),

                // Previous Year Data (2025)
                fetchTSV(`${PREV_DATA_DIR}/DST_Data.tsv`, State.parseDSTActualsData.bind(State), State.mergeDSTActualsData.bind(State)),
                fetchTSV(`${PREV_DATA_DIR}/Snap_Count_${PREV_SEASON}.tsv`, State.parseSnapCountData.bind(State), State.mergeSnapCountData.bind(State)),
                ...['QB', 'RB', 'WR', 'TE'].map(pos => fetchTSV(`${PREV_DATA_DIR}/${pos}_BB_${PREV_SEASON}.tsv`, State.parseAdvancedData.bind(State), State.mergeBoomBustData.bind(State))),
                fetchTSV(`${PREV_DATA_DIR}/Team_Adv_Pass_${PREV_SEASON}.tsv`, State.parseTeamAdvPassData.bind(State)),
                fetchTSV(`${PREV_DATA_DIR}/Team_Adv_Rush_${PREV_SEASON}.tsv`, State.parseTeamAdvRushData.bind(State)),
                fetchTSV(`${PREV_DATA_DIR}/Team_Adv_Rec_${PREV_SEASON}.tsv`, State.parseTeamAdvRecData.bind(State)),
                fetchTSV(`${PREV_DATA_DIR}/Team_Target_Dist_Data.tsv`, State.parseTeamTargetDistData.bind(State), data => State.teamTargets = data),
                ...['QB', 'RB', 'WR', 'TE'].map(pos => fetchTSV(`${PREV_DATA_DIR}/${pos}_Stats.tsv`, State.parseAdvancedData.bind(State), State.mergeActualStatsData.bind(State))),
                ...['QB', 'RB', 'WR', 'TE'].map(pos => fetchTSV(`${PREV_DATA_DIR}/Advanced${pos}Data.tsv`, State.parseAdvancedData.bind(State), State.mergeAdvancedMetrics.bind(State))),

                // NEW: 2-Year Historical Actuals (2024)
                ...['QB', 'RB', 'WR', 'TE'].map(pos => fetchTSV(`${HIST_DATA_DIR}/${pos}_Stats_${HIST_SEASON}.tsv`, State.parseHistoricalStatsData.bind(State), State.merge2024StatsData.bind(State)))
            ]);

            State.calculateProjections();
            State.finalizeDepthCharts();
            State.applyDynamicDSTSOS();
            State.calculateVBD();

            if (window.TeamResearch) {
                TeamResearch.init();
            }

            if (loadBtn) {
                loadBtn.textContent = `✓ Auto-Loaded ${State.allPlayers.length} Players + Advanced Stats!`;
                loadBtn.classList.replace('bg-slate-900', 'bg-emerald-600');
                loadBtn.disabled = true;
            }

            renderTeamTargets('WR');
            renderMetricLeaders('TGT %');

            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            startBtn.disabled = false;
            startBtn.textContent = "Start Draft Engine";

            if (document.getElementById('insights-screen').classList.contains('active') && State.teamTargets.length > 0) {
                renderTeamInsightsChart();
            }

        } catch (err) {
            console.error(err);
            if (loadBtn) {
                loadBtn.textContent = "Failed to load data. Click to retry.";
                loadBtn.classList.replace('bg-slate-900', 'bg-red-600');
            }
        }
    }

    autoLoadData();
    document.getElementById('load-data-button').addEventListener('click', autoLoadData);

    function renderTeamInsightsChart() {
        if (typeof Chart === 'undefined') return;

        let ctx = document.getElementById('team-targets-chart');
        if (!ctx) {
            let container = document.getElementById('insights-screen').querySelector('.bg-white');
            if (!container) return;

            let chartDiv = document.createElement('div');
            chartDiv.innerHTML = `
                <h3 class="text-xl font-extrabold text-gray-900 mt-10 mb-4 border-t pt-8">Offensive Positional Target Distribution</h3>
                <div class="w-full h-80 relative bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <canvas id="team-targets-chart"></canvas>
                </div>`;
            container.appendChild(chartDiv);
            ctx = document.getElementById('team-targets-chart');
        }

        setTimeout(() => {
            if (window.teamTargetsChartInst) {
                window.teamTargetsChartInst.destroy();
            }

            let labels = [];
            let wrData = [], rbData = [], teData = [];

            let sorted = [...State.teamTargets].sort((a, b) => (b['WR %'] || 0) - (a['WR %'] || 0));

            sorted.forEach(t => {
                labels.push(t.Team);
                wrData.push(t['WR %'] || 0);
                rbData.push(t['RB %'] || 0);
                teData.push(t['TE %'] || 0);
            });

            window.teamTargetsChartInst = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'WR %', data: wrData, backgroundColor: 'rgba(79, 70, 229, 0.8)' },
                        { label: 'TE %', data: teData, backgroundColor: 'rgba(245, 158, 11, 0.8)' },
                        { label: 'RB %', data: rbData, backgroundColor: 'rgba(16, 185, 129, 0.8)' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { stacked: true, max: 100 }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: { label: function (context) { return context.dataset.label + ': ' + context.raw + '%'; } }
                        }
                    }
                }
            });
        }, 50);
    }

    function renderTeamTargets(position) {
        const tbody = document.getElementById('team-targets-body');
        if (!tbody || !State.teamTargets || State.teamTargets.length === 0) return;

        let sortedTeams = [...State.teamTargets].sort((a, b) => (b[`${position} %`] || 0) - (a[`${position} %`] || 0));

        tbody.innerHTML = sortedTeams.map(t => `
        <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-gray-900">${t.Team}</td>
            <td class="px-4 py-3 font-bold text-indigo-600">${t[`${position} %`]}%</td>
            <td class="px-4 py-3 text-sm text-gray-500">${t[`${position} Targets`]} / ${t['Total Targets']}</td>
        </tr>
    `).join('');
    }

    function renderMetricLeaders(metric) {
        const tbody = document.getElementById('metric-leaders-body');
        const sourcePool = (State.allPlayers && State.allPlayers.length > 0) ? State.allPlayers : State.advancedMetrics;
        if (!tbody || !sourcePool || sourcePool.length === 0) return;

        const getMetricValue = (p, m) => {
            if (m === 'TGT %' || m === '% TM') {
                return p.targetShare ?? p['TGT %'] ?? p['% TM'] ?? p.pastStats?.targetShare;
            }
            if (m === '20+Rec') {
                return p.pastStats?.bigRec ?? p['20+Rec'];
            }
            if (m === '20+Rush') {
                return p.pastStats?.bigRush ?? p['20+Rush'];
            }
            if (m === 'RZ TGT') {
                return p.rzTgt ?? p['RZ TGT'];
            }
            return p[m] ?? p.pastStats?.[m];
        };

        let sortedPlayers = [...sourcePool]
            .map(p => ({
                player: p,
                val: getMetricValue(p, metric)
            }))
            .filter(item => item.val !== undefined && item.val !== null && !isNaN(item.val) && item.val > 0)
            .sort((a, b) => b.val - a.val)
            .slice(0, 15);

        tbody.innerHTML = sortedPlayers.map(item => {
            let p = item.player;
            let val = item.val;
            let pos = p.Pos || (p['ATT'] ? 'RB' : (p['REC'] ? 'WR/TE' : 'QB'));
            let displayVal = (metric === '% TM' || metric === 'TGT %') ? `${val}%` : val;
            return `
        <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-gray-900">${p.Player}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${pos}</td>
            <td class="px-4 py-3 font-bold text-emerald-600">${displayVal}</td>
        </tr>
        `;
        }).join('');
    }

    document.addEventListener('click', (e) => {
        const triggerEl = resolveClickTarget(e);
        if (!triggerEl) return;

        if (triggerEl.classList.contains('target-tab-btn')) {
            document.querySelectorAll('.target-tab-btn').forEach(b => {
                b.classList.remove('bg-indigo-100', 'text-indigo-700');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            triggerEl.classList.remove('bg-gray-100', 'text-gray-600');
            triggerEl.classList.add('bg-indigo-100', 'text-indigo-700');
            renderTeamTargets(triggerEl.getAttribute('data-pos'));
        }

        if (triggerEl.classList.contains('metric-tab-btn')) {
            document.querySelectorAll('.metric-tab-btn').forEach(b => {
                b.classList.remove('bg-emerald-100', 'text-emerald-700');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            triggerEl.classList.remove('bg-gray-100', 'text-gray-600');
            triggerEl.classList.add('bg-emerald-100', 'text-emerald-700');
            renderMetricLeaders(triggerEl.getAttribute('data-metric'));
        }
    });

    const settingsTeams = document.getElementById('setting-teams');
    if (settingsTeams) settingsTeams.addEventListener('change', () => UI.renderProfileAssignments());
    const settingsUserPick = document.getElementById('setting-user-pick');
    if (settingsUserPick) settingsUserPick.addEventListener('change', () => UI.renderProfileAssignments());

    // FIX: Safely fallback `State.settings.numTeams` if it hasn't been instantiated yet to prevent crashing before UI start.
    const initialRound = Math.floor(State.currentPick / (State.settings.numTeams || 12)) + 1;
    const currentRoundEl = document.getElementById('current-round');
    if (currentRoundEl) currentRoundEl.textContent = initialRound;

    const currentPickEl = document.getElementById('current-pick-number');
    if (currentPickEl) currentPickEl.textContent = (State.currentPick % (State.settings.numTeams || 12)) + 1;

    const overallPickEl = document.getElementById('overall-pick-number');
    if (overallPickEl) overallPickEl.textContent = State.currentPick + 1;


    // Inside renderInsightsTable()
    function renderInsightsTable() {
        const tbody = document.getElementById('insights-table-body');
        let htmlStr = '';

        Object.values(State.managerProfiles).forEach(p => {
            let stratColor = p.strategy === 'RB-Heavy' ? 'text-emerald-600' : (p.strategy === 'Zero-RB' ? 'text-indigo-600' : 'text-gray-600');
            // NEW: Add Team Bias badge
            let biasBadge = p.teamBias !== 'None' ? `<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">${p.teamBias} Fan</span>` : '<span class="text-gray-400">None</span>';

            htmlStr += `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-gray-900">${p.name}</td>
                    <td class="px-4 py-3 font-semibold ${stratColor}">${p.strategy}</td>
                    <td class="px-4 py-3 text-sm">${p.qbAvgRound.toFixed(1)} ${p.draftsEarlyQB ? '⚠️ (Early)' : ''}</td>
                    <td class="px-4 py-3 text-sm">${p.teAvgRound.toFixed(1)} ${p.draftsEarlyTE ? '⚠️ (Early)' : ''}</td>
                    <td class="px-4 py-3 text-sm">${p.pkAvgRound.toFixed(1)}</td>
                    <td class="px-4 py-3 text-sm">${p.dstAvgRound.toFixed(1)}</td>
                    <td class="px-4 py-3">${biasBadge}</td>
                </tr>
            `;
        });
        tbody.innerHTML = htmlStr;
    }

    // 1. Settings Submit Listener
    startBtn.addEventListener('click', () => {
        State.settings.numTeams = parseInt(document.getElementById('setting-teams').value) || 12;
        State.settings.draftMode = document.getElementById('setting-draft-type').value;
        State.settings.userTeamIndex = parseInt(document.getElementById('setting-user-pick').value) || 1;

        let r = State.settings.roster;
        r.QB.max = parseInt(document.getElementById('pos-qb').value) || 1;
        r.RB.max = parseInt(document.getElementById('pos-rb').value) || 2;
        r.WR.max = parseInt(document.getElementById('pos-wr').value) || 2;
        r.TE.max = parseInt(document.getElementById('pos-te').value) || 1;
        r.FlexRBWR = { max: parseInt(document.getElementById('pos-flex-rbwr').value) || 0 };
        r.Flex = { max: parseInt(document.getElementById('pos-flex').value) || 0 };
        r.Superflex = { max: parseInt(document.getElementById('pos-superflex').value) || 0 };
        r.PK.max = parseInt(document.getElementById('pos-pk').value) || 1;
        r.DST.max = parseInt(document.getElementById('pos-dst').value) || 1;
        r.Bench.max = parseInt(document.getElementById('pos-bn').value) || 6;

        r.totalSize = r.QB.max + r.RB.max + r.WR.max + r.TE.max + r.FlexRBWR.max + r.Flex.max + r.Superflex.max + r.PK.max + r.DST.max + r.Bench.max;

        const getNum = (id, fallback) => {
            const el = document.getElementById(id);
            if (!el || el.value === '' || el.value === undefined) return fallback;
            const val = parseFloat(el.value);
            return isNaN(val) ? fallback : val;
        };

        // Primary Scoring Rules
        State.scoring.tePremium = getNum('score-te-prem', 0);
        State.scoring.passYds = getNum('score-pass-yds', 0.04);
        State.scoring.passTd = getNum('score-pass-td', 6);
        State.scoring.int = getNum('score-int', -2);
        State.scoring.ppr = getNum('score-ppr', 1);
        State.scoring.rushYds = getNum('score-rush-yds', 0.1);
        State.scoring.rushTd = getNum('score-rush-td', 6);
        State.scoring.recYds = getNum('score-rec-yds', 0.1);
        State.scoring.recTd = getNum('score-rec-td', 6);
        State.scoring.fumLost = getNum('score-fum', -2);

        // 🎛️ League Customization Toggles
        State.scoring.useMilestones = document.getElementById('toggle-milestones') ? document.getElementById('toggle-milestones').checked : true;
        State.scoring.use2pt = document.getElementById('toggle-2pt') ? document.getElementById('toggle-2pt').checked : true;
        State.scoring.useDecimalKicking = document.getElementById('toggle-decimal-kicking') ? document.getElementById('toggle-decimal-kicking').checked : true;

        // 2-Point Conversions & Milestone Bonuses (Safely falls back if inputs don't exist)
        State.scoring.pass2pt = getNum('score-pass-2pt', 2);
        State.scoring.rush2pt = getNum('score-rush-2pt', 2);
        State.scoring.rec2pt = getNum('score-rec-2pt', 2);
        State.scoring.def2ptRet = getNum('score-def-2pt', 2);
        
        State.scoring.pass300Bonus = getNum('score-pass-300', 1);
        State.scoring.pass400Bonus = getNum('score-pass-400', 3);
        State.scoring.rush100Bonus = getNum('score-rush-100', 1);
        State.scoring.rush200Bonus = getNum('score-rush-200', 3);
        State.scoring.rec100Bonus = getNum('score-rec-100', 1);
        State.scoring.rec200Bonus = getNum('score-rec-200', 3);

        // Kicker Brackets & DST
        State.scoring.fg0_29 = getNum('score-fg', 3);
        State.scoring.fg30_39 = getNum('score-fg-30-39', 3.5);
        State.scoring.fg40_49 = getNum('score-fg-40-49', 4.5);
        State.scoring.fg50_plus = getNum('score-fg-50', 5.3);
        State.scoring.xp = getNum('score-xp', 1);

        State.scoring.sack = getNum('score-sack', 1);
        State.scoring.turnover = getNum('score-turnover', 2);
        State.scoring.defTd = getNum('score-deftd', 6);
        State.scoring.safety = getNum('score-safety', 2);
        
        State.calculateProjections();
        State.applyDynamicDSTSOS();
        State.calculateVBD();
        State.initializeTeams();

        UI.switchTab('drafting-screen');
        UI.updateDraftBoard();

        if (State.settings.draftMode === 'mock') {
            AutoDraft.processQueue();
        }
    });

    // 2. Draft Button Click Slotting Handler
    document.addEventListener('click', (e) => {
        const triggerEl = resolveClickTarget(e);
        const draftBtn = triggerEl?.closest('.draft-btn');
        if (draftBtn) {
            const cleanName = draftBtn.getAttribute('data-player');
            const player = State.availablePlayers.find(p => p._cleanName === cleanName);
            if (!player) return;

            const teamId = State.draftOrder[State.currentPick];
            const team = State.teamsById[teamId];

            let slot = 'Bench';
            if (team.counts[player.Pos] < State.settings.roster[player.Pos].max) {
                slot = player.Pos;
            } else if (['RB', 'WR'].includes(player.Pos) && team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) {
                slot = 'FlexRBWR';
            } else if (['RB', 'WR', 'TE'].includes(player.Pos) && team.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) {
                slot = 'Flex';
            } else if (['QB', 'RB', 'WR', 'TE'].includes(player.Pos) && team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) {
                slot = 'Superflex';
            }

            AutoDraft.executeDraft(player, team, slot);
            UI.updateDraftBoard();

            if (State.settings.draftMode === 'mock') {
                AutoDraft.processQueue();
            }
        }
    });

    const undoPickButton = document.getElementById('undo-pick-button');
    if (undoPickButton) undoPickButton.addEventListener('click', () => {
        if (State.draftHistory.length === 0) return UI.showMessage("Error", "No picks to undo.");

        let picksToUndo = 1;

        if (State.settings.draftMode === 'mock' && State.draftHistory[State.draftHistory.length - 1].teamId !== State.userTeamId) {
            for (let i = State.draftHistory.length - 1; i >= 0; i--) {
                if (State.draftHistory[i].teamId === State.userTeamId) break;
                picksToUndo++;
            }
        }

        for (let i = 0; i < picksToUndo; i++) {
            if (State.draftHistory.length === 0) break;

            let lastPick = State.draftHistory.pop();
            let team = State.teamsById[lastPick.teamId];

            const rosterIdx = team.roster.findIndex(p => p._cleanName === lastPick.player._cleanName && p.Pos === lastPick.player.Pos);
            if (rosterIdx !== -1) team.roster.splice(rosterIdx, 1);

            team.counts[lastPick.slot] = Math.max(0, (team.counts[lastPick.slot] || 1) - 1);

            State.availablePlayers.push(lastPick.player);
            State.currentPick--;
        }

        // Fix: Force array to re-sort using the exact UI configuration the user has active
        let currentSort = State.draftSortKey || 'AdvVBD';
        let currentAsc = State.draftSortAsc;

        State.availablePlayers.sort((a, b) => {
            let valA = a[currentSort] ?? (currentSort === 'AdvVBD' ? (a.AdvVBD || a.VBD) : 0);
            let valB = b[currentSort] ?? (currentSort === 'AdvVBD' ? (b.AdvVBD || b.VBD) : 0);
            if (typeof valA === 'string') return currentAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return currentAsc ? valA - valB : valB - valA;
        });

        State.draftStarted = true;
        UI.updateDraftBoard();
    });

    const messageModalClose = document.getElementById('message-modal-close');
    if (messageModalClose) messageModalClose.addEventListener('click', () => {
        const modal = document.getElementById('message-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });

    let dbSearchTimeout;
    const dbSearch = document.getElementById('db-search');
    if (dbSearch) dbSearch.addEventListener('input', () => {
        clearTimeout(dbSearchTimeout);
        dbSearchTimeout = setTimeout(() => UI.renderDatabase(), 250);
    });

    const dbPosition = document.getElementById('db-position');
    if (dbPosition) dbPosition.addEventListener('change', () => UI.renderDatabase());

    // Draft Screen Search & Filter Handlers
    let draftSearchTimeout;
    const draftSearch = document.getElementById('draft-search');
    if (draftSearch) draftSearch.addEventListener('input', () => {
        clearTimeout(draftSearchTimeout);
        draftSearchTimeout = setTimeout(() => UI.renderDraftAvailablePlayers(), 150);
    });

    const draftPosition = document.getElementById('draft-position-filter');
    if (draftPosition) draftPosition.addEventListener('change', () => UI.renderDraftAvailablePlayers());
});
