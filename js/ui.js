const UI = {
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
        document.getElementById('message-modal-title').textContent = title;
        document.getElementById('message-modal-content').textContent = message;
        document.getElementById('message-modal').classList.remove('hidden');
    },

    renderDatabase() {
        const tbody = document.getElementById('db-players-body');
        
        let filterPos = document.getElementById('db-position').value;
        let search = document.getElementById('db-search').value.toLowerCase().replace(/[^a-z0-9]/g, ''); // match clean style
        
        let filtered = State.allPlayers.filter(p => {
            if(filterPos && p.Pos !== filterPos) return false;
            // ⚡ OPTIMIZATION: Check against the pre-computed _cleanName instead of re-lowercasing
            if(search && !p._cleanName.includes(search) && !p._cleanTeam.toLowerCase().includes(search)) return false;
            return true;
        });

        // ⚡ OPTIMIZATION: Build a single string. Never use tbody.innerHTML += inside a loop.
        let htmlStr = '';
        
        filtered.slice(0, 200).forEach(p => {
            let vbdVal = p.VBD.toFixed(1);
            let advVbdVal = (p.AdvVBD || p.VBD).toFixed(1);
            let stars = p.avgStars ? `⭐ ${p.avgStars.toFixed(2)}` : '-';
            let bye = p.byeWeek && p.byeWeek !== 'N/A' ? `Wk ${p.byeWeek}` : '-';

            let vbdColor = p.VBD >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium';
            let advVbdColor = p.AdvVBD >= 0 ? 'text-indigo-600 font-extrabold' : 'text-red-400 font-bold';

            let safeName = p.Player.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            htmlStr += `
                <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="UI.showWeeklyModal('${safeName}')">
                    <td class="px-6 py-3 text-sm font-medium text-gray-900">${p.Player}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${p.Pos}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${p.Team}</td>
                    <td class="px-6 py-3 text-sm font-bold text-indigo-600">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-6 py-3 text-sm ${vbdColor}">${vbdVal}</td>
                    <td class="px-6 py-3 text-sm ${advVbdColor}">${advVbdVal}</td>
                    <td class="px-6 py-3 text-sm font-semibold text-amber-600">${stars}</td>
                    <td class="px-6 py-3 text-sm text-gray-500">${bye}</td>
                </tr>
            `;
        });
        
        // Inject DOM exactly once
        tbody.innerHTML = htmlStr;
    },

    // Weekly Projections Modal Viewer
    showWeeklyModal(playerName) {
        let p = State.allPlayers.find(x => x.Player === playerName);
        if (!p || !p.weeklyProjections) return;

        let rowsHtml = '';
        for (let w = 1; w <= 18; w++) {
            let star = p.sosWeeks[`W${w}`];
            let pts = p.weeklyProjections[`W${w}`];
            let starDisp = star === 'BYE' ? '<span class="text-gray-400">BYE</span>' : `⭐ ${star}`;

            rowsHtml += `
            <div class="flex justify-between items-center py-1.5 border-b text-xs">
                <span class="font-bold text-gray-600">Week ${w}</span>
                <span>${starDisp}</span>
                <span class="font-extrabold text-indigo-600">${pts > 0 ? pts.toFixed(1) + ' pts' : '-'}</span>
            </div>
        `;
        }

        UI.showMessage(`${p.Player} (${p.Pos} - ${p.Team}) Weekly Projections`, `
        <div class="mb-3 text-xs text-gray-500">Season Total: <strong>${p.ProjPts.toFixed(1)} pts</strong> | Avg Schedule: <strong>⭐ ${p.avgStars}</strong></div>
        <div class="max-h-60 overflow-y-auto pr-2">${rowsHtml}</div>
    `);
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

        // Preserve previous selections to prevent resetting user progress when settings change
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

        // Restore selections after adding to DOM
        for (let i = 1; i <= numTeams; i++) {
            let el = document.getElementById(`profile-team-${i}`);
            if (el && prevSelections[i]) el.value = prevSelections[i];
        }
    },

    updateDraftBoard() {
        if (!State.draftStarted) return;

        const round = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        document.getElementById('current-round').textContent = round;
        document.getElementById('current-pick-number').textContent = (State.currentPick % State.settings.numTeams) + 1;

        if (State.currentPick < State.draftOrder.length) {
            const onClockId = State.draftOrder[State.currentPick];
            const onClockTeam = State.teamsById[onClockId];
            document.getElementById('on-the-clock').textContent = onClockTeam.name;

            let badgeBadge = document.getElementById('drafting-for-badge');
            badgeBadge.textContent = `Drafting for: ${onClockTeam.name}`;

            // Highlight color based on if it's user or not
            if (onClockId === State.userTeamId) {
                badgeBadge.className = "text-sm font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full";
            } else {
                badgeBadge.className = "text-sm font-medium px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full";
            }

        } else {
            document.getElementById('on-the-clock').textContent = "Complete";
            document.getElementById('drafting-for-badge').textContent = "Draft Complete";
            this.renderStandings();
            this.switchTab('summary-screen');
        }

        this.renderDraftAvailablePlayers();
        this.renderRosters();
        this.renderRecommendations();
    },

    renderDraftAvailablePlayers() {
        const tbody = document.getElementById('draft-players-body');
        let htmlStr = '';
        
        let displayList = State.availablePlayers.slice(0, 100);
        let btnText = "Draft";
        let isMock = State.settings.draftMode === 'mock';
        let onClockId = State.draftOrder[State.currentPick];
        let isUserTurn = isMock && (onClockId === State.userTeamId);
        
        displayList.forEach(p => {
            let btnHtml = "";
            let safeName = p.Player.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            
            if(isMock && !isUserTurn) {
                btnHtml = `<button class="bg-gray-200 text-gray-400 px-3 py-1.5 rounded-lg text-xs font-bold cursor-not-allowed" disabled>Wait</button>`;
            } else {
                btnHtml = `<button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-xs font-bold shadow-sm draft-btn transition-colors" data-player="${safeName}">${btnText}</button>`;
            }

            let insightTag = "";
            if (p.targetShare && p.targetShare >= 25) {
                insightTag = `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">🎯 ${p.targetShare}% Tgts</span>`;
            } else if (p.rzTgt && p.rzTgt >= 15) {
                insightTag = `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">🚨 High RZ Vol</span>`;
            } else if (p.yacAtt && p.yacAtt >= 2.2) {
                insightTag = `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">🏃‍♂️ Elusive</span>`;
            }

            htmlStr += `
                <tr class="hover:bg-slate-50 border-b border-gray-50">
                    <td class="px-4 py-3 text-sm font-semibold text-gray-900 flex items-center">
                        ${p.Player} 
                        <span class="text-xs font-normal text-gray-400 ml-1">${p.Team}</span>
                        ${insightTag}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">${p.Pos}</td>
                    <td class="px-4 py-3 text-sm font-medium">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-4 py-3 text-sm font-medium text-emerald-600">${p.VBD.toFixed(1)}</td>
                    <td class="px-4 py-3 text-sm font-extrabold text-indigo-600">${p.AdvVBD ? p.AdvVBD.toFixed(1) : p.VBD.toFixed(1)}</td>
                    <td class="px-4 py-3 text-right">${btnHtml}</td>
                </tr>
            `;
        });
        
        // Inject DOM exactly once
        tbody.innerHTML = htmlStr;
    },

    renderRecommendations() {
        const container = document.getElementById('recommendations-container');
        if (State.currentPick >= State.draftOrder.length) return;

        const userTeam = State.teamsById[State.userTeamId];
        document.getElementById('user-team-name-disp').textContent = userTeam.name;
        
        let viablePlayers = State.availablePlayers.filter(player => { /* ... existing logic ... */ return true; });

        let recs = viablePlayers.sort((a,b) => b.AdvVBD - a.AdvVBD).slice(0, 4);
        
        container.innerHTML = recs.map((p, i) => {
            let safeName = p.Player.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `
            <div class="p-3 bg-indigo-800 rounded-xl border border-indigo-700 flex justify-between items-center shadow-inner cursor-pointer hover:bg-indigo-700 transition" onclick="UI.showWeeklyModal('${safeName}')">
                <div>
                    <h4 class="font-bold text-sm text-white">${i+1}. ${p.Player}</h4>
                    <p class="text-xs text-indigo-300 font-medium">${p.Pos} • Adv. VBD: ${(p.AdvVBD || p.VBD).toFixed(1)} • ⭐ ${p.avgStars ? p.avgStars.toFixed(2) : '3.0'}</p>
                </div>
            </div>`;
        }).join('');
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
                    <div class="p-4">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-bold text-gray-800">${team.name} Roster</h3>
                            <span class="text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">${team.roster.length}/${State.settings.roster.totalSize} Spots</span>
                        </div>
                        <ul class="space-y-2">
                            ${team.roster.map(p => `
                                <li class="text-sm bg-white border border-gray-200 p-2.5 rounded-lg flex justify-between shadow-sm">
                                    <span><strong class="text-indigo-600 mr-2 w-8 inline-block">${p.slottedPos}</strong> <span class="font-medium">${p.Player}</span></span>
                                    <span class="text-gray-400 text-xs">${p.Pos} • <span class="text-emerald-600 font-semibold">${p.ProjPts.toFixed(1)} pts</span></span>
                                </li>
                            `).join('')}
                            ${team.roster.length === 0 ? '<p class="text-sm text-gray-400 italic">No players drafted yet.</p>' : ''}
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
            return { name: team.name, pts, isUser: team.id === State.userTeamId };
        }).sort((a, b) => b.pts - a.pts);

        totals.forEach((t, i) => {
            let bg = t.isUser ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100';
            let text = t.isUser ? 'text-indigo-900' : 'text-gray-900';
            list.innerHTML += `
                <div class="flex justify-between items-center p-4 border rounded-xl ${bg}">
                    <span class="text-lg font-bold ${text}"><span class="text-gray-400 mr-2">#${i + 1}</span> ${t.name}</span>
                    <span class="text-lg text-emerald-600 font-extrabold">${t.pts.toFixed(1)} pts</span>
                </div>
            `;
        });
    }
};