// Helper for Home screen buttons to route properly
window.appGoToSetup = function (mode) {
    document.getElementById('setting-draft-type').value = mode;
    UI.switchTab('setup-screen');
}

document.addEventListener('DOMContentLoaded', () => {

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

    // Navigation routing
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find closest button in case SVG is clicked
            let target = e.target.closest('button').getAttribute('data-target');
            UI.switchTab(target);
        });
    });

    const startBtn = document.getElementById('start-draft-btn');

    async function enrichPlayerAges() {
        try {
            const response = await fetch('https://api.sleeper.app/v1/players/nfl');
            if (!response.ok) return;
            const data = await response.json();
            const ageMap = {};

            Object.values(data || {}).forEach(entry => {
                if (!entry || !entry.full_name) return;
                ageMap[State.normalizeName(entry.full_name)] = entry.age;
            });

            State.allPlayers.forEach(player => {
                if (!player.age && ageMap[State.normalizeName(player.Player)] !== undefined) {
                    player.age = ageMap[State.normalizeName(player.Player)];
                }
            });

            if (typeof UI.renderDatabase === 'function') UI.renderDatabase();
            if (typeof UI.renderDraftAvailablePlayers === 'function' && State.draftStarted) UI.renderDraftAvailablePlayers();
        } catch (err) {
            console.warn('Could not load player ages', err);
        }
    }

    // Auto-Load Data Function
    async function autoLoadData() {
        const loadBtn = document.getElementById('load-data-button');
        if (loadBtn) loadBtn.textContent = "Fetching Projections & Strength of Schedule...";

        try {
            // 1. Fetch Skill Players
            const offRes = await fetch('./projected_data_26.tsv');
            const offPlayers = State.parseProjectedData(await offRes.text());

            // 2. Fetch Defenses & Kickers
            let defPlayers = [], kickerPlayers = [];
            try {
                const defRes = await fetch('./def_proj_26.tsv');
                defPlayers = State.parseDefData(await defRes.text());
            } catch (e) { }

            try {
                const kRes = await fetch('./k_proj_26.tsv');
                kickerPlayers = State.parseKickerData(await kRes.text());
            } catch (e) { }

            State.allPlayers = [...offPlayers, ...defPlayers, ...kickerPlayers];

            // ⚡ RUN THE OPTIMIZER CACHE HERE ⚡
            State.enrichPlayerMap();
            await enrichPlayerAges();

            // 3. Fetch SOS Data & Merge
            try {
                const sosRes = await fetch('./SOS_26.tsv');
                const sosParsed = State.parseSOSData(await sosRes.text());
                State.mergeSOSData(sosParsed);
            } catch (e) { console.warn("Could not load SOS_26.tsv"); }

            // 4. Advanced Analytics & History
            const advFiles = ['./AdvancedQBData.tsv', './AdvancedRBData.tsv', './AdvancedWRData.tsv', './AdvancedTEData.tsv'];
            for (let file of advFiles) {
                try {
                    let advRes = await fetch(file);
                    State.mergeAdvancedMetrics(State.parseAdvancedData(await advRes.text()));
                } catch (err) { }
            }

            try {
                let tgtRes = await fetch('./Team_Target_Dist_Data.tsv');
                State.teamTargets = State.parseAdvancedData(await tgtRes.text());
            } catch (e) { }

            try {
                const adpRes = await fetch('./ADP_26.tsv');
                State.mergeADPData(State.parseADPData(await adpRes.text()));
            } catch (e) { }

            try {
                const depthRes = await fetch('./Depth_Chart_26.tsv');
                State.mergeDepthChartData(State.parseDepthChartData(await depthRes.text()));
            } catch (e) { }

            try {
                const snapRes = await fetch('./Snap_Count_26.tsv');
                State.mergeSnapCountData(State.parseSnapCountData(await snapRes.text()));
            } catch (e) { }

            try {
                const olRes = await fetch('./OL_Rank_26.tsv');
                State.mergeOLRankData(State.parseOLRankData(await olRes.text()));
            } catch (e) { console.warn('Could not load OL_Rank_26.tsv'); }

            try {
                const historyRes = await fetch('./DraftHistory.tsv');
                State.parseHistory(await historyRes.text());
                if (typeof renderInsightsTable === "function") renderInsightsTable();
                if (typeof UI.renderProfileAssignments === "function") UI.renderProfileAssignments();
            } catch (e) { }

            // Calculate Projections & VBD
            State.calculateProjections();
            State.calculateVBD();

            if (loadBtn) {
                loadBtn.textContent = `✓ Auto-Loaded ${State.allPlayers.length} Players + SOS Ratings!`;
                loadBtn.classList.replace('bg-slate-900', 'bg-emerald-600');
                loadBtn.disabled = true;
            }

            renderTeamTargets('WR');
            renderMetricLeaders('RZ TGT');

            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            startBtn.disabled = false;
            startBtn.textContent = "Start Draft";

        } catch (err) {
            console.error(err);
            if (loadBtn) {
                loadBtn.textContent = "Failed to load data. Click to retry.";
                loadBtn.classList.replace('bg-slate-900', 'bg-red-600');
            }
            UI.showMessage('Error', 'Failed to auto-load projection files.');
        }
    }

    // Call it immediately!
    autoLoadData();

    // Allow manual retry if it fails
    document.getElementById('load-data-button').addEventListener('click', autoLoadData);

    // Render Team Target Dist
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

    // Render Advanced Metric Leaders
    function renderMetricLeaders(metric) {
        const tbody = document.getElementById('metric-leaders-body');
        if (!tbody || State.advancedMetrics.length === 0) return;

        let sortedPlayers = [...State.advancedMetrics]
            .filter(p => p[metric] !== undefined && p[metric] !== null)
            .sort((a, b) => b[metric] - a[metric])
            .slice(0, 15);

        tbody.innerHTML = sortedPlayers.map(p => {
            let pos = p['ATT'] ? 'RB' : (p['REC'] ? 'WR/TE' : 'QB');
            let displayVal = metric === '% TM' ? `${p[metric]}%` : p[metric];
            return `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-gray-900">${p.Player}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${pos}</td>
                <td class="px-4 py-3 font-bold text-emerald-600">${displayVal}</td>
            </tr>
            `;
        }).join('');
    }

    // Handle Insight Tab Clicks
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('target-tab-btn')) {
            document.querySelectorAll('.target-tab-btn').forEach(b => {
                b.classList.remove('bg-indigo-100', 'text-indigo-700');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            e.target.classList.remove('bg-gray-100', 'text-gray-600');
            e.target.classList.add('bg-indigo-100', 'text-indigo-700');
            renderTeamTargets(e.target.getAttribute('data-pos'));
        }

        if (e.target.classList.contains('metric-tab-btn')) {
            document.querySelectorAll('.metric-tab-btn').forEach(b => {
                b.classList.remove('bg-emerald-100', 'text-emerald-700');
                b.classList.add('bg-gray-100', 'text-gray-600');
            });
            e.target.classList.remove('bg-gray-100', 'text-gray-600');
            e.target.classList.add('bg-emerald-100', 'text-emerald-700');
            renderMetricLeaders(e.target.getAttribute('data-metric'));
        }
    });

    // Hook up Profile Assignment Dynamic Rendering on changes
    document.getElementById('setting-teams').addEventListener('change', () => UI.renderProfileAssignments());
    document.getElementById('setting-user-pick').addEventListener('change', () => UI.renderProfileAssignments());

    // Helper to render the Insights Tab
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

    // Start Draft Engine
    startBtn.addEventListener('click', () => {
        State.settings.numTeams = parseInt(document.getElementById('setting-teams').value);
        State.settings.draftMode = document.getElementById('setting-draft-type').value;
        State.settings.userTeamIndex = document.getElementById('setting-user-pick').value;

        let r = State.settings.roster;
        r.QB.max = parseInt(document.getElementById('pos-qb').value);
        r.RB.max = parseInt(document.getElementById('pos-rb').value);
        r.WR.max = parseInt(document.getElementById('pos-wr').value);
        r.TE.max = parseInt(document.getElementById('pos-te').value);
        r.Flex.max = parseInt(document.getElementById('pos-flex').value);
        r.PK.max = parseInt(document.getElementById('pos-pk').value);
        r.DST.max = parseInt(document.getElementById('pos-dst').value);
        r.Bench.max = parseInt(document.getElementById('pos-bn').value);
        r.totalSize = r.QB.max + r.RB.max + r.WR.max + r.TE.max + r.Flex.max + r.PK.max + r.DST.max + r.Bench.max;

        // NEW: Grab user scoring settings
        State.scoring.passYds = parseFloat(document.getElementById('score-pass-yds').value);
        State.scoring.passTd = parseFloat(document.getElementById('score-pass-td').value);
        State.scoring.int = parseFloat(document.getElementById('score-int').value);
        State.scoring.ppr = parseFloat(document.getElementById('score-ppr').value);
        State.scoring.rushYds = parseFloat(document.getElementById('score-rush-yds').value);
        State.scoring.rushTd = parseFloat(document.getElementById('score-rush-td').value);
        State.scoring.recYds = parseFloat(document.getElementById('score-rec-yds').value);
        State.scoring.recTd = parseFloat(document.getElementById('score-rec-td').value);
        State.scoring.fumLost = parseFloat(document.getElementById('score-fum').value);

        // Kicker & DST
        State.scoring.fg = parseFloat(document.getElementById('score-fg').value);
        State.scoring.xp = parseFloat(document.getElementById('score-xp').value);
        State.scoring.sack = parseFloat(document.getElementById('score-sack').value);
        State.scoring.turnover = parseFloat(document.getElementById('score-turnover').value);
        State.scoring.defTd = parseFloat(document.getElementById('score-deftd').value);
        State.scoring.safety = parseFloat(document.getElementById('score-safety').value);

        // Calculate custom points and VBD right before generating the board!
        State.calculateProjections();
        State.calculateVBD();

        State.initializeTeams();
        UI.switchTab('drafting-screen');
        UI.updateDraftBoard();

        if (State.settings.draftMode === 'mock') {
            AutoDraft.processQueue();
        }
    });

    // Handle Manual Picks (User picking for themself OR User acting as tracker in Live Draft)
    document.addEventListener('click', (e) => {
        const draftBtn = e.target.closest('.draft-btn');
        if (draftBtn) {
            const cleanName = draftBtn.getAttribute('data-player');
            // Look up by the cached, lowercase, punctuation-free name (instant)
            const player = State.availablePlayers.find(p => p._cleanName === cleanName);
            if (!player) return;

            const teamId = State.draftOrder[State.currentPick];
            const team = State.teamsById[teamId];

            let slot = 'Bench';
            if (team.counts[player.Pos] < State.settings.roster[player.Pos].max) slot = player.Pos;
            else if (['RB', 'WR', 'TE'].includes(player.Pos) && team.counts['Flex'] < State.settings.roster.Flex.max) slot = 'Flex';

            AutoDraft.executeDraft(player, team, slot);
            UI.updateDraftBoard();

            if (State.settings.draftMode === 'mock') {
                AutoDraft.processQueue();
            }
        }
    });

    // Undo Pick Logic
    document.getElementById('undo-pick-button').addEventListener('click', () => {
        if (State.draftHistory.length === 0) return UI.showMessage("Error", "No picks to undo.");

        // Find last pick
        let lastPick = State.draftHistory.pop();
        let team = State.teamsById[lastPick.teamId];

        // Remove from team
        team.roster = team.roster.filter(p => p.Player !== lastPick.player.Player);
        team.counts[lastPick.slot]--;

        // Return to available players and re-sort
        State.availablePlayers.push(lastPick.player);
        State.availablePlayers.sort((a, b) => b.VBD - a.VBD); // Keep sorted high to low

        // Decrement pick counter
        State.currentPick--;
        State.draftStarted = true; // In case we undid the final pick

        UI.updateDraftBoard();

        // If mock draft, stop the bot temporarily so user can review
        if (State.settings.draftMode === 'mock' && AutoDraft.isDrafting) {
            // Let it finish its current tick, but next tick will rely on user
            console.log("Mock draft interrupted by Undo.");
        }
    });

    // Close Modals
    document.getElementById('message-modal-close').addEventListener('click', () => {
        const modal = document.getElementById('message-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });

    // DB Searching logic
    let dbSearchTimeout;
    document.getElementById('db-search').addEventListener('input', () => {
        clearTimeout(dbSearchTimeout);
        // Wait 250ms after the user stops typing to render the results
        dbSearchTimeout = setTimeout(() => UI.renderDatabase(), 250);
    });
    
    document.getElementById('db-position').addEventListener('change', () => UI.renderDatabase());
});