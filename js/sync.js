window.DraftSync = {
    // 🛡️ Safe Base64 encoder that won't crash on emojis or special characters
    toSafeBase64(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
    },

    // 🛡️ Safe Base64 decoder
    fromSafeBase64(str) {
        return decodeURIComponent(atob(str).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    },

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

    showExportModal() {
        if (!State.draftStarted || State.draftHistory.length === 0) {
            return UI.showMessage("Export Failed", "There is no active draft progress to save.");
        }
        
        const data = this.generateExportData();
        const saveCode = this.toSafeBase64(JSON.stringify(data));
        
        const html = `
            <p class="text-sm text-slate-600 mb-3">Copy the code below to save your draft. You can paste it back in later to resume where you left off.</p>
            <textarea id="export-draft-data" class="w-full h-32 p-3 text-[10px] text-slate-500 font-mono border border-slate-300 rounded-lg bg-slate-50 focus:outline-none break-all" readonly>${saveCode}</textarea>
            <button onclick="DraftSync.copyToClipboard()" class="mt-3 w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm flex items-center justify-center gap-2">
                📋 Copy Save Code
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

    showImportModal() {
        const html = `
            <p class="text-sm text-slate-600 mb-3">Paste your saved code below to restore league settings, scoring rules, and draft progress.</p>
            <textarea id="import-draft-data" class="w-full h-32 p-3 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner text-slate-700" placeholder="Paste your save code here..."></textarea>
            <button onclick="DraftSync.processImport()" class="mt-3 w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-sm flex items-center justify-center gap-2">
                🚀 Restore & Resume Draft
            </button>
        `;
        UI.showMessage("📂 Load Saved Draft", html);
    },

    processImport() {
        // 🛡️ Data Guard: Ensure player base data is ready
        if (!State.allPlayers || State.allPlayers.length === 0) {
            return alert("Base player data is still loading. Please wait a moment and try again.");
        }

        const input = document.getElementById('import-draft-data').value.trim();
        if (!input) return alert("Please paste a save code first.");

        try {
            const jsonStr = this.fromSafeBase64(input);
            const data = JSON.parse(jsonStr);

            if (!data.history || !data.teams) throw new Error("Invalid Save File Structure");

            // 1. Restore Settings & Scoring
            State.settings = data.settings;
            State.scoring = data.scoring;
            State.userTeamId = data.userTeamId;

            // 2. Recalculate Projections for scoring rules
            State.calculateProjections();
            State.applyDynamicDSTSOS();
            State.calculateVBD();

            // 3. Reset and Rebuild Draft State
            State.teamsById = {};
            State.draftOrder = [];
            State.draftHistory = [];
            State.currentPick = 0;
            State.availablePlayers = [...State.allPlayers];

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

            // 4. Replay Pick History
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
            
            const closeBtn = document.getElementById('message-modal-close');
            if (closeBtn) closeBtn.click();
            
            UI.switchTab('drafting-screen');
            UI.updateDraftBoard();

            if (State.settings.draftMode === 'mock') {
                AutoDraft.processQueue();
            }

        } catch (err) {
            console.error("Import Error:", err);
            alert("Failed to load draft. The save code may be corrupted or invalid.");
        }
    }
};
