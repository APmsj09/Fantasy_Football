const State = {
    allPlayers: [],       // Holds original untouched player pool
    availablePlayers: [], // Remaining undrafted players
    teamsById: {},
    draftOrder: [],
    currentPick: 0,
    draftStarted: false,
    draftHistory: [],
    
    // Dynamic Settings populated from user input
    settings: {
        numTeams: 12,
        isMockDraft: false,
        userTeamIndex: 1, // 1 through numTeams
        roster: {
            QB: { max: 1 }, 
            RB: { max: 2 }, 
            WR: { max: 2 }, 
            TE: { max: 1 }, 
            Flex: { max: 2 }, 
            PK: { max: 1 }, 
            DST: { max: 1 },
            Bench: { max: 6 },
            totalSize: 16
        }
    },
    
    // Helper to extract TSV data
    parseTSV(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split('\t').map(v => v.trim());
            let player = {
                Player: values[headers.indexOf('Player')],
                Team: values[headers.indexOf('Team')],
                Pos: values[headers.indexOf('Pos')] === 'K' ? 'PK' : 
                     values[headers.indexOf('Pos')] === 'DEF' ? 'DST' : values[headers.indexOf('Pos')],
                ProjPts: parseFloat(values[headers.indexOf('2025 Projected Fantasy Points')]) || 0,
                VBD: parseFloat(values[headers.indexOf('VBD')]) || 0,
                Bye: values[headers.indexOf('Bye Week')] || ''
            };
            
            // Extract Weekly Projections
            for (let w = 1; w <= 18; w++) {
                let wkIndex = headers.indexOf(`Week ${w}`);
                player[`Week ${w}`] = wkIndex !== -1 ? (parseFloat(values[wkIndex]) || 0) : 0;
            }
            if(player.Player && player.Pos) parsed.push(player);
        }
        return parsed;
    },

    initializeTeams() {
        this.teamsById = {};
        this.draftOrder = [];
        this.currentPick = 0;
        this.draftHistory = [];
        this.availablePlayers = [...this.allPlayers];

        let teamIds = [];
        for (let i = 0; i < this.settings.numTeams; i++) {
            let id = `team-${i+1}`;
            // Mark user team specifically for Mock Draft mode
            let isUser = this.settings.isMockDraft && (i + 1 === parseInt(this.settings.userTeamIndex));
            
            this.teamsById[id] = {
                id: id,
                name: isUser ? "My Team" : `CPU Team ${i+1}`,
                isCPU: this.settings.isMockDraft ? !isUser : false,
                roster: [],
                counts: { QB:0, RB:0, WR:0, TE:0, Flex:0, PK:0, DST:0, Bench:0 }
            };
            teamIds.push(id);
        }

        // Generate Snake Draft Order
        for (let r = 0; r < this.settings.roster.totalSize; r++) {
            const roundOrder = [...teamIds];
            if (r % 2 !== 0) roundOrder.reverse();
            this.draftOrder.push(...roundOrder);
        }
        this.draftStarted = true;
    }
};