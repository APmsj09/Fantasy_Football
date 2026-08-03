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
        roster: {
            QB: { max: 1 }, RB: { max: 2 }, WR: { max: 2 },
            TE: { max: 1 }, Flex: { max: 2 }, PK: { max: 1 },
            DST: { max: 1 }, Bench: { max: 6 }, totalSize: 16
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
            'LOS ANGELES RAMS': 'LAR', 'RAMS': 'LAR',
            'CHICAGO BEARS': 'CHI', 'BEARS': 'CHI',
            'TAMPA BAY BUCCANEERS': 'TB', 'BUCCANEERS': 'TB',
            'BUFFALO BILLS': 'BUF', 'BILLS': 'BUF',
            'CAROLINA PANTHERS': 'CAR', 'PANTHERS': 'CAR',
            'SAN FRANCISCO 49ERS': 'SF', '49ERS': 'SF',
            'INDIANAPOLIS COLTS': 'IND', 'COLTS': 'IND',
            'LOS ANGELES CHARGERS': 'LAC', 'CHARGERS': 'LAC',
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
        
        // Standard Flex (RB, WR, TE)
        if (['RB', 'WR', 'TE'].includes(pos)) return true;
        
        // Superflex / 2-QB League check
        if (pos === 'QB' && ((r.Superflex && r.Superflex.max > 0) || (r.QB && r.QB.max >= 2))) {
            return true;
        }
        
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

                const sameLastName = p._lastName === lastName;
                const sameInitialLastName = p._firstInitial === firstInitial && p._lastName === lastName;
                const nameContains = p._cleanName.includes(cleanName) || cleanName.includes(p._cleanName);
                return sameLastName || sameInitialLastName || nameContains;
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
            const runBlk = parseInt(vals[headers.indexOf('2025 Run Blk')], 10);
            const passBlk = parseInt(vals[headers.indexOf('2025 Pass Blk')], 10);

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
        let qb = []; let rb = []; let wr = []; let te = []; let pk = []; let dst = []; let flex = [];

        for (let i = 0; i < roster.length; i++) {
            let p = roster[i];
            let val = p.weeklyProjections[`W${weekNum}`] || 0;
            let pos = p.Pos;
            if (pos === 'QB') qb.push({ player: p, val: val });
            else if (pos === 'RB') rb.push(val);
            else if (pos === 'WR') wr.push(val);
            else if (pos === 'TE') te.push(val);
            else if (pos === 'PK') pk.push(val);
            else if (pos === 'DST') dst.push(val);
        }

        let score = 0;
        let req = this.settings.roster;
        let b = this.positionalWeeklyBaselines || { QB: 18.0, RB: 10.5, WR: 11.0, TE: 7.5, PK: 7.0, DST: 7.0 };

        // 1. QB SCORING (Waiver baseline for empty slot, Bye-week only for QB2)
        if (req.QB.max === 1 && !State.isPositionFlexEligible('QB')) {
            if (qb.length === 0) {
                // Empty QB slot = Waiver replacement level
                score += b.QB || 18.0;
            } else {
                // Pick highest season-projected QB as permanent QB1
                let primaryQB = qb.reduce((max, curr) => (curr.player.ProjPts > max.player.ProjPts ? curr : max), qb[0]);
                if (primaryQB.val > 0) {
                    score += primaryQB.val; // QB1 active
                } else {
                    // QB1 on BYE week -> Backup QB or waiver baseline
                    let backupQB = qb.find(q => q !== primaryQB && q.val > 0);
                    score += backupQB ? backupQB.val : (b.QB || 18.0);
                }
            }
        } else {
            // Multi-QB / Superflex
            qb.sort((a, b) => b.val - a.val);
            for (let i = 0; i < req.QB.max; i++) {
                if (i < qb.length) score += qb[i].val;
                else score += b.QB || 18.0;
            }
        }

        // 2. PK & DST SCORING
        pk.sort((a, b) => b - a);
        dst.sort((a, b) => b - a);
        for (let i = 0; i < req.PK.max; i++) {
            if (i < pk.length) score += pk[i];
            else score += b.PK || 7.0;
        }
        for (let i = 0; i < req.DST.max; i++) {
            if (i < dst.length) score += dst[i];
            else score += b.DST || 7.0;
        }

        // 3. FLEX POSITIONS (RB, WR, TE)
        rb.sort((a, b) => b - a);
        wr.sort((a, b) => b - a);
        te.sort((a, b) => b - a);

        let processFlexPos = (arr, maxReq, posKey) => {
            let s = 0;
            let bVal = b[posKey] || 10.0;
            for (let i = 0; i < maxReq; i++) {
                if (i < arr.length) s += arr[i];
                else s += bVal; // Empty starter slot uses positional replacement baseline
            }
            for (let i = maxReq; i < arr.length; i++) {
                flex.push(arr[i]);
            }
            return s;
        };

        score += processFlexPos(rb, req.RB.max, 'RB');
        score += processFlexPos(wr, req.WR.max, 'WR');
        score += processFlexPos(te, req.TE.max, 'TE');

        // Fill remaining Flex slots
        let flexBaseline = ((b.RB || 10.5) + (b.WR || 11.0)) / 2;
        flex.sort((a, b) => b - a);
        for (let i = 0; i < req.Flex.max; i++) {
            if (i < flex.length) score += flex[i];
            else score += flexBaseline;
        }

        return score;
    },

    evaluateRosterFits(team, availablePlayers) {
        let baseSeasonScore = 0;
        for (let w = 1; w <= 17; w++) {
            baseSeasonScore += this.calculateOptimalWeeklyScore(team.roster, w);
        }

        let viablePlayers = availablePlayers.filter(player => {
            let pos = player.Pos;
            if (team.counts[pos] < this.settings.roster[pos].max) return true;
            if ((pos === 'RB' || pos === 'WR' || pos === 'TE') && team.counts['Flex'] < this.settings.roster.Flex.max) return true;
            if (team.counts['Bench'] < this.settings.roster.Bench.max) return true;
            return false;
        });

        // Limit the pool to 45 to keep memory footprint hyper-light but accurate
        let topViable = viablePlayers.sort((a, b) => b.AdvVBD - a.AdvVBD).slice(0, 45);

        topViable.forEach(p => {
            let simSeasonScore = 0;

            // Push player onto existing array instead of generating a cloned copy
            team.roster.push(p);
            for (let w = 1; w <= 17; w++) {
                simSeasonScore += this.calculateOptimalWeeklyScore(team.roster, w);
            }
            team.roster.pop(); // Remove them cleanly

            let addedPts = simSeasonScore - baseSeasonScore;

            if (p.Pos === 'PK' || p.Pos === 'DST') addedPts *= 0.15;
            p._addedPPW = addedPts / 17;
        });

        // Reset non-viable players safely
        availablePlayers.forEach(p => {
            if (!topViable.includes(p)) p._addedPPW = 0;
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

                pastPts += (ps.passYds || 0) * this.scoring.passYds;
                pastPts += (ps.rushYds || 0) * this.scoring.rushYds;
                pastPts += (ps.recYds || 0) * this.scoring.recYds;
                pastPts += (ps.rec || 0) * this.scoring.ppr;
                pastPts += (ps.int || 0) * this.scoring.int;

                if (ps.passTd) pastPts += ps.passTd * this.scoring.passTd;
                if (ps.rushTd) pastPts += ps.rushTd * this.scoring.rushTd;
                if (ps.recTd) pastPts += ps.recTd * this.scoring.recTd;
                if (ps.totalTd && !ps.passTd && !ps.rushTd && !ps.recTd) {
                    if (p.Pos === 'QB') pastPts += ps.totalTd * this.scoring.passTd;
                    else pastPts += ps.totalTd * this.scoring.rushTd;
                }
                p.pastPts = pastPts;
            }
            // ===========================================================

            this.calculateWeeklyProjections(p);
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
                starters = Math.floor(numTeams * 1.25); // Baseline at QB15 instead of QB12
            }

            if (pos === 'RB' || pos === 'WR') {
                starters += Math.floor((numTeams * (this.settings.roster.Flex?.max || 2)) / 2);
            }
            if (pos === 'PK') {
                starters = Math.floor(numTeams * 1.1); // Baseline at 13th Kicker
            } else if (pos === 'DST') {
                starters = Math.floor(numTeams * 1.25); // Baseline at 15th DST
            }

            let sortedPos = [...this.allPlayers].filter(p => p.Pos === pos).sort((a, b) => b.ProjPts - a.ProjPts);
            let baselineIndex = Math.min(Math.max(starters - 1, 0), sortedPos.length - 1);
            let baselinePlayer = sortedPos[baselineIndex];
            baselines[pos] = baselinePlayer ? baselinePlayer.ProjPts : 0;
        });

        // SAVE WEEKLY REPLACEMENT-LEVEL BASELINES FOR SIMULATION
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

            //Kicker and Defense VBD multipliers
            if (p.Pos === 'PK') {
                rawVBD = (rawVBD * 0.05) - 30.0; // Pushes Kickers below skill players until Round 14+
            } else if (p.Pos === 'DST') {
                rawVBD = (rawVBD * 0.10) - 20.0; // Pushes DSTs below skill players until Round 10+
            }
            p.VBD = rawVBD;

            let adjMultiplier = 1.0;

            // 1. ADP Value Validation (Softened)
            //if (p.adp && p.adp > 0) {
            //    if (p.adp <= 12) adjMultiplier += 0.03;
            //    else if (p.adp <= 36) adjMultiplier += 0.02;
            //}

            // 2. Role Security (De-duplicated: Snap Share takes priority over Depth Chart)
            if (p.snapShare) {
                if (p.snapShare >= 80) adjMultiplier += 0.05;
                else if (p.snapShare >= 65) adjMultiplier += 0.03;
                else if (p.snapShare < 35) adjMultiplier -= 0.03;
            } else if (p.depthChart !== undefined && p.depthChart !== null) {
                if (p.depthChart === 1) adjMultiplier += 0.04;
                else if (p.depthChart >= 3) adjMultiplier -= 0.02;
            }

            // 3. Schedule Strength
            if (p.avgStars) adjMultiplier += (p.avgStars - 3.0) * 0.02;
            if (p.playoffSOS && p.playoffSOS >= 4.0) adjMultiplier += 0.02;

            // 4. Offensive Line Quality
            if (p.Pos === 'RB' && p.olRunBlk) {
                if (p.olRunBlk <= 5) adjMultiplier += 0.04;
                else if (p.olRunBlk >= 25) adjMultiplier -= 0.03;
            }
            if (['QB', 'WR', 'TE'].includes(p.Pos) && p.olPassBlk) {
                if (p.olPassBlk <= 5) adjMultiplier += 0.03;
                else if (p.olPassBlk >= 25) adjMultiplier -= 0.03;
            }

            // 5. Inherited Role Volume (for Rookies / Team Changers)
            let lacksIndividualMetrics = false;
            if (p.Pos === 'QB') {
                lacksIndividualMetrics = (p.trueAccuracy === undefined) && (p.pktTime === undefined);
            } else if (['RB', 'WR', 'TE'].includes(p.Pos)) {
                lacksIndividualMetrics = (p.targetShare === undefined) && (p.brokenTackles === undefined) && (p.yacAtt === undefined);
            }
            if (lacksIndividualMetrics) {
                p.isNewRole = true;
                let teamDist = this.teamTargets.find(t => t.Team === p.Team);

                if (teamDist && p.depthChart) {
                    let posPctKey = `${p.Pos} %`;
                    let teamPosPct = teamDist[posPctKey] || 0;

                    if (p.depthChart === 1) {
                        if (p.Pos === 'RB' && teamPosPct >= 20.0) adjMultiplier += 0.04;
                        else if (p.Pos === 'WR' && teamPosPct >= 60.0) adjMultiplier += 0.04;
                        else if (p.Pos === 'TE' && teamPosPct >= 25.0) adjMultiplier += 0.04;
                    }
                }
                if (p.Pos === 'RB' && p.olRunBlk && p.olRunBlk <= 10) adjMultiplier += 0.03;
            }

            // 6. Efficiency Metrics (Target Share, Tackle Breaking, Deep Ball)
            if (p.targetShare) {
                if (p.targetShare >= 25) adjMultiplier += 0.05;
                else if (p.targetShare >= 20) adjMultiplier += 0.03;
            }

            if (p.targetShare >= 22 && p.aDOT >= 10.0) adjMultiplier += 0.03;

            if (p.Pos === 'RB') {
                if (p.rzAtt && p.rzAtt >= 40) adjMultiplier += 0.03;
                if (p.brokenTackles && p.brokenTackles >= 20) adjMultiplier += 0.02;
            }

            if (p.trueCatchRate && p.trueCatchRate > 90) adjMultiplier += 0.02;
            if (p.dropRate && p.dropRate > 10) adjMultiplier -= 0.03;

            if (p.Pos === 'QB') {
                // Rushing floor boost for dual-threat QBs (Allen, Hurts, Lamar, Daniels)
                if (p.stats && p.stats.rushAtt >= 60) adjMultiplier += 0.08;

                // Top-tier elite passer projection boost
                if (rawVBD >= 30) adjMultiplier += 0.06;
            }

            // ===========================================================
            // ADVANCED TEAM ENVIRONMENT METRICS (ZERO OVERLAP)
            // ===========================================================
            const tTeam = this.normalizeTeam(p.Team);
            const passEnv = this.teamAdvPass[tTeam];
            const rushEnv = this.teamAdvRush[tTeam];
            const recEnv = this.teamAdvRec[tTeam];

            // 1. VETERAN & TEAM SCHEME METRICS
            if (passEnv) {
                if (['QB', 'WR', 'TE'].includes(p.Pos)) {
                    if (passEnv.playActionYds >= 950 || passEnv.rpoYds >= 550) {
                        adjMultiplier += 0.02;
                    } else if (passEnv.playActionYds < 500 && passEnv.rpoYds < 200) {
                        adjMultiplier -= 0.01;
                    }
                }

                if (['QB', 'WR', 'TE'].includes(p.Pos) && (!p.olPassBlk || (p.olPassBlk > 5 && p.olPassBlk < 25))) {
                    if (passEnv.prssPct >= 25.0) adjMultiplier -= 0.02;
                    else if (passEnv.prssPct <= 18.0) adjMultiplier += 0.01;
                }
            }

            // TARGET QUALITY: Evaluate Actual Starting QB Accuracy (Fallback to Team OnTgt%)
            if (['WR', 'TE'].includes(p.Pos)) {
                let teamQB = this.allPlayers.find(q =>
                    q._cleanTeam === tTeam &&
                    q._cleanPos === 'QB' &&
                    q.depthChart === 1
                );

                if (!teamQB) {
                    teamQB = this.allPlayers
                        .filter(q => q._cleanTeam === tTeam && q._cleanPos === 'QB')
                        .sort((a, b) => b.ProjPts - a.ProjPts)[0];
                }

                if (teamQB && teamQB.trueAccuracy !== undefined) {
                    if (teamQB.trueAccuracy >= 74.0) adjMultiplier += 0.025;
                    else if (teamQB.trueAccuracy <= 63.0) adjMultiplier -= 0.025;
                } else if (passEnv) {
                    if (passEnv.onTgtPct >= 76.0) adjMultiplier += 0.02;
                    else if (passEnv.badPct >= 19.0) adjMultiplier -= 0.02;
                }
            }

            // 2. ROOKIES & TEAM CHANGERS (`p.isNewRole`)
            if (p.isNewRole) {
                if (p.Pos === 'RB' && rushEnv) {
                    if (rushEnv.ybcAtt >= 2.8) adjMultiplier += 0.03;
                    else if (rushEnv.ybcAtt <= 2.0) adjMultiplier -= 0.03;

                    if (rushEnv.yacAtt >= 2.0) adjMultiplier += 0.02;
                    if (rushEnv.firstDownRate >= 28.0) adjMultiplier += 0.01;
                }

                if (['WR', 'TE'].includes(p.Pos) && recEnv) {
                    if (recEnv.yacPerRec >= 5.8) adjMultiplier += 0.03;
                    else if (recEnv.yacPerRec <= 4.6) adjMultiplier -= 0.02;

                    if (recEnv.adot >= 8.0) adjMultiplier += 0.01;
                    if (recEnv.dropPct >= 6.0) adjMultiplier -= 0.02;
                }

                if (p.Pos === 'QB' && passEnv) {
                    if (passEnv.pktTime >= 2.4 && passEnv.prssPct < 22.0) adjMultiplier += 0.03;
                    else if (passEnv.prssPct >= 25.0) adjMultiplier -= 0.03;

                    if (passEnv.dropPct >= 6.0) adjMultiplier -= 0.02;
                }
            }

            // NARROW CAP RANGE: Keeps Adv VBD realistic without blowing up Round 1 scores
            adjMultiplier = Math.max(0.85, Math.min(1.25, adjMultiplier));

            if (p.VBD >= 0) {
                p.AdvVBD = p.VBD * adjMultiplier;
            } else {
                p.AdvVBD = p.VBD / adjMultiplier;
            }
        });

        this.allPlayers.sort((a, b) => b.AdvVBD - a.AdvVBD);
        this.availablePlayers = [...this.allPlayers];
    },

    parseHistory(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const profiles = {};

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split('\t');
            if (cols.length < 5) continue;

            const round = parseInt(cols[0]);
            const teamName = cols[2].replace(/,/g, '').trim();

            // FIX: Normalize the position string so "Def" successfully translates to "DST"
            const pos = this.normalizePos(cols[4]);

            if (!profiles[teamName]) {
                profiles[teamName] = {
                    name: teamName,
                    totalDrafts: 0,
                    earlyRBs: 0, earlyWRs: 0,
                    qbAvgRound: 0, qbCount: 0,
                    teAvgRound: 0, teCount: 0,
                    pkAvgRound: 0, pkCount: 0,
                    dstAvgRound: 0, dstCount: 0
                };
            }

            if (round <= 3) {
                if (pos === 'RB') profiles[teamName].earlyRBs++;
                if (pos === 'WR') profiles[teamName].earlyWRs++;
            }

            // Keep the round filter for QB/TE to ignore late backups, 
            // but remove it entirely for PK/DST since they naturally go late!
            if (pos === 'QB' && round < 12) {
                profiles[teamName].qbAvgRound += round;
                profiles[teamName].qbCount++;
            }
            if (pos === 'TE' && round < 12) {
                profiles[teamName].teAvgRound += round;
                profiles[teamName].teCount++;
            }
            if (pos === 'PK') {
                profiles[teamName].pkAvgRound += round;
                profiles[teamName].pkCount++;
            }
            if (pos === 'DST') {
                profiles[teamName].dstAvgRound += round;
                profiles[teamName].dstCount++;
            }
        }

        for (let key in profiles) {
            let p = profiles[key];
            p.qbAvgRound = p.qbCount > 0 ? (p.qbAvgRound / p.qbCount) : 10;
            p.teAvgRound = p.teCount > 0 ? (p.teAvgRound / p.teCount) : 10;

            // FIX: Change fallback for K/DST to 15 (instead of 10) for managers lacking history
            p.pkAvgRound = p.pkCount > 0 ? (p.pkAvgRound / p.pkCount) : 15;
            p.dstAvgRound = p.dstCount > 0 ? (p.dstAvgRound / p.dstCount) : 15;

            if (p.earlyRBs > p.earlyWRs * 1.5) p.strategy = "RB-Heavy";
            else if (p.earlyWRs > p.earlyRBs * 1.5) p.strategy = "Zero-RB";
            else p.strategy = "Balanced";

            p.draftsEarlyQB = p.qbAvgRound <= 5;
            p.draftsEarlyTE = p.teAvgRound <= 5;
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
                    defTd: parseFloat(vals[headers.indexOf('DTD')]) || 0,
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
                id: id,
                name: teamName,
                isCPU: this.settings.draftMode === 'mock' ? !isUser : false,
                profile: profile,
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