const AutoDraft = {
    isDrafting: false,

    async processQueue() {
        if (!State.draftStarted || State.currentPick >= State.draftOrder.length || this.isDrafting) return;
        
        const teamId = State.draftOrder[State.currentPick];
        const team = State.teamsById[teamId];

        // If it's a CPU team, let the bot draft
        if (team.isCPU) {
            this.isDrafting = true;
            UI.showMessage("Mock Draft", `${team.name} is on the clock...`);
            
            // Artificial delay to make it feel like a real draft
            await new Promise(r => setTimeout(r, 800)); 
            
            this.makeCPUPick(team);
            this.isDrafting = false;
            
            // Call next tick
            UI.updateDraftBoard();
            this.processQueue();
        }
    },

    makeCPUPick(team) {
        // Sort available players by VBD (Value Based Drafting)
        let bestPlayers = [...State.availablePlayers].sort((a, b) => b.VBD - a.VBD);
        let selectedPlayer = null;
        let slottedPos = null;

        for (let player of bestPlayers) {
            let pos = player.Pos;
            
            // 1. Can they fit in standard position?
            if (team.counts[pos] < State.settings.roster[pos].max) {
                slottedPos = pos;
            } 
            // 2. Can they fit in FLEX?
            else if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < State.settings.roster.Flex.max) {
                slottedPos = 'Flex';
            } 
            // 3. Can they fit on the Bench?
            else if (team.counts['Bench'] < State.settings.roster.Bench.max) {
                slottedPos = 'Bench';
            }

            if (slottedPos) {
                selectedPlayer = player;
                break; // We found the highest VBD player that fits the roster!
            }
        }

        if (selectedPlayer) {
            this.executeDraft(selectedPlayer, team, slottedPos);
        } else {
            console.error(`${team.name} could not find a valid player to draft!`);
        }
    },

    executeDraft(player, team, slot) {
        // Remove from available pool
        State.availablePlayers = State.availablePlayers.filter(p => p.Player !== player.Player);
        
        // Add to team
        team.roster.push({ ...player, slottedPos: slot });
        team.counts[slot]++;
        
        // Log history
        State.draftHistory.push({
            pickIndex: State.currentPick,
            player: player,
            teamId: team.id,
            slot: slot
        });

        State.currentPick++;
    }
};