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
        if (storedSidebarState === 'true') {
            sidebar.classList.add('sidebar-collapsed');
        }
        sidebarToggle.addEventListener('click', () => {
            const collapsed = sidebar.classList.toggle('sidebar-collapsed');
            localStorage.setItem('draft-pro-sidebar-collapsed', String(collapsed));
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

    async function enrichPlayerAges() {
        try {
            const cacheKey = 'sleeper_nfl_players_cache';
            const cacheTimeKey = 'sleeper_nfl_players_time';
            const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
            let data;

            if (localStorage.getItem(cacheKey) && (Date.now() - localStorage.getItem(cacheTimeKey) < cacheExpiry)) {
                data = JSON.parse(localStorage.getItem(cacheKey));
            } else {
                const response = await fetch('https://api.sleeper.app/v1/players/nfl');
                if (!response.ok) return;
                data = await response.json();
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    localStorage.setItem(cacheTimeKey, Date.now().toString());
                } catch (e) {
                    console.warn('LocalStorage quota exceeded, skipping cache');
                }
            }
            const ageMap = {};

            const normalizedAgeEntries = Object.values(data || {}).filter(entry => entry && entry.full_name);

            normalizedAgeEntries.forEach(entry => {
                const normalizedName = State.normalizeName(entry.full_name);
                const normalizedTeam = State.normalizeTeam(entry.team);
                const normalizedPos = State.normalizePos(entry.position);
                const key = `${normalizedName}::${normalizedTeam || 'NONE'}::${normalizedPos || 'NONE'}`;
                ageMap[key] = entry.age;
            });

            State.allPlayers.forEach(player => {
                if (player.age !== undefined && player.age !== null && player.age !== '') return;

                const normalizedName = State.normalizeName(player.Player);
                const normalizedTeam = State.normalizeTeam(player.Team);
                const normalizedPos = State.normalizePos(player.Pos);
                const directKey = `${normalizedName}::${normalizedTeam || 'NONE'}::${normalizedPos || 'NONE'}`;
                const fallbackKey = `${normalizedName}::${normalizedTeam || 'NONE'}::NONE`;
                const fallbackNameKey = `${normalizedName}::NONE::NONE`;

                const matchedAge = ageMap[directKey]
                    ?? ageMap[fallbackKey]
                    ?? ageMap[fallbackNameKey];

                if (matchedAge !== undefined) {
                    player.age = matchedAge;
                }
            });

            if (typeof UI.renderDatabase === 'function') UI.renderDatabase();
            if (typeof UI.renderDraftAvailablePlayers === 'function' && State.draftStarted) UI.renderDraftAvailablePlayers();
        } catch (err) {
            console.warn('Could not load player ages');
        }
    }

    window.enrichPlayerAges = enrichPlayerAges;

    async function autoLoadData() {
        const loadBtn = document.getElementById('load-data-button');
        if (loadBtn) loadBtn.textContent = "Fetching Projections & Advanced Data...";

        const fetchOpts = { cache: 'no-store' };

        try {
            const SEASON = "26";
            const PREV_SEASON = "25";

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
            await fetchTSV(`./projected_data_${SEASON}.tsv`, State.parseProjectedData.bind(State), data => State.allPlayers.push(...data));
            await fetchTSV(`./def_proj_${SEASON}.tsv`, State.parseDefData.bind(State), data => State.allPlayers.push(...data));
            await fetchTSV(`./k_proj_${SEASON}.tsv`, State.parseKickerData.bind(State), data => State.allPlayers.push(...data));

            State.enrichPlayerMap();
            //await enrichPlayerAges();

            // Load all advanced metrics concurrently
            await Promise.all([
                enrichPlayerAges(),
                fetchTSV(`./Schedule_${SEASON}.tsv`, State.parseScheduleData.bind(State)),
                fetchTSV(`./SOS_${SEASON}.tsv`, State.parseSOSData.bind(State), State.mergeSOSData.bind(State)),
                fetchTSV(`./RB_Handcuffs_${SEASON}.tsv`, State.parseHandcuffData.bind(State), State.mergeHandcuffData.bind(State)),
                fetchTSV(`./ADP_${SEASON}.tsv`, State.parseADPData.bind(State), State.mergeADPData.bind(State)),
                fetchTSV(`./DST_Data.tsv`, State.parseDSTActualsData.bind(State), State.mergeDSTActualsData.bind(State)),
                fetchTSV(`./Depth_Chart_${SEASON}.tsv`, State.parseDepthChartData.bind(State), State.mergeDepthChartData.bind(State)),
                fetchTSV(`./Snap_Count_${SEASON}.tsv`, State.parseSnapCountData.bind(State), State.mergeSnapCountData.bind(State)),
                fetchTSV(`./OL_Rank_${SEASON}.tsv`, State.parseOLRankData.bind(State), State.mergeOLRankData.bind(State)),
                fetchTSV(`./Team_Adv_Pass_${PREV_SEASON}.tsv`, State.parseTeamAdvPassData.bind(State)),
                fetchTSV(`./Team_Adv_Rush_${PREV_SEASON}.tsv`, State.parseTeamAdvRushData.bind(State)),
                fetchTSV(`./Team_Adv_Rec_${PREV_SEASON}.tsv`, State.parseTeamAdvRecData.bind(State)),
                fetchTSV(`./DraftHistory.tsv`, State.parseHistory.bind(State), () => {
                    if (typeof renderInsightsTable === "function") renderInsightsTable();
                    if (typeof UI.renderProfileAssignments === "function") UI.renderProfileAssignments();
                }),
                ...['QB', 'RB', 'WR', 'TE'].map(pos => fetchTSV(`./${pos}_Stats.tsv`, State.parseAdvancedData.bind(State), State.mergeActualStatsData.bind(State))),
                ...['QB', 'RB', 'WR', 'TE'].map(pos => fetchTSV(`./Advanced${pos}Data.tsv`, State.parseAdvancedData.bind(State), State.mergeAdvancedMetrics.bind(State))),
                fetchTSV(`./Team_Target_Dist_Data.tsv`, State.parseAdvancedData.bind(State), data => State.teamTargets = data)
            ]);

            State.calculateProjections();
            State.applyDynamicDSTSOS();
            State.calculateVBD();

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
        if (!tbody || State.teamTargets.length === 0) return;

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
        if (!tbody || State.advancedMetrics.length === 0) return;

        let sortedPlayers = [...State.advancedMetrics]
            .filter(p => p[metric] !== undefined && p[metric] !== null)
            .sort((a, b) => b[metric] - a[metric])
            .slice(0, 15);

        tbody.innerHTML = sortedPlayers.map(p => {
            let pos = p['ATT'] ? 'RB' : (p['REC'] ? 'WR/TE' : 'QB');
            let displayVal = metric === '% TM' || metric === 'TGT %' ? `${p[metric]}%` : p[metric];
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

    function renderInsightsTable() {
        const tbody = document.getElementById('insights-table-body');
        let htmlStr = '';

        Object.values(State.managerProfiles).forEach(p => {
            let stratColor = p.strategy === 'RB-Heavy' ? 'text-emerald-600' : (p.strategy === 'Zero-RB' ? 'text-indigo-600' : 'text-gray-600');
            htmlStr += `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-gray-900">${p.name}</td>
                    <td class="px-4 py-3 font-semibold ${stratColor}">${p.strategy}</td>
                    <td class="px-4 py-3 text-sm">${p.qbAvgRound.toFixed(1)} ${p.draftsEarlyQB ? '⚠️ (Early)' : ''}</td>
                    <td class="px-4 py-3 text-sm">${p.teAvgRound.toFixed(1)} ${p.draftsEarlyTE ? '⚠️ (Early)' : ''}</td>
                    <td class="px-4 py-3 text-sm">${p.pkAvgRound.toFixed(1)}</td>
                    <td class="px-4 py-3 text-sm">${p.dstAvgRound.toFixed(1)}</td>
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

        State.scoring.tePremium = parseFloat(document.getElementById('score-te-prem').value) || 0;
        State.scoring.passYds = parseFloat(document.getElementById('score-pass-yds').value) || 0.04;
        State.scoring.passTd = parseFloat(document.getElementById('score-pass-td').value) || 6;
        State.scoring.int = parseFloat(document.getElementById('score-int').value) || -2;
        State.scoring.ppr = parseFloat(document.getElementById('score-ppr').value) || 1;
        State.scoring.rushYds = parseFloat(document.getElementById('score-rush-yds').value) || 0.1;
        State.scoring.rushTd = parseFloat(document.getElementById('score-rush-td').value) || 6;
        State.scoring.recYds = parseFloat(document.getElementById('score-rec-yds').value) || 0.1;
        State.scoring.recTd = parseFloat(document.getElementById('score-rec-td').value) || 6;
        State.scoring.fumLost = parseFloat(document.getElementById('score-fum').value) || -2;
        State.scoring.fg = parseFloat(document.getElementById('score-fg').value) || 3;
        State.scoring.xp = parseFloat(document.getElementById('score-xp').value) || 1;
        State.scoring.sack = parseFloat(document.getElementById('score-sack').value) || 1;
        State.scoring.turnover = parseFloat(document.getElementById('score-turnover').value) || 2;
        State.scoring.defTd = parseFloat(document.getElementById('score-deftd').value) || 6;
        State.scoring.safety = parseFloat(document.getElementById('score-safety').value) || 2;

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

            team.roster = team.roster.filter(p => p.Player !== lastPick.player.Player);
            team.counts[lastPick.slot]--;

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