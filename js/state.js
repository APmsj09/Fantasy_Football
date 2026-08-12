const State = {
    allPlayers: [],
    availablePlayers: [],
    teamsById: {},
    draftOrder: [],
    currentPick: 0,
    draftStarted: false,
    draftHistory: [],
    userTeamId: null,
    managerProfiles: {},
    handcuffData: [],

    settings: {
        numTeams: 12,
        draftMode: 'live',
        userTeamIndex: 1,
        startWeek: 1, endWeek: 17, decimalPlaces: 2,
        roster: {
            QB: { max: 1 }, RB: { max: 2 }, WR: { max: 2 }, TE: { max: 1 },
            FlexRBWR: { max: 0 }, Flex: { max: 2 }, Superflex: { max: 0 },
            PK: { max: 1 }, DST: { max: 1 }, Bench: { max: 6 }, totalSize: 16
        }
    },

    teamTargets: [],
    advancedMetrics: [],
    sosData: [],
    olRankings: [],
    draftSortKey: 'AdvVBD',
    draftSortAsc: false,

    _simCache: { qb: [], rb: [], wr: [], te: [], pk: [], dst: [], flex: [] },

    normalizeTeam(team) {
        if (!team) return '';
        let t = team.toUpperCase().trim();
        const map = {
            'JAC': 'JAX', 'LAR': 'LA', 'SFO': 'SF', 'NWE': 'NE',
            'KCC': 'KC', 'TAM': 'TB', 'TBB': 'TB', 'GBP': 'GB',
            'NOR': 'NO', 'WSH': 'WAS', 'ARZ': 'ARI', 'HST': 'HOU',
            'CLV': 'CLE', 'BLV': 'BAL', 'OAK': 'LV', 'SD': 'LAC',
            'DENVER BRONCOS': 'DEN', 'BRONCOS': 'DEN',
            'PHILADELPHIA EAGLES': 'PHI', 'EAGLES': 'PHI',

            // FIX: Map Rams consistently to 'LA' to match player data and the 'LAR' key above
            'LOS ANGELES RAMS': 'LA', 'RAMS': 'LA', 'LA RAMS': 'LA',

            'CHICAGO BEARS': 'CHI', 'BEARS': 'CHI',
            'TAMPA BAY BUCCANEERS': 'TB', 'BUCCANEERS': 'TB',
            'BUFFALO BILLS': 'BUF', 'BILLS': 'BUF',
            'CAROLINA PANTHERS': 'CAR', 'PANTHERS': 'CAR',
            'SAN FRANCISCO 49ERS': 'SF', '49ERS': 'SF',
            'INDIANAPOLIS COLTS': 'IND', 'COLTS': 'IND',

            // FIX: Added 'LA CHARGERS' just to be safe
            'LOS ANGELES CHARGERS': 'LAC', 'CHARGERS': 'LAC', 'LA CHARGERS': 'LAC',

            'ATLANTA FALCONS': 'ATL', 'FALCONS': 'ATL',
            'DETROIT LIONS': 'DET', 'LIONS': 'DET',
            'MINNESOTA VIKINGS': 'MIN', 'VIKINGS': 'MIN',
            'DALLAS COWBOYS': 'DAL', 'COWBOYS': 'DAL',
            'SEATTLE SEAHAWKS': 'SEA', 'SEAHAWKS': 'SEA',
            'NEW ENGLAND PATRIOTS': 'NE', 'PATRIOTS': 'NE',
            'NEW ORLEANS SAINTS': 'NO', 'SAINTS': 'NO',
            'NEW YORK JETS': 'NYJ', 'JETS': 'NYJ',
            'KANSAS CITY CHIEFS': 'KC', 'CHIEFS': 'KC',
            'NEW YORK GIANTS': 'NYG', 'GIANTS': 'NYG',
            'ARIZONA CARDINALS': 'ARI', 'CARDINALS': 'ARI',
            'PITTSBURGH STEELERS': 'PIT', 'STEELERS': 'PIT',
            'JACKSONVILLE JAGUARS': 'JAX', 'JAGUARS': 'JAX',
            'BALTIMORE RAVENS': 'BAL', 'RAVENS': 'BAL',
            'MIAMI DOLPHINS': 'MIA', 'DOLPHINS': 'MIA',
            'GREEN BAY PACKERS': 'GB', 'PACKERS': 'GB',
            'HOUSTON TEXANS': 'HOU', 'TEXANS': 'HOU',
            'CINCINNATI BENGALS': 'CIN', 'BENGALS': 'CIN',
            'LAS VEGAS RAIDERS': 'LV', 'RAIDERS': 'LV',
            'WASHINGTON COMMANDERS': 'WAS', 'COMMANDERS': 'WAS',
            'TENNESSEE TITANS': 'TEN', 'TITANS': 'TEN',
            'CLEVELAND BROWNS': 'CLE', 'BROWNS': 'CLE'
        };
        return map[t] || t;
    },

    normalizePos(pos) {
        if (!pos) return '';
        let p = pos.toUpperCase().trim();
        if (p === 'K') return 'PK';
        if (p === 'DEF' || p === 'D/ST') return 'DST';
        if (p === 'HB' || p === 'FB') return 'RB';
        if (p === 'EDGE') return 'DL';
        return p;
    },

    // Helper: Checks if a position is Flex/Superflex eligible under active roster settings
    isPositionFlexEligible(pos) {
        const r = this.settings.roster;
        if (!r) return false;
        if (['RB', 'WR'].includes(pos) && (r.FlexRBWR?.max > 0 || r.Flex?.max > 0 || r.Superflex?.max > 0)) return true;
        if (pos === 'TE' && (r.Flex?.max > 0 || r.Superflex?.max > 0)) return true;
        if (pos === 'QB' && r.Superflex?.max > 0) return true;
        return false;
    },

    normalizeName(name) {
        if (!name) return '';
        let clean = name.toLowerCase().trim();
        clean = clean.replace(/\b(jr\.?|sr\.?|iii?|iv|v)\b/g, '');
        clean = clean.replace(/[.,'"\-]/g, '');
        clean = clean.replace(/\s+/g, ' ').trim();

        const aliases = {
            'marquise brown': 'hollywood brown',
            'nathaniel dell': 'tank dell',
            'gabriel davis': 'gabe davis',
            'mitchell trubisky': 'mitch trubisky',
            'patrick mahomes i': 'patrick mahomes',
            'patrick mahomes ii': 'patrick mahomes',
            'patrick mahomes iii': 'patrick mahomes',
            'chris brooks': 'christopher brooks',
            'kenny gainwell': 'kenneth gainwell',
            'chig okonkwo': 'chigoziem okonkwo'
        };

        return aliases[clean] || clean;
    },

    enrichPlayerMap() {
        this.allPlayers.forEach(p => {
            p._cleanName = this.normalizeName(p.Player);
            p._noSpaceName = p._cleanName.replace(/\s/g, '');
            p._cleanTeam = this.normalizeTeam(p.Team);
            p._cleanPos = this.normalizePos(p.Pos);

            let nameParts = p._cleanName.split(' ');
            if (nameParts.length >= 2) {
                p._firstInitial = nameParts[0][0];
                p._lastName = nameParts[nameParts.length - 1];
            }
        });
    },

    matchPlayerFast(name, team, pos) {
        let cleanName = this.normalizeName(name);
        let noSpaceName = cleanName.replace(/\s/g, '');
        let nTeam = this.normalizeTeam(team);
        let nPos = this.normalizePos(pos);

        if (!this.allPlayers || !this.allPlayers.length) return null;

        if (nPos === 'DST') {
            return this.allPlayers.find(p => p._cleanPos === 'DST' &&
                (p._cleanTeam === nTeam || p._cleanName.includes(cleanName))
            );
        }

        let exact = this.allPlayers.find(p => p._cleanName === cleanName);
        if (exact) return exact;

        let exactNoSpace = this.allPlayers.find(p => p._noSpaceName === noSpaceName);
        if (exactNoSpace) return exactNoSpace;

        let nameParts = cleanName.split(' ');
        if (nameParts.length >= 2) {
            let firstInitial = nameParts[0][0];
            let lastName = nameParts[nameParts.length - 1];

            let sameTeamPosMatch = this.allPlayers.find(p => {
                const sameTeam = (p._cleanTeam === nTeam) || !nTeam || !p.Team;
                const samePos = (p._cleanPos === nPos) || !nPos || !p.Pos;
                if (!sameTeam || !samePos) return false;

                // Require at least first initial + last name match to prevent name collisions
                const sameInitialLastName = p._firstInitial === firstInitial && p._lastName === lastName;
                const nameContains = p._cleanName.includes(cleanName) || cleanName.includes(p._cleanName);
                return sameInitialLastName || nameContains;
            });

            if (sameTeamPosMatch) return sameTeamPosMatch;
        }

        return this.allPlayers.find(p => {
            let isSameTeamAndPos = (p._cleanTeam === nTeam) && (p._cleanPos === nPos);
            return isSameTeamAndPos && (p._cleanName.includes(cleanName) || cleanName.includes(p._cleanName));
        }) || null;
    },

    // ===========================================================
    // TEAM ADVANCED STATS STATE & PARSERS
    // ===========================================================
    teamAdvPass: {},
    teamAdvRush: {},
    teamAdvRec: {},

    parseTeamAdvPassData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return {};
        const headers = rows[0].split('\t').map(h => h.trim());
        const data = {};

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            const rawTeam = vals[headers.indexOf('Team')];
            if (!rawTeam) continue;
            const team = this.normalizeTeam(rawTeam);

            data[team] = {
                prssPct: parseFloat(vals[headers.indexOf('Prss%')]) || 0,
                pktTime: parseFloat(vals[headers.indexOf('PktTime')]) || 0,
                onTgtPct: parseFloat(vals[headers.indexOf('OnTgt%')]) || 0,
                badPct: parseFloat(vals[headers.indexOf('Bad%')]) || 0,
                playActionYds: parseFloat(vals[headers.indexOf('PlayActionPassYds')]) || 0,
                rpoYds: parseFloat(vals[headers.indexOf('RPOYds')]) || 0,
                rpoPlays: parseFloat(vals[headers.indexOf('RPOPlays')]) || 0,
                dropPct: parseFloat(vals[headers.indexOf('Drop%')]) || 0,
                bltz: parseFloat(vals[headers.indexOf('Bltz')]) || 0,
                scrmYds: parseFloat(vals[headers.indexOf('Yds/Scr')]) || 0
            };
        }
        this.teamAdvPass = data;
        return data;
    },

    parseDSTActualsData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim().toUpperCase());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 4) continue;

            let obj = {};
            headers.forEach((h, idx) => {
                let val = vals[idx] || '';
                let cleanVal = val.replace(/,/g, '');
                if (cleanVal !== '' && !isNaN(cleanVal)) {
                    obj[h] = parseFloat(cleanVal);
                } else {
                    obj[h] = val;
                }
            });
            parsed.push(obj);
        }
        return parsed;
    },

    mergeDSTActualsData(dataArray) {
        dataArray.forEach(row => {
            const playerStr = row['PLAYER'];
            const teamStr = row['TEAM'];
            if (!playerStr || !teamStr) return;

            // Match using exact casing/team string
            let p = this.matchPlayerFast(playerStr, teamStr, 'DST');
            if (!p) return;

            if (!p.pastStats) p.pastStats = {};
            let ps = p.pastStats;

            if (row['G'] !== undefined) ps.gp = row['G'];
            if (row['SACK'] !== undefined) ps.sack = row['SACK'];
            if (row['INT'] !== undefined) ps.defInt = row['INT'];
            if (row['FR'] !== undefined) ps.defFum = row['FR'];
            if (row['FF'] !== undefined) ps.ff = row['FF'];
            if (row['DEF TD'] !== undefined) ps.defTd = row['DEF TD'];
            if (row['SFTY'] !== undefined) ps.safety = row['SFTY'];
            if (row['SPC TD'] !== undefined) ps.spcTd = row['SPC TD'];
        });
    },

    parseTeamAdvRushData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return {};
        const headers = rows[0].split('\t').map(h => h.trim());
        const data = {};

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            const rawTeam = vals[headers.indexOf('Team')];
            if (!rawTeam) continue;
            const team = this.normalizeTeam(rawTeam);

            const att = parseFloat(vals[headers.indexOf('Att')]) || 1;
            const firstDowns = parseFloat(vals[headers.indexOf('1D')]) || 0;

            data[team] = {
                ybcAtt: parseFloat(vals[headers.indexOf('YBC/Att')]) || 0,
                yacAtt: parseFloat(vals[headers.indexOf('YAC/Att')]) || 0,
                brkTkl: parseFloat(vals[headers.indexOf('BrkTkl')]) || 0,
                attPerBrk: parseFloat(vals[headers.indexOf('Att/Br')]) || 0,
                firstDownRate: att > 0 ? (firstDowns / att) * 100 : 0
            };
        }
        this.teamAdvRush = data;
        return data;
    },

    parseTeamAdvRecData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return {};
        const headers = rows[0].split('\t').map(h => h.trim());
        const data = {};

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            const rawTeam = vals[headers.indexOf('Team')];
            if (!rawTeam) continue;
            const team = this.normalizeTeam(rawTeam);

            data[team] = {
                yacPerRec: parseFloat(vals[headers.indexOf('YAC/R')]) || 0,
                ybcPerRec: parseFloat(vals[headers.indexOf('YBC/R')]) || 0,
                adot: parseFloat(vals[headers.indexOf('ADOT')]) || 0,
                dropPct: parseFloat(vals[headers.indexOf('Drop%')]) || 0,
                brkTkl: parseFloat(vals[headers.indexOf('BrkTkl')]) || 0
            };
        }
        this.teamAdvRec = data;
        return data;
    },

    parseTeamTargetDistData(text) {
        const parsed = this.parseAdvancedData(text);
        const map = {};
        parsed.forEach(row => {
            if (row.Team) {
                row.Team = this.normalizeTeam(row.Team); // Centralized Normalization
                map[row.Team] = row;
            }
        });
        this.teamTargetsMap = map;
        return parsed;
    },

    parseScheduleData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        // UpperCase headers to standardize
        const headers = rows[0].split('\t').map(h => h.trim().toUpperCase());
        const schedule = {};

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            const team = this.normalizeTeam(vals[0]); // First column is the Team
            if (!team) continue;

            schedule[team] = {};
            for (let w = 1; w <= 18; w++) {
                // Check if the header is just "1" or "W1"
                let headerKey = headers.includes(`W${w}`) ? `W${w}` : `${w}`;
                let idx = headers.indexOf(headerKey);

                if (idx !== -1) {
                    schedule[team][w] = vals[idx];
                }
            }
        }
        this.nflSchedule = schedule;
    },

    parseHandcuffData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];

        // Uppercase all headers to handle any capitalization format
        const headers = rows[0].split('\t').map(h => h.trim().toUpperCase());
        const parsed = [];

        const teamIdx = headers.indexOf('TEAM');
        const starterIdx = headers.findIndex(h => h.includes('STARTER'));
        const handcuffIdx = headers.findIndex(h => h.includes('HANDCUFF'));

        if (starterIdx === -1 || handcuffIdx === -1) return [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length <= Math.max(starterIdx, handcuffIdx)) continue;

            const team = teamIdx !== -1 ? this.normalizeTeam(vals[teamIdx]) : '';
            const starter = vals[starterIdx];
            const handcuff = vals[handcuffIdx];

            if (!starter || !handcuff) continue;
            parsed.push({ team, starter, handcuff });
        }
        return parsed;
    },

    mergeHandcuffData(handcuffList) {
        this.handcuffData = handcuffList;
        handcuffList.forEach(entry => {
            // Match starter with team context; match handcuff globally by name to prevent team mismatches
            let starterPlayer = this.matchPlayerFast(entry.starter, entry.team, 'RB');
            let handcuffPlayer = this.matchPlayerFast(entry.handcuff, '', 'RB');

            if (starterPlayer) {
                starterPlayer.isRBStarter = true;
                starterPlayer.handcuffName = entry.handcuff;
            }
            if (handcuffPlayer) {
                handcuffPlayer.isRBHandcuff = true;
                handcuffPlayer.starterName = entry.starter;
            }
        });
    },

    parseOLRankData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];

        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 5) continue;

            const rank = parseInt(vals[headers.indexOf('Rank')], 10);
            const tier = vals[headers.indexOf('Tier')] || '';
            const teamName = vals[headers.indexOf('Team')] || '';

            // Dynamically find columns in case the year changes (e.g., "2026 Run Blk")
            const runBlkIdx = headers.findIndex(h => h.includes('Run Blk'));
            const passBlkIdx = headers.findIndex(h => h.includes('Pass Blk'));

            const runBlk = runBlkIdx !== -1 ? parseInt(vals[runBlkIdx], 10) : null;
            const passBlk = passBlkIdx !== -1 ? parseInt(vals[passBlkIdx], 10) : null;
            if (!teamName) continue;

            parsed.push({
                rank: isNaN(rank) ? null : rank,
                tier,
                team: this.normalizeTeam(teamName),
                runBlk: isNaN(runBlk) ? null : runBlk,
                passBlk: isNaN(passBlk) ? null : passBlk,
                teamDisplay: teamName
            });
        }

        return parsed;
    },

    mergeOLRankData(olRankList) {
        this.olRankings = olRankList;

        const rankMap = new Map((olRankList || []).map(entry => [entry.team, entry]));
        this.allPlayers.forEach(player => {
            const entry = rankMap.get(this.normalizeTeam(player.Team));
            if (!entry) return;

            player.olRank = entry.rank;
            player.olTier = entry.tier;
            player.olRunBlk = entry.runBlk;
            player.olPassBlk = entry.passBlk;
        });
    },

    parseADPData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 4) continue;

            const name = vals[headers.indexOf('Name')] || vals[headers.indexOf('Player')];
            const team = this.normalizeTeam(vals[headers.indexOf('Team')]);
            const posKey = headers.indexOf('POS.RK') >= 0 ? 'POS.RK' : (headers.indexOf('POS') >= 0 ? 'POS' : null);
            const pos = this.normalizePos(posKey ? vals[headers.indexOf(posKey)] : '');
            const adpIndex = headers.indexOf('REAL-TIME');
            const adpValue = parseFloat(adpIndex >= 0 ? vals[adpIndex] : (headers.indexOf('ADP') >= 0 ? vals[headers.indexOf('ADP')] : (headers.indexOf('Pick Num') >= 0 ? vals[headers.indexOf('Pick Num')] : '')));

            if (!name) continue;
            parsed.push({ name, team, pos, adp: isNaN(adpValue) ? null : adpValue });
        }
        return parsed;
    },

    mergeADPData(adpList) {
        adpList.forEach(entry => {
            const player = this.matchPlayerFast(entry.name, entry.team, entry.pos);
            if (player) {
                player.adp = entry.adp;
            }
        });
    },

    parseDepthChartData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 4) continue;

            const team = this.normalizeTeam(vals[headers.indexOf('Team')]);
            const playerName = vals[headers.indexOf('Player')];
            const position = this.normalizePos(vals[headers.indexOf('Position')]);

            const rawDepth = vals[headers.indexOf('Depth')] || '';
            const depth = parseInt(rawDepth.replace(/\D/g, ''), 10);

            const ecr = parseFloat(vals[headers.indexOf('ECR')]);

            if (!playerName) continue;
            parsed.push({ name: playerName, team, pos: position, depth: isNaN(depth) ? null : depth, ecr: isNaN(ecr) ? null : ecr });
        }
        return parsed;
    },

    mergeDepthChartData(depthList) {
        depthList.forEach(entry => {
            const player = this.matchPlayerFast(entry.name, entry.team, entry.pos);
            if (player) {
                player.depthChart = entry.depth;
                player.ecr = entry.ecr;
            }
        });
    },

    parseSnapCountData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 4) continue;

            const playerName = vals[headers.indexOf('PLAYER')] || vals[headers.indexOf('Player')];
            const position = this.normalizePos(vals[headers.indexOf('POS')] || vals[headers.indexOf('Position')]);
            const team = this.normalizeTeam(vals[headers.indexOf('TEAM')] || vals[headers.indexOf('Team')]);
            const snapShare = parseFloat(vals[headers.indexOf('SNAP %')] || vals[headers.indexOf('SNAP%')]);
            const snaps = parseInt(vals[headers.indexOf('SNAPS')], 10);
            const games = parseInt(vals[headers.indexOf('GAMES')], 10);

            if (!playerName) continue;
            parsed.push({ name: playerName, team, pos: position, snapShare: isNaN(snapShare) ? null : snapShare, snaps, games });
        }
        return parsed;
    },

    mergeSnapCountData(snapList) {
        snapList.forEach(entry => {
            const player = this.matchPlayerFast(entry.name, entry.team, entry.pos);
            if (player) {
                player.snapShare = entry.snapShare;
                player.snaps = entry.snaps;
                player.games = entry.games;
            }
        });
    },

    mergeActualStatsData(statsList) {
        if (!statsList || !Array.isArray(statsList)) return;
        this.advancedMetrics = [...this.advancedMetrics, ...statsList];

        // Number sanitation helper
        const cleanNum = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            let num = parseFloat(String(val).replace(/,/g, '').replace('%', '').trim());
            return isNaN(num) ? 0 : num;
        };

        statsList.forEach(row => {
            const player = row.Player || row.PLAYER;
            const team = row.Team || row.TEAM;
            if (!player) return;

            let p = this.matchPlayerFast(player, team, '');
            if (!p) return;

            if (!p.pastStats) p.pastStats = {};
            let ps = p.pastStats;

            // Games Played
            if (row['G'] !== undefined) ps.gp = cleanNum(row['G']) || 17;

            // Passing
            if (row['CMP'] !== undefined) ps.passCmp = cleanNum(row['CMP']);
            if (row['PassATT'] !== undefined) ps.passAtt = cleanNum(row['PassATT']);
            if (row['PassATTYDS'] !== undefined) ps.passYds = cleanNum(row['PassATTYDS']);
            if (row['PassATTTD'] !== undefined) ps.passTd = cleanNum(row['PassATTTD']);
            if (row['PassATTY/A'] !== undefined) ps.passYpa = cleanNum(row['PassATTY/A']);
            if (row['INT'] !== undefined) ps.int = cleanNum(row['INT']);

            // Rushing
            if (row['RushATT'] !== undefined) ps.rushAtt = cleanNum(row['RushATT']);
            if (row['RushYDS'] !== undefined) ps.rushYds = cleanNum(row['RushYDS']);
            if (row['RushY/A'] !== undefined) ps.rushYpa = cleanNum(row['RushY/A']);

            if (p.Pos === 'QB' && row['TD'] !== undefined) {
                ps.rushTd = cleanNum(row['TD']);
            } else if (row['RushTD'] !== undefined) {
                ps.rushTd = cleanNum(row['RushTD']);
            }

            // Receiving
            if (row['TGT'] !== undefined) ps.targets = cleanNum(row['TGT']);
            if (row['REC'] !== undefined) ps.rec = cleanNum(row['REC']);
            if (row['RecYDS'] !== undefined) ps.recYds = cleanNum(row['RecYDS']);
            if (row['RecTD'] !== undefined) ps.recTd = cleanNum(row['RecTD']);
            if (row['Y/R'] !== undefined) ps.recYpr = cleanNum(row['Y/R']);

            // Target Share %
            if (row['TGT %'] !== undefined) {
                p.targetShare = cleanNum(row['TGT %']);
                ps.targetShare = p.targetShare;
            }

            // Big Plays (20+ Yard Plays)
            if (row['20+Rush'] !== undefined) ps.bigRush = cleanNum(row['20+Rush']);
            if (row['20+Rec'] !== undefined) ps.bigRec = cleanNum(row['20+Rec']);
            ps.bigPlays = (ps.bigRush || 0) + (ps.bigRec || 0);

            // Fumbles Lost
            if (row['FL'] !== undefined) ps.fum = cleanNum(row['FL']);

            // Total TDs
            ps.totalTd = (ps.passTd || 0) + (ps.rushTd || 0) + (ps.recTd || 0);
        });
    },

    parseSOSData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 4) continue;

            let obj = {
                Player: vals[headers.indexOf('Player')],
                Team: this.normalizeTeam(vals[headers.indexOf('Team')]),
                Pos: this.normalizePos(vals[headers.indexOf('Pos')]),
                avgStars: parseFloat(vals[headers.indexOf('Avg Stars')]) || 3.0,
                weeks: {},
                byeWeek: null
            };

            for (let w = 1; w <= 18; w++) {
                let key = `W${w}`;
                let idx = headers.indexOf(key);
                if (idx !== -1) {
                    let val = vals[idx].toUpperCase();
                    if (val === 'BYE') {
                        obj.weeks[key] = 'BYE';
                        obj.byeWeek = w;
                    } else {
                        obj.weeks[key] = parseFloat(val) || 3.0;
                    }
                }
            }
            parsed.push(obj);
        }
        return parsed;
    },

    mergeSOSData(sosList) {
        if (!sosList || !Array.isArray(sosList)) return;
        this.sosData = sosList;
        const teamPosMap = {};

        sosList.forEach(s => {
            let key = `${s.Team}_${s.Pos}`;
            if (!teamPosMap[key]) teamPosMap[key] = s;

            let p = this.matchPlayerFast(s.Player, s.Team, s.Pos);
            if (p) {
                p.avgStars = s.avgStars;
                p.byeWeek = s.byeWeek;
                p.sosWeeks = s.weeks;
            }
        });

        this.allPlayers.forEach(p => {
            if (!p.avgStars) {
                let sosEntry = teamPosMap[`${p._cleanTeam}_${p._cleanPos}`];
                if (sosEntry) {
                    p.avgStars = sosEntry.avgStars;
                    p.byeWeek = sosEntry.byeWeek;
                    p.sosWeeks = sosEntry.weeks;
                } else {
                    p.avgStars = 3.0;
                    p.byeWeek = 'N/A';
                    p.sosWeeks = {};
                }
            }

            let playoffSum = 0, playoffCount = 0;
            [15, 16, 17].forEach(w => {
                let rating = p.sosWeeks[`W${w}`];
                if (rating && rating !== 'BYE') {
                    playoffSum += rating;
                    playoffCount++;
                }
            });
            p.playoffSOS = playoffCount > 0 ? (playoffSum / playoffCount) : p.avgStars;

            this.calculateWeeklyProjections(p);
        });
    },

    calculateOptimalWeeklyScore(roster, weekNum) {
        let qb = []; let rb = []; let wr = []; let te = []; let pk = []; let dst = [];

        for (let i = 0; i < roster.length; i++) {
            let p = roster[i];
            let val = p.weeklyProjections[`W${weekNum}`] || 0;
            if (p.Pos === 'QB') qb.push({ player: p, val: val });
            else if (p.Pos === 'RB') rb.push(val);
            else if (p.Pos === 'WR') wr.push(val);
            else if (p.Pos === 'TE') te.push(val);
            else if (p.Pos === 'PK') pk.push(val);
            else if (p.Pos === 'DST') dst.push(val);
        }

        let score = 0;
        let req = this.settings.roster;
        let b = this.positionalWeeklyBaselines || { QB: 18.0, RB: 10.5, WR: 11.0, TE: 7.5, PK: 7.0, DST: 7.0 };

        let superflexPool = [];

        // 1. QB SCORING (Overflow goes to Superflex)
        qb.sort((a, b) => b.val - a.val);
        for (let i = 0; i < req.QB.max; i++) score += (i < qb.length) ? Math.max(qb[i].val, b.QB || 18.0) : (b.QB || 18.0);
        for (let i = req.QB.max; i < qb.length; i++) superflexPool.push(qb[i].val);

        // 2. K/DST SCORING
        pk.sort((a, b) => b - a); dst.sort((a, b) => b - a);
        for (let i = 0; i < req.PK.max; i++) score += (i < pk.length) ? Math.max(pk[i], b.PK || 7.0) : (b.PK || 7.0);
        for (let i = 0; i < req.DST.max; i++) score += (i < dst.length) ? Math.max(dst[i], b.DST || 7.0) : (b.DST || 7.0);

        // 3. RB/WR/TE SCORING (Process pools separately for overflow cascades)
        let processPos = (arr, maxReq, posKey, overflowTarget) => {
            let s = 0; let bVal = b[posKey] || 10.0;
            arr.sort((a, b) => b - a);
            for (let i = 0; i < maxReq; i++) {
                if (i < arr.length) s += Math.max(arr[i], bVal);
                else s += bVal;
            }
            for (let i = maxReq; i < arr.length; i++) overflowTarget.push(arr[i]);
            return s;
        };

        let rbwrOverflow = [];
        score += processPos(rb, req.RB.max, 'RB', rbwrOverflow);
        score += processPos(wr, req.WR.max, 'WR', rbwrOverflow);

        let teOverflow = [];
        score += processPos(te, req.TE.max, 'TE', teOverflow);

        // 4. RB/WR FLEX SCORING
        rbwrOverflow.sort((a, b) => b - a);
        let rbwrBaseline = Math.max((b.RB || 10.5), (b.WR || 11.0));
        for (let i = 0; i < (req.FlexRBWR?.max || 0); i++) {
            if (i < rbwrOverflow.length) score += Math.max(rbwrOverflow[i], rbwrBaseline);
            else score += rbwrBaseline;
        }

        // Combine remaining RB/WR and TE for standard Flex
        let flexPool = [];
        for (let i = (req.FlexRBWR?.max || 0); i < rbwrOverflow.length; i++) flexPool.push(rbwrOverflow[i]);
        flexPool.push(...teOverflow);

        // 5. STANDARD FLEX (W/R/T) SCORING
        flexPool.sort((a, b) => b - a);
        let flexBaseline = Math.max((b.RB || 10.5), (b.WR || 11.0), (b.TE || 7.5));
        for (let i = 0; i < (req.Flex?.max || 0); i++) {
            if (i < flexPool.length) score += Math.max(flexPool[i], flexBaseline);
            else score += flexBaseline;
        }
        for (let i = (req.Flex?.max || 0); i < flexPool.length; i++) superflexPool.push(flexPool[i]);

        // 6. SUPERFLEX SCORING
        superflexPool.sort((a, b) => b - a);
        let sfBaseline = Math.max(flexBaseline, (b.QB || 18.0));
        for (let i = 0; i < (req.Superflex?.max || 0); i++) {
            if (i < superflexPool.length) score += Math.max(superflexPool[i], sfBaseline);
            else score += sfBaseline;
        }

        return score;
    },

    calculateActualWeeklyScore(roster, weekNum) {
        let qb = []; let rb = []; let wr = []; let te = []; let pk = []; let dst = [];

        for (let i = 0; i < roster.length; i++) {
            let p = roster[i];
            let val = p.weeklyProjections[`W${weekNum}`] || 0;
            if (p.Pos === 'QB') qb.push(val);
            else if (p.Pos === 'RB') rb.push(val);
            else if (p.Pos === 'WR') wr.push(val);
            else if (p.Pos === 'TE') te.push(val);
            else if (p.Pos === 'PK') pk.push(val);
            else if (p.Pos === 'DST') dst.push(val);
        }

        let score = 0;
        let req = this.settings.roster;
        let superflexPool = [];

        qb.sort((a, b) => b - a);
        for (let i = 0; i < req.QB.max; i++) if (i < qb.length) score += qb[i];
        for (let i = req.QB.max; i < qb.length; i++) superflexPool.push(qb[i]);

        pk.sort((a, b) => b - a); dst.sort((a, b) => b - a);
        for (let i = 0; i < req.PK.max; i++) if (i < pk.length) score += pk[i];
        for (let i = 0; i < req.DST.max; i++) if (i < dst.length) score += dst[i];

        let processPos = (arr, maxReq, overflowTarget) => {
            let s = 0;
            arr.sort((a, b) => b - a);
            for (let i = 0; i < maxReq; i++) {
                if (i < arr.length) s += arr[i];
            }
            for (let i = maxReq; i < arr.length; i++) overflowTarget.push(arr[i]);
            return s;
        };

        let rbwrOverflow = [];
        score += processPos(rb, req.RB.max, rbwrOverflow);
        score += processPos(wr, req.WR.max, rbwrOverflow);

        let teOverflow = [];
        score += processPos(te, req.TE.max, teOverflow);

        rbwrOverflow.sort((a, b) => b - a);
        for (let i = 0; i < (req.FlexRBWR?.max || 0); i++) {
            if (i < rbwrOverflow.length) score += rbwrOverflow[i];
        }

        let flexPool = [];
        for (let i = (req.FlexRBWR?.max || 0); i < rbwrOverflow.length; i++) flexPool.push(rbwrOverflow[i]);
        flexPool.push(...teOverflow);

        flexPool.sort((a, b) => b - a);
        for (let i = 0; i < (req.Flex?.max || 0); i++) {
            if (i < flexPool.length) score += flexPool[i];
        }
        for (let i = (req.Flex?.max || 0); i < flexPool.length; i++) superflexPool.push(flexPool[i]);

        superflexPool.sort((a, b) => b - a);
        for (let i = 0; i < (req.Superflex?.max || 0); i++) {
            if (i < superflexPool.length) score += superflexPool[i];
        }

        return score;
    },

    evaluateRosterFits(team, availablePlayers) {
        const startW = this.settings.startWeek || 1;
        const endW = this.settings.endWeek || 17;
        const totalFantasyWeeks = (endW - startW + 1);

        let baseWeeklyScores = {};
        let baseSeasonScore = 0;
        for (let w = startW; w <= endW; w++) {
            let pts = this.calculateActualWeeklyScore(team.roster, w);
            baseWeeklyScores[w] = pts;
            baseSeasonScore += pts;
        }

        let viablePlayers = availablePlayers.filter(player => {
            let pos = player.Pos;
            let posConfig = this.settings.roster[pos];

            // Safe check: Ensure position exists in roster settings
            if (posConfig && team.counts[pos] < posConfig.max) return true;
            if (['RB', 'WR'].includes(pos) && team.counts['FlexRBWR'] < (this.settings.roster.FlexRBWR?.max || 0)) return true;
            if (['RB', 'WR', 'TE'].includes(pos) && team.counts['Flex'] < (this.settings.roster.Flex?.max || 0)) return true;
            if (['QB', 'RB', 'WR', 'TE'].includes(pos) && team.counts['Superflex'] < (this.settings.roster.Superflex?.max || 0)) return true;
            if (team.counts['Bench'] < (this.settings.roster.Bench?.max || 6)) return true;
            return false;
        });

        let topViable = viablePlayers.sort((a, b) => (b.AdvVBD || b.VBD || 0) - (a.AdvVBD || a.VBD || 0)).slice(0, 45);

        topViable.forEach(p => {
            let simSeasonScore = 0;
            let maxWeekAdded = 0;
            let bestByeFillWeek = null;

            team.roster.push(p);
            for (let w = startW; w <= endW; w++) {
                let newScore = this.calculateActualWeeklyScore(team.roster, w);
                simSeasonScore += newScore;

                let weekDiff = newScore - baseWeeklyScores[w];
                if (weekDiff > maxWeekAdded) {
                    maxWeekAdded = weekDiff;
                    bestByeFillWeek = w;
                }
            }
            team.roster.pop();

            let addedPts = simSeasonScore - baseSeasonScore;
            p._addedPPW = addedPts / totalFantasyWeeks;
            p._byeFillWeek = null;
            p._byeFillPts = 0;

            if (p._addedPPW < 1.5 && maxWeekAdded >= 3.0 && bestByeFillWeek) {
                p._byeFillWeek = bestByeFillWeek;
                p._byeFillPts = maxWeekAdded;
            }
        });

        availablePlayers.forEach(p => {
            if (!topViable.includes(p)) {
                p._addedPPW = 0;
                p._byeFillWeek = null;
                p._byeFillPts = 0;
            }
        });
    },

    calculateWeeklyProjections(player) {
        player.weeklyProjections = {};
        if (!player.ProjPts || player.ProjPts <= 0) return;

        let activeWeeks = 0;
        for (let w = 1; w <= 18; w++) {
            let weekVal = player.sosWeeks ? player.sosWeeks[`W${w}`] : 3.0;
            if (weekVal !== 'BYE') activeWeeks++;
        }
        if (activeWeeks === 0) activeWeeks = 17;

        const baseWeeklyPts = player.ProjPts / activeWeeks;

        for (let w = 1; w <= 18; w++) {
            let weekRating = player.sosWeeks ? player.sosWeeks[`W${w}`] : 3.0;

            if (weekRating === 'BYE') {
                player.weeklyProjections[`W${w}`] = 0;
            } else {
                // Fallback undefined or non-numeric ratings to neutral 3.0 stars
                let ratingVal = (typeof weekRating === 'number') ? weekRating : 3.0;
                let starDiff = ratingVal - 3.0;
                let multiplier = 1 + (starDiff * 0.08);
                player.weeklyProjections[`W${w}`] = Math.max(0, baseWeeklyPts * multiplier);
            }
        }
    },

    parseAdvancedData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        // NO .toUpperCase() here, so Player, Team, Pos remain case-sensitive matches
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split('\t').map(v => v.trim());
            let obj = {};
            headers.forEach((h, idx) => {
                let val = values[idx] || '';
                // Fix comma bug: "1,585" becomes "1585" so parseFloat doesn't break
                let cleanVal = val.replace(/,/g, '');

                if (val.includes('%')) {
                    obj[h] = parseFloat(val.replace('%', ''));
                } else if (cleanVal !== '' && !isNaN(cleanVal)) {
                    obj[h] = parseFloat(cleanVal);
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
            // Match using exact casing from the TSV (Player, Team, Pos or Position)
            let p = this.matchPlayerFast(advPlayer.Player, advPlayer.Team, advPlayer.Pos || advPlayer.Position);

            if (p) {
                // Save historical stats for years prior to 2025
                let rowYear = advPlayer['Year'] || advPlayer['YEAR'];
                if (rowYear && rowYear < 2025) {
                    if (!p.historicalStats) p.historicalStats = {};
                    p.historicalStats[rowYear] = advPlayer;
                    return;
                }

                // Advanced metrics
                if (advPlayer['RZ TGT'] !== undefined) p.rzTgt = advPlayer['RZ TGT'];
                if (advPlayer['RZ ATT'] !== undefined) p.rzAtt = advPlayer['RZ ATT'];
                if (advPlayer['% TM'] !== undefined) p.targetShare = advPlayer['% TM'];

                if (advPlayer['AIR/R'] !== undefined) p.aDOT = advPlayer['AIR/R'];
                if (advPlayer['AIR/A'] !== undefined) p.aDOT = advPlayer['AIR/A'];

                if (advPlayer['YACON/ATT'] !== undefined) p.yacAtt = advPlayer['YACON/ATT'];
                if (advPlayer['YACON/R'] !== undefined) p.yacAtt = advPlayer['YACON/R'];

                if (advPlayer['BRKTKL'] !== undefined) p.brokenTackles = advPlayer['BRKTKL'];
                if (advPlayer['PKT TIME'] !== undefined) p.pktTime = advPlayer['PKT TIME'];

                // ⚡ SYNTHESIZED PRO METRICS ⚡
                // 1. Yards Per Target (Efficiency) & Air Yards (Upside)
                if (advPlayer['YDS'] && advPlayer['TGT']) p.ypt = advPlayer['YDS'] / advPlayer['TGT'];
                if (advPlayer['AIR'] !== undefined) p.airYards = advPlayer['AIR'];

                // 2. High-Value Opportunities (HVO) for RBs = Receptions + Red Zone Targets
                if (p.Pos === 'RB' && advPlayer['REC'] !== undefined) {
                    const rzCarries = advPlayer['RZ ATT'] ?? advPlayer['RZ Att'] ?? 0;
                    p.hvo = advPlayer['REC'] + rzCarries;
                }

                // 3. True Pressure Rate for QBs = (Sacks + Knockdowns + Hurries) / Attempts
                if (p.Pos === 'QB' && advPlayer['ATT'] > 0) {
                    let sacks = advPlayer['SACK'] || 0;
                    let hits = advPlayer['KNCK'] || 0;
                    let hurries = advPlayer['HRRY'] || 0;
                    p.pressureRate = ((sacks + hits + hurries) / advPlayer['ATT']) * 100;
                }

                if (advPlayer['CATCHABLE'] && advPlayer['CATCHABLE'] > 0) {
                    p.catchable = advPlayer['CATCHABLE'];
                    p.trueCatchRate = ((advPlayer['REC'] || 0) / advPlayer['CATCHABLE']) * 100;
                    p.dropRate = ((advPlayer['DROP'] || 0) / advPlayer['CATCHABLE']) * 100;
                }

                if (advPlayer['ATT'] && advPlayer['POOR']) {
                    p.trueAccuracy = (((advPlayer['COMP'] || 0) + (advPlayer['DROP'] || 0)) / advPlayer['ATT']) * 100;
                }

                // 2025 Actuals
                if (!p.pastStats) p.pastStats = {};
                if (advPlayer['G']) p.pastStats.gp = advPlayer['G'];

                // Passing
                if (advPlayer['COMP']) p.pastStats.passCmp = advPlayer['COMP'];
                if (p.Pos === 'QB' && advPlayer['ATT']) p.pastStats.passAtt = advPlayer['ATT'];
                if (p.Pos === 'QB' && advPlayer['YDS']) p.pastStats.passYds = advPlayer['YDS'];

                // Rushing
                if (p.Pos === 'RB' && advPlayer['ATT']) p.pastStats.rushAtt = advPlayer['ATT'];
                if (p.Pos === 'RB' && advPlayer['YDS']) p.pastStats.rushYds = advPlayer['YDS'];

                // Receiving
                if (advPlayer['TGT']) p.pastStats.targets = advPlayer['TGT'];
                if (advPlayer['REC']) p.pastStats.rec = advPlayer['REC'];
                if (['WR', 'TE'].includes(p.Pos) && advPlayer['YDS']) p.pastStats.recYds = advPlayer['YDS'];

                // TDs & INTs
                const statsSource = p.stats || {};
                const passTd = advPlayer['PASS TD'] ?? advPlayer['Pass TD'] ?? statsSource.passTd;
                const rushTd = advPlayer['RUSH TD'] ?? advPlayer['Rush TD'] ?? statsSource.rushTd;
                const recTd = advPlayer['REC TD'] ?? advPlayer['Rec TD'] ?? statsSource.recTd;
                const totalTd = advPlayer['TD'] ?? advPlayer['TDs'] ?? advPlayer['Total TD'];

                if (advPlayer['INT']) p.pastStats.int = advPlayer['INT'];
                if (totalTd !== undefined) {
                    p.pastStats.totalTd = totalTd;
                } else if (passTd !== undefined || rushTd !== undefined || recTd !== undefined) {
                    const fallbackTotal = [passTd, rushTd, recTd]
                        .filter(val => val !== undefined && val !== null && val !== '')
                        .reduce((sum, val) => sum + Number(val), 0);
                    p.pastStats.totalTd = fallbackTotal;
                }
                if (passTd !== undefined) p.pastStats.passTd = passTd;
                if (rushTd !== undefined) p.pastStats.rushTd = rushTd;
                if (recTd !== undefined) p.pastStats.recTd = recTd;
            }
        });
    },

    parseProjectedData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            let rawPos = this.normalizePos(vals[headers.indexOf('Position')]);

            let p = {
                Player: vals[headers.indexOf('Player')],
                Pos: rawPos,
                Team: this.normalizeTeam(vals[headers.indexOf('Team')]),
                stats: {
                    gp: parseFloat(vals[headers.indexOf('GP')]) || 17,
                    passAtt: parseFloat(vals[headers.indexOf('Pass Att')]) || 0,
                    passCmp: parseFloat(vals[headers.indexOf('Pass Cmp')]) || 0,
                    passYds: parseFloat(vals[headers.indexOf('Pass Yds')]) || 0,
                    passTd: parseFloat(vals[headers.indexOf('Pass TD')]) || 0,
                    int: parseFloat(vals[headers.indexOf('INT')]) || 0,
                    passerRating: parseFloat(vals[headers.indexOf('Passer Rating')]) || 0,
                    rushAtt: parseFloat(vals[headers.indexOf('Rush Att')]) || 0,
                    rushYds: parseFloat(vals[headers.indexOf('Rush Yds')]) || 0,
                    rushAvg: parseFloat(vals[headers.indexOf('Rush Avg')]) || 0,
                    rushTd: parseFloat(vals[headers.indexOf('Rush TD')]) || 0,
                    targets: parseFloat(vals[headers.indexOf('Targets')]) || 0,
                    rec: parseFloat(vals[headers.indexOf('Receptions')]) || 0,
                    recYds: parseFloat(vals[headers.indexOf('Rec Yds')]) || 0,
                    recAvg: parseFloat(vals[headers.indexOf('Rec Avg')]) || 0,
                    recTd: parseFloat(vals[headers.indexOf('Rec TD')]) || 0,
                    fum: parseFloat(vals[headers.indexOf('Fumbles Lost')]) || 0,
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
    },

    scoring: {
        passYds: 0.04, passTd: 6, int: -2,
        rushYds: 0.1, rushTd: 6, recYds: 0.1, recTd: 6, ppr: 1, fumLost: -2,
        fg: 3, xp: 1, sack: 1, turnover: 2, defTd: 6, safety: 2
    },

    calculateProjections() {
        this.allPlayers.forEach(p => {
            let s = p.stats;
            let gp = s.gp || 17;

            if (p.Pos === 'PK') {
                p.ProjPts = ((s.fgTotal || 0) * (this.scoring.fg || 3)) + ((s.xp || 0) * (this.scoring.xp || 1));
            }
            else if (p.Pos === 'DST') {
                let turnoverPts = ((s.defInt || 0) + (s.defFum || 0)) * (this.scoring.turnover || 2);
                let sackPts = (s.sack || 0) * (this.scoring.sack || 1);
                let tdPts = (s.defTd || 0) * (this.scoring.defTd || 6);
                let safetyPts = (s.safety || 0) * (this.scoring.safety || 2);
                let blkPts = (s.blk || 0) * 2;

                let papg = s.papg || 18.0;
                let weeklyPaPts = 0;
                if (papg === 0) weeklyPaPts = 10;
                else if (papg <= 6) weeklyPaPts = 7;
                else if (papg <= 13) weeklyPaPts = 4;
                else if (papg <= 20) weeklyPaPts = 1;
                else if (papg <= 27) weeklyPaPts = 0;
                else if (papg <= 35) weeklyPaPts = -1;
                else weeklyPaPts = -4;

                // Pure formula — matches your league's exact point scale!
                p.ProjPts = sackPts + turnoverPts + tdPts + safetyPts + blkPts + (weeklyPaPts * gp);
            }
            else {
                let basePts =
                    ((s.passYds || 0) * this.scoring.passYds) +
                    ((s.passTd || 0) * this.scoring.passTd) +
                    ((s.int || 0) * this.scoring.int) +
                    ((s.rushYds || 0) * this.scoring.rushYds) +
                    ((s.rushTd || 0) * this.scoring.rushTd) +
                    ((s.recYds || 0) * this.scoring.recYds) +
                    ((s.recTd || 0) * this.scoring.recTd) +
                    ((s.rec || 0) * this.scoring.ppr) +
                    ((s.fum || 0) * this.scoring.fumLost);

                let passYpg = s.passYds / gp;
                let rushYpg = s.rushYds / gp;
                let recYpg = s.recYds / gp;

                let passBonus = 0;
                if (passYpg >= 220) passBonus += Math.min(gp, (passYpg - 200) / 15) * 1;
                if (passYpg >= 300) passBonus += Math.min(gp, (passYpg - 280) / 25) * 3;

                let rushBonus = 0;
                if (rushYpg >= 50) rushBonus += Math.min(gp, (rushYpg - 45) / 10) * 1;
                if (rushYpg >= 130) rushBonus += Math.min(gp, (rushYpg - 120) / 20) * 3;

                let recBonus = 0;
                if (recYpg >= 50) recBonus += Math.min(gp, (recYpg - 45) / 10) * 1;
                if (recYpg >= 130) recBonus += Math.min(gp, (recYpg - 120) / 20) * 3;

                p.ProjPts = basePts + passBonus + rushBonus + recBonus;
            }

            if (p.pastStats) {
                let ps = p.pastStats;
                let pastPts = 0;

                if (p.Pos === 'DST') {
                    let sack = ps.sack || 0;
                    let defInt = ps.defInt || 0;
                    let defFum = ps.defFum || 0;
                    let defTd = ps.defTd || 0;
                    let spcTd = ps.spcTd || 0;
                    let safety = ps.safety || 0;

                    pastPts += sack * (this.scoring.sack || 1);
                    pastPts += (defInt + defFum) * (this.scoring.turnover || 2);
                    pastPts += (defTd + spcTd) * (this.scoring.defTd || 6);
                    pastPts += safety * (this.scoring.safety || 2);

                    pastPts += (ps.gp || 17) * 4;
                } else if (p.Pos === 'PK') {
                    // PK past points fallback if added
                } else {
                    let passYds = ps.passYds || 0;
                    let rushYds = ps.rushYds || 0;
                    let recYds = ps.recYds || 0;
                    let rec = ps.rec || 0;
                    let int = ps.int || 0;
                    let fum = ps.fum || 0;
                    let passTd = ps.passTd || 0;
                    let rushTd = ps.rushTd || 0;
                    let recTd = ps.recTd || 0;

                    pastPts += passYds * (this.scoring.passYds || 0.04);
                    pastPts += rushYds * (this.scoring.rushYds || 0.1);
                    pastPts += recYds * (this.scoring.recYds || 0.1);
                    pastPts += rec * (this.scoring.ppr || 1);
                    pastPts += int * (this.scoring.int || -2);
                    pastPts += fum * (this.scoring.fumLost || -2);
                    pastPts += passTd * (this.scoring.passTd || 6);
                    pastPts += rushTd * (this.scoring.rushTd || 6);
                    pastPts += recTd * (this.scoring.recTd || 6);
                }

                p.pastPts = isNaN(pastPts) ? 0 : pastPts;
                p.pastPpg = (ps.gp && ps.gp > 0) ? (p.pastPts / ps.gp) : 0;
                if (isNaN(p.pastPpg)) p.pastPpg = 0;
            }

            this.calculateWeeklyProjections(p);
        });
    },

    // -------------------------------------------------------------
    // DYNAMIC DST MATCHUP ENGINE
    // -------------------------------------------------------------
    teamOffensiveThreats: {},
    nflSchedule: {},

    calculateTeamOffensiveThreats() {
        const teams = [...new Set(this.allPlayers.map(p => this.normalizeTeam(p.Team)).filter(Boolean))];
        let maxThreat = 0;
        let minThreat = 999;

        teams.forEach(team => {
            let threatScore = 0;
            let teamPlayers = this.allPlayers.filter(p => this.normalizeTeam(p.Team) === team);

            // 1. FIREPOWER (Projected Points of Top Starters)
            let qbs = teamPlayers.filter(p => p.Pos === 'QB').sort((a, b) => b.ProjPts - a.ProjPts);
            let rbs = teamPlayers.filter(p => p.Pos === 'RB').sort((a, b) => b.ProjPts - a.ProjPts);
            let passCatchers = teamPlayers.filter(p => ['WR', 'TE'].includes(p.Pos)).sort((a, b) => b.ProjPts - a.ProjPts);

            let startingQB = qbs[0];

            // Add top QB, top RB, and top 2 Pass Catchers projected points
            if (startingQB) threatScore += (startingQB.ProjPts * 0.4);
            if (rbs[0]) threatScore += (rbs[0].ProjPts * 0.2);
            if (passCatchers[0]) threatScore += (passCatchers[0].ProjPts * 0.2);
            if (passCatchers[1]) threatScore += (passCatchers[1].ProjPts * 0.15);

            // 2. MISTAKE PRONENESS & TRENCHES (Adjusts the threat score)
            if (startingQB) {
                // If the QB takes a lot of pressure, REDUCE their threat score (makes them a juicy DST matchup)
                if (startingQB.pressureRate) {
                    if (startingQB.pressureRate > 24.0) threatScore -= 15;
                    else if (startingQB.pressureRate < 15.0) threatScore += 10;
                }
                // Turnover history
                if (startingQB.pastStats && startingQB.pastStats.int >= 12) threatScore -= 10;
            }

            // O-Line Tier Impact
            let firstPlayerWithOL = teamPlayers.find(p => p.olTier);
            if (firstPlayerWithOL) {
                let tier = firstPlayerWithOL.olTier;
                if (tier === 'S' || tier === 'A') threatScore += 15; // Elite line, brutal for DSTs
                else if (tier === 'D' || tier === 'F') threatScore -= 20; // Terrible line, great for DSTs
            }

            this.teamOffensiveThreats[team] = {
                team: team,
                rawScore: threatScore,
                qb: startingQB ? startingQB.Player : 'Unknown'
            };

            if (threatScore > maxThreat) maxThreat = threatScore;
            if (threatScore < minThreat) minThreat = threatScore;
        });

        // 3. NORMALIZE TO 1.0 - 5.0 STARS (Inverted for DSTs)
        teams.forEach(team => {
            let raw = this.teamOffensiveThreats[team].rawScore;
            let normalized = (raw - minThreat) / ((maxThreat - minThreat) || 1); // fallback to 1 to prevent division by 0

            // Invert: High Threat Score = 1.0 Star Matchup for DST (Bad)
            let starRating = 5.0 - (normalized * 4.0);
            this.teamOffensiveThreats[team].dstMatchupStars = Math.min(5.0, Math.max(1.0, starRating));
        });
    },

    applyDynamicDSTSOS() {
        if (Object.keys(this.nflSchedule).length === 0) return;
        this.calculateTeamOffensiveThreats();

        let dsts = this.allPlayers.filter(p => p.Pos === 'DST');

        dsts.forEach(dst => {
            let t = this.normalizeTeam(dst.Team);
            let teamSchedule = this.nflSchedule[t];
            if (!teamSchedule) return;

            let totalStars = 0;
            let activeWeeks = 0;
            let playoffStars = 0;
            let playoffCount = 0;

            dst.sosWeeks = {};

            for (let w = 1; w <= 18; w++) {
                let opp = teamSchedule[w];
                if (!opp || opp.toUpperCase() === 'BYE') {
                    dst.sosWeeks[`W${w}`] = 'BYE';
                    dst.byeWeek = w;
                } else {
                    // Smart cleaner: removes "@", "vs", and trims extra spaces (e.g. "@ LAC" becomes "LAC")
                    let rawOpp = opp.replace(/@/g, '').replace(/vs/gi, '').trim();
                    let oppTeam = this.normalizeTeam(rawOpp);

                    let matchupThreat = this.teamOffensiveThreats[oppTeam];
                    let stars = matchupThreat ? matchupThreat.dstMatchupStars : 3.0;

                    dst.sosWeeks[`W${w}`] = stars;

                    totalStars += stars;
                    activeWeeks++;

                    if (w >= 15 && w <= 17) {
                        playoffStars += stars;
                        playoffCount++;
                    }
                }
            }

            dst.avgStars = activeWeeks > 0 ? (totalStars / activeWeeks) : 3.0;
            dst.playoffSOS = playoffCount > 0 ? (playoffStars / playoffCount) : dst.avgStars;

            // Recalculate weekly projections based on this new custom SOS
            this.calculateWeeklyProjections(dst);
        });
    },

    calculateVBD() {
        let numTeams = parseInt(document.getElementById('setting-teams')?.value) || this.settings.numTeams || 12;
        this.settings.numTeams = numTeams;

        const baselines = {};
        const positions = ['QB', 'RB', 'WR', 'TE', 'PK', 'DST'];

        positions.forEach(pos => {
            let maxPos = this.settings.roster[pos]?.max || 1;
            let starters = numTeams * maxPos;

            if (pos === 'QB') {
                const isSuperflex = (this.settings.roster.Superflex?.max || 0) > 0;
                if (isSuperflex) {
                    starters = Math.floor(numTeams * 1.8);
                } else {
                    starters = Math.floor(numTeams * (maxPos === 1 ? 1.25 : maxPos * 1.1));
                }
            }

            if (pos === 'RB' || pos === 'WR') {
                let extraSlots = (this.settings.roster.Flex?.max || 0) + (this.settings.roster.FlexRBWR?.max || 0);
                if (pos === 'WR' && this.settings.roster.Superflex?.max > 0) extraSlots += (this.settings.roster.Superflex.max * 0.1);
                starters += Math.floor((numTeams * extraSlots) / 2);
            }
            if (pos === 'PK') {
                starters = Math.floor(numTeams * 1.1);
            } else if (pos === 'DST') {
                starters = Math.floor(numTeams * 1.25);
            }

            let sortedPos = [...this.allPlayers].filter(p => p.Pos === pos).sort((a, b) => b.ProjPts - a.ProjPts);
            let baselineIndex = Math.min(Math.max(starters - 1, 0), sortedPos.length - 1);
            let baselinePlayer = sortedPos[baselineIndex];
            baselines[pos] = baselinePlayer ? baselinePlayer.ProjPts : 0;
        });

        this.positionalWeeklyBaselines = {
            QB: (baselines.QB || 300) / 17,
            RB: (baselines.RB || 180) / 17,
            WR: (baselines.WR || 180) / 17,
            TE: (baselines.TE || 120) / 17,
            PK: (baselines.PK || 120) / 17,
            DST: (baselines.DST || 120) / 17
        };

        this.allPlayers.forEach(p => {
            let basePts = baselines[p.Pos] || 0;
            let rawVBD = p.ProjPts - basePts;

            // Kicker and Defense VBD suppression
            if (p.Pos === 'PK') {
                rawVBD = (rawVBD * 0.05) - 30.0;
            } else if (p.Pos === 'DST') {
                rawVBD = (rawVBD * 0.10) - 20.0;
            }
            p.VBD = rawVBD;

            let adjMultiplier = 1.0;

            // 1. Tiered Role Security (Reduced double-counting of volume)
            if (p.snapShare) {
                if (p.snapShare >= 85) adjMultiplier += 0.04;
                else if (p.snapShare >= 75) adjMultiplier += 0.02;
                else if (p.snapShare < 40) adjMultiplier -= 0.04;
                else if (p.snapShare < 55) adjMultiplier -= 0.02;
            } else if (p.depthChart !== undefined && p.depthChart !== null) {
                if (p.depthChart === 1) adjMultiplier += 0.025;
                else if (p.depthChart === 2) adjMultiplier -= 0.01;
                else if (p.depthChart >= 3) adjMultiplier -= 0.04;
            }

            // 2. Smooth & Tiered Schedule Strength
            if (p.avgStars) adjMultiplier += (p.avgStars - 3.0) * 0.025; // Scales smoothly dynamically
            if (p.playoffSOS) {
                if (p.playoffSOS >= 4.2) adjMultiplier += 0.03;
                else if (p.playoffSOS >= 3.6) adjMultiplier += 0.015;
                else if (p.playoffSOS <= 1.8) adjMultiplier -= 0.03;
                else if (p.playoffSOS <= 2.4) adjMultiplier -= 0.015;
            }

            // 3. Tiered Offensive Line Quality
            let olModifier = 0;
            if (p.Pos === 'RB' && p.olRunBlk) {
                if (p.olRunBlk <= 3) olModifier = 0.05;
                else if (p.olRunBlk <= 8) olModifier = 0.025;
                else if (p.olRunBlk >= 29) olModifier = -0.05;
                else if (p.olRunBlk >= 24) olModifier = -0.025;
            } else if (['QB', 'WR', 'TE'].includes(p.Pos) && p.olPassBlk) {
                if (p.olPassBlk <= 3) olModifier = 0.04;
                else if (p.olPassBlk <= 8) olModifier = 0.02;
                else if (p.olPassBlk >= 29) olModifier = -0.04;
                else if (p.olPassBlk >= 24) olModifier = -0.02;
            }

            // Fallback to broad tier only if rank data didn't trigger a change
            if (olModifier === 0 && p.olTier) {
                if (p.olTier === 'S') olModifier = 0.04;
                else if (p.olTier === 'A') olModifier = 0.02;
                else if (p.olTier === 'D') olModifier = -0.02;
                else if (p.olTier === 'F') olModifier = -0.04;
            }
            adjMultiplier += olModifier;

            // 4. Inherited Role Volume (Rookies / Team Changers)
            let lacksIndividualMetrics = false;
            if (p.Pos === 'QB') {
                lacksIndividualMetrics = (p.trueAccuracy === undefined) && (p.pktTime === undefined);
            } else if (['RB', 'WR', 'TE'].includes(p.Pos)) {
                lacksIndividualMetrics = (p.targetShare === undefined) && (p.brokenTackles === undefined) && (p.yacAtt === undefined);
            }

            if (lacksIndividualMetrics) {
                p.isNewRole = true;
                let teamDist = (this.teamTargets || []).find(t => t.Team === p.Team);

                // FIX: Apply to depthChart 1 AND 2, so rookies backing up veterans get credit for the scheme's upside
                if (teamDist && (p.depthChart === 1 || p.depthChart === 2)) {
                    let posPctKey = `${p.Pos} %`;
                    let teamPosPct = teamDist[posPctKey] || 0;

                    if (p.Pos === 'RB') {
                        if (teamPosPct >= 24.0) adjMultiplier += 0.04;
                        else if (teamPosPct >= 19.0) adjMultiplier += 0.02;
                    } else if (p.Pos === 'WR') {
                        if (teamPosPct >= 65.0) adjMultiplier += 0.04;
                        else if (teamPosPct >= 58.0) adjMultiplier += 0.02;
                    } else if (p.Pos === 'TE') {
                        if (teamPosPct >= 26.0) adjMultiplier += 0.04;
                        else if (teamPosPct >= 20.0) adjMultiplier += 0.02;
                    }
                }
            }

            // 5. Tiered Efficiency & "TD-Dependency" Penalties
            if (p.targetShare) {
                if (p.targetShare >= 28) adjMultiplier += 0.05;
                else if (p.targetShare >= 23) adjMultiplier += 0.025;

                if (p.targetShare >= 22 && p.aDOT >= 12.0) adjMultiplier += 0.03;

                // --- WOPR (Weighted Opportunity Rating) ENGINE ---
                if (['WR', 'TE'].includes(p.Pos)) {
                    const teamAirYards = 3500;
                    const tgtShare = Number(p.targetShare) || 0;
                    const airYardsShare = p.airYards ? ((Number(p.airYards) / teamAirYards) * 100) : tgtShare;

                    p.wopr = (1.5 * (tgtShare / 100)) + (0.7 * (airYardsShare / 100));

                    if (p.wopr >= 0.65) adjMultiplier += 0.05;
                    else if (p.wopr >= 0.55) adjMultiplier += 0.025;
                    else if (p.wopr <= 0.32 && (p.ProjPts || 0) > 110) adjMultiplier -= 0.04;
                }

                // Fraud Penalty - High projected points but low target share means highly TD dependent
                if (['WR', 'TE'].includes(p.Pos) && p.ProjPts > 120) {
                    if (p.targetShare < 12.0) adjMultiplier -= 0.06;
                    else if (p.targetShare < 15.0) adjMultiplier -= 0.03;
                }
            }

            if (p.Pos === 'RB') {
                if (p.brokenTackles) {
                    if (p.brokenTackles >= 30) adjMultiplier += 0.04;
                    else if (p.brokenTackles >= 20) adjMultiplier += 0.02;
                }
                if (p.hvo) {
                    if (p.hvo >= 80) adjMultiplier += 0.04;
                    else if (p.hvo >= 60) adjMultiplier += 0.02;
                }
            }

            if (['WR', 'TE'].includes(p.Pos)) {
                if (p.ypt && p.targetShare && p.targetShare >= 15) {
                    if (p.ypt >= 10.5) adjMultiplier += 0.04;
                    else if (p.ypt >= 9.0) adjMultiplier += 0.02;
                    else if (p.ypt < 6.5) adjMultiplier -= 0.04;
                }
                if (p.trueCatchRate) {
                    if (p.trueCatchRate >= 92) adjMultiplier += 0.03;
                    else if (p.trueCatchRate >= 86) adjMultiplier += 0.015;
                }
                if (p.dropRate) {
                    if (p.dropRate > 10) adjMultiplier -= 0.04;
                    else if (p.dropRate > 7) adjMultiplier -= 0.02;
                }
            }

            if (p.Pos === 'QB') {
                if (p.pressureRate) {
                    if (p.pressureRate > 26.0) adjMultiplier -= 0.05;
                    else if (p.pressureRate > 22.0) adjMultiplier -= 0.025;
                    else if (p.pressureRate < 14.0) adjMultiplier += 0.03;
                }
            }

            // 6. Age-Cliff Modifiers (Non-Linear Polynomial Scaling)
            let pAge = p.age || p.Age;
            if (pAge) {
                if (p.Pos === 'RB' && pAge >= 27) {
                    adjMultiplier -= Math.pow(pAge - 26, 1.3) * 0.025;
                } else if (p.Pos === 'WR' && pAge >= 31) {
                    adjMultiplier -= Math.pow(pAge - 30, 1.2) * 0.03;
                } else if (p.Pos === 'TE' && pAge >= 32) {
                    adjMultiplier -= Math.pow(pAge - 31, 1.2) * 0.025;
                } else if (p.Pos === 'QB' && pAge >= 38) {
                    adjMultiplier -= Math.pow(pAge - 37, 1.2) * 0.02;
                }

                // NEW: Breakout Window Bonus
                if (!p.isNewRole && pAge >= 21 && pAge <= 23 && ['WR', 'RB', 'TE'].includes(p.Pos)) {
                    adjMultiplier += 0.02;
                }
            }

            // 7. Advanced Team Environment Metrics
            const tTeam = this.normalizeTeam(p.Team);
            const passEnv = this.teamAdvPass[tTeam];
            const rushEnv = this.teamAdvRush[tTeam];
            const recEnv = this.teamAdvRec[tTeam];

            if (passEnv) {
                if (['QB', 'WR', 'TE'].includes(p.Pos)) {
                    if (passEnv.playActionYds >= 1100 || passEnv.rpoYds >= 700) adjMultiplier += 0.035;
                    else if (passEnv.playActionYds >= 900 || passEnv.rpoYds >= 500) adjMultiplier += 0.015;
                    else if (passEnv.playActionYds < 500 && passEnv.rpoYds < 200) adjMultiplier -= 0.02;
                }
                if (['QB', 'WR', 'TE'].includes(p.Pos) && (!p.olPassBlk || (p.olPassBlk > 5 && p.olPassBlk < 25))) {
                    if (passEnv.prssPct >= 28.0) adjMultiplier -= 0.04;
                    else if (passEnv.prssPct >= 25.0) adjMultiplier -= 0.02;
                }
            }

            if (['WR', 'TE'].includes(p.Pos)) {
                let teamQB = this.allPlayers.find(q => q._cleanTeam === tTeam && q._cleanPos === 'QB' && q.depthChart === 1);
                if (!teamQB) {
                    teamQB = this.allPlayers.filter(q => q._cleanTeam === tTeam && q._cleanPos === 'QB').sort((a, b) => b.ProjPts - a.ProjPts)[0];
                }
                if (teamQB && teamQB.trueAccuracy !== undefined) {
                    if (teamQB.trueAccuracy >= 76.0) adjMultiplier += 0.04;
                    else if (teamQB.trueAccuracy >= 73.0) adjMultiplier += 0.02;
                    else if (teamQB.trueAccuracy <= 60.0) adjMultiplier -= 0.04;
                    else if (teamQB.trueAccuracy <= 64.0) adjMultiplier -= 0.02;
                }
            }

            // 8. New Role / Inherited Environment (Rookies & Free Agents)
            if (p.isNewRole) {
                if (p.Pos === 'RB' && rushEnv) {
                    if (rushEnv.ybcAtt >= 2.9) adjMultiplier += 0.04;
                    else if (rushEnv.ybcAtt >= 2.6) adjMultiplier += 0.02;
                    else if (rushEnv.ybcAtt <= 1.8) adjMultiplier -= 0.04;
                    else if (rushEnv.ybcAtt <= 2.2) adjMultiplier -= 0.02;
                }
                if (['WR', 'TE'].includes(p.Pos) && recEnv) {
                    if (recEnv.yacPerRec >= 6.0) adjMultiplier += 0.03;
                    else if (recEnv.yacPerRec >= 5.5) adjMultiplier += 0.015;
                    else if (recEnv.yacPerRec <= 4.2) adjMultiplier -= 0.03;
                }
                if (p.Pos === 'QB' && passEnv) {
                    if (passEnv.pktTime >= 2.6) adjMultiplier += 0.03;
                    else if (passEnv.pktTime >= 2.4) adjMultiplier += 0.015;
                    else if (passEnv.pktTime <= 2.2) adjMultiplier -= 0.025;

                    if (passEnv.dropPct >= 8.5) adjMultiplier -= 0.04;
                    else if (passEnv.dropPct >= 6.5) adjMultiplier -= 0.02;
                }
            }

            // 9. Tiered Advanced Realism Penalties (Workload Wear & Injury Risk)
            if (p.pastStats) {
                let totalTouches = (p.pastStats.rushAtt || 0) + (p.pastStats.rec || 0);

                if (p.Pos === 'RB') {
                    if (totalTouches >= 360) adjMultiplier -= 0.06;
                    else if (totalTouches >= 300) adjMultiplier -= 0.03;
                }

                if (p.pastStats.gp && p.pastStats.gp > 0) {
                    if (p.pastStats.gp <= 8) adjMultiplier -= 0.05;
                    else if (p.pastStats.gp <= 12) adjMultiplier -= 0.025;
                }
            }

            // ===========================================================
            // 10. DYNAMIC UPSIDE, CEILING & VOLATILITY CLASSIFICATIONS
            // ===========================================================
            let upsideMultiplier = 1.0;
            let ceilingTags = [];

            p._isFlyer = false;
            p._isSafeFloor = false;
            
            // tTeam is already defined up in Step 7, so we just use it here!
            const teamDist = (this.teamTargets || []).find(t => this.normalizeTeam(t.Team) === tTeam);

            // 🌟 INHERITED ROLE FLAG (For Rookies & Free Agents)
            let isInheritedStarter = p.isNewRole && p.depthChart === 1;

            // -----------------------------------------------------------
            // RB CLASSIFICATION
            // -----------------------------------------------------------
            if (p.Pos === 'RB') {
                // 🚀 CEILING / FLYER TRAITS

                // TIERED HANDCUFF ENGINE
                if (p.isRBHandcuff) {
                    p._isFlyer = true;
                    let handcuffTierBonus = 0.15; // Base handcuff upside

                    let starter = this.matchPlayerFast(p.starterName, p.Team, 'RB');
                    if (starter) {
                        // Tiers for the role they would inherit
                        if (starter.ProjPts >= 240) handcuffTierBonus += 0.25;      // Elite bellcow role
                        else if (starter.ProjPts >= 200) handcuffTierBonus += 0.15; // High-end starter role
                        else if (starter.ProjPts >= 160) handcuffTierBonus += 0.10; // Solid starter role
                    }

                    // Tiers for blocking environment inheritance
                    if (p.olTier === 'S') handcuffTierBonus += 0.10;
                    else if (p.olTier === 'A') handcuffTierBonus += 0.05;
                    if (rushEnv && rushEnv.ybcAtt >= 2.5) handcuffTierBonus += 0.05;

                    upsideMultiplier += handcuffTierBonus;
                    ceilingTags.push("League-Winning Upside (Contingent)");
                }

                if (pAge && pAge <= 22) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    ceilingTags.push("Breakout Age");
                }

                if (p.pastStats && p.pastStats.bigPlays >= 8) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.15;
                    if (!ceilingTags.includes("Explosive Playmaker")) ceilingTags.push("Explosive Playmaker");
                }
                if (isInheritedStarter && teamDist && teamDist['RB %'] >= 20.0) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.15;
                    if (!ceilingTags.includes("Elite Inherited Volume")) ceilingTags.push("Elite Inherited Volume");
                }

                // 🛡️ SAFE FLOOR TRAITS
                let hasVolumeFloor = (p.targetShare && p.targetShare >= 10) || (p.snapShare && p.snapShare >= 60) || (p.hvo && p.hvo >= 50);
                let hasRedZoneFloor = (p.rzAtt && p.rzAtt >= 35);
                let hasSchemeFloor = (rushEnv && rushEnv.ybcAtt >= 2.5 && p.snapShare && p.snapShare >= 45) || (p.olTier === 'S' || p.olTier === 'A');

                // 🌟 ROOKIE/NEW STARTER INHERITED FLOOR
                // If a rookie steps into a starting job behind an elite line or high YBC scheme, their floor is instantly safe.
                if (isInheritedStarter && ((rushEnv && rushEnv.ybcAtt >= 2.5) || p.olTier === 'S' || p.olTier === 'A')) {
                    hasSchemeFloor = true;
                }

                if (hasVolumeFloor || hasRedZoneFloor || hasSchemeFloor) {
                    p._isSafeFloor = true;
                }

                if (pAge && pAge >= 28) upsideMultiplier -= 0.15;
            }

            // -----------------------------------------------------------
            // WR / TE CLASSIFICATION
            // -----------------------------------------------------------
            else if (['WR', 'TE'].includes(p.Pos)) {
                // 🚀 CEILING / FLYER TRAITS
                if ((p.aDOT && p.aDOT >= 12.0) || (pAge && pAge <= 22)) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    ceilingTags.push(p.aDOT >= 12.0 ? "Deep Threat" : "Breakout Age");
                }
                if (p.wopr && p.wopr >= 0.60) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.15;
                    if (!ceilingTags.includes("Alpha WOPR Profile")) ceilingTags.push("Alpha WOPR Profile");
                }
                if (p.airYards && p.airYards >= 1200) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.15;
                    if (!ceilingTags.includes("Air Yards Monster")) ceilingTags.push("Air Yards Monster");
                }
                if (p.pastStats && p.pastStats.bigPlays >= 12) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.15;
                    if (!ceilingTags.includes("Spike Week Upside")) ceilingTags.push("Spike Week Upside");
                }

                // 🚀 NEW: System-Based Contingent Upside (Next-Man-Up)
                if (p.depthChart && teamDist) {
                    // If they are a backup WR in a scheme that heavily funnels targets to WRs
                    if (p.Pos === 'WR' && p.depthChart >= 3 && teamDist['WR %'] >= 62.0) {
                        p._isFlyer = true;
                        upsideMultiplier += 0.10; // Smaller than RB's 0.25, but still gives a noticeable late-round bump
                        if (!ceilingTags.includes("Scheme Upside (Next-Man-Up)")) {
                            ceilingTags.push("Scheme Upside (Next-Man-Up)");
                        }
                    }
                    // If they are a backup TE in a scheme that heavily features TEs
                    else if (p.Pos === 'TE' && p.depthChart === 2 && teamDist['TE %'] >= 22.0) {
                        p._isFlyer = true;
                        upsideMultiplier += 0.10;
                        if (!ceilingTags.includes("TE-Friendly Scheme Contingency")) {
                            ceilingTags.push("TE-Friendly Scheme Contingency");
                        }
                    }
                }

                // 🛡️ SAFE FLOOR TRAITS
                let hasTargetFloor = (p.targetShare && p.targetShare >= 20);
                let hasEfficiencyFloor = (p.trueCatchRate && p.trueCatchRate >= 85.0);
                let hasRedZoneFloor = (p.rzTgt && p.rzTgt >= 15);

                // 🌟 ROOKIE/NEW STARTER INHERITED FLOOR
                // If a rookie is named WR1/TE1 on a team that funnels targets to that position, they inherit that floor.
                if (isInheritedStarter && teamDist) {
                    if (p.Pos === 'WR' && teamDist['WR %'] >= 60.0) hasTargetFloor = true;
                    if (p.Pos === 'TE' && teamDist['TE %'] >= 22.0) hasTargetFloor = true;
                }

                if ((hasTargetFloor && (!p.aDOT || p.aDOT < 11.0)) || hasEfficiencyFloor || hasRedZoneFloor) {
                    p._isSafeFloor = true;
                }

                if (pAge && pAge >= 31 && p.Pos === 'WR') upsideMultiplier -= 0.15;
            }

            // -----------------------------------------------------------
            // QB CLASSIFICATION
            // -----------------------------------------------------------
            else if (p.Pos === 'QB') {
                // 🚀 CEILING / FLYER TRAITS
                if (p.stats && p.stats.rushAtt >= 65) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.25;
                    ceilingTags.push("Rushing Upside");
                }

                // 🛡️ SAFE FLOOR TRAITS
                let hasCleanPocket = (p.pressureRate && p.pressureRate <= 18.0) || (p.olTier === 'S' || p.olTier === 'A');
                // FIXED: Use trueAccuracy for QBs instead of trueCatchRate
                let hasAccuracyFloor = (p.trueAccuracy && p.trueAccuracy >= 70.0) || (p.stats && p.stats.passCmp / p.stats.passAtt >= 0.66);

                // 🌟 ROOKIE/NEW STARTER INHERITED FLOOR
                if (isInheritedStarter) {
                    // Inherit the O-Line's pocket protection time and the receiver room's ability to catch the ball.
                    if ((passEnv && passEnv.pktTime >= 2.5) || p.olTier === 'S' || p.olTier === 'A') hasCleanPocket = true;
                    if (passEnv && passEnv.onTgtPct >= 75.0) hasAccuracyFloor = true;
                }

                if (hasCleanPocket && hasAccuracyFloor) {
                    p._isSafeFloor = true;
                }
            }

            p._ceilingTags = [...new Set(ceilingTags)]; // Remove duplicates

            let baseVbd = p.AdvVBD || p.VBD;
            if (baseVbd > 0) {
                p.upsideScore = baseVbd * upsideMultiplier;
            } else {
                p.upsideScore = baseVbd / Math.max(0.5, upsideMultiplier);
            }

            // ===========================================================
            // FINAL CALCULATIONS
            // ===========================================================
            // Tightened bounds from 0.75-1.25 down to 0.80-1.20 for enhanced stability
            adjMultiplier = Math.max(0.80, Math.min(1.20, adjMultiplier));

            if (p.VBD >= 0) {
                // 2. Dampen the multiplier for elite players so they don't break the top of the draft board
                // e.g. A 10% boost on 150 VBD is +15 pts. The dampener smoothly compresses the multiplier as VBD scales up.
                let dampenedMultiplier = p.VBD > 50 ? 1 + ((adjMultiplier - 1) * (50 / p.VBD)) : adjMultiplier;
                p.AdvVBD = p.VBD * dampenedMultiplier;
            } else {
                p.AdvVBD = p.VBD / adjMultiplier;
            }

            if (isNaN(p.VBD)) p.VBD = 0;
            if (isNaN(p.AdvVBD)) p.AdvVBD = p.VBD;

            // 11. INJURY PENALTIES & PHYSICAL ATTRIBUTES (BMI)
            if (p.injuryStatus) {
                // Severe penalty for players slated to miss serious time
                if (['Out', 'IR', 'PUP', 'COV'].includes(p.injuryStatus)) {
                    p.AdvVBD *= 0.85; 
                } 
                // Minor deduction for camp injuries/questionable tags
                else if (p.injuryStatus === 'Doubtful') {
                    p.AdvVBD *= 0.95;
                }
            }

            // BMI Calculator for Running Backs (BMI = 703 x (weight / height^2))
            if (p.height && p.weight && p.Pos === 'RB') {
                // Sleeper heights format e.g., "5'10" or "6-1"
                let hMatch = String(p.height).match(/(\d+)['\-]+(\d+)/);
                if (hMatch) {
                    let inches = (parseInt(hMatch[1]) * 12) + parseInt(hMatch[2]);
                    let weightLbs = parseInt(p.weight);
                    if (inches > 0 && weightLbs > 0) {
                        p.bmi = (weightLbs / (inches * inches)) * 703;
                        // Give a micro-boost to elite power frames (e.g. Derrick Henry, Nick Chubb)
                        if (p.bmi >= 31.5) p.AdvVBD *= 1.02; 
                    }
                }
            }

            // Range of Outcomes / Upside Potential 
            let upsideBonus = 0;
            if (p.aDOT && p.aDOT >= 12.0) upsideBonus += 0.05;
            if (p.hvo && p.hvo >= 75) upsideBonus += 0.05;
            if (p.pastStats && p.pastStats.bigPlays && p.pastStats.bigPlays >= 12) upsideBonus += 0.04;

            // Combine upsideBonus with the dynamic upsideScore from Step 10
            if (p.upsideScore > 0) {
                p.upsideScore = p.upsideScore * (1 + upsideBonus);
            }
        });

        // Fail-safe sort
        this.allPlayers.sort((a, b) => (b.AdvVBD || 0) - (a.AdvVBD || 0));

        // Assign static ranks for the Draft UI
        let posTracker = {};
        this.allPlayers.forEach((p, index) => {
            p.ovrRank = index + 1;
            posTracker[p.Pos] = (posTracker[p.Pos] || 0) + 1;
            p.posRank = `${p.Pos}${posTracker[p.Pos]}`;
        });

        this.availablePlayers = [...this.allPlayers];
    },

    // Helper: Calculates positional tiers for available players based on AdvVBD clusters
    getPositionalTiers(pos) {
        let avail = this.availablePlayers.filter(p => p.Pos === pos);
        if (!avail.length) return [];

        let tiers = [];
        let currentTier = [avail[0]];
        let dropThreshold = (pos === 'QB' || pos === 'TE') ? 7.5 : 9.5;

        for (let i = 1; i < avail.length; i++) {
            let prevVal = avail[i - 1].AdvVBD || avail[i - 1].VBD;
            let currVal = avail[i].AdvVBD || avail[i].VBD;
            if ((prevVal - currVal) >= dropThreshold) {
                tiers.push(currentTier);
                currentTier = [];
            }
            currentTier.push(avail[i]);
        }
        if (currentTier.length) tiers.push(currentTier);
        return tiers;
    },

    parseHistory(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const profiles = {};

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split('\t');
            if (cols.length < 5) continue;

            const round = parseInt(cols[0], 10);
            const teamName = cols[2].replace(/,/g, '').trim();
            const playerName = cols[3]?.replace(/,/g, '').trim();
            const pos = this.normalizePos(cols[4]);

            if (!profiles[teamName]) {
                profiles[teamName] = {
                    name: teamName,
                    totalDrafts: 0,
                    earlyRBs: 0, earlyWRs: 0,
                    firstQbRound: 99, firstTeRound: 99,
                    qbAvgRound: 0, qbCount: 0,
                    teAvgRound: 0, teCount: 0,
                    pkAvgRound: 0, pkCount: 0,
                    dstAvgRound: 0, dstCount: 0,
                    midRoundRBs: 0, midRoundWRs: 0,
                    teamTally: {}
                };
            }

            let p = profiles[teamName];

            // Track distinct draft instances (increment whenever Round 1 is processed)
            if (round === 1) {
                p.totalDrafts++;
            }

            // Track Early Rounds 1-3
            if (round <= 3) {
                if (pos === 'RB') p.earlyRBs++;
                if (pos === 'WR') p.earlyWRs++;
            }

            // Track Mid-Rounds 6-10
            if (round >= 6 && round <= 10) {
                if (pos === 'RB') p.midRoundRBs++;
                if (pos === 'WR') p.midRoundWRs++;
            }

            // Track First QB / TE Selected
            if (pos === 'QB' && round < p.firstQbRound) p.firstQbRound = round;
            if (pos === 'TE' && round < p.firstTeRound) p.firstTeRound = round;

            // Position Averages
            if (pos === 'QB' && round < 12) { p.qbAvgRound += round; p.qbCount++; }
            if (pos === 'TE' && round < 12) { p.teAvgRound += round; p.teCount++; }
            if (pos === 'PK') { p.pkAvgRound += round; p.pkCount++; }
            if (pos === 'DST') { p.dstAvgRound += round; p.dstCount++; }

            // Track NFL Team Bias
            let matchedPlayer = this.matchPlayerFast(playerName, '', pos);
            if (matchedPlayer && matchedPlayer.Team) {
                let nflTeam = this.normalizeTeam(matchedPlayer.Team);
                p.teamTally[nflTeam] = (p.teamTally[nflTeam] || 0) + 1;
            }
        }

        // Resolve Manager Personalities & Mid-Round Tendencies
        for (let key in profiles) {
            let p = profiles[key];
            let draftsCount = Math.max(1, p.totalDrafts || 1);

            // Per-draft averages
            let avgEarlyRBs = p.earlyRBs / draftsCount;
            let avgEarlyWRs = p.earlyWRs / draftsCount;
            let avgMidRBs = p.midRoundRBs / draftsCount;

            p.qbAvgRound = p.qbCount > 0 ? (p.qbAvgRound / p.qbCount) : 10;
            p.teAvgRound = p.teCount > 0 ? (p.teAvgRound / p.teCount) : 10;
            p.pkAvgRound = p.pkCount > 0 ? (p.pkAvgRound / p.pkCount) : 15;
            p.dstAvgRound = p.dstCount > 0 ? (p.dstAvgRound / p.dstCount) : 15;

            p.draftsEarlyQB = p.firstQbRound <= 5;
            p.draftsEarlyTE = p.firstTeRound <= 5;

            // --- Core Strategy Logic (Normalized per Draft) ---
            if (avgEarlyRBs >= 1.5) {
                p.strategy = "Robust-RB";
            } else if (avgEarlyRBs >= 0.8 && avgEarlyWRs >= 1.5) {
                p.strategy = "Hero-RB";
            } else if (avgEarlyRBs < 0.8 && avgEarlyWRs >= 1.5) {
                p.strategy = "Zero-RB";
            } else if (p.draftsEarlyQB && p.draftsEarlyTE) {
                p.strategy = "Double-Elite";
            } else {
                p.strategy = "Balanced";
            }

            // --- Mid-Round Tendency Flags ---
            p.likesHandcuffs = avgMidRBs >= 2.0;
            p.reachesForKicker = p.pkAvgRound <= 12;
            p.reachesForDST = p.dstAvgRound <= 12;

            // Team Bias
            let maxTally = 0, bias = 'None';
            for (let teamKey in p.teamTally) {
                let avgTally = p.teamTally[teamKey] / draftsCount;
                if (avgTally > maxTally) {
                    maxTally = avgTally;
                    bias = teamKey;
                }
            }
            p.teamBias = maxTally >= 2.0 ? bias : 'None';
        }

        this.managerProfiles = profiles;
    },


    parseDefData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            let city = vals[headers.indexOf('City')] || '';
            let teamName = vals[headers.indexOf('Team')] || '';

            // Auto-fix decimal point error (20 -> 2.0, 14 -> 1.4, 32 -> 3.2)
            let rawDTD = parseFloat(vals[headers.indexOf('DTD')]) || 0;
            let realDefTDs = rawDTD > 5 ? (rawDTD / 10) : rawDTD;

            let p = {
                Player: `${city} ${teamName}`.trim(),
                Pos: 'DST',
                Team: vals[headers.indexOf('Abv')] || '',
                stats: {
                    defInt: parseFloat(vals[headers.indexOf('INT')]) || 0,
                    safety: parseFloat(vals[headers.indexOf('Safety')]) || 0,
                    sack: parseFloat(vals[headers.indexOf('Sacks')]) || 0,
                    tfl: parseFloat(vals[headers.indexOf('TFL')]) || 0,
                    defFum: parseFloat(vals[headers.indexOf('FR')]) || 0,
                    defTd: realDefTDs, // Fixes DTD float issue
                    papg: parseFloat(vals[headers.indexOf('PAPG')]) || 18.0,
                    blk: parseFloat(vals[headers.indexOf('Blk')]) || 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player && p.Team) parsed.push(p);
        }
        return parsed;
    },

    parseKickerData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            let p = {
                Player: vals[headers.indexOf('Player')],
                Pos: 'PK',
                Team: vals[headers.indexOf('Team')],
                stats: {
                    fgTotal: parseFloat(vals[headers.indexOf('FGM')]) || 0,
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

        const availableProfiles = Object.values(this.managerProfiles);
        let usedProfiles = [];
        let teamIds = [];

        for (let i = 0; i < this.settings.numTeams; i++) {
            let id = `team-${i + 1}`;
            let isUser = (i + 1 === parseInt(this.settings.userTeamIndex));
            if (isUser) this.userTeamId = id;

            let dropdown = document.getElementById(`profile-team-${i + 1}`);
            let selectedName = dropdown ? dropdown.value : "";
            let profile = null;
            let teamName = isUser ? "My Team" : `CPU ${i + 1}`;

            if (selectedName) {
                profile = availableProfiles.find(p => p.name === selectedName);
                if (profile) {
                    teamName = profile.name + (isUser ? ' (You)' : '');
                    usedProfiles.push(profile.name);
                }
            }

            if (!isUser && !profile && availableProfiles.length > 0) {
                let unassigned = availableProfiles.filter(p => !usedProfiles.includes(p.name));
                let pool = unassigned.length > 0 ? unassigned : availableProfiles;
                let profileIndex = Math.floor(Math.random() * pool.length);
                profile = pool[profileIndex];
                teamName = profile.name;
                usedProfiles.push(profile.name);
            }

            this.teamsById[id] = {
                id: id, name: teamName,
                isCPU: this.settings.draftMode === 'mock' ? !isUser : false,
                profile: profile, roster: [],
                counts: { QB: 0, RB: 0, WR: 0, TE: 0, FlexRBWR: 0, Flex: 0, Superflex: 0, PK: 0, DST: 0, Bench: 0 }
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