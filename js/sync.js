window.DraftSync = {
    // 1. Generate the Save Data
    generateExportData() {
        return {
            timestamp: Date.now(),
            settings: State.settings,
            scoring: State.scoring,
            userTeamId: State.userTeamId,
            teams: Object.values(State.teamsById).map(t => ({
                id: t.id,
                name: t.name,
                isCPU: t.isCPU,
                profileName: t.profile ? t.profile.name : null
            })),
            history: State.draftHistory.map(h => ({
                pickIndex: h.pickIndex,
                teamId: h.teamId,
                slot: h.slot,
                cleanName: h.player._cleanName,
                pos: h.player.Pos,
                team: h.player.Team
            }))
        };
    },

    // 2. Show the Export Modal
    showExportModal() {
        if (!State.draftStarted || State.draftHistory.length === 0) {
            return UI.showMessage("Export Failed", "There is no active draft progress to save.");
        }
        
        // Convert to Base64 to make it look like a clean "Save Code" instead of a messy JSON string
        const data = this.generateExportData();
        const saveCode = btoa(JSON.stringify(data));
        
        const html = `
            <p class="text-sm text-slate-600 mb-3">Copy the code below to save your draft progress. You can paste it into the Import tool later to resume exactly where you left off.</p>
            <textarea id="export-draft-data" class="w-full h-32 p-3 text-[10px] text-slate-500 font-mono border border-slate-300 rounded-lg bg-slate-50 focus:outline-none break-all" readonly>${saveCode}</textarea>
            <button onclick="DraftSync.copyToClipboard()" class="mt-3 w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copy Save Code
            </button>
        `;
        UI.showMessage("💾 Save Draft Progress", html);
    },

    copyToClipboard() {
        const copyText = document.getElementById("export-draft-data");
        copyText.select();
        document.execCommand("copy");
        
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = `✅ Copied to Clipboard!`;
        btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
        btn.classList.replace('hover:bg-indigo-700', 'hover:bg-emerald-700');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('bg-emerald-600', 'bg-indigo-600');
            btn.classList.replace('hover:bg-emerald-700', 'hover:bg-indigo-700');
        }, 2000);
    },

    // 3. Show the Import Modal
    showImportModal() {
        const html = `
            <p class="text-sm text-slate-600 mb-3">Paste your previously saved draft code below to instantly restore your league settings, scoring rules, and draft board.</p>
            <textarea id="import-draft-data" class="w-full h-32 p-3 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner text-slate-700" placeholder="Paste your save code here..."></textarea>
            <button onclick="DraftSync.processImport()" class="mt-3 w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-sm flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Restore & Resume Draft
            </button>
        `;
        UI.showMessage("📂 Load Saved Draft", html);
    },

    // 4. Process the Import and Rebuild the App State
    processImport() {
        const input = document.getElementById('import-draft-data').value.trim();
        if (!input) return alert("Please paste a save code first.");

        try {
            // Decode Base64 and parse JSON
            const jsonStr = atob(input);
            const data = JSON.parse(jsonStr);

            if (!data.history || !data.teams) throw new Error("Invalid Save File Structure");

            // 1. Restore Core Settings & Scoring
            State.settings = data.settings;
            State.scoring = data.scoring;
            State.userTeamId = data.userTeamId;

            // 2. Recalculate VBD/Projections to match the imported scoring settings
            State.calculateProjections();
            State.applyDynamicDSTSOS();
            State.calculateVBD();

            // 3. Re-initialize the Draft Board
            State.teamsById = {};
            State.draftOrder = [];
            State.draftHistory = [];
            State.currentPick = 0;
            State.availablePlayers = [...State.allPlayers]; // Reset board fully

            data.teams.forEach(t => {
                let profile = null;
                if (t.profileName && State.managerProfiles) {
                    profile = Object.values(State.managerProfiles).find(p => p.name === t.profileName) || null;
                }
                State.teamsById[t.id] = {
                    id: t.id,
                    name: t.name,
                    isCPU: t.isCPU,
                    profile: profile,
                    roster: [],
                    counts: { QB: 0, RB: 0, WR: 0, TE: 0, FlexRBWR: 0, Flex: 0, Superflex: 0, PK: 0, DST: 0, Bench: 0 }
                };
            });

            const teamIds = data.teams.map(t => t.id);
            for (let r = 0; r < State.settings.roster.totalSize; r++) {
                const roundOrder = [...teamIds];
                if (r % 2 !== 0) roundOrder.reverse();
                State.draftOrder.push(...roundOrder);
            }

            // 4. Ghost-Draft the History to rebuild rosters and the available player pool
            data.history.forEach(h => {
                let team = State.teamsById[h.teamId];
                let playerIndex = State.availablePlayers.findIndex(p => p._cleanName === h.cleanName && p.Pos === h.pos && p.Team === h.team);
                
                if (playerIndex !== -1 && team) {
                    let player = State.availablePlayers.splice(playerIndex, 1)[0];
                    player.draftPickNum = h.pickIndex + 1;
                    
                    team.roster.push({ ...player, slottedPos: h.slot });
                    team.counts[h.slot]++;
                    State.draftHistory.push({ pickIndex: h.pickIndex, player: player, teamId: team.id, slot: h.slot });
                    State.currentPick++;
                }
            });

            // 5. Finalize UI State
            State.draftStarted = true;
            
            // Close Modal
            document.getElementById('message-modal-close').click(); 
            
            // Switch tabs and update board
            UI.switchTab('drafting-screen');
            UI.updateDraftBoard();

            // Resume Auto-Draft if the bot was on the clock
            if (State.settings.draftMode === 'mock') {
                AutoDraft.processQueue();
            }

        } catch (err) {
            console.error("Import Error:", err);
            alert("Failed to load draft. The save code may be corrupted or invalid.");
        }
    }
};
