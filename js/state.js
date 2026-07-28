const State = {
    allPlayers: [],       
    availablePlayers: [], 
    teamsById: {},
    draftOrder: [],
    currentPick: 0,
    draftStarted: false,
    draftHistory: [],
    userTeamId: null, 
    
    // NEW: Store manager profiles calculated from history
    managerProfiles: {}, 
    
    settings: {
        numTeams: 12,
        draftMode: 'live',
        userTeamIndex: 1, 
        roster: {
            QB: { max: 1 }, RB: { max: 3 }, WR: { max: 3 }, 
            TE: { max: 1 }, Flex: { max: 2 }, PK: { max: 1 }, 
            DST: { max: 1 }, Bench: { max: 5 }, totalSize: 16
        }
    },

    teamTargets: [],
    advancedMetrics: [],

    parseAdvancedData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split('\t').map(v => v.trim());
            let obj = {};
            headers.forEach((h, idx) => {
                let val = values[idx];
                if (val && val.includes('%')) {
                    obj[h] = parseFloat(val.replace('%', ''));
                } else if (!isNaN(parseFloat(val)) && !val.includes(',')) {
                    obj[h] = parseFloat(val);
                } else {
                    obj[h] = val;
                }
            });
            parsed.push(obj);
        }
        return parsed;
    },

    mergeAdvancedMetrics(advancedDataArray) {
        this.advancedMetrics = [...this.advancedMetrics, ...advancedDataArray];
        advancedDataArray.forEach(advPlayer => {
            let mainPlayer = this.allPlayers.find(p => p.Player === advPlayer.Player);
            if (mainPlayer) {
                if (advPlayer['RZ TGT']) mainPlayer.rzTgt = advPlayer['RZ TGT'];
                if (advPlayer['YACON/ATT']) mainPlayer.yacAtt = advPlayer['YACON/ATT'];
                if (advPlayer['% TM']) mainPlayer.targetShare = advPlayer['% TM'];
            }
        });
    },
    
    parseTSV(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split('\t').map(v => v.trim());
            if (values.length < 5) continue;
            let player = {
                Player: values[headers.indexOf('Player')],
                Team: values[headers.indexOf('Team')],
                Pos: values[headers.indexOf('Pos')] === 'K' ? 'PK' : 
                     values[headers.indexOf('Pos')] === 'DEF' ? 'DST' : values[headers.indexOf('Pos')],
                ProjPts: parseFloat(values[headers.indexOf('2025 Projected Fantasy Points')]) || 0,
                VBD: parseFloat(values[headers.indexOf('VBD')]) || 0,
            };
            if(player.Player && player.Pos) parsed.push(player);
        }
        return parsed;
    },

    // NEW: Parse historical draft data to build CPU bot profiles
    parseHistory(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const profiles = {};

        // Skip header
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split('\t');
            if (cols.length < 5) continue;
            
            const round = parseInt(cols[0]);
            // Clean team names to handle slight formatting differences over the years
            const teamName = cols[2].replace(/,/g, '').trim(); 
            const pos = cols[4];

            if (!profiles[teamName]) {
                profiles[teamName] = { 
                    name: teamName, 
                    totalDrafts: 0, 
                    earlyRBs: 0, earlyWRs: 0, 
                    qbAvgRound: 0, qbCount: 0,
                    teAvgRound: 0, teCount: 0
                };
            }

            // Track Round 1-3 Strategy
            if (round <= 3) {
                if (pos === 'RB') profiles[teamName].earlyRBs++;
                if (pos === 'WR') profiles[teamName].earlyWRs++;
            }
            
            // Track QB/TE reach tendencies
            if (pos === 'QB' && round < 15) { // ignore late fliers
                profiles[teamName].qbAvgRound += round;
                profiles[teamName].qbCount++;
            }
            if (pos === 'TE' && round < 15) {
                profiles[teamName].teAvgRound += round;
                profiles[teamName].teCount++;
            }
        }

        // Finalize averages
        for (let key in profiles) {
            let p = profiles[key];
            p.qbAvgRound = p.qbCount > 0 ? (p.qbAvgRound / p.qbCount) : 10;
            p.teAvgRound = p.teCount > 0 ? (p.teAvgRound / p.teCount) : 10;
            
            // Calculate Core Strategy
            if (p.earlyRBs > p.earlyWRs * 1.5) p.strategy = "RB-Heavy";
            else if (p.earlyWRs > p.earlyRBs * 1.5) p.strategy = "Zero-RB";
            else p.strategy = "Balanced";

            p.draftsEarlyQB = p.qbAvgRound <= 5;
            p.draftsEarlyTE = p.teAvgRound <= 5;
        }

        this.managerProfiles = profiles;
    },

    initializeTeams() {
        this.teamsById = {};
        this.draftOrder = [];
        this.currentPick = 0;
        this.draftHistory = [];
        this.availablePlayers = [...this.allPlayers];
        
        // Convert profiles to an array to assign randomly to CPUs
        const availableProfiles = Object.values(this.managerProfiles);
        
        let teamIds = [];
        for (let i = 0; i < this.settings.numTeams; i++) {
            let id = `team-${i+1}`;
            let isUser = (i + 1 === parseInt(this.settings.userTeamIndex));
            
            if(isUser) this.userTeamId = id;

            // Assign a unique historical profile to each CPU
            let profile = null;
            let teamName = isUser ? "My Team" : `CPU ${i+1}`;
            
            if (!isUser && availableProfiles.length > 0) {
                // Pick a random historical manager for this CPU
                let profileIndex = Math.floor(Math.random() * availableProfiles.length);
                profile = availableProfiles.splice(profileIndex, 1)[0];
                teamName = profile.name; // Name the CPU after the historical manager!
            }

            this.teamsById[id] = {
                id: id,
                name: teamName,
                isCPU: this.settings.draftMode === 'mock' ? !isUser : false, 
                profile: profile, // Attach the AI profile
                roster: [],
                counts: { QB:0, RB:0, WR:0, TE:0, Flex:0, PK:0, DST:0, Bench:0 }
            };
            teamIds.push(id);
        }

        for (let r = 0; r < this.settings.roster.totalSize; r++) {
            const roundOrder = [...teamIds];
            if (r % 2 !== 0) roundOrder.reverse();
            this.draftOrder.push(...roundOrder);
        }
        this.draftStarted = true;
    }
};