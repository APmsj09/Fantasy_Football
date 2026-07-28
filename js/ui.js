const UI = {
    switchTab(targetId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-target="${targetId}"]`).classList.add('active');

        if(targetId === 'player-db-screen') this.renderDatabase();
    },

    showMessage(title, message) {
        document.getElementById('message-modal-title').textContent = title;
        document.getElementById('message-modal-content').textContent = message;
        document.getElementById('message-modal').classList.remove('hidden');
    },

    renderDatabase() {
        const tbody = document.getElementById('db-players-body');
        tbody.innerHTML = '';
        
        let filterPos = document.getElementById('db-position').value;
        let search = document.getElementById('db-search').value.toLowerCase();
        
        let filtered = State.allPlayers.filter(p => {
            if(filterPos && p.Pos !== filterPos) return false;
            if(search && !p.Player.toLowerCase().includes(search)) return false;
            return true;
        });

        filtered.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-2 text-sm">${p.Player}</td>
                    <td class="px-6 py-2 text-sm">${p.Pos}</td>
                    <td class="px-6 py-2 text-sm">${p.Team}</td>
                    <td class="px-6 py-2 text-sm font-bold text-blue-600">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-6 py-2 text-sm font-bold text-green-600">${p.VBD.toFixed(1)}</td>
                </tr>
            `;
        });
    },

    updateDraftBoard() {
        if (!State.draftStarted) return;
        
        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        document.getElementById('current-round').textContent = round;
        document.getElementById('current-pick-number').textContent = State.currentPick + 1;

        if (State.currentPick < State.draftOrder.length) {
            const onClockId = State.draftOrder[State.currentPick];
            document.getElementById('on-the-clock').textContent = State.teamsById[onClockId].name;
        } else {
            document.getElementById('on-the-clock').textContent = "Draft Complete!";
            this.renderStandings();
        }

        this.renderDraftAvailablePlayers();
        this.renderRosters();
        this.renderRecommendations();
    },

    renderDraftAvailablePlayers() {
        const tbody = document.getElementById('draft-players-body');
        tbody.innerHTML = '';
        
        // Show top 100 available to prevent browser lag
        let displayList = State.availablePlayers.slice(0, 100);

        displayList.forEach(p => {
            let tr = document.createElement('tr');
            tr.className = "hover:bg-gray-100";
            tr.innerHTML = `
                <td class="px-4 py-2 text-sm font-medium">${p.Player} <span class="text-xs text-gray-500">(${p.Team})</span></td>
                <td class="px-4 py-2 text-sm text-gray-600">${p.Pos}</td>
                <td class="px-4 py-2 text-sm">${p.ProjPts.toFixed(1)}</td>
                <td class="px-4 py-2 text-sm font-bold text-green-600">${p.VBD.toFixed(1)}</td>
                <td class="px-4 py-2 text-sm">
                    <button class="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs shadow draft-btn" data-player="${p.Player}">Draft</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderRecommendations() {
        const container = document.getElementById('recommendations-container');
        if (State.currentPick >= State.draftOrder.length) return;

        const team = State.teamsById[State.draftOrder[State.currentPick]];
        
        // Very basic recommendation: Show top 3 VBD players for user
        let recs = State.availablePlayers.slice(0, 3);
        
        container.innerHTML = recs.map((p, i) => `
            <div class="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-sm">${i+1}. ${p.Player}</h4>
                    <p class="text-xs text-gray-600">${p.Pos} - VBD: ${p.VBD.toFixed(1)}</p>
                </div>
                ${!team.isCPU ? `<button class="bg-indigo-600 text-white px-2 py-1 rounded text-xs draft-btn" data-player="${p.Player}">Pick</button>` : ''}
            </div>
        `).join('');
    },

    renderRosters() {
        const tabs = document.getElementById('roster-tabs');
        const content = document.getElementById('roster-content');
        tabs.innerHTML = ''; content.innerHTML = '';

        let activeTab = localStorage.getItem('activeRosterTab') || State.draftOrder[0];

        Object.values(State.teamsById).forEach(team => {
            const btn = document.createElement('button');
            btn.className = `tab ${activeTab === team.id ? 'active' : ''}`;
            btn.textContent = team.name;
            btn.onclick = () => { localStorage.setItem('activeRosterTab', team.id); this.renderRosters(); };
            tabs.appendChild(btn);
            
            if (activeTab === team.id) {
                content.innerHTML = `
                    <div class="p-4 bg-gray-50">
                        <h3 class="font-bold mb-2">${team.name} Roster (${team.roster.length}/${State.settings.roster.totalSize})</h3>
                        <ul class="space-y-1">
                            ${team.roster.map(p => `
                                <li class="text-sm bg-white border p-2 rounded flex justify-between">
                                    <span><strong>${p.slottedPos}:</strong> ${p.Player}</span>
                                    <span class="text-gray-500">${p.Pos} - ${p.ProjPts.toFixed(1)} pts</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `;
            }
        });
    },

    renderStandings() {
        const list = document.getElementById('standings-list');
        list.innerHTML = '';
        
        let totals = Object.values(State.teamsById).map(team => {
            let pts = team.roster.reduce((sum, p) => sum + p.ProjPts, 0);
            return { name: team.name, pts };
        }).sort((a,b) => b.pts - a.pts);

        totals.forEach((t, i) => {
            list.innerHTML += `
                <div class="flex justify-between items-center p-3 border rounded-lg bg-gray-50">
                    <span class="text-lg font-bold">${i+1}. ${t.name}</span>
                    <span class="text-lg text-blue-600 font-semibold">${t.pts.toFixed(1)} pts</span>
                </div>
            `;
        });
    }
};