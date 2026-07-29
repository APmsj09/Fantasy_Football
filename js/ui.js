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
        
        // ⚡ CHANGE this from .textContent to .innerHTML
        document.getElementById('message-modal-content').innerHTML = message;
        
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
                <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="UI.showWeeklyModal('${p._cleanName}')">
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
    showWeeklyModal(cleanName) {
        let p = State.allPlayers.find(x => x._cleanName === cleanName);
        if(!p || !p.weeklyProjections) return;

        // 1. Build the new Real-World Stats Dashboard
        let statsHtml = '';
        if (p.stats && !['PK', 'DST'].includes(p.Pos)) {
            let s = p.stats;
            statsHtml = `
                <div class="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-4 text-xs text-gray-800 grid grid-cols-2 gap-y-2 gap-x-4 shadow-sm">
                    ${p.Pos === 'QB' ? `
                        <div><span class="font-bold text-gray-500 block uppercase text-[9px]">Passing</span> ${s.passCmp} / ${s.passAtt}</div>
                        <div><span class="font-bold text-gray-500 block uppercase text-[9px]">Pass Yds / Rating</span> ${s.passYds} yds <span class="text-gray-400">(${s.passerRating})</span></div>
                        <div class="col-span-2 border-b border-indigo-100/50 pb-1"><span class="font-bold text-gray-500 block uppercase text-[9px]">TD:INT Ratio</span> ${s.passTd} TD / ${s.int} INT</div>
                    ` : ''}
                    
                    ${s.rushAtt > 0 ? `
                        <div><span class="font-bold text-gray-500 block uppercase text-[9px]">Rushing Vol</span> ${s.rushAtt} att</div>
                        <div><span class="font-bold text-gray-500 block uppercase text-[9px]">Rush Yds</span> ${s.rushYds} <span class="text-emerald-600 font-semibold">(${s.rushAvg} ypc)</span></div>
                    ` : ''}
                    
                    ${s.targets > 0 ? `
                        <div><span class="font-bold text-gray-500 block uppercase text-[9px]">Receiving Vol</span> ${s.rec} rec / ${s.targets} tgt</div>
                        <div><span class="font-bold text-gray-500 block uppercase text-[9px]">Rec Yds</span> ${s.recYds} <span class="text-indigo-600 font-semibold">(${s.recAvg} ypr)</span></div>
                    ` : ''}
                    
                    <div class="col-span-2 pt-1 mt-1 border-t border-indigo-100/50 flex justify-between font-bold">
                        <span>Total TDs: ${(s.rushTd || 0) + (s.recTd || 0)}</span>
                        ${s.fum > 0 ? `<span class="text-red-500">Fumbles: ${s.fum}</span>` : ''}
                    </div>
                </div>
            `;
        }

        // 2. Build the Weekly rows
        let rowsHtml = '';
        for(let w = 1; w <= 18; w++) {
            let star = p.sosWeeks[`W${w}`];
            let pts = p.weeklyProjections[`W${w}`];
            let starDisp = star === 'BYE' ? '<span class="text-gray-400">BYE</span>' : `⭐ ${star}`;
            
            rowsHtml += `
                <div class="flex justify-between items-center py-2 border-b border-gray-50 text-xs">
                    <span class="font-bold text-gray-600 w-16">Week ${w}</span>
                    <span class="text-amber-500 font-medium">${starDisp}</span>
                    <span class="font-extrabold ${pts > 0 ? 'text-indigo-600' : 'text-gray-300'}">${pts > 0 ? pts.toFixed(1) + ' pts' : '-'}</span>
                </div>
            `;
        }

        UI.showMessage(`${p.Player} <span class="text-sm font-normal text-gray-500">| ${p.Pos} - ${p.Team}</span>`, `
            ${statsHtml}
            <div class="mb-2 text-[11px] text-gray-500 flex justify-between px-1">
                <span>Season Total: <strong class="text-gray-800">${p.ProjPts.toFixed(1)} pts</strong></span>
                <span>Schedule Avg: <strong class="text-amber-600">⭐ ${p.avgStars}</strong></span>
            </div>
            <div class="max-h-56 overflow-y-auto pr-2 custom-scrollbar bg-white border rounded-xl p-3 shadow-inner">${rowsHtml}</div>
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
        
        // ⚡ NEW: Evaluate best roster fits for YOUR team before rendering
        const userTeam = State.teamsById[State.userTeamId];
        State.evaluateRosterFits(userTeam, State.availablePlayers);
        
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
                btnHtml = `<button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-xs font-bold shadow-sm draft-btn transition-colors" data-player="${p._cleanName}">${btnText}</button>`;
            }

            let insightTag = "";
            let opps = (p.stats?.rushAtt || 0) + (p.stats?.targets || 0);
            
            // Generate Volume / Efficiency Tags based on our newly imported data
            if (opps >= 300) {
                insightTag += `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">👑 Elite Volume</span>`;
            } else if (p.Pos === 'RB' && p.stats?.rushAvg >= 5.0) {
                insightTag += `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">⚡ Home Run Threat</span>`;
            } else if (['WR', 'TE'].includes(p.Pos) && p.stats?.recAvg >= 15.0) {
                insightTag += `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">🚀 Deep Threat</span>`;
            } else if (p.targetShare && p.targetShare >= 25) {
                insightTag += `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">🎯 ${p.targetShare}% Tgts</span>`;
            }
            if (p._addedPPW && p._addedPPW > 0.5) {
                insightTag += `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 shadow-sm" title="Adds ${p._addedPPW.toFixed(1)} points per week to your optimal starting lineup">📈 +${p._addedPPW.toFixed(1)} PPW</span>`;
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
        
        // Viable players were already simulated in evaluateRosterFits
        let viablePlayers = State.availablePlayers.filter(p => p._addedPPW !== undefined);

        // Find the absolute #1 Best Fit for the roster
        let bestFit = null;
        let highestPPW = -1;
        viablePlayers.forEach(p => {
            if (p._addedPPW > highestPPW) {
                highestPPW = p._addedPPW;
                bestFit = p;
            }
        });

        // Filter out the best fit so they don't appear twice, then get Top 3 by AdvVBD
        let vbdRecs = viablePlayers
            .filter(p => p !== bestFit)
            .sort((a,b) => b.AdvVBD - a.AdvVBD)
            .slice(0, 3);
        
        let htmlStr = '';

        // Render the #1 Dynamic Roster Fit Card
        if (bestFit && highestPPW > 0.1) {
            htmlStr += `
            <div class="p-3 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl border border-emerald-500 flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition mb-4" onclick="UI.showWeeklyModal('${bestFit._cleanName}')">
                <div>
                    <span class="text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 mb-1 block flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Optimal Roster Fit</span>
                    <h4 class="font-bold text-sm text-white">${bestFit.Player}</h4>
                    <p class="text-xs text-emerald-100 font-medium">${bestFit.Pos} • ⭐ ${bestFit.avgStars ? bestFit.avgStars.toFixed(2) : '3.0'} • <strong class="text-white">Adds ${highestPPW.toFixed(1)} PPW</strong></p>
                </div>
            </div>`;
        }

        // Render the Top Value Targets
        htmlStr += vbdRecs.map((p, i) => {
            return `
            <div class="p-3 bg-indigo-800 rounded-xl border border-indigo-700 flex justify-between items-center shadow-inner cursor-pointer hover:bg-indigo-700 transition mb-2" onclick="UI.showWeeklyModal('${p._cleanName}')">
                <div>
                    <h4 class="font-bold text-sm text-white">${bestFit ? i+2 : i+1}. ${p.Player}</h4>
                    <p class="text-xs text-indigo-300 font-medium">${p.Pos} • Adv. VBD: ${(p.AdvVBD || p.VBD).toFixed(1)} • ⭐ ${p.avgStars ? p.avgStars.toFixed(2) : '3.0'}</p>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = htmlStr;
    },

    renderRosters() {
        const tabs = document.getElementById('roster-tabs');
        const content = document.getElementById('roster-content');
        
        let activeTab = localStorage.getItem('activeRosterTab') || State.draftOrder[0];

        // ⚡ OPTIMIZATION: Document Fragments prevent UI Reflows.
        const fragment = document.createDocumentFragment();
        let contentHtml = '';

        Object.values(State.teamsById).forEach(team => {
            const btn = document.createElement('button');
            btn.className = `tab ${activeTab === team.id ? 'active' : ''}`;
            btn.textContent = team.name;
            btn.onclick = () => { localStorage.setItem('activeRosterTab', team.id); this.renderRosters(); };
            
            fragment.appendChild(btn); // Add to memory, not the screen
            
            if (activeTab === team.id) {
                contentHtml = `
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

        // Push to DOM exactly ONCE
        tabs.innerHTML = ''; 
        tabs.appendChild(fragment);
        content.innerHTML = contentHtml;
    },

    renderStandings() {
        const list = document.getElementById('standings-list');
        let totals = Object.values(State.teamsById).map(team => {
            let pts = team.roster.reduce((sum, p) => sum + p.ProjPts, 0);
            return { name: team.name, pts, isUser: team.id === State.userTeamId };
        }).sort((a,b) => b.pts - a.pts);

        let htmlStr = '';
        totals.forEach((t, i) => {
            let bg = t.isUser ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100';
            let text = t.isUser ? 'text-indigo-900' : 'text-gray-900';
            htmlStr += `
                <div class="flex justify-between items-center p-4 border rounded-xl ${bg}">
                    <span class="text-lg font-bold ${text}"><span class="text-gray-400 mr-2">#${i+1}</span> ${t.name}</span>
                    <span class="text-lg text-emerald-600 font-extrabold">${t.pts.toFixed(1)} pts</span>
                </div>
            `;
        });
        list.innerHTML = htmlStr;
    }
};