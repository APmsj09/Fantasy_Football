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
            if (player.Player && player.Pos) parsed.push(player);
        }
        return parsed;
    },

    scoring: {
        passYds: 0.04, passTd: 4, int: -2,
        rushYds: 0.1, rushTd: 6, recYds: 0.1, recTd: 6, ppr: 1, fumLost: -2,
        fg: 3, xp: 1, sack: 1, turnover: 2, defTd: 6, safety: 2
    },

    // 1. Parse the raw counting stats
    parseProjectedData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');

            // Standardize Position names
            let rawPos = vals[headers.indexOf('Position')] || '';
            if (rawPos === 'K') rawPos = 'PK';
            if (rawPos === 'DEF') rawPos = 'DST';

            let p = {
                Player: vals[headers.indexOf('Player')],
                Pos: rawPos,
                Team: vals[headers.indexOf('Team')],
                stats: {
                    // Offense
                    passYds: parseFloat(vals[headers.indexOf('Pass Yds')]) || 0,
                    passTd: parseFloat(vals[headers.indexOf('Pass TD')]) || 0,
                    int: parseFloat(vals[headers.indexOf('INT')]) || 0,
                    rushYds: parseFloat(vals[headers.indexOf('Rush Yds')]) || 0,
                    rushTd: parseFloat(vals[headers.indexOf('Rush TD')]) || 0,
                    recYds: parseFloat(vals[headers.indexOf('Rec Yds')]) || 0,
                    recTd: parseFloat(vals[headers.indexOf('Rec TD')]) || 0,
                    rec: parseFloat(vals[headers.indexOf('Receptions')]) || 0,
                    fum: parseFloat(vals[headers.indexOf('Fumbles Lost')]) || 0,

                    // Kickers
                    fg: parseFloat(vals[headers.indexOf('FG')]) || parseFloat(vals[headers.indexOf('FGM')]) || 0,
                    xp: parseFloat(vals[headers.indexOf('XP')]) || parseFloat(vals[headers.indexOf('XPM')]) || 0,

                    // DST
                    sack: parseFloat(vals[headers.indexOf('Sacks')]) || parseFloat(vals[headers.indexOf('Sack')]) || 0,
                    defInt: parseFloat(vals[headers.indexOf('Def INT')]) || parseFloat(vals[headers.indexOf('INTs')]) || 0,
                    defFum: parseFloat(vals[headers.indexOf('Fum Rec')]) || parseFloat(vals[headers.indexOf('Def Fum')]) || 0,
                    defTd: parseFloat(vals[headers.indexOf('Def TD')]) || 0,
                    safety: parseFloat(vals[headers.indexOf('Safety')]) || parseFloat(vals[headers.indexOf('Safeties')]) || 0,

                    // Points Allowed Base (Usually standard projections just give base DST Points Allowed)
                    dstBasePts: parseFloat(vals[headers.indexOf('PA Pts')]) || 0,
                },
                ProjPts: 0,
                VBD: 0,
                AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
    },

    // 2. Calculate Base Points
    calculateProjections() {
        this.allPlayers.forEach(p => {
            let s = p.stats;

            if (p.Pos === 'PK') {
                // Distance Scoring: 3pts for <40, 4pts for 40-49, 5pts for 50+
                p.ProjPts = (s.fg0_39 * 3) + (s.fg40_49 * 4) + (s.fg50 * 5) + (s.xp * (this.scoring.xp || 1));
            }
            else if (p.Pos === 'DST') {
                // Defensive Scoring
                let turnoverPts = (s.defInt + s.defFum) * (this.scoring.turnover || 2);
                let sackPts = s.sack * (this.scoring.sack || 1);
                let tdPts = s.defTd * (this.scoring.defTd || 6);
                let safetyPts = s.safety * (this.scoring.safety || 2);
                let blkPts = s.blk * 2; // Standard 2pts for Blocked Kicks

                // Points Allowed Approximation (Base starting at ~100 pts minus total season points allowed penalty)
                let paBonus = Math.max(0, 100 - (s.ptsAllowed * 0.15));

                p.ProjPts = sackPts + turnoverPts + tdPts + safetyPts + blkPts + paBonus;
            }
            else {
                p.ProjPts =
                    (s.passYds * this.scoring.passYds) +
                    (s.passTd * this.scoring.passTd) +
                    (s.int * this.scoring.int) +
                    (s.rushYds * this.scoring.rushYds) +
                    (s.rushTd * this.scoring.rushTd) +
                    (s.recYds * this.scoring.recYds) +
                    (s.recTd * this.scoring.recTd) +
                    (s.rec * this.scoring.ppr) +
                    (s.fum * this.scoring.fumLost);

                // Fallback: If a site only provides generic "FPTS" for a defense, use that instead of counting it as 0
                if (p.Pos === 'DST' && p.ProjPts === 0) {
                    p.ProjPts = parseFloat(p.stats.dstBasePts || 100);
                }
            }
        });
    },

    // 3. Calculate Standard & Advanced VBD
    calculateVBD() {
        const baselines = {};
        const positions = ['QB', 'RB', 'WR', 'TE', 'PK', 'DST'];

        // Find baseline players (the worst starter at each position based on league size)
        positions.forEach(pos => {
            let starters = this.settings.numTeams * this.settings.roster[pos].max;
            // Flex approximation: add 50% of flex spots to RB and WR baselines
            if (pos === 'RB' || pos === 'WR') starters += Math.floor((this.settings.numTeams * this.settings.roster.Flex.max) / 2);

            let sortedPos = [...this.allPlayers].filter(p => p.Pos === pos).sort((a, b) => b.ProjPts - a.ProjPts);
            let baselinePlayer = sortedPos[Math.min(starters - 1, sortedPos.length - 1)];
            baselines[pos] = baselinePlayer ? baselinePlayer.ProjPts : 0;
        });

        this.allPlayers.forEach(p => {
            // Standard VBD
            let basePts = baselines[p.Pos] || 0;
            p.VBD = Math.max(0, p.ProjPts - basePts);

            // Advanced VBD Adjustments based on engineered features
            let adjMultiplier = 1.0;

            // Apply logic to engineered metrics calculated earlier
            if (p.trueCatchRate && p.trueCatchRate > 90) adjMultiplier += 0.05; // Elite Hands
            if (p.dropRate && p.dropRate > 10) adjMultiplier -= 0.05; // Drop Risk
            if (p.targetShare && p.targetShare >= 25) adjMultiplier += 0.10; // Elite Volume
            if (p.yaconPercent && p.yaconPercent >= 70) adjMultiplier += 0.10; // O-Line Independent (RB)
            if (p.trueAccuracy && p.trueAccuracy > 75) adjMultiplier += 0.05; // Elite QB Accuracy

            p.AdvVBD = p.VBD * adjMultiplier;
        });

        // Sort master list by Advanced VBD by default
        this.allPlayers.sort((a, b) => b.AdvVBD - a.AdvVBD);
        this.availablePlayers = [...this.allPlayers];
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

    // 1. Parse Defense File (def_proj_26.tsv)
    parseDefData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            let city = vals[headers.indexOf('City')] || '';
            let teamName = vals[headers.indexOf('Team')] || '';

            let p = {
                Player: `${city} ${teamName}`.trim(), // e.g., "Denver Broncos"
                Pos: 'DST',
                Team: vals[headers.indexOf('Abv')] || '', // e.g., "DEN"
                stats: {
                    defInt: parseFloat(vals[headers.indexOf('INT')]) || 0,
                    safety: parseFloat(vals[headers.indexOf('Safety')]) || 0,
                    sack: parseFloat(vals[headers.indexOf('Sacks')]) || 0,
                    tfl: parseFloat(vals[headers.indexOf('TFL')]) || 0,
                    defFum: parseFloat(vals[headers.indexOf('FR')]) || 0, // Fumble Recoveries
                    defTd: parseFloat(vals[headers.indexOf('DTD')]) || 0, // Defensive TDs
                    ptsAllowed: parseFloat(vals[headers.indexOf('Pts Allowed')]) || 0,
                    blk: parseFloat(vals[headers.indexOf('Blk')]) || 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player && p.Team) parsed.push(p);
        }
        return parsed;
    },

    // 2. Parse Kicker File (k_proj_26.tsv)
    parseKickerData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');

            // Extract Made Field Goals by Distance
            let fg1_19 = parseFloat(vals[headers.indexOf('1-19 M')]) || 0;
            let fg20_29 = parseFloat(vals[headers.indexOf('20-29 M')]) || 0;
            let fg30_39 = parseFloat(vals[headers.indexOf('30-39 M')]) || 0;
            let fg40_49 = parseFloat(vals[headers.indexOf('40-49 M')]) || 0;
            let fg50_plus = parseFloat(vals[headers.indexOf('50+ M')]) || 0;

            let p = {
                Player: vals[headers.indexOf('Player')],
                Pos: 'PK',
                Team: vals[headers.indexOf('Team')],
                stats: {
                    fgTotal: parseFloat(vals[headers.indexOf('FGM')]) || 0,
                    fg0_39: fg1_19 + fg20_29 + fg30_39,
                    fg40_49: fg40_49,
                    fg50: fg50_plus,
                    xp: parseFloat(vals[headers.indexOf('XPM')]) || 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
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
            let id = `team-${i + 1}`;
            let isUser = (i + 1 === parseInt(this.settings.userTeamIndex));

            if (isUser) this.userTeamId = id;

            // Assign a unique historical profile to each CPU
            let profile = null;
            let teamName = isUser ? "My Team" : `CPU ${i + 1}`;

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
                counts: { QB: 0, RB: 0, WR: 0, TE: 0, Flex: 0, PK: 0, DST: 0, Bench: 0 }
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