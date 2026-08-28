window.AutoDraft = {
    isDrafting: false,

    async processQueue() {
        if (!State.draftStarted || State.currentPick >= State.draftOrder.length || this.isDrafting) return;
        if (State.settings.draftMode === 'live') return;

        const teamId = State.draftOrder[State.currentPick];
        const team = State.teamsById[teamId];

        if (team && team.isCPU) {
            this.isDrafting = true;
            await new Promise(r => setTimeout(r, 400));
            if (!State.draftStarted || State.currentPick >= State.draftOrder.length || State.draftOrder[State.currentPick] !== teamId) {
                this.isDrafting = false;
                return;
            }
            this.makeCPUPick(team);
            this.isDrafting = false;

            UI.updateDraftBoard();
            this.processQueue();
        }
    },

    makeCPUPick(team) {
        let safeAvailablePlayers = State.availablePlayers.filter(p => State.settings.roster[p.Pos]);
        State.evaluateRosterFits(team, safeAvailablePlayers);

        const currentRound = Math.floor(State.currentPick / State.settings.numTeams) + 1;
        const currentOverallPick = State.currentPick + 1;

        let context = { currentRound, currentOverallPick, isCPU: true };

        let evaluatedWrapper = safeAvailablePlayers.map(p => {
            return {
                player: p,
                adjustedVBD: State.evaluateDraftValue(p, team, context).totalDraftValue
            };
        }).filter(item => item.adjustedVBD !== -999);

        evaluatedWrapper.sort((a, b) => b.adjustedVBD - a.adjustedVBD);

        let selectedPlayer = null;
        let slottedPos = null;

        for (let item of evaluatedWrapper) {
            let p = item.player;
            let pos = p.Pos;
            let posRoster = State.settings.roster[pos];
            let maxForPos = posRoster ? posRoster.max : 0;

            if ((team.counts[pos] || 0) < maxForPos) slottedPos = pos;
            else if (['RB', 'WR'].includes(pos) && team.counts['FlexRBWR'] < (State.settings.roster.FlexRBWR?.max || 0)) slottedPos = 'FlexRBWR';
            else if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < (State.settings.roster.Flex?.max || 0)) slottedPos = 'Flex';
            else if (['QB', 'RB', 'WR', 'TE'].includes(pos) && team.counts['Superflex'] < (State.settings.roster.Superflex?.max || 0)) slottedPos = 'Superflex';
            else if (team.counts['Bench'] < State.settings.roster.Bench.max) slottedPos = 'Bench';

            if (slottedPos) {
                selectedPlayer = p;
                break;
            }
        }

        if (selectedPlayer) {
            this.executeDraft(selectedPlayer, team, slottedPos);
        } else {
            State.currentPick++;
        }
    },

    executeDraft(player, team, slot) {
        const idx = State.availablePlayers.findIndex(p => p._cleanName === player._cleanName && p.Pos === player.Pos && p.Team === player.Team);
        if (idx !== -1) State.availablePlayers.splice(idx, 1);

        player.draftPickNum = State.currentPick + 1;

        team.roster.push({ ...player, slottedPos: slot });
        team.counts[slot]++;
        State.draftHistory.push({ pickIndex: State.currentPick, player: player, teamId: team.id, slot: slot });
        State.currentPick++;
    }
};

const AutoDraft = window.AutoDraft;
