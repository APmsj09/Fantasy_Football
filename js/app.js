document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Tab Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            UI.switchTab(e.target.getAttribute('data-target'));
        });
    });

    // 2. Draft Setting Toggles
    const draftTypeSelect = document.getElementById('setting-draft-type');
    const userPickContainer = document.getElementById('user-pick-container');
    
    draftTypeSelect.addEventListener('change', (e) => {
        if(e.target.value === 'mock') {
            userPickContainer.classList.remove('hidden');
        } else {
            userPickContainer.classList.add('hidden');
        }
    });

    // 3. Load Data Action
    const tsvUrl = 'https://raw.githubusercontent.com/APmsj09/Fantasy_Football/main/Data.tsv';
    
    document.getElementById('load-data-button').addEventListener('click', async (e) => {
        e.target.textContent = "Loading...";
        try {
            const res = await fetch(tsvUrl);
            const text = await res.text();
            State.allPlayers = State.parseTSV(text);
            UI.showMessage('Success', `Loaded ${State.allPlayers.length} players! Adjust settings and click Initialize Draft.`);
            document.getElementById('start-draft-btn').classList.remove('hidden');
            e.target.textContent = "Data Loaded!";
        } catch (err) {
            UI.showMessage('Error', 'Failed to load data.');
            e.target.textContent = "Load Default Data";
        }
    });

    // 4. Initialize Draft Action
    document.getElementById('start-draft-btn').addEventListener('click', () => {
        // Capture User Settings
        State.settings.numTeams = parseInt(document.getElementById('setting-teams').value);
        State.settings.isMockDraft = document.getElementById('setting-draft-type').value === 'mock';
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

        // Start engine
        State.initializeTeams();
        UI.switchTab('drafting-screen');
        UI.updateDraftBoard();

        // Kick off bot if CPU is picking #1
        if (State.settings.isMockDraft) {
            AutoDraft.processQueue();
        }
    });

    // 5. Handle Manual User Draft Clicks (Delegated)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('draft-btn')) {
            const playerName = e.target.getAttribute('data-player');
            const player = State.availablePlayers.find(p => p.Player === playerName);
            
            const teamId = State.draftOrder[State.currentPick];
            const team = State.teamsById[teamId];

            if (team.isCPU) {
                UI.showMessage("Wait!", "It is not your turn!");
                return;
            }

            // Simple user slotting (Fallback logic)
            let slot = 'Bench';
            if (team.counts[player.Pos] < State.settings.roster[player.Pos].max) slot = player.Pos;
            else if (['RB', 'WR', 'TE'].includes(player.Pos) && team.counts['Flex'] < State.settings.roster.Flex.max) slot = 'Flex';

            AutoDraft.executeDraft(player, team, slot);
            UI.updateDraftBoard();
            
            // Allow bots to resume picking
            if (State.settings.isMockDraft) AutoDraft.processQueue();
        }
    });

    // Handle Messages close
    document.getElementById('message-modal-close').addEventListener('click', () => {
        document.getElementById('message-modal').classList.add('hidden');
    });

    // Search listeners for DB
    document.getElementById('db-search').addEventListener('input', () => UI.renderDatabase());
    document.getElementById('db-position').addEventListener('change', () => UI.renderDatabase());
});