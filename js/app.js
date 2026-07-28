// Helper for Home screen buttons to route properly
window.appGoToSetup = function(mode) {
    document.getElementById('setting-draft-type').value = mode;
    UI.switchTab('setup-screen');
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Navigation routing
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Find closest button in case SVG is clicked
            let target = e.target.closest('button').getAttribute('data-target');
            UI.switchTab(target);
        });
    });

    // Handle Data Load (Updated to load Player Data AND League History)
    const tsvUrl = 'https://raw.githubusercontent.com/APmsj09/Fantasy_Football/main/Data.tsv';
    const startBtn = document.getElementById('start-draft-btn');
    
    document.getElementById('load-data-button').addEventListener('click', async (e) => {
        e.target.textContent = "Loading Data & AI Profiles...";
        try {
            // 1. Fetch Player Data
            const res = await fetch(tsvUrl);
            State.allPlayers = State.parseTSV(await res.text());
            
            // 2. Fetch Historical Data (Assuming it is saved locally or hosted)
            // Replace 'DraftHistory.tsv' with your actual path or URL
            try {
                const historyRes = await fetch('DraftHistory.tsv'); 
                State.parseHistory(await historyRes.text());
                renderInsightsTable(); // Call UI function
            } catch(historyErr) {
                console.warn("Could not load DraftHistory.tsv. Bots will use generic VBD.", historyErr);
            }

            UI.showMessage('Success', `Loaded ${State.allPlayers.length} players and ${Object.keys(State.managerProfiles).length} manager AI profiles!`);
            
            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            startBtn.disabled = false;
            startBtn.textContent = "Initialize Draft Board";
            e.target.textContent = "All Data Loaded!";
            e.target.classList.replace('bg-slate-900', 'bg-emerald-600');
        } catch (err) {
            UI.showMessage('Error', 'Failed to load data. Please check connection.');
            e.target.textContent = "Load Default Data";
        }
    });

    // Helper to render the Insights Tab
    function renderInsightsTable() {
        const tbody = document.getElementById('insights-table-body');
        tbody.innerHTML = '';
        
        Object.values(State.managerProfiles).forEach(p => {
            let stratColor = p.strategy === 'RB-Heavy' ? 'text-emerald-600' : (p.strategy === 'Zero-RB' ? 'text-indigo-600' : 'text-gray-600');
            tbody.innerHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-3 font-bold text-gray-900">${p.name}</td>
                    <td class="px-4 py-3 font-semibold ${stratColor}">${p.strategy}</td>
                    <td class="px-4 py-3 text-sm">${p.qbAvgRound.toFixed(1)} ${p.draftsEarlyQB ? '⚠️ (Early)' : ''}</td>
                    <td class="px-4 py-3 text-sm">${p.teAvgRound.toFixed(1)} ${p.draftsEarlyTE ? '⚠️ (Early)' : ''}</td>
                </tr>
            `;
        });
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

        State.initializeTeams();
        UI.switchTab('drafting-screen');
        UI.updateDraftBoard();

        if (State.settings.draftMode === 'mock') {
            AutoDraft.processQueue();
        }
    });

    // Handle Manual Picks (User picking for themself OR User acting as tracker in Live Draft)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('draft-btn')) {
            const playerName = e.target.getAttribute('data-player');
            const player = State.availablePlayers.find(p => p.Player === playerName);
            
            const teamId = State.draftOrder[State.currentPick];
            const team = State.teamsById[teamId];

            // Assign slotted position visually
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
        State.availablePlayers.sort((a,b) => b.VBD - a.VBD); // Keep sorted high to low
        
        // Decrement pick counter
        State.currentPick--;
        State.draftStarted = true; // In case we undid the final pick

        UI.updateDraftBoard();
        
        // If mock draft, stop the bot temporarily so user can review
        if(State.settings.draftMode === 'mock' && AutoDraft.isDrafting) {
             // Let it finish its current tick, but next tick will rely on user
             console.log("Mock draft interrupted by Undo.");
        }
    });

    // Close Modals
    document.getElementById('message-modal-close').addEventListener('click', () => {
        document.getElementById('message-modal').classList.add('hidden');
    });

    // DB Searching logic
    document.getElementById('db-search').addEventListener('input', () => UI.renderDatabase());
    document.getElementById('db-position').addEventListener('change', () => UI.renderDatabase());
});