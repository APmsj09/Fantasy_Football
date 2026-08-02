const UI = {
    getPlayerAge(p) {
        if (p?.age !== undefined && p?.age !== null && p.age !== '') return p.age;
        if (p?.Age !== undefined && p?.Age !== null && p.Age !== '') return p.Age;
        return null;
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
        
        let filterPos = document.getElementById('db-position').value;
        let search = document.getElementById('db-search').value.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        
        let filtered = State.allPlayers.filter(p => {
            if(filterPos && p.Pos !== filterPos) return false;
            if(search && !p._cleanName.includes(search) && !p._cleanTeam.toLowerCase().includes(search)) return false;
            return true;
        });

        let htmlStr = '';
        
        filtered.slice(0, 200).forEach(p => {
            let vbdVal = p.VBD.toFixed(1);
            let advVbdVal = (p.AdvVBD || p.VBD).toFixed(1);
            let stars = p.avgStars ? `⭐ ${p.avgStars.toFixed(2)}` : '-';
            let bye = p.byeWeek && p.byeWeek !== 'N/A' ? `Wk ${p.byeWeek}` : '-';
            let age = this.getPlayerAge(p) ? `${this.getPlayerAge(p)} y/o` : '—';
            let adp = p.adp !== undefined && p.adp !== null ? `${p.adp.toFixed(1)}` : '—';
            let depth = p.depthChart !== undefined && p.depthChart !== null ? `${p.depthChart}` : '—';
            let snap = p.snapShare !== undefined && p.snapShare !== null ? `${p.snapShare.toFixed(0)}%` : '—';
            let olTag = p.olTier ? `<span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">OL ${p.olTier}</span>` : '';

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

    showPlayerCard(cleanName) {
        let p = State.allPlayers.find(x => x._cleanName === cleanName);
        if (!p) return;

        let s = p.stats || {};
        let isOffense = !['PK', 'DST'].includes(p.Pos);

        let ageDisplay = this.getPlayerAge(p);
        let ppwBadge = p._addedPPW && p._addedPPW > 0.2 
            ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">📈 +${p._addedPPW.toFixed(1)} PPW Lineup Fit</span>` 
            : '';

        let statsDashboard = '';
        if (isOffense) {
            let opps = (s.rushAtt || 0) + (s.targets || 0);
            statsDashboard = `
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 shadow-sm text-xs grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div class="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span class="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Opportunity Volume</span>
                        <span class="text-sm font-extrabold text-slate-800">${opps} Touches/Tgts</span>
                        ${p.targetShare ? `<span class="block text-[10px] text-indigo-600 font-semibold">${p.targetShare}% Tgt Share</span>` : ''}
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span class="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Projected Output</span>
                        <span class="text-sm font-extrabold text-indigo-600">${p.ProjPts.toFixed(1)} Pts</span>
                        <span class="block text-[10px] text-gray-500">Adv VBD: ${(p.AdvVBD || p.VBD).toFixed(1)}</span>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span class="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Schedule Rating</span>
                        <span class="text-sm font-extrabold text-amber-600">⭐ ${p.avgStars ? p.avgStars.toFixed(2) : '3.0'}</span>
                        <span class="block text-[10px] text-gray-500">Playoffs: ⭐${(p.playoffSOS || p.avgStars || 3.0).toFixed(1)}</span>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span class="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Bye Week</span>
                        <span class="text-sm font-extrabold text-slate-700">${p.byeWeek && p.byeWeek !== 'N/A' ? 'Week ' + p.byeWeek : 'N/A'}</span>
                    </div>
                    <div class="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span class="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Age</span>
                        <span class="text-sm font-extrabold text-slate-700">${ageDisplay ? ageDisplay : 'N/A'}</span>
                    </div>
                </div>

                <div class="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 mb-4 text-xs text-gray-800 grid grid-cols-2 md:grid-cols-3 gap-y-2.5 gap-x-4">
                    ${p.Pos === 'QB' ? `
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Pass Comp / Att</span> ${s.passCmp} / ${s.passAtt}</div>
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Pass Yds / Rating</span> ${s.passYds} <span class="text-gray-400">(${s.passerRating})</span></div>
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">TD : INT</span> <span class="text-emerald-600 font-bold">${s.passTd} TD</span> / <span class="text-red-500">${s.int} INT</span></div>
                        ${p.trueAccuracy ? `<div><span class="font-bold text-gray-500 block text-[10px] uppercase">True Accuracy</span> ${p.trueAccuracy.toFixed(1)}%</div>` : ''}
                    ` : ''}

                    ${s.rushAtt > 0 ? `
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Rushing Vol</span> ${s.rushAtt} Att</div>
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Rush Yds / YPC</span> ${s.rushYds} yds <span class="text-emerald-600 font-bold">(${s.rushAvg} YPC)</span></div>
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Rush TDs</span> ${s.rushTd} TD</div>
                        ${p.yacAtt ? `<div><span class="font-bold text-gray-500 block text-[10px] uppercase">YAC / Att</span> ${p.yacAtt} yds</div>` : ''}
                    ` : ''}

                    ${s.targets > 0 ? `
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Receiving Vol</span> ${s.rec} Rec / ${s.targets} Tgt</div>
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Rec Yds / YPR</span> ${s.recYds} yds <span class="text-indigo-600 font-bold">(${s.recAvg} YPR)</span></div>
                        <div><span class="font-bold text-gray-500 block text-[10px] uppercase">Rec TDs</span> ${s.recTd} TD</div>
                        ${p.rzTgt ? `<div><span class="font-bold text-gray-500 block text-[10px] uppercase">Red Zone Targets</span> <span class="text-red-600 font-bold">${p.rzTgt} RZ Tgts</span></div>` : ''}
                        ${p.trueCatchRate ? `<div><span class="font-bold text-gray-500 block text-[10px] uppercase">Catch Rate</span> ${p.trueCatchRate.toFixed(1)}%</div>` : ''}
                        ${p.dropRate ? `<div><span class="font-bold text-gray-500 block text-[10px] uppercase">Drop Rate</span> ${p.dropRate.toFixed(1)}%</div>` : ''}
                    ` : ''}
                </div>
            `;
        }

        let contextPanel = '';
        let advancedContextBits = [];
        if (p.targetShare) advancedContextBits.push(`${p.targetShare}% target share`);
        if (p.rzTgt) advancedContextBits.push(`${p.rzTgt} RZ tgts`);
        if (p.yacAtt) advancedContextBits.push(`${p.yacAtt} YAC/att`);
        if (p.trueCatchRate) advancedContextBits.push(`${p.trueCatchRate.toFixed(1)}% catch rate`);
        if (p.dropRate) advancedContextBits.push(`${p.dropRate.toFixed(1)}% drop rate`);
        if (p.adp !== undefined && p.adp !== null) advancedContextBits.push(`ADP ${p.adp.toFixed(1)}`);
        if (p.depthChart !== undefined && p.depthChart !== null) advancedContextBits.push(`Depth ${p.depthChart}`);
        if (p.snapShare !== undefined && p.snapShare !== null) advancedContextBits.push(`Snap ${p.snapShare.toFixed(0)}%`);
        if (p.olTier) advancedContextBits.push(`OL ${p.olTier}${p.olRank ? ` #${p.olRank}` : ''}`);

        if (advancedContextBits.length > 0) {
            contextPanel = `
                <div class="bg-slate-50/80 p-3 rounded-xl border border-slate-200 mb-4 text-xs">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-bold text-gray-600 uppercase tracking-wider">Advanced Context</span>
                        ${p.targetShare ? `<span class="text-indigo-600 font-semibold">${p.targetShare}% of ${p.Team} targets</span>` : ''}
                    </div>
                    <div class="text-gray-700 flex flex-wrap gap-2">
                        ${advancedContextBits.map(bit => `<span class="bg-white px-2 py-1 rounded border border-slate-200">${bit}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        let rowsHtml = '';
        if (p.weeklyProjections) {
            for (let w = 1; w <= 18; w++) {
                let star = p.sosWeeks ? p.sosWeeks[`W${w}`] : 3.0;
                let pts = p.weeklyProjections[`W${w}`] || 0;
                let starDisp = star === 'BYE' ? '<span class="text-gray-400 font-semibold">BYE</span>' : `⭐ ${star}`;
                let isPlayoff = w >= 15 && w <= 17;

                rowsHtml += `
                    <div class="flex justify-between items-center py-2 border-b border-gray-100 text-xs ${isPlayoff ? 'bg-amber-50/50 px-2 rounded-md' : ''}">
                        <span class="font-bold text-gray-700 w-20 flex items-center">
                            Week ${w} ${isPlayoff ? '<span class="ml-1 text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-extrabold">PLAYOFF</span>' : ''}
                        </span>
                        <span class="text-amber-600 font-medium">${starDisp}</span>
                        <span class="font-extrabold ${pts > 0 ? 'text-indigo-600' : 'text-gray-300'}">${pts > 0 ? pts.toFixed(1) + ' pts' : '-'}</span>
                    </div>
                `;
            }
        }

        let modalTitle = `<div class="flex items-center flex-wrap gap-2">
            <span>${p.Player}</span>
            <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-normal">${p.Pos} • ${p.Team}</span>
            ${ageDisplay ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Age ${ageDisplay}</span>` : ''}
        </div>`;

        UI.showMessage(modalTitle, `
            <div class="mb-3">${ppwBadge}</div>
            ${statsDashboard}
            ${contextPanel}
            <h4 class="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">18-Week Projection & Schedule Matrix</h4>
            <div class="max-h-52 overflow-y-auto pr-2 bg-white border border-gray-200 rounded-xl p-3 shadow-inner">${rowsHtml}</div>
        `);
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
        
        let displayList = State.availablePlayers.slice(0, 100);
        let isMock = State.settings.draftMode === 'mock';
        let onClockId = State.draftOrder[State.currentPick];
        let isUserTurn = isMock && (onClockId === State.userTeamId);
        
        displayList.forEach(p => {
            let btnHtml = "";
            let safeName = p._cleanName;
            
            if (isMock && !isUserTurn) {
                btnHtml = `<button class="bg-gray-200 text-gray-400 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-not-allowed" disabled>Wait</button>`;
            } else {
                btnHtml = `<button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-[11px] font-bold shadow-sm draft-btn transition-colors" data-player="${safeName}">Draft</button>`;
            }

            let adpStr = p.adp ? p.adp.toFixed(1) : '-';
            let byeStr = p.byeWeek && p.byeWeek !== 'N/A' ? p.byeWeek : '-';
            let depthStr = p.depthChart ? p.depthChart : '-';
            
            let ppwStr = p._addedPPW && p._addedPPW > 0.1 
                ? `<span class="font-bold text-emerald-600">+${p._addedPPW.toFixed(1)}</span>` 
                : `<span class="text-gray-300">-</span>`;

            let ageStr = p.age ? `<span class="text-[9px] font-semibold text-slate-400 ml-1">Age ${p.age}</span>` : '';
            let olBadge = p.olTier ? `<span class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">OL ${p.olTier}</span>` : '';
            let sosBadge = p.avgStars ? `<span class="ml-1 inline-flex items-center text-[10px] font-bold text-amber-500">⭐ ${p.avgStars.toFixed(1)}</span>` : '';

            htmlStr += `
                <tr class="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer" onclick="if (!event.target.closest('.draft-btn')) UI.showPlayerCard('${p._cleanName}')">
                    <td class="px-3 py-2 text-[11px] font-bold text-gray-900">
                        <div class="flex items-center">
                            <span>${p.Player}</span>
                            <span class="font-normal text-gray-400 ml-1.5">${p.Team}</span>
                            ${ageStr} ${olBadge} ${sosBadge}
                        </div>
                    </td>
                    <td class="px-2 py-2 text-[11px] text-gray-600 font-medium">${p.Pos}</td>
                    <td class="px-2 py-2 text-[11px] font-bold text-indigo-600">${p.ProjPts.toFixed(1)}</td>
                    <td class="px-2 py-2 text-[11px] font-extrabold text-indigo-900">${(p.AdvVBD || p.VBD).toFixed(1)}</td>
                    <td class="px-2 py-2 text-[11px]">${ppwStr}</td>
                    <td class="px-2 py-2 text-[11px] text-gray-600">${adpStr}</td>
                    <td class="px-2 py-2 text-[11px] text-gray-600">${byeStr}</td>
                    <td class="px-2 py-2 text-[11px] text-gray-600">${depthStr}</td>
                    <td class="px-3 py-2 text-right">${btnHtml}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = htmlStr;
    },

    renderRecommendations() {
        const container = document.getElementById('recommendations-container');
        if (State.currentPick >= State.draftOrder.length) return;

        const userTeam = State.teamsById[State.userTeamId];
        document.getElementById('user-team-name-disp').textContent = userTeam.name;
        
        const currentRound = Math.floor(State.currentPick / State.settings.numTeams) + 1;

        let viablePlayers = State.availablePlayers.filter(p => {
            let pos = p.Pos;
            if ((pos === 'PK' || pos === 'DST') && currentRound < 14) return false;

            if (userTeam.counts[pos] < State.settings.roster[pos].max) return true;
            if (['RB', 'WR', 'TE'].includes(pos) && userTeam.counts['Flex'] < State.settings.roster.Flex.max) return true;
            if (userTeam.counts['Bench'] < State.settings.roster.Bench.max) return true;
            return false;
        });

        viablePlayers.forEach(p => {
            let score = p.AdvVBD || p.VBD;
            if (p._addedPPW) score += (p._addedPPW * 5); 

            let starterMax = State.settings.roster[p.Pos].max;
            let currentCount = userTeam.counts[p.Pos];

            // Smarter Positional Weighting
            if (currentCount < starterMax) {
                score += 15; // High priority to fill starting lineup
            } else {
                let overage = currentCount - starterMax;
                if (['PK', 'DST', 'QB', 'TE'].includes(p.Pos)) {
                    score -= 20; // Severe penalty for backup onesie positions
                } else if (['RB', 'WR'].includes(p.Pos)) {
                    score -= (overage * 8); // Diminishing returns penalty for bench depth
                }
            }

            if (p.targetShare && p.targetShare >= 20) score += 4;
            if (p.stats && (p.stats.rushAtt + p.stats.targets) >= 200) score += 4;

            p._recScore = score;
        });

        let sortedByRec = [...viablePlayers].sort((a,b) => b._recScore - a._recScore);
        
        let bestFit = [...viablePlayers].sort((a,b) => (b._addedPPW || 0) - (a._addedPPW || 0))[0];
        if (bestFit && (bestFit._addedPPW || 0) <= 0.1) bestFit = null;

        let vbdRecs = sortedByRec.filter(p => p !== bestFit).slice(0, 3);
        
        let htmlStr = '';

        if (bestFit) {
            htmlStr += `
            <div class="p-3 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl border border-emerald-500 flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition mb-2" onclick="UI.showPlayerCard('${bestFit._cleanName}')">
                <div>
                    <span class="text-[9px] font-extrabold uppercase tracking-widest text-emerald-200 mb-1 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Best Roster Fit
                    </span>
                    <h4 class="font-bold text-sm text-white">${bestFit.Player}</h4>
                    <p class="text-[10px] text-emerald-100 font-medium">${bestFit.Pos} • ${bestFit.Team} • <strong class="text-white">Adds +${bestFit._addedPPW.toFixed(1)} PPW</strong></p>
                </div>
            </div>`;
        }

        htmlStr += vbdRecs.map((p, i) => `
            <div class="p-3 bg-indigo-800/80 rounded-xl border border-indigo-700/50 flex justify-between items-center shadow-inner cursor-pointer hover:bg-indigo-700 transition mb-2" onclick="UI.showPlayerCard('${p._cleanName}')">
                <div>
                    <h4 class="font-bold text-xs text-white">${bestFit ? i+2 : i+1}. ${p.Player} <span class="text-[10px] font-normal text-indigo-300">(${p.Team})</span></h4>
                    <p class="text-[10px] text-indigo-200 font-medium mt-0.5">${p.Pos} • Adv VBD: ${(p.AdvVBD || p.VBD).toFixed(1)}</p>
                </div>
            </div>
        `).join('');

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
            
        for(let i=0; i<numTeams; i++) {
            let team = State.teamsById[`team-${i+1}`];
            let isUser = team.id === State.userTeamId;
            htmlStr += `<th class="p-2 border border-slate-700 truncate max-w-[100px] ${isUser ? 'text-emerald-400 font-extrabold' : 'font-semibold'}">${team.name}</th>`;
        }
        htmlStr += `</tr></thead><tbody>`;

        for (let r = 0; r < totalRounds; r++) {
            htmlStr += `<tr><td class="p-2 border border-slate-200 bg-slate-50 font-bold text-slate-500">${r+1}</td>`;
            
            for (let c = 0; c < numTeams; c++) {
                let isSnakeReverse = r % 2 !== 0;
                let pickInRound = isSnakeReverse ? (numTeams - 1 - c) : c;
                let overallPick = (r * numTeams) + pickInRound;
                
                let pickData = State.draftHistory.find(d => d.pickIndex === overallPick);
                
                if (pickData) {
                    let p = pickData.player;
                    let posColor = '';
                    if(p.Pos === 'RB') posColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    else if (p.Pos === 'WR') posColor = 'bg-blue-50 text-blue-800 border-blue-200';
                    else if (p.Pos === 'QB') posColor = 'bg-red-50 text-red-800 border-red-200';
                    else if (p.Pos === 'TE') posColor = 'bg-amber-50 text-amber-800 border-amber-200';
                    else posColor = 'bg-slate-50 text-slate-800 border-slate-200';

                    htmlStr += `<td class="p-2 border border-slate-200 ${posColor} relative group">
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
        
        let activeTab = localStorage.getItem('activeRosterTab') || State.draftOrder[0];
        const fragment = document.createDocumentFragment();
        let contentHtml = '';

        Object.values(State.teamsById).forEach(team => {
            const btn = document.createElement('button');
            btn.className = `tab ${activeTab === team.id ? 'active' : ''}`;
            btn.textContent = team.name;
            btn.onclick = () => { localStorage.setItem('activeRosterTab', team.id); this.renderRosters(); };
            
            fragment.appendChild(btn);
            
            if (activeTab === team.id) {
                contentHtml = `
                    <div class="p-2">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-bold text-gray-800">${team.name} Roster</h3>
                            <span class="text-[10px] font-bold bg-white text-gray-500 px-2 py-1 border border-gray-200 rounded-full">${team.roster.length}/${State.settings.roster.totalSize} Spots</span>
                        </div>
                        <ul class="space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            ${team.roster.map(p => `
                                <li class="text-xs bg-white border border-gray-200 p-2.5 rounded-lg flex justify-between shadow-sm">
                                    <span><strong class="text-indigo-600 mr-2 w-8 inline-block">${p.slottedPos}</strong> <span class="font-medium">${p.Player}</span></span>
                                    <span class="text-gray-400 text-[10px]">${p.Pos} • <span class="text-emerald-600 font-semibold">${p.ProjPts.toFixed(1)} pts</span></span>
                                </li>
                            `).join('')}
                            ${team.roster.length === 0 ? '<p class="text-xs text-gray-400 italic">No players drafted yet.</p>' : ''}
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
        let totals = Object.values(State.teamsById).map(team => {
            let pts = team.roster.reduce((sum, p) => sum + p.ProjPts, 0);
            return { name: team.name, pts, isUser: team.id === State.userTeamId };
        }).sort((a,b) => b.pts - a.pts);

        let htmlStr = '';
        totals.forEach((t, i) => {
            let bg = t.isUser ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100';
            let text = t.isUser ? 'text-indigo-900' : 'text-gray-900';
            htmlStr += `
                <div class="flex justify-between items-center p-4 border rounded-xl ${bg} mb-3">
                    <span class="text-lg font-bold ${text}"><span class="text-gray-400 mr-2">#${i+1}</span> ${t.name}</span>
                    <span class="text-lg text-emerald-600 font-extrabold">${t.pts.toFixed(1)} pts</span>
                </div>
            `;
        });
        list.innerHTML = htmlStr;
    }
};