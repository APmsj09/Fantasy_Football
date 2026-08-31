const State = {
    allPlayers: [],
    availablePlayers: [],
    currentRecommendations: [],
    teamsById: {},
    _playerIndex: new Map(),
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
    
    weights: {
        starterNeed: 25,
        flexNeed: 15,
        survivalUrgency: 8,
        stackBoost: 1.05,
        maxStash: 20
    },

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
        let p = pos.toUpperCase().trim().replace(/[0-9]/g, '');
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

    buildPlayerIndex() {
        this._playerIndex.clear();
        this._fallbackIndex = new Map(); // Dedicated fallback map

        this.allPlayers.forEach(p => {
            const exactKey = `${p._noSpaceName}_${p._cleanTeam}_${p._cleanPos}`;
            this._playerIndex.set(exactKey, p);
        
            const fallbackKey = `${p._noSpaceName}_${p._cleanPos}`;
            if (!this._fallbackIndex.has(fallbackKey)) {
                this._fallbackIndex.set(fallbackKey, p);
            }
        });
    },

    async fetchSleeperProjections(season) {
        try {
            // ⚡ Fetch Kicker Metadata and Projections concurrently for speed
            const [playersRes, projRes] = await Promise.all([
                fetch('https://api.sleeper.app/v1/players/nfl').catch(() => null),
                fetch(`https://api.sleeper.app/projections/nfl/20${season}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF`).catch(() => null)
            ]);

            let pMap = {}; // ⚡ FIXED: Store all players temporarily to resolve skill player names
            if (playersRes && playersRes.ok) {
                pMap = await playersRes.json();
            }

            if (!projRes || !projRes.ok) return;
            const projData = await projRes.json();
            const projList = Array.isArray(projData) ? projData : Object.values(projData);

            // Valid 32 NFL Teams
            const validNFLTeams = new Set([
                'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
                'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
                'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
                'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
            ]);

            this.sleeperProjectionsMap = {}; // ⚡ NEW: Store projections for blending

            projList.forEach(entry => {
                let pid = String(entry.player_id || '').trim();
                let rawPos = entry.position;
                let meta = pMap[pid] || {};
                let isKicker = rawPos === 'K' || meta.position === 'K';

                // ⚡ FIXED: Map ALL players for the blending engine
                if (meta.full_name) {
                    const cName = this.normalizeName(meta.full_name);
                    const cPos = this.normalizePos(rawPos || meta.position);
                    if (cName && cPos) {
                        this.sleeperProjectionsMap[`${cName}_${cPos}`] = entry.stats || {};
                    }
                }
                
                // 🛑 FILTER OUT IDPs (Individual Defensive Players):
                if (!isKicker) {
                    if (!isNaN(Number(pid))) return; // Skip numeric IDs (IDP players)
                    let nTeam = this.normalizeTeam(pid);
                    if (!validNFLTeams.has(nTeam)) return; // Only accept the 32 real NFL teams
                }

                let pos = isKicker ? 'PK' : 'DST';
                let team = "";
                let pName = "";

                if (pos === 'DST') {
                    team = this.normalizeTeam(pid);
                    let existingDST = this.allPlayers.find(p => p.Pos === 'DST' && this.normalizeTeam(p.Team) === team);
                    if (existingDST) return; 
                    pName = team + " Defense";
                } else if (pos === 'PK') {
                    if (meta.full_name) {
                        pName = meta.full_name;
                        team = this.normalizeTeam(meta.team || entry.team);
                    } else {
                        return; // Skip unnamed records
                    }
                }

                let p = {
                    Player: pName,
                    Pos: pos,
                    Team: team,
                    stats: {},
                    ProjPts: 0, VBD: 0, AdvVBD: 0
                };

                let st = entry.stats || {};

                if (pos === 'PK') {
                    let totalFGs = (st.fgm_0_19 || 0) + (st.fgm_20_29 || 0) + (st.fgm_30_39 || 0) + (st.fgm_40_49 || 0) + (st.fgm_50p || 0);
                    let totalXPs = st.xpm || 0;
                    if (totalFGs === 0 && totalXPs === 0) return;

                    p.stats.fgm_0_19 = st.fgm_0_19 || 0;
                    p.stats.fgm_20_29 = st.fgm_20_29 || 0;
                    p.stats.fgm_30_39 = st.fgm_30_39 || 0;
                    p.stats.fgm_40_49 = st.fgm_40_49 || 0;
                    p.stats.fgm_50p = st.fgm_50p || 0;
                    p.stats.xp = totalXPs;
                    p.stats.fgTotal = totalFGs;
                } else if (pos === 'DST') {
                    p.stats.sack = st.sack || 0;
                    p.stats.defInt = st.int || 0;
                    p.stats.defFum = st.fum_rec || 0;
                    p.stats.defTd = st.def_td || 0;
                    p.stats.safety = st.safe || 0;
                    p.stats.ptsAllowed = st.pts_allow || 300;
                    p.stats.papg = parseFloat((p.stats.ptsAllowed / 17.0).toFixed(1));
                }

                this.allPlayers.push(p);
            });
        } catch (e) {
            console.warn("Failed to load Sleeper K/DST projections", e);
        }
    },

    matchPlayerFast(name, team, pos) {
        let cleanName = this.normalizeName(name);
        let noSpaceName = cleanName.replace(/\s/g, '');
        let nTeam = this.normalizeTeam(team);
        let nPos = this.normalizePos(pos);

        if (!this.allPlayers || !this.allPlayers.length) return null;

        if (nPos !== 'DST' && nPos !== 'PK') {
            // Check exact map first
            let exactMatch = this._playerIndex.get(`${noSpaceName}_${nTeam}_${nPos}`);
            if (exactMatch) return exactMatch;

            // Check fallback map without contaminating exact indices
            let fallbackMatch = this._fallbackIndex.get(`${noSpaceName}_${nPos}`);
            if (fallbackMatch) return fallbackMatch;
        }
        // Fallback to fuzzy loop for DSTs and edge cases
        if (nPos === 'DST') {
            return this.allPlayers.find(p => {
                if (p._cleanPos !== 'DST') return false;
                if (nTeam && p._cleanTeam === nTeam) return true;
                if (p._cleanTeam && cleanName.includes(p._cleanTeam.toLowerCase())) return true;
                let pNameClean = p._cleanName;
                if (pNameClean.includes(cleanName) || cleanName.includes(pNameClean)) return true;
                let cleanParts = cleanName.split(' ');
                for (let part of cleanParts) {
                    if (part.length >= 4 && pNameClean.includes(part)) return true;
                }
                return false;
            });
        }

        // Exact match
        let exact = this.allPlayers.find(p => p._cleanName === cleanName && (!nPos || p._cleanPos === nPos));
        if (exact) return exact;

        let exactNoSpace = this.allPlayers.find(p => p._noSpaceName === noSpaceName && (!nPos || p._cleanPos === nPos));
        if (exactNoSpace) return exactNoSpace;

        // Prevent initial collisions (e.g., DeAndre Hopkins WR matching Dustin Hopkins PK)
        let nameParts = cleanName.split(' ');
        if (nameParts.length >= 2) {
            let firstInitial = nameParts[0][0];
            let lastName = nameParts[nameParts.length - 1];

            let sameTeamPosMatch = this.allPlayers.find(p => {
                const sameTeam = (p._cleanTeam === nTeam) || !nTeam || !p.Team;
                const samePos = (p._cleanPos === nPos) || (!nPos && !['PK', 'DST'].includes(p._cleanPos)); // 🛑 Never match offensive players to PK/DST!
                if (!sameTeam || !samePos) return false;

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

    parseInjuryData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 3) continue;

            let player = vals[headers.indexOf('Player')];
            let pos = vals[headers.indexOf('Pos')];
            let team = this.normalizeTeam(vals[headers.indexOf('Team')]);
            let reason = vals[headers.indexOf('Absence_Reason')] || '';
            let when = vals[headers.indexOf('When_Occurred')] || '';
            let status = vals[headers.indexOf('Status_26')] || '';
            let minMissed = parseInt(vals[headers.indexOf('Min_Missed_26')], 10);
            let maxMissed = parseInt(vals[headers.indexOf('Max_Missed_26')], 10);

            // Categorize timing recency
            let timing = 'camp_recent';
            let lowerWhen = when.toLowerCase();
            if (lowerWhen.includes('2025') || lowerWhen.includes('2024') || lowerWhen.includes('in-season') || lowerWhen.includes('prior')) {
                timing = 'prior_season'; // 8-10+ months ago
            } else if (lowerWhen.includes('offseason') || lowerWhen.includes('spring') || lowerWhen.includes('jan') || lowerWhen.includes('feb') || lowerWhen.includes('mar') || lowerWhen.includes('early 2026')) {
                timing = 'offseason_rehab'; // 4-7 months ago
            } else if (lowerWhen.includes('summer') || lowerWhen.includes('june') || lowerWhen.includes('jul')) {
                timing = 'summer_recent'; // 1-2 months ago
            } else if (lowerWhen.includes('aug') || lowerWhen.includes('camp')) {
                timing = 'camp_recent'; // Acute right before Week 1
            }

            let lowerReason = reason.toLowerCase();

            // Non-Injury Absences (Suspensions, Holdouts, Personal, etc.)
            const nonInjuryKeywords = ['suspension', 'holdout', 'benched', 'inactive', 'personal', 'illness', 'legal', 'leave'];
            let isNonInjury = nonInjuryKeywords.some(kw => lowerReason.includes(kw));

            // Categorize the penalty type based on status & keywords
            let penalty = 'minor';
            let upperStatus = status.toUpperCase();
            let gamesSuspended = 0;


            if (isNonInjury) {
                if (upperStatus.includes('SUS') || upperStatus === 'OUT') {
                    penalty = 'suspension'; // Active in-season suspension
                    let match = lowerReason.match(/(\d+)\s*-?\s*game/);
                    gamesSuspended = match ? parseInt(match[1], 10) : (parseInt(vals[headers.indexOf('Missed_25')], 10) || 4);
                } else {
                    penalty = 'past_non_injury'; // Historical 2025 suspension/holdout (healed/served)
                }
            } else if (upperStatus === 'SHORT_IR' || upperStatus === 'IR_RETURN' || (upperStatus === 'IR' && !lowerReason.includes('season'))) {
                penalty = 'short_ir';
            } else if (upperStatus === 'IR' || upperStatus === 'OUT_FOR_SEASON' || lowerReason.includes('season-ending')) {
                penalty = 'season_ir';
            } else if (upperStatus === 'PUP') {
                penalty = 'pup_list';
            } else if (
                lowerReason.includes('acl') ||
                lowerReason.includes('achilles') ||
                lowerReason.includes('fracture') ||
                lowerReason.includes('disloc') ||
                lowerReason.includes('tear')
            ) {
                penalty = 'major_recovery';
            } else if (
                lowerReason.includes('surgery') ||
                lowerReason.includes('mcl') ||
                lowerReason.includes('hernia') ||
                lowerReason.includes('sprain') ||
                lowerReason.includes('ankle') ||
                lowerReason.includes('knee') ||
                lowerReason.includes('leg') ||
                lowerReason.includes('foot') ||
                lowerReason.includes('toe') ||
                lowerReason.includes('shoulder')
            ) {
                penalty = 'structural_sprain';
            } else if (
                lowerReason.includes('hamstring') ||
                lowerReason.includes('groin') ||
                lowerReason.includes('calf') ||
                lowerReason.includes('quad') ||
                lowerReason.includes('psoas') ||
                lowerReason.includes('hip')
            ) {
                penalty = 'soft_tissue';
            } else if (upperStatus === 'OUT') {
                penalty = 'missed_time';
            } else {
                penalty = 'minor';
            }

            // Normalize the status string for the UI
            let formattedStatus = status;
            if (upperStatus === 'QUESTIONABLE' || upperStatus === 'LIMITED') formattedStatus = 'Questionable';
            else if (upperStatus === 'DOUBTFUL') formattedStatus = 'Doubtful';
            else if (upperStatus === 'PUP') formattedStatus = 'PUP';
            else if (upperStatus === 'OUT') formattedStatus = 'Out';
            else if (upperStatus === 'ACTIVE') formattedStatus = 'Active';
            else if (upperStatus.includes('SUS')) formattedStatus = 'Suspended';
            else if (upperStatus === 'SHORT_IR' || upperStatus === 'IR_RETURN') formattedStatus = 'Short-Term IR';
            else if (penalty === 'season_ir') formattedStatus = 'Out for Season';

            let missed25 = parseInt(vals[headers.indexOf('Missed_25')], 10) || 0;

            if (player) {
                parsed.push({
                    player, pos, team, reason, when, status: formattedStatus, penalty, timing, gamesSuspended, missed25, minMissed, maxMissed
                });
            }
        }
        return parsed;
    },

    mergeInjuryData(injList) {
        injList.forEach(inj => {
            let p = this.matchPlayerFast(inj.player, inj.team, inj.pos);
            if (p) {
                p._injuryNote = `${inj.when}: ${inj.reason}`;
                p._injuryPenalty = inj.penalty;
                p._injuryTiming = inj.timing;
                p._gamesSuspended = inj.gamesSuspended || 0;
                p._missed25 = inj.missed25 || 0;
                p._isPastNonInjury = (inj.penalty === 'past_non_injury');
                p.Min_Missed_26 = !isNaN(inj.minMissed) ? inj.minMissed : undefined;
                p.Max_Missed_26 = !isNaN(inj.maxMissed) ? inj.maxMissed : undefined;
            }
        });
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
        const headers = rows[0].split('\t').map(h => h.trim().toUpperCase());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 2) continue;

            let nameIdx = headers.indexOf('NAME');
            if (nameIdx === -1) nameIdx = headers.indexOf('PLAYER');
            const name = nameIdx >= 0 ? vals[nameIdx] : '';

            let teamIdx = headers.indexOf('TEAM');
            const team = teamIdx >= 0 ? this.normalizeTeam(vals[teamIdx]) : '';

            let posKey = null;
            if (headers.indexOf('POS') >= 0) posKey = 'POS';
            else if (headers.indexOf('POSITION') >= 0) posKey = 'POSITION';
            else if (headers.indexOf('POS.RK') >= 0) posKey = 'POS.RK';
            
            let rawPos = posKey ? vals[headers.indexOf(posKey)] : '';
            const pos = this.normalizePos(rawPos.replace(/[0-9]/g, ''));
            
            let adpIndex = headers.indexOf('REAL-TIME');
            if (adpIndex === -1) adpIndex = headers.indexOf('REAL-TIME ADP');
            if (adpIndex === -1) adpIndex = headers.indexOf('ADP');
            if (adpIndex === -1) adpIndex = headers.indexOf('PICK NUM');
            if (adpIndex === -1) adpIndex = headers.indexOf('OVR');
            if (adpIndex === -1) adpIndex = headers.indexOf('OVERALL');
            
            const adpValue = parseFloat(adpIndex >= 0 ? vals[adpIndex] : '');

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
                // Preserve live Sleeper depth chart; use TSV as fallback if missing
                if (player.depthChart === undefined || player.depthChart === null) {
                    player.depthChart = entry.depth;
                }
                player.ecr = entry.ecr;
            }
        });
    },

    parseRookieData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        const headers = rows[0].split('\t').map(h => h.trim());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 2) continue;

            const player = vals[headers.indexOf('Player')];
            if (!player) continue;

            const rawRnd = vals[headers.indexOf('DraftRound')] || '';
            const rawPick = vals[headers.indexOf('DraftPick')] || '';
            const draftTeam = vals[headers.indexOf('DraftTeam')] || '';
            const wt = parseFloat(vals[headers.indexOf('Wt')]) || null;
            const forty = parseFloat(vals[headers.indexOf('40yd')]) || null;

            let speedScore = null;
            if (wt && forty && forty > 0) {
                speedScore = parseFloat(((wt * 200) / Math.pow(forty, 4)).toFixed(1));
            }

            parsed.push({
                player,
                pos: this.normalizePos(vals[headers.indexOf('Pos')]),
                school: vals[headers.indexOf('School')],
                ht: vals[headers.indexOf('Ht')],
                wt,
                forty,
                speedScore,
                vertical: parseFloat(vals[headers.indexOf('Vertical')]) || null,
                broadJump: parseFloat(vals[headers.indexOf('Broad Jump')]) || null,
                bench: parseInt(vals[headers.indexOf('Bench')], 10) || null,
                threeCone: parseFloat(vals[headers.indexOf('3Cone')]) || null,
                shuttle: parseFloat(vals[headers.indexOf('Shuttle')]) || null,
                draftTeam: this.normalizeTeam(draftTeam),
                draftRound: rawRnd ? parseInt(rawRnd, 10) : null,
                overallPick: rawPick ? parseInt(rawPick, 10) : null,
                draftYear: parseInt(vals[headers.indexOf('DraftYear')], 10) || 2026
            });
        }
        return parsed;
    },

    mergeRookieData(rookieList) {
        if (!rookieList || !Array.isArray(rookieList)) return;

        rookieList.forEach(r => {
            let p = this.matchPlayerFast(r.player, r.draftTeam, r.pos);
            if (!p) return;

            p.isRookie = true;
            p.draftRound = r.draftRound;
            p.nflDraftPick = r.overallPick;
            p.speedScore = r.speedScore;
            p.fortyTime = r.forty;
            p.college = r.school;
            if (r.wt && !p.weight) p.weight = r.wt;
            if (r.ht && !p.height) p.height = r.ht;
            p.combineStats = {
                vertical: r.vertical,
                broadJump: r.broadJump,
                bench: r.bench,
                threeCone: r.threeCone,
                shuttle: r.shuttle
            };
        });
    },

    finalizeDepthCharts() {
        // ⚡ Ensure Sleeper's tied designations (LWR1, RWR1, SWR1) and imported TSV data 
        // are properly resolved into a clean, sequential depth chart hierarchy (1, 2, 3...)
        const teams = [...new Set(this.allPlayers.map(p => this.normalizeTeam(p.Team)).filter(Boolean))];

        ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
            teams.forEach(team => {
                const teamPlayers = this.allPlayers.filter(p => this.normalizeTeam(p.Team) === team && p.Pos === pos);
                if (!teamPlayers.length) return;

                teamPlayers.sort((a, b) => {
                    const depthA = (a.depthChart !== undefined && a.depthChart !== null) ? a.depthChart : 99;
                    const depthB = (b.depthChart !== undefined && b.depthChart !== null) ? b.depthChart : 99;

                    if (depthA !== depthB) return depthA - depthB;
                    
                    if (a.isRBStarter && !b.isRBStarter) return -1;
                    if (b.isRBStarter && !a.isRBStarter) return 1;

                    return (b.ProjPts || 0) - (a.ProjPts || 0);
                });

                // Assign clean sequential hierarchy
                teamPlayers.forEach((p, index) => {
                    if (p.depthChartPos) p.officialDepthChart = p.depthChartPos; // Preserve "LWR" / "SWR"
                    p.depthChart = index + 1; // 1, 2, 3, 4...
                });
            });
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

    mergeBoomBustData(bbList) {
        if (!bbList || !Array.isArray(bbList)) return;
        const cleanPct = (val) => typeof val === 'number' ? val : parseFloat(String(val || '0').replace('%', '')) || 0;

        bbList.forEach(row => {
            const player = row.Player || row.PLAYER;
            const team = row.Team || row.TEAM;
            if (!player) return;

            let p = this.matchPlayerFast(player, team, '');
            if (!p) return;

            p.boomBust = {
                boom: cleanPct(row['Boom']),
                top6: cleanPct(row['Top 6']),
                top12: cleanPct(row['Top 12']),
                bust: cleanPct(row['Bust']),
                other: cleanPct(row['Other']),
                games: parseInt(row['Games'], 10) || 0
            };
        });
    },

    mergeBoomBustData24(bbList) {
        if (!bbList || !Array.isArray(bbList)) return;
        
        // Safely converts '44%', 44, or undefined into a clean float, defaulting to 0
        const cleanPct = (val) => typeof val === 'number' ? val : parseFloat(String(val || '0').replace('%', '')) || 0;

        bbList.forEach(row => {
            const player = row.Player || row.PLAYER;
            const team = row.Team || row.TEAM;
            if (!player) return;

            let p = this.matchPlayerFast(player, team, '');
            if (!p) return;

            p.boomBust24 = {
                boom: cleanPct(row['Boom']),
                top6: cleanPct(row['Top 6']), // RBs/WRs don't have this; cleanPct safely converts it to 0
                top12: cleanPct(row['Top 12']),
                bust: cleanPct(row['Bust']),
                other: cleanPct(row['Other']),
                games: parseInt(row['Games'] || row['GAMES'], 10) || 0
            };
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

            if (team) p.pastTeam = this.normalizeTeam(team);

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

    // ===========================================================
    // 2024 HISTORICAL DATA PARSER & MERGER
    // ===========================================================
    parseHistoricalStatsData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        
        // ⚡ DYNAMIC DELIMITER: Safely handles both TSV and CSV formats
        const delimiter = rows[0].includes('\t') ? '\t' : ',';
        
        // Clean & normalize headers for case-insensitive flexible matching
        const rawHeaders = rows[0].split(delimiter).map(h => h.trim());
        const headers = rawHeaders.map(h => h.toUpperCase().replace(/[^A-Z0-9%]/g, ''));
        const parsed = [];

        // Helper: Find column index matching any alias
        const findIdx = (aliases) => {
            for (let a of aliases) {
                let cleanA = a.toUpperCase().replace(/[^A-Z0-9%]/g, '');
                let idx = headers.indexOf(cleanA);
                if (idx !== -1) return idx;
            }
            return -1;
        };

        // Helper: Extract clean float from column
        const getNum = (vals, aliases, fallback = 0) => {
            for (let a of aliases) {
                let cleanA = a.toUpperCase().replace(/[^A-Z0-9%]/g, '');
                let idx = headers.indexOf(cleanA);
                if (idx !== -1 && vals[idx] !== undefined && vals[idx] !== '') {
                    let num = parseFloat(String(vals[idx]).replace(/,/g, '').replace('%', '').trim());
                    if (!isNaN(num)) return num;
                }
            }
            return fallback;
        };

        const playerIdx = findIdx(['PLAYER', 'NAME', 'PLAYERNAME']);
        const teamIdx = findIdx(['TEAM', 'TM', 'TEAMNAME']);
        const posIdx = findIdx(['POS', 'POSITION']);

        if (playerIdx === -1) return [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split(delimiter).map(v => v.trim());
            if (vals.length <= playerIdx) continue;

            const player = vals[playerIdx];
            const team = teamIdx !== -1 ? vals[teamIdx] : '';
            const pos = posIdx !== -1 ? vals[posIdx] : '';
            if (!player) continue;

            // Extract Games Played (looks for G, GP, GAMES)
            let gp = getNum(vals, ['G', 'GP', 'GAMES'], 0);
            if (gp === 0) gp = 17; // Default only if completely missing

            // Passing Stats
            let passCmp = getNum(vals, ['CMP', 'COMP', 'PASSCMP']);
            let passAtt = getNum(vals, ['PASSATT', 'PASSES', 'ATT']);
            let passYds = getNum(vals, ['PASSATTYDS', 'PASSYDS', 'YDS']);
            let passTd = getNum(vals, ['PASSATTTD', 'PASSTD', 'TD']);
            let intVal = getNum(vals, ['INT', 'INTS', 'INTERCEPTIONS']);

            // Rushing Stats (Checks specific Rush prefixes first before generic ATT/YDS/TD)
            let rushAtt = getNum(vals, ['RUSHATT', 'CARRIES', 'RUSHES', 'ATT']);
            let rushYds = getNum(vals, ['RUSHATTYDS', 'RUSHYDS', 'RUSHINGYDS', 'YDS']);
            let rushTd = getNum(vals, ['RUSHATTTD', 'RUSHTD', 'RUSHINGTD', 'TD']);

            // Receiving Stats
            let tgts = getNum(vals, ['TGT', 'TARGETS']);
            let rec = getNum(vals, ['REC', 'RECEPTIONS']);
            let recYds = getNum(vals, ['RECYDS', 'RECEIVINGYDS', 'YDS']);
            let recTd = getNum(vals, ['RECTD', 'RECEIVINGTD', 'TD']);
            let tgtShare = getNum(vals, ['TGT%', 'TGTPCT', '%TM']);

            // Big Plays & Fumbles
            let bigRush = getNum(vals, ['20+RUSH', 'BIGRUSH']);
            let bigRec = getNum(vals, ['20+REC', 'BIGREC']);
            let fum = getNum(vals, ['FL', 'FUM', 'FUMBLESLOST']);

            let obj = {
                Player: player,
                Team: this.normalizeTeam(team),
                Pos: this.normalizePos(pos),
                gp: gp,
                passCmp, passAtt, passYds, passTd, int: intVal,
                rushAtt, rushYds, rushTd,
                targets: tgts, rec, recYds, recTd, targetShare: tgtShare,
                bigRush, bigRec,
                bigPlays: (bigRush || 0) + (bigRec || 0),
                fum,
                totalTd: (passTd || 0) + (rushTd || 0) + (recTd || 0)
            };

            parsed.push(obj);
        }
        return parsed;
    },

    merge2024StatsData(statsList) {
        if (!statsList || !Array.isArray(statsList)) return;

        statsList.forEach(row => {
            // Pass pos and team for fast matching
            let p = this.matchPlayerFast(row.Player, row.Team, row.Pos || '');
            if (!p) return;

            if (!p.stats2024) p.stats2024 = {};
            p.stats2024 = row;

            // Calculate 2024 Fantasy PPG using custom scoring rules
            let sc = (val, def) => typeof val === 'number' ? val : def;
            let pts24 = 0;
            pts24 += (row.passYds || 0) * sc(this.scoring.passYds, 0.04);
            pts24 += (row.passTd || 0) * sc(this.scoring.passTd, 6);
            pts24 += (row.int || 0) * sc(this.scoring.int, -2);
            pts24 += (row.rushYds || 0) * sc(this.scoring.rushYds, 0.1);
            pts24 += (row.rushTd || 0) * sc(this.scoring.rushTd, 6);
            pts24 += (row.recYds || 0) * sc(this.scoring.recYds, 0.1);
            let pastPpr = sc(this.scoring.ppr, 1) + (p.Pos === 'TE' ? sc(this.scoring.tePremium, 0) : 0);
            pts24 += (row.rec || 0) * pastPpr;

            pts24 += (row.recTd || 0) * sc(this.scoring.recTd, 6);
            pts24 += (row.fum || 0) * sc(this.scoring.fumLost, -2);
            
            p.stats2024.totalPts = pts24;
            p.stats2024.ppg = (row.gp > 0) ? (pts24 / row.gp) : 0;
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
            // Evaluates using optimal baselines so empty slots aren't treated as zero
            // ❌ INCORRECT: let pts = this.calculateActualWeeklyScore(team.roster, w);
            // ✅ CORRECT:
            let pts = this.calculateOptimalWeeklyScore(team.roster, w);
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
                // Now accurately tracks Value Over Replacement Player (VORP)
                // ❌ INCORRECT: let newScore = this.calculateActualWeeklyScore(team.roster, w);
                // ✅ CORRECT:
                let newScore = this.calculateOptimalWeeklyScore(team.roster, w);
                simSeasonScore += newScore;

                let weekDiff = newScore - baseWeeklyScores[w];
                const startersOnByeThisWeek = team.roster.filter(r => String(r.byeWeek) === String(w)).length;
                if (weekDiff > maxWeekAdded && startersOnByeThisWeek > 0 && w >= 5 && w <= 14) {
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

    evaluateDraftValue(player, team, context) {
        const { currentRound, currentOverallPick, nextActiveWindowPick, isCPU } = context;
        const profile = team.profile;
        
        let baseVBD = player.AdvVBD ?? player.VBD ?? 0;
        let pos = player.Pos;
        let posRoster = this.settings.roster[pos];
        let starterMax = posRoster ? posRoster.max : 0;
        let currentCount = team.counts[pos] || 0;
        let isStarterOpen = currentCount < starterMax;
        
        let isFlexRBWROpen = ['RB', 'WR'].includes(pos) && (team.counts['FlexRBWR'] < (this.settings.roster.FlexRBWR?.max || 0));
        let isFlexOpen = ['RB', 'WR', 'TE'].includes(pos) && (team.counts['Flex'] < (this.settings.roster.Flex?.max || 0));
        let isSuperflexOpen = ['QB', 'RB', 'WR', 'TE'].includes(pos) && (team.counts['Superflex'] < (this.settings.roster.Superflex?.max || 0));
        let isBenchOpen = team.counts['Bench'] < (this.settings.roster.Bench?.max || 6);

        let isAnyStartingSlotOpen = isStarterOpen || isFlexRBWROpen || isFlexOpen || isSuperflexOpen;

        if (!isStarterOpen && !isAnyStartingSlotOpen && !isBenchOpen) {
            return { totalDraftValue: -999, isDraftable: false }; 
        }

        let starterBonus = 0;
        if (isStarterOpen) starterBonus = this.weights.starterNeed;
        else if (isFlexRBWROpen || isFlexOpen || isSuperflexOpen) starterBonus = this.weights.flexNeed;

        // Scarcity Tier Cliff bonus
        let scarcityBonus = 0;
        let tiers = this.getPositionalTiers(pos);
        if (tiers.length > 1 && tiers[0].length <= 3) {
            let posRankInAvail = this.availablePlayers.filter(x => x.Pos === pos).findIndex(x => x._cleanName === player._cleanName);
            if (posRankInAvail < 3) {
                let lastInTopTier = tiers[0][tiers[0].length - 1];
                let firstInNextTier = tiers[1][0];
                let drop = (lastInTopTier.AdvVBD ?? lastInTopTier.VBD ?? 0) - (firstInNextTier.AdvVBD ?? firstInNextTier.VBD ?? 0);
                
                let urgencyMult = tiers[0].length === 1 ? 1.0 : (tiers[0].length === 2 ? 0.7 : 0.4);
                
                // ✨ 3-LAYERS DEEP FIX: Onesie Position Scarcity Dampening
                // If a position only requires 1 starter (QB/TE), the panic of a tier cliff 
                // is naturally mitigated because market demand is capped at 1 per team.
                let maxStarters = this.settings.roster[pos]?.max || 1;
                let isStrictOnesie = ['QB', 'TE', 'PK', 'DST'].includes(pos) && maxStarters === 1;
                
                if (isStrictOnesie) {
                    if (pos === 'QB' && !isSuperflexOpen) urgencyMult *= 0.20; 
                    else if (pos === 'TE' && (this.scoring.tePremium || 0) === 0) urgencyMult *= 0.35;
                }

                scarcityBonus = Math.max(0, drop) * urgencyMult;
            }
        }

        // Roster Overage Penalty
        let rosterOveragePenalty = 1.0;
        if (!isAnyStartingSlotOpen) {
            let effectiveStarterMax = starterMax;
            if (['RB', 'WR'].includes(pos)) effectiveStarterMax += (this.settings.roster.FlexRBWR?.max || 0) + (this.settings.roster.Flex?.max || 0);
            if (pos === 'TE') effectiveStarterMax += (this.settings.roster.Flex?.max || 0);
            if (['QB', 'RB', 'WR', 'TE'].includes(pos)) effectiveStarterMax += (this.settings.roster.Superflex?.max || 0);
    
            let totalPosCount = team.roster.filter(r => r.Pos === pos).length;
            let overage = Math.max(0, totalPosCount - effectiveStarterMax);

            // ✨ NEW: Smoother exponential scaling for backups, factoring in Flex eligibility
            if (['RB', 'WR'].includes(pos)) {
                rosterOveragePenalty = Math.pow(0.75, overage + 1); // 75% -> 56% -> 42%
            } else if (pos === 'TE') {
                // If Flex is open, treat like a WR. If closed, scale backup value gently.
                rosterOveragePenalty = isFlexOpen ? Math.pow(0.75, overage + 1) : Math.pow(0.50, overage + 1);
            } else if (pos === 'QB') {
                // If Superflex is open, treat like high value. If closed, scale backup value gently.
                rosterOveragePenalty = isSuperflexOpen ? Math.pow(0.70, overage + 1) : Math.pow(0.40, overage + 1);
            } else {
                // Kicker/Defense backups get slashed hard because hoarding them is objectively bad strategy
                rosterOveragePenalty = overage === 0 ? 0.15 : 0.05;
            }
        }

        // CPU Empirical Tendency Application (Safely clamped)
        let personalityAdjustment = 0;
        if (isCPU && profile && profile.empirical) {
            if (currentRound <= 3) {
                if (pos === 'RB') personalityAdjustment += (profile.empirical.earlyRBRate - 0.40) * 12.0; 
                if (pos === 'WR') personalityAdjustment += (profile.empirical.earlyWRRate - 0.40) * 12.0;
                if (pos === 'QB') personalityAdjustment += (profile.empirical.earlyQBRate - 0.10) * 15.0;
                if (pos === 'TE') personalityAdjustment += (profile.empirical.earlyTERate - 0.10) * 15.0;
            }

            // CPU Empirical Tendency Application (Safely clamped)
            if (['QB', 'TE', 'PK', 'DST'].includes(pos)) {
                let targetRound = profile.empirical[`${pos.toLowerCase()}TargetRound`] || 10;
                let roundDiff = currentRound - targetRound;
    
                if (roundDiff >= 0) {
                    personalityAdjustment += Math.min(12.0, (roundDiff + 1) * 3.0); 
                } else if (roundDiff < 0) {
                    // ✨ NEW: Smooth polynomial scaling instead of a flat -15 cliff!
                    // -1 round early = -2.0 VBD penalty
                    // -2 rounds early = -5.6 VBD penalty
                    // -3 rounds early = -10.3 VBD penalty
                    // -4 rounds early = -16.0 VBD penalty
                    personalityAdjustment -= Math.pow(Math.abs(roundDiff), 1.5) * 2.0; 
                }
            }

            if (profile.teamBias === this.normalizeTeam(player.Team)) personalityAdjustment += 4.0;
            if (profile.playerCrushes?.includes(player._cleanName)) personalityAdjustment += 6.0;

            const totalRounds = this.settings.roster.totalSize;
            const canDraftPK = profile.reachesForKicker && currentRound >= Math.floor(profile.pkAvgRound);
            const canDraftDST = profile.reachesForDST && currentRound >= Math.floor(profile.dstAvgRound);
            if (pos === 'PK' && currentRound <= totalRounds - 2 && !canDraftPK) personalityAdjustment -= 999;
            if (pos === 'DST' && currentRound <= totalRounds - 2 && !canDraftDST) personalityAdjustment -= 999;

            personalityAdjustment = Math.max(-15, Math.min(15, personalityAdjustment));
        }

        // ADP Reach / Slide evaluation
        let adpPenalty = 0, adpBonus = 0;
        if (player.adp) {
            let adpDiff = player.adp - currentOverallPick; // Positive means market drafts them later
            let allowedReach = Math.round(4.0 + Math.pow(currentRound, 1.4) * 0.8);
    
            // ✨ NEW: ADP Arbitrage for Recommendations!
            // If it's the User's turn, check if the player will survive until our NEXT pick.
            if (!isCPU && nextActiveWindowPick) {
                let turnsUntilNextPick = nextActiveWindowPick - currentOverallPick;
        
                // If the player's ADP happens BEFORE our next pick (plus a tiny 2-pick safety buffer), 
                // it is mathematically NOT a reach to draft them now. We must waive the penalty.
                if (adpDiff <= turnsUntilNextPick + 2) {
                    allowedReach = Math.max(allowedReach, adpDiff); 
                }
            }

            if (adpDiff > allowedReach) {
                adpPenalty = Math.min(22.0, (adpDiff - allowedReach) * Math.max(0.35, 1.2 - currentRound * 0.08));
                if (isCPU && personalityAdjustment > 0) adpPenalty *= 0.5; // Fan favorites mitigate reach penalty
            } else if (adpDiff < -12) {
                // ✨ NEW: Dynamic "Falling Knife" vs "Discount Rack" Logic
                // Calculate where the pick is relative to the Model's Overall Rank
                let modelDiff = (player.ovrRank || player.adp) - currentOverallPick; 
        
                if ((player.Edge || 0) >= -1.5) {
                    // 🟢 Scenario A: The Model LIKES them, and they are sliding past ADP. 
                    // Give them the standard slide bonus to push them to the top of your queue.
                    adpBonus = Math.min(12, Math.abs(adpDiff + 12) * 0.35);
                } else if (modelDiff < 0) {
                    // 🟡 Scenario B: The "Discount Rack" Trigger
                    // The Model HATES them, BUT they have now fallen past where even the Model 
                    // thinks they belong. They are officially a steal at this price.
                    adpBonus = Math.min(10, Math.abs(modelDiff) * 0.40);
                }
                // 🔴 Scenario C: The Model hates them, and they haven't fallen to the Model's 
                // rank yet. Give them ZERO bonus. Let the knife keep falling.
            }
        }

        // Late Round Upside
        let upsideBonus = 0;
        if (currentRound >= 7 && player.upsideScore > 0) {
            let roundScale = Math.min(1.0, Math.max(0, currentRound - 6) * 0.15);
            let ceilingDelta = Math.max(0, player.upsideScore - Math.max(0, baseVBD));
            upsideBonus = Math.min(12.0, ceilingDelta * 0.18) * roundScale;
        }

        // EARLY ROUND FLOOR SECURITY PENALTY
        // Punish high-variance profiles (injuries, bad O-Lines, volatile roles) in Rounds 1-3.
        let variancePenalty = 0;
        if (currentRound <= 3 && player.varianceSpread > 0.28) {
            let urgency = (4 - currentRound); // Rd 1 = 3, Rd 2 = 2, Rd 3 = 1
            // Scales dynamically. e.g., a 0.35 variance RB in Rd 1 gets a ~4.2 VBD penalty.
            variancePenalty = (player.varianceSpread - 0.28) * 20.0 * urgency;
        }
        
        // Bye Week Multiplier
        let byePenaltyMultiplier = 1.0;
        if (player.byeWeek && player.byeWeek !== 'N/A') {
            const sameByePlayers = team.roster.filter(r => String(r.byeWeek) === String(player.byeWeek));
            const posByeCollisions = sameByePlayers.filter(r => r.Pos === pos).length;
    
            // Check if the user has enough players at this position to survive the bye week
            let totalDraftedAtPos = team.counts[pos] || 0;
            let willHaveEmptyStarterSlot = posByeCollisions === totalDraftedAtPos && totalDraftedAtPos >= 1;

            // Treat TE like a WR/RB if the Flex slot is still open
            let isStrictOnesie = ['QB', 'PK', 'DST'].includes(pos) || (pos === 'TE' && !isFlexOpen);

            if (isStrictOnesie) {
                if (willHaveEmptyStarterSlot) {
                    // Only apply the brutal 80% penalty if drafting this player means EVERY player 
                    // at this position shares the same bye week, leaving no coverage.
                    byePenaltyMultiplier = 0.20; 
                } else if (posByeCollisions >= 1) {
                    // If they share a bye but you have coverage, just apply a minor annoyance penalty
                    byePenaltyMultiplier = 0.85; 
                }
            } else {
                // Flex-eligible positions (RB, WR, and TE if flex is open)
                if (posByeCollisions >= 2) {
                    byePenaltyMultiplier = 0.65;
                } else if (sameByePlayers.length >= 3) {
                    byePenaltyMultiplier = 0.50; // Team-wide bye week collision
                }
            }
        }

        let stackBonus = 0;
        let userQBs = team.roster.filter(r => r.Pos === 'QB');
        let matchingQB = userQBs.find(qb => qb._cleanTeam === player._cleanTeam);
        if (matchingQB && ['WR', 'TE'].includes(pos)) {
            stackBonus = 2.0;
        }

        // Only apply the Lineup Optimization (PPW) bonus in Round 5 or later.
        // In Rounds 1-4, VBD, Scarcity, and Tier Drops must dictate the draft.
        let ppwBonus = 0;
        if (!isCPU && isAnyStartingSlotOpen && player._addedPPW && player._addedPPW >= 0.5) {
            // Polynomial Phase Scaling: Transitions draft weight from pure VBD to Roster Fit
            let phaseScale = Math.min(1.0, Math.pow(Math.max(0, currentRound - 1) / 4, 1.5));
            ppwBonus = (player._addedPPW * 2) * phaseScale;
        }

        let rawScore = baseVBD + starterBonus + scarcityBonus + adpBonus - adpPenalty + upsideBonus - variancePenalty + ppwBonus + stackBonus + personalityAdjustment;
        let totalDraftValue = (rawScore >= 0 ? rawScore * rosterOveragePenalty * byePenaltyMultiplier : rawScore / Math.max(0.05, (rosterOveragePenalty * byePenaltyMultiplier)));

        return { totalDraftValue, isDraftable: true };
    },

    calculateWeeklyProjections(player) {
        player.weeklyProjections = {};
        if (!player.ProjPts || player.ProjPts <= 0) return;

        let expectedGames = player.stats?.gp || 17;
        if (!Number.isFinite(expectedGames) || expectedGames <= 0) expectedGames = 17;

        // ProjPts already factors in missed games. Derive true per-game rate:
        player._healthyPpg = player.ProjPts / expectedGames;

        let isEarlyAbsence = player._isSuspended || player._isSeasonIR || player._isShortIR || player._isPupList;
        let expectedMissed = Math.max(0, 17 - expectedGames);
        let missedCount = 0;

        for (let w = 1; w <= 18; w++) {
            let weekRating = player.sosWeeks ? player.sosWeeks[`W${w}`] : 3.0;

            if (weekRating === 'BYE') {
                player.weeklyProjections[`W${w}`] = 0;
                continue;
            }

            // Front-load zeros for suspensions / PUP / early IR
            if (isEarlyAbsence && missedCount < expectedMissed) {
                player.weeklyProjections[`W${w}`] = 0;
                missedCount++;
                continue;
            }

            let ratingVal = (typeof weekRating === 'number') ? weekRating : 3.0;
            let multiplier = 1 + ((ratingVal - 3.0) * 0.08);

            let rookieGrowthFactor = 1.0;
            if (player.isRookie) {
                rookieGrowthFactor = 0.75 + (0.50 * ((w - 1) / 17));
            }

            // If absence is scattered randomly, spread points evenly without double discounting:
            let spreadFactor = isEarlyAbsence ? 1.0 : (expectedGames / 17);

            player.weeklyProjections[`W${w}`] = Math.max(0, player._healthyPpg * multiplier * rookieGrowthFactor * spreadFactor);
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

                // True aDOT = Total Air Yards / Targets
                // Do NOT use AIR/R (Air Yards per Reception) as that heavily distorts depth of target!
                if (advPlayer['ADOT'] !== undefined) {
                    p.aDOT = advPlayer['ADOT'];
                } else if (advPlayer['AIR/A'] !== undefined) {
                    p.aDOT = advPlayer['AIR/A'];
                } else if (advPlayer['AIR'] !== undefined && advPlayer['TGT'] && advPlayer['TGT'] > 0) {
                    p.aDOT = parseFloat((advPlayer['AIR'] / advPlayer['TGT']).toFixed(1));
                }

                if (advPlayer['YACON/ATT'] !== undefined) p.yacAtt = advPlayer['YACON/ATT'];
                if (advPlayer['YACON/R'] !== undefined) p.yacAtt = advPlayer['YACON/R'];

                if (advPlayer['BRKTKL'] !== undefined) p.brokenTackles = advPlayer['BRKTKL'];
                if (advPlayer['PKT TIME'] !== undefined) p.pktTime = advPlayer['PKT TIME'];

                // ⚡ SYNTHESIZED PRO METRICS ⚡
                // 1. Yards Per Target (Efficiency) & Air Yards (Upside)
                // For RBs, the 'YDS' column in advanced files represents rushing yards; only calculate YPT for WR/TE or pull from recYds
                if (['WR', 'TE'].includes(p.Pos) && advPlayer['YDS'] && advPlayer['TGT']) {
                    p.ypt = advPlayer['YDS'] / advPlayer['TGT'];
                } else if (p.Pos === 'RB' && p.pastStats && p.pastStats.recYds && p.pastStats.targets) {
                    p.ypt = p.pastStats.recYds / p.pastStats.targets;
                }
                if (advPlayer['AIR'] !== undefined) p.airYards = advPlayer['AIR'];

                // 2. High-Value Opportunities (HVO) for RBs = Targets + Red Zone Carries
                // Targets are more predictive than Receptions because they represent earned volume, not QB accuracy.
                if (p.Pos === 'RB' && advPlayer['TGT'] !== undefined) {
                    const rzCarries = advPlayer['RZ ATT'] ?? advPlayer['RZ Att'] ?? 0;
                    p.hvo = advPlayer['TGT'] + rzCarries;
                }
                
                // 3. Pressure to Sack Rate (P2S%) & True Pressure Rate
                // Pressure Rate evaluates the O-Line. P2S% evaluates the *Quarterback's* escapability.
                if (p.Pos === 'QB' && advPlayer['ATT'] > 0) {
                    let sacks = advPlayer['SACK'] || 0;
                    let hits = advPlayer['KNCK'] || 0;
                    let hurries = advPlayer['HRRY'] || 0;
                    
                    let dropbacks = advPlayer['ATT'] + sacks;
                    let totalPressures = sacks + hits + hurries;
                    
                    p.pressureRate = (totalPressures / dropbacks) * 100;
                    
                    if (totalPressures > 0) {
                        p.p2s = (sacks / totalPressures) * 100;
                    }
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
                const passTd = advPlayer['PASS TD'] ?? advPlayer['Pass TD'];
                const rushTd = advPlayer['RUSH TD'] ?? advPlayer['Rush TD'];
                const recTd = advPlayer['REC TD'] ?? advPlayer['Rec TD'];
                const totalTd = advPlayer['TD'] ?? advPlayer['TDs'] ?? advPlayer['Total TD'];

                if (totalTd !== undefined) {
                    p.pastStats.totalTd = totalTd;
                } else if (passTd !== undefined || rushTd !== undefined || recTd !== undefined) {
                    const fallbackTotal = [passTd, rushTd, recTd]
                        .filter(val => val !== undefined && val !== null && val !== '')
                        .reduce((sum, val) => sum + Number(val), 0);
                    p.pastStats.totalTd = fallbackTotal;
                }

                if (advPlayer['INT']) p.pastStats.int = advPlayer['INT'];
                if (passTd !== undefined) p.pastStats.passTd = passTd;
                if (rushTd !== undefined) p.pastStats.rushTd = rushTd;
                if (recTd !== undefined) p.pastStats.recTd = recTd;
            }
        });
    },

    parseCBS_QB(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            if (vals.length < 15) continue;
            let p = {
                Player: vals[0], Pos: 'QB', Team: this.normalizeTeam(vals[2]),
                stats: {
                    gp: parseFloat(vals[3]) || 17, passAtt: parseFloat(vals[4]) || 0,
                    passCmp: parseFloat(vals[5]) || 0, passYds: parseFloat(vals[6]) || 0,
                    passTd: parseFloat(vals[8]) || 0, int: parseFloat(vals[9]) || 0,
                    passerRating: parseFloat(vals[10]) || 0, rushAtt: parseFloat(vals[11]) || 0,
                    rushYds: parseFloat(vals[12]) || 0, rushAvg: parseFloat(vals[13]) || 0,
                    rushTd: parseFloat(vals[14]) || 0, fum: parseFloat(vals[15]) || 0,
                    targets: 0, rec: 0, recYds: 0, recAvg: 0, recTd: 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
    },

    parseCBS_RB(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            if (vals.length < 14) continue;
            let p = {
                Player: vals[0], Pos: 'RB', Team: this.normalizeTeam(vals[2]),
                stats: {
                    gp: parseFloat(vals[3]) || 17, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, int: 0, passerRating: 0,
                    rushAtt: parseFloat(vals[4]) || 0, rushYds: parseFloat(vals[5]) || 0, rushAvg: parseFloat(vals[6]) || 0,
                    rushTd: parseFloat(vals[7]) || 0, targets: parseFloat(vals[8]) || 0, rec: parseFloat(vals[9]) || 0,
                    recYds: parseFloat(vals[10]) || 0, recAvg: parseFloat(vals[12]) || 0, recTd: parseFloat(vals[13]) || 0,
                    fum: parseFloat(vals[14]) || 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
    },

    parseCBS_WR(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            if (vals.length < 14) continue;
            let p = {
                Player: vals[0], Pos: 'WR', Team: this.normalizeTeam(vals[2]),
                stats: {
                    gp: parseFloat(vals[3]) || 17, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, int: 0, passerRating: 0,
                    targets: parseFloat(vals[4]) || 0, rec: parseFloat(vals[5]) || 0, recYds: parseFloat(vals[6]) || 0,
                    recAvg: parseFloat(vals[8]) || 0, recTd: parseFloat(vals[9]) || 0, rushAtt: parseFloat(vals[10]) || 0,
                    rushYds: parseFloat(vals[11]) || 0, rushAvg: parseFloat(vals[12]) || 0, rushTd: parseFloat(vals[13]) || 0,
                    fum: parseFloat(vals[14]) || 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
    },

    parseCBS_TE(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            if (vals.length < 10) continue;
            let p = {
                Player: vals[0], Pos: 'TE', Team: this.normalizeTeam(vals[2]),
                stats: {
                    gp: parseFloat(vals[3]) || 17, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, int: 0, passerRating: 0,
                    targets: parseFloat(vals[4]) || 0, rec: parseFloat(vals[5]) || 0, recYds: parseFloat(vals[6]) || 0,
                    recAvg: parseFloat(vals[8]) || 0, recTd: parseFloat(vals[9]) || 0, rushAtt: 0, rushYds: 0, rushAvg: 0, rushTd: 0,
                    fum: parseFloat(vals[10]) || 0
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };
            if (p.Player) parsed.push(p);
        }
        return parsed;
    },

    scoring: {
        // Base Settings
        passYds: 0.04, passTd: 6, int: -2,
        rushYds: 0.1, rushTd: 6, recYds: 0.1, recTd: 6, ppr: 1, fumLost: -2,
        xp: 1, sack: 1, turnover: 2, defTd: 6, safety: 2,
        retYds: 0.04, retTd: 6, qbSack: 0, // ⚡ Return yards & QB sack penalty

        // 🎛️ NEW: UI Toggles
        useMilestones: true,
        use2pt: true,
        useDecimalKicking: true,

        // Extra Points Settings (Only applied if toggles are true)
        pass2pt: 2, rush2pt: 2, rec2pt: 2, def2ptRet: 2,
        pass300Bonus: 1, pass400Bonus: 3,
        rush100Bonus: 1, rush200Bonus: 3,
        rec100Bonus: 1, rec200Bonus: 3,

        // Kicker Brackets: Decimal Approximations vs Standard Rules
        fg0_29: 3, fg30_39: 3.5, fg40_49: 4.5, fg50_plus: 5.3,
        std_fg0_29: 3, std_fg30_39: 3, std_fg40_49: 4, std_fg50_plus: 5
    },

    stadiumClimates: {
        'Dome': ['ATL', 'ARI', 'DAL', 'DET', 'HOU', 'IND', 'LV', 'LA', 'LAC', 'MIN', 'NO'],
        'Warm': ['CAR', 'JAX', 'MIA', 'TB', 'SF'],
        'SevereCold': ['BUF', 'CHI', 'CLE', 'GB', 'NE', 'NYG', 'NYJ', 'PIT']
    },

    calculateProjections() {
        this.allPlayers.forEach(p => {
            let s = p.stats || {};
            
            // =========================================================
            // ⚡ PER-GAME CONSENSUS BLENDING (CBS + Sleeper)
            // =========================================================
            const sleeperKey = `${p._cleanName}_${p._cleanPos}`;
            const sl = this.sleeperProjectionsMap ? this.sleeperProjectionsMap[sleeperKey] : null;

            if (sl) {
                // Helper: Convert to per-game rates, average them, multiply by Sleeper's active GP
                const blendStat = (cbsRaw, slRaw, cbsGp, slGp) => {
                    let cbsVal = Number(cbsRaw) || 0;
                    let slVal = Number(slRaw) || 0;
                    let cGp = Number(cbsGp) || 17;
                    let sGp = Number(slGp) || 17;

                    if (cbsVal > 0 && slVal > 0) {
                        let cbsPerGame = cbsVal / cGp;
                        let slPerGame = slVal / sGp;
                        let consensusPerGame = (cbsPerGame + slPerGame) / 2;
                        return consensusPerGame * sGp; // Sleeper GP is truth
                    }
                    return cbsVal > 0 ? cbsVal : slVal;
                };

                // Sync GP to Sleeper's injury-adjusted reality
                s.gp = (sl.gp && sl.gp > 0) ? sl.gp : (s.gp || 17);

                // Blend Core Stats
                s.passAtt = blendStat(s.passAtt, sl.pass_att, (p.stats?.gp || 17), s.gp);
                s.passCmp = blendStat(s.passCmp, sl.pass_cmp, (p.stats?.gp || 17), s.gp);
                s.passYds = blendStat(s.passYds, sl.pass_yd, (p.stats?.gp || 17), s.gp);
                s.passTd  = blendStat(s.passTd, sl.pass_td, (p.stats?.gp || 17), s.gp);
                s.int     = blendStat(s.int, sl.pass_int, (p.stats?.gp || 17), s.gp);

                s.rushAtt = blendStat(s.rushAtt, sl.rush_att, (p.stats?.gp || 17), s.gp);
                s.rushYds = blendStat(s.rushYds, sl.rush_yd, (p.stats?.gp || 17), s.gp);
                s.rushTd  = blendStat(s.rushTd, sl.rush_td, (p.stats?.gp || 17), s.gp);

                s.targets = blendStat(s.targets, sl.rec_tgt, (p.stats?.gp || 17), s.gp);
                s.rec     = blendStat(s.rec, sl.rec, (p.stats?.gp || 17), s.gp);
                s.recYds  = blendStat(s.recYds, sl.rec_yd, (p.stats?.gp || 17), s.gp);
                s.recTd   = blendStat(s.recTd, sl.rec_td, (p.stats?.gp || 17), s.gp);
                s.fum     = blendStat(s.fum, sl.fum_lost, (p.stats?.gp || 17), s.gp);

                // Activate New Sleeper Categories
                s.qbSacks = sl.pass_sack || 0;
                s.retYds  = (sl.kr_yd || 0) + (sl.pr_yd || 0);
                s.retTd   = (sl.kr_td || 0) + (sl.pr_td || 0);
            }

            // 🛠️ SANITY CLAMP: Ensure blended targets are never fewer than receptions
            if (s.rec && (!s.targets || s.rec > s.targets)) {
                // If receptions exceed targets, scale targets up to maintain a realistic ~85% catch rate ceiling
                s.targets = Math.round(s.rec * 1.18);
            }

            // =========================================================
            // 🚨 SLEEPER-FIRST INJURY CONTEXT & HISTORICAL RECOVERY ENGINE
            // =========================================================
            let hasLiveSleeperInjury = Boolean(p.injuryStatus && p.injuryStatus !== 'Active' && p.injuryStatus !== 'None');

            if (hasLiveSleeperInjury) {
                // 1. LIVE INJURY: Sleeper confirmed an active tag. Check TSV for specific context:
                let timing = p._injuryTiming || 'camp_recent';

                if (p.injuryStatus === 'Suspended' || p._injuryPenalty === 'suspension') {
                    let missed = p._gamesSuspended > 0 ? p._gamesSuspended : 4;
                    s.gp = Math.max(0, 17 - missed);
                    p._isSuspended = true;
                } else if (p.injuryStatus === 'Short-Term IR' || p._injuryPenalty === 'short_ir') {
                    s.gp = Math.min(s.gp || 17, 13);
                    p._isShortIR = true;
                } else if (p.injuryStatus === 'Out for Season' || p._injuryPenalty === 'season_ir') {
                    s.gp = 0;
                    p._isSeasonIR = true;
                } else if (p.injuryStatus === 'PUP' || p._injuryPenalty === 'pup_list') {
                    s.gp = Math.min(s.gp || 17, 12); 
                    p._isPupList = true;
                } else if (p._injuryPenalty === 'soft_tissue') {
                    s.gp = Math.min(s.gp || 17, 15);
                    p._isSoftTissueRisk = true;
                } else if (p._injuryPenalty === 'major_recovery') {
                    s.gp = Math.min(s.gp || 17, 12);
                    p._isSlowRampUp = true;
                } else if (p._injuryPenalty === 'structural_sprain') {
                    s.gp = Math.min(s.gp || 17, 15);
                    p._isSlowRampUp = true;
                } else if (p.injuryStatus === 'Out' || p._injuryPenalty === 'missed_time') {
                    s.gp = Math.min(s.gp || 17, 15);
                    p._isMissedTime = true;
                }
            } else if (p._injuryPenalty) {
                // 2. SLEEPER SAYS HEALTHY: Check if returning from a major 2025/prior structural reconstruction
                let isPriorMajorInjury = (p._injuryPenalty === 'major_recovery' || (p._missed25 && p._missed25 >= 4)) && 
                                         (p._injuryTiming === 'prior_season' || p._injuryTiming === 'offseason_rehab');

                if (isPriorMajorInjury) {
                    // Year-1 Return Model (e.g. Kittle Achilles, Skattebo Dislocation, Kraft ACL):
                    // Cleared to play, but account for early-season load management & pitch counts
                    s.gp = Math.min(s.gp || 17, 16);
                    p._isMajorReturn = true;
                } else {
                    // Minor or resolved issue: 100% full go
                    p._isFullyCleared = true; 
                }
            }

            let gp = s.gp || 17;

            if (p.Pos === 'PK') {
                // Apply decimal kicking logic OR standard 3/4/5 point logic based on toggle
                let b0 = this.scoring.useDecimalKicking ? this.scoring.fg0_29 : this.scoring.std_fg0_29;
                let b30 = this.scoring.useDecimalKicking ? this.scoring.fg30_39 : this.scoring.std_fg30_39;
                let b40 = this.scoring.useDecimalKicking ? this.scoring.fg40_49 : this.scoring.std_fg40_49;
                let b50 = this.scoring.useDecimalKicking ? this.scoring.fg50_plus : this.scoring.std_fg50_plus;

                let bracketFGPts = 
                    ((s.fgm_0_19 || 0) * b0) +
                    ((s.fgm_20_29 || 0) * b0) +
                    ((s.fgm_30_39 || 0) * b30) +
                    ((s.fgm_40_49 || 0) * b40) +
                    ((s.fgm_50p || 0) * b50);

                if (bracketFGPts === 0 && (s.fgTotal || 0) > 0) {
                    bracketFGPts = s.fgTotal * 3.5; // Baseline league-average FG value
                }

                p.ProjPts = bracketFGPts + ((s.xp || 0) * this.scoring.xp);
            }
            else if (p.Pos === 'DST') {
                let sc = (val, def) => typeof val === 'number' ? val : def;
                let turnoverPts = ((s.defInt || 0) + (s.defFum || 0)) * sc(this.scoring.turnover, 2);
                let sackPts = (s.sack || 0) * sc(this.scoring.sack, 1);
                let tdPts = (s.defTd || 0) * sc(this.scoring.defTd, 6);
                let safetyPts = (s.safety || 0) * sc(this.scoring.safety, 2);
                
                let convRetPts = this.scoring.use2pt ? ((s.def2ptRet || 0) * sc(this.scoring.def2ptRet, 2)) : 0;

                let papg = s.papg || 18.0;
                let weeklyPaPts = 0;
                
                if (papg === 0) weeklyPaPts = 10;
                else if (papg <= 6) weeklyPaPts = 7;
                else if (papg <= 13) weeklyPaPts = 4;
                else if (papg <= 20) weeklyPaPts = 1;
                else if (papg <= 27) weeklyPaPts = 0;
                else if (papg <= 35) weeklyPaPts = -1;
                else weeklyPaPts = -4;

                p.ProjPts = sackPts + turnoverPts + tdPts + safetyPts + convRetPts + (weeklyPaPts * gp);
                p.havocPerGame = ((s.sack || 0) + (s.defInt || 0) + (s.defFum || 0) + (s.tfl || 0)) / gp;
            }
            else {
                let sc = (val, def) => typeof val === 'number' ? val : def;
                let pprVal = sc(this.scoring.ppr, 1);
                let tePrem = sc(this.scoring.tePremium, 0);

                let recPoints = (s.rec || 0) * pprVal;
                if (p.Pos === 'TE' && tePrem > 0) {
                    recPoints += (s.rec || 0) * tePrem;
                }

                let pass2ptPts = this.scoring.use2pt ? ((s.pass2pt || 0) * sc(this.scoring.pass2pt, 2)) : 0;
                let rush2ptPts = this.scoring.use2pt ? ((s.rush2pt || 0) * sc(this.scoring.rush2pt, 2)) : 0;
                let rec2ptPts = this.scoring.use2pt ? ((s.rec2pt || 0) * sc(this.scoring.rec2pt, 2)) : 0;

                // ⚡ Calculate Return Yards and QB Sacks
                let retPts = ((s.retYds || 0) * sc(this.scoring.retYds, 0.04)) + ((s.retTd || 0) * sc(this.scoring.retTd, 6));
                let qbSackPts = p.Pos === 'QB' ? ((s.qbSacks || 0) * sc(this.scoring.qbSack, 0)) : 0;

                let basePts =
                    ((s.passYds || 0) * sc(this.scoring.passYds, 0.04)) +
                    ((s.passTd || 0) * sc(this.scoring.passTd, 6)) +
                    ((s.int || 0) * sc(this.scoring.int, -2)) +
                    pass2ptPts +
                    ((s.rushYds || 0) * sc(this.scoring.rushYds, 0.1)) +
                    ((s.rushTd || 0) * sc(this.scoring.rushTd, 6)) +
                    rush2ptPts +
                    ((s.recYds || 0) * sc(this.scoring.recYds, 0.1)) +
                    ((s.recTd || 0) * sc(this.scoring.recTd, 6)) +
                    rec2ptPts +
                    recPoints +
                    ((s.fum || 0) * sc(this.scoring.fumLost, -2)) +
                    retPts + qbSackPts; // ⚡ Added to base formula
                
                let passYpg = (s.passYds || 0) / gp;
                let rushYpg = (s.rushYds || 0) / gp;
                let recYpg = (s.recYds || 0) / gp;

                let passBonus = 0, rushBonus = 0, recBonus = 0;

                if (this.scoring.useMilestones) {
                    let pass300Games = passYpg >= 260 ? Math.min(gp, gp * ((passYpg - 240) / 100)) : 0;
                    let pass400Games = passYpg >= 320 ? Math.min(gp, gp * ((passYpg - 300) / 150)) : 0;
                    let rush100Games = rushYpg >= 75 ? Math.min(gp, gp * ((rushYpg - 60) / 60)) : 0;
                    let rush200Games = rushYpg >= 130 ? Math.min(gp, gp * ((rushYpg - 110) / 100)) : 0;
                    let rec100Games = recYpg >= 75 ? Math.min(gp, gp * ((recYpg - 60) / 60)) : 0;
                    let rec200Games = recYpg >= 130 ? Math.min(gp, gp * ((recYpg - 110) / 100)) : 0;

                    let p300B = (this.scoring.pass300Bonus !== undefined && !isNaN(this.scoring.pass300Bonus)) ? this.scoring.pass300Bonus : 1;
                    let p400B = (this.scoring.pass400Bonus !== undefined && !isNaN(this.scoring.pass400Bonus)) ? this.scoring.pass400Bonus : 3;
                    let r100B = (this.scoring.rush100Bonus !== undefined && !isNaN(this.scoring.rush100Bonus)) ? this.scoring.rush100Bonus : 1;
                    let r200B = (this.scoring.rush200Bonus !== undefined && !isNaN(this.scoring.rush200Bonus)) ? this.scoring.rush200Bonus : 3;
                    let rc100B = (this.scoring.rec100Bonus !== undefined && !isNaN(this.scoring.rec100Bonus)) ? this.scoring.rec100Bonus : 1;
                    let rc200B = (this.scoring.rec200Bonus !== undefined && !isNaN(this.scoring.rec200Bonus)) ? this.scoring.rec200Bonus : 3;

                    passBonus = (Math.max(0, pass300Games) * p300B) + (Math.max(0, pass400Games) * p400B);
                    rushBonus = (Math.max(0, rush100Games) * r100B) + (Math.max(0, rush200Games) * r200B);
                    recBonus = (Math.max(0, rec100Games) * rc100B) + (Math.max(0, rec200Games) * rc200B);
                }

                let totalProj = basePts + passBonus + rushBonus + recBonus;
                p.ProjPts = isNaN(totalProj) ? 0 : totalProj;
            }

            if (p.pastStats) {
                let ps = p.pastStats;
                let pastPts = 0;

                let sc = (val, def) => typeof val === 'number' ? val : def;
                if (p.Pos === 'DST') {
                    let sack = ps.sack || 0;
                    let defInt = ps.defInt || 0;
                    let defFum = ps.defFum || 0;
                    let defTd = ps.defTd || 0;
                    let spcTd = ps.spcTd || 0;
                    let safety = ps.safety || 0;

                    pastPts += sack * sc(this.scoring.sack, 1);
                    pastPts += (defInt + defFum) * sc(this.scoring.turnover, 2);
                    pastPts += (defTd + spcTd) * sc(this.scoring.defTd, 6);
                    pastPts += safety * sc(this.scoring.safety, 2);

                    pastPts += (ps.gp || 17) * 4;
                } else if (p.Pos === 'PK') {
                    // PK past points calculation if available
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

                    pastPts += passYds * sc(this.scoring.passYds, 0.04);
                    pastPts += rushYds * sc(this.scoring.rushYds, 0.1);
                    pastPts += recYds * sc(this.scoring.recYds, 0.1);
                    let pprValPast = sc(this.scoring.ppr, 1) + (p.Pos === 'TE' ? sc(this.scoring.tePremium, 0) : 0);
                    pastPts += rec * pprValPast;
                    pastPts += int * sc(this.scoring.int, -2);
                    pastPts += fum * sc(this.scoring.fumLost, -2);
                    pastPts += passTd * sc(this.scoring.passTd, 6);
                    pastPts += rushTd * sc(this.scoring.rushTd, 6);
                    pastPts += recTd * sc(this.scoring.recTd, 6);
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
            let maxPos = this.settings.roster[pos]?.max !== undefined ? this.settings.roster[pos].max : 1;
            let starters = numTeams * maxPos;

            // Dynamically scale baselines based on User Roster Settings
            let flexRBWR = this.settings.roster.FlexRBWR?.max || 0;
            let flex = this.settings.roster.Flex?.max || 0;
            let superFlex = this.settings.roster.Superflex?.max || 0;
            let bench = this.settings.roster.Bench?.max || 6;

            if (maxPos === 0) {
                starters = 0;
            } else if (pos === 'QB') {
                starters = Math.floor(numTeams * (maxPos + (superFlex > 0 ? 1.0 : 0) + (bench * 0.10)));
            } else if (pos === 'RB') {
                starters = Math.floor(numTeams * (maxPos + (flexRBWR * 0.5) + (flex * 0.4) + (bench * 0.35)));
            } else if (pos === 'WR') {
                starters = Math.floor(numTeams * (maxPos + (flexRBWR * 0.5) + (flex * 0.5) + (bench * 0.40)));
            } else if (pos === 'TE') {
                starters = Math.floor(numTeams * (maxPos + (flex * 0.1) + (bench * 0.05)));
                if (this.scoring.tePremium > 0) starters = Math.floor(starters * 1.2);
            } else if (pos === 'PK' || pos === 'DST') {
                starters = Math.floor(numTeams * maxPos); // No bench representation needed for kicker/defense baselines
            }
            
            // Ensure minimum 1 starter per team if maxPos > 0
            starters = Math.max(starters, numTeams * maxPos);

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

        // ⚡ Z-SCORE PRE-CALCULATION ENGINE (Position-Specific Standard Deviations)
        const calcMean = arr => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
        const calcStdDev = (arr, mean) => Math.sqrt(arr.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / Math.max(1, arr.length));

        // RBs
        const validRBs = this.allPlayers.filter(p => p.Pos === 'RB' && p.ProjPts >= 60);
        const hvoArr = validRBs.map(p => p.hvo || 0);
        const btArr = validRBs.map(p => p.brokenTackles || 0);
        const rHvoMean = calcMean(hvoArr), rHvoStd = calcStdDev(hvoArr, rHvoMean) || 1;
        const rBtMean = calcMean(btArr), rBtStd = calcStdDev(btArr, rBtMean) || 1;

        // WRs (Evaluated against WR standards: ~18% mean)
        const validWRs = this.allPlayers.filter(p => p.Pos === 'WR' && p.ProjPts >= 60);
        const wrTgtArr = validWRs.map(p => p.targetShare || 0);
        const wrWoprArr = validWRs.map(p => p.wopr || 0);
        const wrTgtMean = calcMean(wrTgtArr), wrTgtStd = calcStdDev(wrTgtArr, wrTgtMean) || 1;
        const wrWoprMean = calcMean(wrWoprArr), wrWoprStd = calcStdDev(wrWoprArr, wrWoprMean) || 1;

        // TEs (Evaluated against TE standards: ~13% mean)
        const validTEs = this.allPlayers.filter(p => p.Pos === 'TE' && p.ProjPts >= 50);
        const teTgtArr = validTEs.map(p => p.targetShare || 0);
        const teWoprArr = validTEs.map(p => p.wopr || 0);
        const teTgtMean = calcMean(teTgtArr), teTgtStd = calcStdDev(teTgtArr, teTgtMean) || 1;
        const teWoprMean = calcMean(teWoprArr), teWoprStd = calcStdDev(teWoprArr, teWoprMean) || 1;

        this.allPlayers.forEach(p => {
            const tTeam = this.normalizeTeam(p.Team);
            const passEnv = this.teamAdvPass[tTeam];
            const rushEnv = this.teamAdvRush[tTeam];
            const recEnv = this.teamAdvRec[tTeam];
            const teamDist = (this.teamTargets || []).find(t => this.normalizeTeam(t.Team) === tTeam);

            let basePts = baselines[p.Pos] || 0;
            let rawVBD = p.ProjPts - basePts;

            // Ensure derived per-touch metrics are synthesized regardless of concurrent TSV fetch order
            if (p.Pos === 'RB') {
                if (p.ypt === undefined && p.pastStats?.recYds && p.pastStats?.targets > 0) {
                    p.ypt = p.pastStats.recYds / p.pastStats.targets;
                }
                if (p.hvo === undefined) {
                    const rzCarries = p.rzAtt ?? p.pastStats?.rzAtt ?? 0;
                    const tgts = p.pastStats?.targets ?? p.stats?.targets ?? 0;
                    if (tgts > 0 || rzCarries > 0) p.hvo = tgts + rzCarries;
                }
            }

            // Gentle VBD Compression: Defenses and Kickers are highly replaceable on waivers.
            // Instead of nuking their value to negative infinity, we gently compress the scale.
            if (p.Pos === 'PK') {
                rawVBD = rawVBD * 0.35;
            } else if (p.Pos === 'DST') {
                rawVBD = rawVBD * 0.40;
            }
            p.VBD = rawVBD;

            // RESET WOPR TO RAW BEFORE APPLYING SCHEME BONUSES
            if (['WR', 'TE'].includes(p.Pos)) {
                const teamAirYards = 3500;
                const teamPassVol = teamDist ? (teamDist['Total Targets'] || 550) : 550;
                // Fall back to projected target share if historical 2025 target share is missing
                const projTgtShare = p.stats?.targets ? ((p.stats.targets / teamPassVol) * 100) : 0;
                const tgtShare = Number(p.targetShare) || projTgtShare;
                const airYardsShare = p.airYards ? ((Number(p.airYards) / teamAirYards) * 100) : tgtShare;
                p.wopr = (1.5 * (tgtShare / 100)) + (0.7 * (airYardsShare / 100));
            }


            // INITIALIZE ALL MULTIPLIERS EARLY TO PREVENT REFERENCE ERRORS
            let adjMultiplier = 1.0;
            let upsideMultiplier = 1.0;
            let ceilingTags = [];
            p._isFlyer = false;
            p._isSafeFloor = false;

            // =========================================================
            // ⚡ ADVANCED FEATURE ENGINEERING (Weather, Breakouts, Game Script)
            // =========================================================

            // 1. Playoff Weather & Dome Insulation
            let playoffDomeCount = 0;
            let playoffColdCount = 0;
            [15, 16, 17].forEach(w => {
                let opp = this.nflSchedule[tTeam]?.[w] || '';
                if (opp && opp !== 'BYE') {
                    let isAway = opp.includes('@');
                    let gameLocation = isAway ? this.normalizeTeam(opp.replace('@', '').trim()) : tTeam;
                    if (this.stadiumClimates?.Dome?.includes(gameLocation)) playoffDomeCount++;
                    if (this.stadiumClimates?.SevereCold?.includes(gameLocation)) playoffColdCount++;
                }
            });

            if (['QB', 'WR', 'TE', 'PK'].includes(p.Pos)) {
                if (playoffDomeCount >= 2) {
                    adjMultiplier += 0.02; // Small floor stability bump
                    ceilingTags.push("🏆 Climate-Controlled Playoff Schedule");
                } else if (playoffColdCount >= 2) {
                    adjMultiplier -= 0.015; // Small weather risk penalty
                    if (p.Pos === 'PK') adjMultiplier -= 0.04; 
                    p._coldWeatherRisk = true; // Flag to widen variance spread later
                }
            }

            // 2. Subtle Sophomore / Year 3 Breakout Nudges (Extremely Small)
            let pAgeVal = p.age || p.Age;
            let estYearsInNFL = pAgeVal ? (pAgeVal - 21) : 5;
            
            if (p.Pos === 'WR' && estYearsInNFL === 2) {
                let rookieTargets = p.pastStats?.targets || 0;
                if (rookieTargets >= 50 || p.ypt >= 8.5) {
                    upsideMultiplier += 0.06; // Just a +6% ceiling nudge
                    adjMultiplier += 0.015;   // Just a +1.5% baseline tiebreaker
                    ceilingTags.push("🚀 Year 2 WR Leap Window");
                }
            }
            if (p.Pos === 'TE' && estYearsInNFL === 3) {
                let careerHighTgts = Math.max(p.pastStats?.targets || 0, p.stats2024?.targets || 0);
                if (careerHighTgts >= 40) {
                    upsideMultiplier += 0.05; // Just a +5% ceiling nudge
                    adjMultiplier += 0.01;    // Just a +1% baseline tiebreaker
                    ceilingTags.push("📈 Year 3 TE Inflection");
                }
            }

            // 3. Game-Script Floor Decay (For early-down RBs on bad teams)
            if (p.Pos === 'RB') {
                let teamThreat = this.teamOffensiveThreats[tTeam];
                let teamQuality = teamThreat ? (6.0 - teamThreat.dstMatchupStars) : 3.0; // 1.0 (Bad) to 5.0 (Elite)
                let isPassCatcher = (p.targetShare && p.targetShare >= 9.0) || p._isSatelliteBack;

                if (teamQuality <= 2.5 && !isPassCatcher) {
                    adjMultiplier -= 0.045; // Base projection drop (scripted out)
                    p._rosterContextBadge = "⚠️ Game-Script Dependent (Low Receiving Floor)";
                    p._scriptRisk = true; // Flag to widen variance spread later
                } else if (teamQuality >= 4.0 && !isPassCatcher && p.weight >= 215) {
                    adjMultiplier += 0.035; // Bonus for grinding clock with the lead
                    ceilingTags.push("🚜 High-Probability 4th Quarter Closer");
                }
            }


            // --- FEATURE: Balanced Offensive Ecosystem & Garbage Time Insulation ---
            let matchupThreat = this.teamOffensiveThreats[tTeam];
            if (matchupThreat && ['QB', 'RB', 'WR', 'TE'].includes(p.Pos)) {
                let offenseQuality = 6.0 - matchupThreat.dstMatchupStars; // 5.0 = Elite, 1.0 = Anemic
                
                if (offenseQuality >= 4.5) {
                    adjMultiplier += 0.04;
                    p._inEliteOffense = true;
                } else if (offenseQuality <= 2.0) {
                    p._inAnemicOffense = true;
                    let baseAnemicPenalty = -0.04; // Standard penalty for broken offenses

                    // Cautiously mitigate penalty for high-volume PPR dump-off targets in trailing scripts
                    const isTrailingPPRBack = (p.Pos === 'RB' && (p.targetShare >= 12 || p._isSatelliteBack) && this.scoring.ppr >= 0.5);
                    const isCheckdownSlotWR = (['WR', 'TE'].includes(p.Pos) && p.aDOT && p.aDOT <= 8.5 && (p.trueCatchRate || 0) >= 88.0);

                    if (isTrailingPPRBack || isCheckdownSlotWR) {
                        baseAnemicPenalty += 0.025; // Softens penalty to -0.015 (cushions floor without boosting ceiling)
                        p._garbageTimeInsulated = true;
                    }

                    adjMultiplier += baseAnemicPenalty;
                }
            }

            // --- FEATURE: Scheme-Adjusted Expected Touchdowns (xTD) ---
            if (p.pastStats && p.pastStats.gp > 0) {
                let rzAtt = p.rzAtt || 0;
                let rzTgt = p.rzTgt || 0;
                let tgt = p.pastStats.targets || 0;
                let att = p.pastStats.rushAtt || 0;

                // Baseline League-Average TD Rates
                let rzPassMult = 0.20;
                let rzRushMult = 0.15;
                
                // Adjust based on Team Scheme (Play Action, RPO, & Blocking)
                if (passEnv) {
                    if (passEnv.playActionYds >= 900) rzPassMult += 0.03; // PA heavily boosts RZ passing efficiency
                    if (passEnv.rpoPlays >= 70) rzPassMult += 0.02;       // RPOs freeze linebackers in the RZ
                    if (passEnv.badPct >= 18.0) rzPassMult -= 0.04;       // Bad QB play ruins RZ targets
                }
                if (rushEnv) {
                    if (rushEnv.ybcAtt >= 2.8) rzRushMult += 0.03;        // Great blocking makes goal-line rushing easier
                    if (rushEnv.ybcAtt <= 2.2) rzRushMult -= 0.03;        // Poor blocking ruins RZ efficiency
                }

                if (p.Pos === 'RB') {
                    let standardAtt = Math.max(0, att - rzAtt);
                    let standardTgt = Math.max(0, tgt - rzTgt); // Isolates standard targets to prevent double-counting
                    let rbXtd = (standardAtt * 0.015) + (rzAtt * rzRushMult) + (standardTgt * 0.035) + (rzTgt * rzPassMult);
                    if (rbXtd > 0) p.xTD = rbXtd;
                } else if (['WR', 'TE'].includes(p.Pos)) {
                    let standardTgt = Math.max(0, tgt - rzTgt);
                    let recXtd = (standardTgt * 0.03) + (rzTgt * rzPassMult);
                    if (recXtd > 0) p.xTD = recXtd;
                }
            }

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
                adjMultiplier += (p.playoffSOS - 3.0) * 0.015; // Smooth playoff scaling
            }

            // 3. Continuous Offensive Line Quality
            let olModifier = 0;
            if (p.Pos === 'RB' && p.olRunBlk) {
                olModifier = (16.5 - p.olRunBlk) * 0.0035; // Continuous float scale for more variance
            } else if (['QB', 'WR', 'TE'].includes(p.Pos) && p.olPassBlk) {
                olModifier = (16.5 - p.olPassBlk) * 0.0030; // Continuous float scale for more variance
            }

            // Fallback to broad tier only if rank data didn't trigger a change
            if (olModifier === 0 && p.olTier) {
                if (p.olTier === 'S') olModifier = 0.04;
                else if (p.olTier === 'A') olModifier = 0.02;
                else if (p.olTier === 'D') olModifier = -0.02;
                else if (p.olTier === 'F') olModifier = -0.04;
            }
            adjMultiplier += olModifier;

            // --- 3B. VACATED OPPORTUNITY, BACKFIELD COMPETITION & WORKLOAD TRAJECTORY ---
            
            // 1. Vacated Opportunity & Incoming Backup Profiler (Running Backs)
            if (p.Pos === 'RB') {
                const teamKey = this.normalizeTeam(p.Team);
                
                // Find all historical running backs from this team in 2025
                const pastTeamRBs = this.allPlayers.filter(x => 
                    x.Pos === 'RB' && 
                    (x.pastTeam === teamKey || (this.normalizeTeam(x.Team) === teamKey && !x.pastTeam)) &&
                    x._cleanName !== p._cleanName
                );

                // Identify departing backfield volume (players who left or are no longer starting)
                let vacatedCarries = 0;
                let vacatedRzAtt = 0;
                let vacatedTgts = 0;
                let departedNames = [];

                pastTeamRBs.forEach(dep => {
                    // If the player moved to another team, or saw their projected touches slashed by >= 60%
                    let isDeparted = (dep._cleanTeam && dep._cleanTeam !== teamKey);
                    let isDemoted = (dep.stats && dep.pastStats && dep.stats.rushAtt < dep.pastStats.rushAtt * 0.4);
                    
                    if (isDeparted || isDemoted) {
                        vacatedCarries += (dep.pastStats?.rushAtt || 0);
                        vacatedRzAtt += (dep.rzAtt || dep.pastStats?.rzAtt || 0);
                        vacatedTgts += (dep.pastStats?.targets || 0);
                        departedNames.push(dep.Player);
                    }
                });

                p._vacatedCarries = vacatedCarries;
                p._vacatedRzAtt = vacatedRzAtt;
                p._vacatedTgts = vacatedTgts;
                p._departedBackfieldNames = [...new Set(departedNames)];

                // 2. Evaluate the Incoming Backup Threat (Separating Starters vs. Backups)
            if ((p.depthChart > 1 || p.isRBHandcuff) && !p.isRBStarter) {
                // If player is a backup, describe their role behind the starter
                p._backupThreatLevel = 'Rotational / Backup Role';
                p._backupThreatNote = p.starterName 
                    ? `Operates behind ${p.starterName}, serving as high-value contingent depth and rotational option.`
                    : `Operates in a depth/rotational capacity on the ${p.Team} depth chart.`;
            } else {
                // If player is a starter, evaluate the backup behind them
                let backup = null;
                if (p.handcuffName) {
                    backup = this.matchPlayerFast(p.handcuffName, p.Team, 'RB');
                }
                if (!backup) {
                    backup = this.allPlayers.find(x => this.normalizeTeam(x.Team) === teamKey && x.Pos === 'RB' && x.depthChart === 2 && x._cleanName !== p._cleanName);
                }

                if (backup && backup._cleanName !== p._cleanName) {
                    p._backupName = backup.Player;
                    let backupPastRz = backup.rzAtt || backup.pastStats?.rzAtt || 0;
                    let backupPastTgtShare = backup.targetShare || backup.pastStats?.targetShare || 0;
                    let backupPastTouches = (backup.pastStats?.rushAtt || 0) + (backup.pastStats?.rec || 0);

                    // Classify backup Archetype
                    let backupProjTgts = backup.stats?.targets || 0;
                    let backupProjCarries = backup.stats?.rushAtt || 0;
                    let backupProjPts = backup.ProjPts || 0;
                    let isHeavyStandalone = backupProjPts >= 175 || (backupProjCarries >= 120 && backupProjTgts >= 30) || (backupProjTgts >= 45);

                    // Classify Backup Archetype accurately
                    if (backupPastRz >= 18 || (backup.weight && backup.weight >= 220 && backupPastTouches >= 100)) {
                        p._backupThreatLevel = 'Goal-Line Vulture Threat';
                        p._backupThreatNote = `${backup.Player} has proven short-yardage gravity and may cap goal-line monopoly.`;
                    } else if (backupPastTgtShare >= 12.0 || backupProjTgts >= 40) {
                        p._backupThreatLevel = 'Passing Down Threat';
                        p._backupThreatNote = `${backup.Player} commands high pass-catching volume (${Math.round(backupProjTgts)} proj targets), capping 3rd-down snaps.`;
                    } else if (isHeavyStandalone) {
                        p._backupThreatLevel = '1B Committee Threat';
                        p._backupThreatNote = `${backup.Player} commands significant standalone volume (${Math.round(backupProjCarries)} carries / ${Math.round(backupProjTgts)} targets), forming a split rotation.`;
                    } else {
                        p._backupThreatLevel = 'Low Standalone Threat';
                        p._backupThreatNote = `${backup.Player} operates as a pure contingent backup, giving ${p.Player} an uncontested early-down lead.`;
                    }
                } else {
                    p._backupThreatLevel = 'Uncontested';
                    p._backupThreatNote = 'No established backup threat on the depth chart.';
                }
            }

            // ⚡ APPLY MATHEMATICAL GOAL-LINE VULTURE PENALTY TO LEAD BACK
                if (p._backupThreatLevel === 'Goal-Line Vulture Threat') {
                    let matchupThreat = this.teamOffensiveThreats[tTeam];
                    let offenseQuality = matchupThreat ? (6.0 - matchupThreat.dstMatchupStars) : 3.0; // Scale 1.0 to 5.0

                    // ⚡ Continuous Interpolation: 5.0 offense = mild penalty (-0.015), 1.0 offense = severe penalty (-0.04)
                    let vulturePenalty = 0.04 - ((offenseQuality - 1.0) * 0.00625); 
                    adjMultiplier -= vulturePenalty; 

                    if (p.xTD) {
                        let xtdDeduction = 1.6 - ((offenseQuality - 1.0) * 0.2); // Deducts between 1.6 TDs and 0.8 TDs
                        p.xTD = Math.max(1.5, p.xTD - xtdDeduction);
                    }
                }

                // 3. Inherited Touchdown Validation (Fixes False TD Fluke on Ascending Backs)
                if (p.depthChart === 1 && vacatedRzAtt >= 15 && p._backupThreatLevel !== 'Goal-Line Vulture Threat') {
                    p._inheritsGoalLineWork = true;
                    p._inheritedRzAttShare = Math.round(vacatedRzAtt * 0.55);
                    if (p.xTD) {
                        p.xTD += (p._inheritedRzAttShare * 0.15);
                    }
                }

                // 4. 3-Back Committee & Rookie RB3 Allocation Engine
                const teamRBs = this.allPlayers
                    .filter(x => this.normalizeTeam(x.Team) === teamKey && x.Pos === 'RB')
                    .sort((a, b) => (a.depthChart || 99) - (b.depthChart || 99));

                const rb1 = teamRBs.find(x => x.depthChart === 1);
                const rb2 = teamRBs.find(x => x.depthChart === 2);
                const rb3 = teamRBs.find(x => x.depthChart === 3);

                // If an active RB3 exists on the team depth chart
                if (rb3 && rb1 && rb2) {
                    const rb3Weight = rb3.weight ? parseInt(rb3.weight, 10) : 205;
                    const rb3Bmi = rb3.bmi || 30.0;
                    const isPowerRookie = rb3Weight >= 218 || rb3Bmi >= 31.5;
                    const isSpeedRookie = rb3Weight <= 202;

                    // A. Adjust Multipliers for RB1 based on RB3 profile
                    if (p._cleanName === rb1._cleanName) {
                        if (isPowerRookie) {
                            adjMultiplier -= 0.04; // Siphons early-down & short-yardage work
                            p._rb3ThreatNote = `Rookie ${rb3.Player} (${rb3Weight} lbs) introduces short-yardage & carry competition.`;
                        } else {
                            adjMultiplier -= 0.02; // General committee drag
                        }
                    }

                    // B. Adjust Multipliers for RB2 based on RB3 profile
                    if (p._cleanName === rb2._cleanName) {
                        if (isSpeedRookie) {
                            adjMultiplier -= 0.04; // Siphons passing-down / space touches
                            p._rb3ThreatNote = `Rookie ${rb3.Player} introduces pass-catching / change-of-pace competition.`;
                        } else {
                            adjMultiplier -= 0.015; // Power rookie barely affects pass-catching role
                        }
                    }

                    // C. Standalone & Contingent Valuation for the Rookie RB3
                    if (p._cleanName === rb3._cleanName) {
                        let starterInjuryRisk = (rb1.pastStats?.gp && rb1.pastStats.gp < 14) ? 0.30 : 0.18;
                        if ((rb1.age || 25) >= 27) starterInjuryRisk += 0.08;

                        // Behind an S/A tier line, an RB3's contingent value jumps dramatically
                        let lineLeverage = (p.olTier === 'S' || p.olTier === 'A') ? 1.25 : 1.0;
                        p.contingentLotteryScore = (rb1.ProjPts * 0.55 * lineLeverage) * starterInjuryRisk;

                        // Boost RB3's upside score in double-digit rounds
                        upsideMultiplier += Math.min(0.35, p.contingentLotteryScore / 50.0);
                        p._isRookieLotteryStash = true;
                    }
                }
            if (p.depthChart === 1) {
                    const teamQB = this.allPlayers.find(q => this.normalizeTeam(q.Team) === tTeam && q.Pos === 'QB' && q.depthChart === 1);
                    
                    if (teamQB && teamQB.stats?.rushTd >= 5) {
                        const rbWeight = p.weight ? parseInt(p.weight, 10) : 210;
                        const qbRushTds = teamQB.stats.rushTd;
                        
                        // Heavy backs (>= 218 lbs) keep goal-line touches; lighter backs lose more sneaks
                        let rbSizeResistance = rbWeight >= 218 ? 0.10 : (rbWeight <= 202 ? 0.25 : 0.18);
                        
                        // Elite scoring offenses generate more total RZ trips, softening the blow
                        if (matchupThreat && (6.0 - matchupThreat.dstMatchupStars) >= 4.0) {
                            rbSizeResistance *= 0.65; // Cut penalty by 35% in high-scoring offenses
                        }

                        // Gentle Expected TD adjustment (typically only -0.5 to -1.0 TD over 17 games)
                        const stolenTds = (qbRushTds - 4) * rbSizeResistance;
                        if (p.xTD) p.xTD = Math.max(2.0, p.xTD - stolenTds);

                        // Gentle multiplier drag (maximum -1.5% drag to avoid tanking studs like Saquon/Henry)
                        const mildDrag = Math.min(0.015, stolenTds * 0.012);
                        adjMultiplier -= mildDrag;

                        p._qbSneakContext = `${teamQB.Player} handles situational sneaks (${qbRushTds} Proj Rush TDs), but offensive gravity creates cutback lanes.`;
                    }
                }

            }

            // 4. Multi-Position Vacated Opportunity & Competition Engine (WR, TE, QB, RB)
            const teamKey = this.normalizeTeam(p.Team);

            // --- ENHANCED WR & TE MULTI-CURRENCY VACATED OPPORTUNITY ENGINE ---
            if (['WR', 'TE'].includes(p.Pos)) {
                const pastTeamReceivers = this.allPlayers.filter(x => 
                    ['WR', 'TE'].includes(x.Pos) && 
                    (x.pastTeam === teamKey || (this.normalizeTeam(x.Team) === teamKey && !x.pastTeam)) &&
                    x._cleanName !== p._cleanName
                );

                let vacatedTgts = 0;
                let vacatedAirYards = 0;
                let vacatedRzTgts = 0;
                let departedRecNames = [];

                pastTeamReceivers.forEach(dep => {
                    let isDeparted = (dep._cleanTeam && dep._cleanTeam !== teamKey);
                    let isDemoted = (dep.stats && dep.pastStats && dep.stats.targets < dep.pastStats.targets * 0.4);
                    
                    if (isDeparted || isDemoted) {
                        let depTgts = dep.pastStats?.targets || 0;
                        vacatedTgts += depTgts;
                        vacatedAirYards += (dep.airYards || dep.pastStats?.airYards || depTgts * 10.5);
                        vacatedRzTgts += (dep.rzTgt || dep.pastStats?.rzTgt || 0);
                        departedRecNames.push(dep.Player);
                    }
                });

                p._vacatedTgts = vacatedTgts;
                p._vacatedAirYards = Math.round(vacatedAirYards);
                p._vacatedRzTgts = vacatedRzTgts;
                p._departedReceiverNames = [...new Set(departedRecNames)];

                // 1. Team Scheme Distribution Capacity Caps
                const teamPosRate = teamDist ? (parseFloat(teamDist[`${p.Pos} %`]) || (p.Pos === 'WR' ? 58.0 : 18.0)) : (p.Pos === 'WR' ? 58.0 : 18.0);
                const isHighVolumePosScheme = (p.Pos === 'TE' && teamPosRate >= 21.0) || (p.Pos === 'WR' && teamPosRate >= 60.0);

                // 2. Alignment & Route Profile Classification
                const pAdot = p.aDOT || (p.Pos === 'WR' ? 10.5 : 7.0);
                const isVerticalWeapon = (p.Pos === 'WR' && pAdot >= 11.5) || (p.Pos === 'TE' && pAdot >= 9.0);
                const isIntermediateMofWeapon = (p.Pos === 'TE' && pAdot >= 6.5 && pAdot < 9.0) || (p.Pos === 'WR' && pAdot >= 7.5 && pAdot < 11.5);
                const isShortUnderneathOutlet = pAdot < 7.0;

                // 3. Assign Role Types (Applies to all depth charts for accurate UI descriptions)
                if (p.Pos === 'WR') {
                    if (isVerticalWeapon) p._vacatedRoleType = 'Perimeter Alpha Air Yards';
                    else if (isIntermediateMofWeapon) p._vacatedRoleType = 'Intermediate Chain-Mover';
                    else p._vacatedRoleType = 'High-Volume Slot Outlet';
                } else if (p.Pos === 'TE') {
                    if (isVerticalWeapon) p._vacatedRoleType = 'Detached Hybrid Deep Seam';
                    else if (isShortUnderneathOutlet && !p._isCardioKing) p._vacatedRoleType = 'Short-Yardage Safety Valve';
                    else p._vacatedRoleType = 'Intermediate MOF & Red-Zone Funnel';
                }

                // 4. Nuanced Target vs. Air-Yard Mathematical Partitioning
                if (p.depthChart <= 2 && vacatedTgts >= 45) {
                    if (p.Pos === 'WR') {
                        if (p._vacatedRoleType === 'Perimeter Alpha Air Yards' && vacatedAirYards >= 700) {
                            p._inheritsAlphaAirShare = true;
                            if (p.depthChart === 1 && p.wopr && p.wopr < 0.55) p.wopr += 0.08;
                            adjMultiplier += p.depthChart === 1 ? 0.035 : 0.015;
                        } else if (p._vacatedRoleType === 'Intermediate Chain-Mover') {
                            p._inheritsIntermediateVolume = true;
                            adjMultiplier += p.depthChart === 1 ? 0.025 : 0.010;
                        } else {
                            p._inheritsUnderneathShare = true;
                            if (this.scoring.ppr >= 0.5) adjMultiplier += p.depthChart === 1 ? 0.020 : 0.010;
                        }
                    } else if (p.Pos === 'TE') {
                        if (p._vacatedRoleType === 'Detached Hybrid Deep Seam' && vacatedAirYards >= 700 && isHighVolumePosScheme) {
                            p._inheritsAlphaAirShare = true;
                            if (p.depthChart === 1 && p.wopr) p.wopr += 0.06;
                            adjMultiplier += p.depthChart === 1 ? 0.040 : 0.015;
                        } else if (p._vacatedRoleType === 'Intermediate MOF & Red-Zone Funnel' && (vacatedRzTgts >= 8 || vacatedTgts >= 60)) {
                            p._inheritsRzFunnel = true;
                            p._inheritsIntermediateVolume = true;
                            if (p.depthChart === 1 && p.xTD) p.xTD += Math.min(3.5, vacatedRzTgts * 0.25);
                            adjMultiplier += p.depthChart === 1 ? 0.035 : 0.015;
                        } else if (p._vacatedRoleType === 'Short-Yardage Safety Valve') {
                            p._inheritsUnderneathShare = true;
                            if (this.scoring.ppr >= 0.5) adjMultiplier += p.depthChart === 1 ? 0.015 : 0.005;
                        }
                    }
                }

                // 5. Passing Tree Concentration Hierarchy
                const currentTeamReceivers = this.allPlayers.filter(x => 
                    this.normalizeTeam(x.Team) === teamKey && ['WR', 'TE'].includes(x.Pos)
                ).sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0));

                let top2ProjectedShare = (currentTeamReceivers.slice(0, 2).reduce((sum, r) => sum + (r.targetShare || 18), 0));
                
                if (top2ProjectedShare >= 44.0) {
                    p._passingTreeType = 'Concentrated 2-Man Funnel';
                    p._treeDescription = 'High-volume concentrated passing tree guaranteeing elite weekly target safety.';
                } else if (currentTeamReceivers.filter(r => (r.targetShare || 0) >= 14).length >= 4) {
                    p._passingTreeType = 'Crowded Committee Spread';
                    p._treeDescription = 'Ball distributed across 4+ receivers, leading to volatile weekly target floors.';
                } else {
                    p._passingTreeType = 'Standard Target Hierarchy';
                    p._treeDescription = 'Balanced positional target distribution.';
                }
            }

            // --- QB SURROUNDING WEAPON ROOM & PROTECTION DELTA ---
            if (p.Pos === 'QB') {
                const teamPassCatchers = this.allPlayers.filter(x => 
                    this.normalizeTeam(x.Team) === teamKey && ['WR', 'TE', 'RB'].includes(x.Pos) && (x.depthChart <= 2)
                );

                let avgCatchRate = 0;
                let eliteWeapons = 0;
                let totalWeaponProj = 0;
                
                teamPassCatchers.forEach(w => {
                    if (w.trueCatchRate && w.trueCatchRate >= 88.0) eliteWeapons++;
                    if (w.targetShare && w.targetShare >= 22.0) eliteWeapons++; // Also count target hogs as elite
                    avgCatchRate += (w.trueCatchRate || 80.0);
                    totalWeaponProj += (w.ProjPts || 0);
                });
                
                p._avgWeaponCatchRate = teamPassCatchers.length > 0 ? (avgCatchRate / teamPassCatchers.length).toFixed(1) : 80.0;
                p._eliteWeaponCount = eliteWeapons;
                p._totalWeaponProj = totalWeaponProj;

                // Offense Grade & O-Line context
                let matchupThreat = this.teamOffensiveThreats[teamKey];
                let offenseQuality = matchupThreat ? (6.0 - matchupThreat.dstMatchupStars) : 3.0; // 1.0 to 5.0
                
                // Assess Trench Protection
                let lineQuality = 3.0; // Average
                if (p.olTier === 'S') lineQuality = 5.0;
                else if (p.olTier === 'A') lineQuality = 4.0;
                else if (p.olTier === 'D') lineQuality = 2.0;
                else if (p.olTier === 'F') lineQuality = 1.0;
                
                // Synthesize the "Full QB Situation" multiplier
                let situationMultiplier = 0;
                
                // 1. Surrounding Weapons Factor
                if (totalWeaponProj >= 500) situationMultiplier += 0.04;
                else if (totalWeaponProj <= 250) situationMultiplier -= 0.03;
                
                if (eliteWeapons >= 2) situationMultiplier += 0.03;
                
                // 2. Playcaller / Offensive Ecosystem
                if (offenseQuality >= 4.2) situationMultiplier += 0.04;
                else if (offenseQuality <= 2.0) situationMultiplier -= 0.04;
                
                // 3. O-Line Trench Factor
                if (lineQuality >= 4.0) situationMultiplier += 0.03;
                else if (lineQuality <= 2.0) situationMultiplier -= 0.04;

                adjMultiplier += situationMultiplier;
                p._qbSituationScore = situationMultiplier; // Track for narrative/UI

                // Konami Code / Goal-Line Rushing Equity
                if (p.stats && p.stats.rushTd >= 5) {
                    p._hasGoalLineRushingEquity = true;
                }
            }
            // --- WORKLOAD TRAJECTORY (ALL POSITIONS) ---
            if (['RB', 'WR', 'TE'].includes(p.Pos) && p.pastStats && p.pastStats.gp >= 6 && p.stats) {
                let pastOppsPG = ((p.pastStats.rushAtt || 0) + (p.pastStats.targets || p.pastStats.rec || 0)) / p.pastStats.gp;
                let projOppsPG = ((p.stats.rushAtt || 0) + (p.stats.targets || p.stats.rec || 0)) / Math.max(1, (p.stats.gp || 17));
                
                if (pastOppsPG >= 4.0) {
                    let growthRatio = projOppsPG / Math.max(1, pastOppsPG);
                    p.touchGrowthRatio = growthRatio;

                    let isAscending = (growthRatio >= 1.08 && pastOppsPG >= 12.0) || (growthRatio >= 1.16) || (p._inheritsGoalLineWork) || (p._inheritsAlphaAirShare);
                    let isDeclining = (growthRatio <= 0.90 && pastOppsPG >= 12.0) || (growthRatio <= 0.84);

                    if (isAscending) {
                        p._isAscendingRole = true;
                        p._growthPct = Math.round((Math.max(growthRatio, 1.0) - 1.0) * 100);
                        if (p._growthPct < 10) p._growthPct = 14;
                    } else if (isDeclining) {
                        p._isDecliningRole = true;
                        p._declinePct = Math.round((1.0 - growthRatio) * 100);
                    }
                }
            }

            // 2. Inter-Team Environmental Migration (Free Agency / Trades)
            if (p.pastTeam && p._cleanTeam && p.pastTeam !== p._cleanTeam) {
                p.isTeamChanger = true;
                let oldRushEnv = this.teamAdvRush[p.pastTeam];
                let newRushEnv = this.teamAdvRush[p._cleanTeam];
                let oldPassEnv = this.teamAdvPass[p.pastTeam];
                let newPassEnv = this.teamAdvPass[p._cleanTeam];

                let envDelta = 0;

                // AVOID DOUBLE COUNTING: We DO NOT evaluate total target/carry volume shifts here, because 
                // the baseline projection handles volume. We ONLY measure HIDDEN EFFICIENCY shifts 
                // (O-Line blocking, QB Accuracy, Pocket Time) which projection algorithms frequently underestimate.
                if (p.Pos === 'RB' && oldRushEnv && newRushEnv) {
                    // RB: Evaluated primarily on O-Line run blocking lane generation
                    let ybcDiff = (newRushEnv.ybcAtt || 2.4) - (oldRushEnv.ybcAtt || 2.4);
                    envDelta += Math.max(-0.06, Math.min(0.06, ybcDiff * 0.05));
                } else if (['WR', 'TE'].includes(p.Pos) && oldPassEnv && newPassEnv) {
                    // WR/TE: Evaluated strictly on QB Accuracy
                    let accDiff = (newPassEnv.onTgtPct || 73.0) - (oldPassEnv.onTgtPct || 73.0);
                    envDelta += Math.max(-0.04, Math.min(0.04, (accDiff / 100) * 0.35));
                } else if (p.Pos === 'QB' && oldPassEnv && newPassEnv) {
                    // QB: Evaluated on Pocket Time protection and receiver reliability (drops)
                    let pktDiff = (newPassEnv.pktTime || 2.4) - (oldPassEnv.pktTime || 2.4);
                    envDelta += Math.max(-0.04, Math.min(0.04, pktDiff * 0.10)); 
                    
                    let dropDiff = (oldPassEnv.dropPct || 5.0) - (newPassEnv.dropPct || 5.0); // positive is good (fewer drops)
                    envDelta += Math.max(-0.02, Math.min(0.02, dropDiff * 0.005));
                }

                adjMultiplier += envDelta;
                p._envDelta = envDelta;
            }

            // =========================================================================
            // 3. ENHANCED INCOMING COMPETITION & TACTICAL THREAT MATRIX
            // =========================================================================
            if (['RB', 'WR', 'TE'].includes(p.Pos)) {
                const teamKey = this.normalizeTeam(p.Team);
                
                // Scan for newly acquired teammates (Free Agents, Rookies, High-Investment Trades)
                const incomingTeammates = this.allPlayers.filter(x => 
                    this.normalizeTeam(x.Team) === teamKey && 
                    x._cleanName !== p._cleanName &&
                    (x.isTeamChanger || x.isNewRole || (x.age && x.age <= 23 && x.depthChart <= 2))
                );

                if (incomingTeammates.length > 0) {
                    incomingTeammates.forEach(inc => {
                        const incEcr = inc.ecr || inc.adp || 150;
                        const incIsHighInvestment = incEcr <= 75; // Day 1/2 draft pick or high-tier FA

                        // --- A. RUNNING BACK COMPETITION TIERS ---
                        if (p.Pos === 'RB' && inc.Pos === 'RB') {
                            const incWeight = inc.weight ? parseInt(inc.weight, 10) : 205;
                            const incCarries = inc.stats?.rushAtt || inc.pastStats?.rushAtt || 0;
                            const incTargets = inc.stats?.targets || inc.pastStats?.targets || 0;
                            const incTgtRatio = incCarries > 0 ? (incTargets / incCarries) : 0;
                            const incYpr = inc.stats?.recAvg || (inc.stats?.recYds && inc.stats?.rec ? inc.stats.recYds / inc.stats.rec : 0);

                            const incIsPower = incWeight >= 218 || (inc.bmi && inc.bmi >= 31.5);
                            const incIsPassCatcher = (inc.targetShare && inc.targetShare >= 12) || (inc.stats?.targets >= 35) || incTgtRatio >= 0.20;
                            const incIsPowerHybrid = incIsPower && (incTgtRatio >= 0.20 || incYpr >= 9.0);

                            // 1. Impact on Incumbent Lead Back (Depth 1)
                            if (p.depthChart === 1) {
                                if (incIsHighInvestment && inc.depthChart <= 2) {
                                    adjMultiplier -= 0.050; // Day 1/2 Draft Pick 55/45 split
                                    p._incomingCompetitionNote = `High-investment addition ${inc.Player} forces a 55/45 split rotation.`;
                                } else if (incIsPowerHybrid) {
                                    adjMultiplier -= 0.040; // Threatens BOTH goal line & checkdowns
                                    if (p.xTD) p.xTD = Math.max(2.0, p.xTD - 1.2);
                                    p._incomingCompetitionNote = `Incoming power-hybrid ${inc.Player} (${incWeight} lbs, ${incYpr.toFixed(1)} YPR) threatens both goal-line and receiving snaps.`;
                                } else if (incIsPower) {
                                    adjMultiplier -= 0.035;
                                    if (p.xTD) p.xTD = Math.max(2.0, p.xTD - 1.2);
                                    p._incomingCompetitionNote = `Incoming power back ${inc.Player} (${incWeight} lbs) siphons goal-line touches.`;
                                } else if (incIsPassCatcher) {
                                    adjMultiplier -= 0.030;
                                    p._incomingCompetitionNote = `Incoming pass-catcher ${inc.Player} caps 3rd-down receiving floor.`;
                                }
                            }

                            // 2. Impact on Incumbent Pass-Catching Specialist (Depth 2)
                            if (p.depthChart === 2 && (p.targetShare >= 10 || p._isSatelliteBack)) {
                                if (incIsPowerHybrid || incIsPassCatcher) {
                                    adjMultiplier -= 0.035; // Siphons passing-down space
                                    p._incomingCompetitionNote = `Incoming pass-catcher ${inc.Player} threatens 3rd-down passing routes.`;
                                }
                            }
                        }

                        // --- B. WIDE RECEIVER & TIGHT END COMPETITION TIERS ---
                        if (p.Pos === 'WR') {
                            // 1. Direct Alignment Collision (Slot vs. Slot or Deep vs. Deep)
                            if (inc.Pos === 'WR' && p.aDOT && inc.aDOT) {
                                const isBothSlot = (p.aDOT <= 8.5 && inc.aDOT <= 8.5);
                                const isBothDeep = (p.aDOT >= 12.0 && inc.aDOT >= 12.0);

                                if (isBothSlot) {
                                    adjMultiplier -= 0.035; // Direct collision for underneath targets
                                    p._incomingCompetitionNote = `Direct slot route collision with incoming receiver ${inc.Player}.`;
                                } else if (isBothDeep) {
                                    adjMultiplier -= 0.030; // Splitting deep air yards
                                    p._incomingCompetitionNote = `Splits downfield vertical routes with incoming deep-threat ${inc.Player}.`;
                                }
                                // Complementary route trees (one slot, one deep) receive NO penalty!
                            }

                            // 2. Franchise Alpha Arrival (e.g. DJ Moore + Rome Odunze)
                            if (inc.Pos === 'WR' && (inc.targetShare >= 20.0 || incEcr <= 45) && p.pastStats?.targetShare >= 24.0) {
                                adjMultiplier -= 0.045; // Compresses target tree from 28% to 21%
                                p._targetCompressionRisk = true;
                                p._incomingCompetitionNote = `Alpha target hierarchy compressed by the arrival of ${inc.Player}.`;
                            }

                            // 3. Elite Pass-Catching TE Arrival (Siphons intermediate looks from Slot WR)
                            if (inc.Pos === 'TE' && incEcr <= 70 && p.aDOT && p.aDOT <= 9.0) {
                                adjMultiplier -= 0.025;
                                p._incomingCompetitionNote = `Intermediate middle-of-field targets siphoned by incoming TE ${inc.Player}.`;
                            }
                        }
                    });
                }
            }

            // 1. WR: Co-Alpha 1B vs. Capped Beta WR2 Tiering
            if (p.Pos === 'WR' && p.depthChart === 2) {
                const teamPassVolume = teamDist ? (teamDist['Total Targets'] || 540) : 540;
                const teamWrShare = teamDist ? (parseFloat(teamDist['WR %']) || 58.0) : 58.0;
                const isHighVolumePie = teamPassVolume >= 560 && teamWrShare >= 59.0;

                if (isHighVolumePie) {
                    p._wr2Category = 'Co-Alpha WR1B';
                    p._wr2Note = `Plays in a high-volume passing funnel (${teamPassVolume} total targets) capable of sustaining two top-24 fantasy WRs.`;
                    adjMultiplier += 0.025; // Boosts high-end WR2s in pass-heavy systems
                } else if (teamPassVolume < 515 || teamWrShare < 52.0) {
                    p._wr2Category = 'Capped Beta WR2';
                    p._wr2Note = `Trapped in a run-heavy/low-volume passing attack; weekly ceiling is capped behind the WR1.`;
                    adjMultiplier -= 0.040; // Penalizes WR2s in run-first offenses
                }
            }

            // 2. TE: 12-Personnel / 2-TE Timeshare Drag
            if (p.Pos === 'TE' && p.depthChart === 1) {
                const teamTE2 = this.allPlayers.find(x => this.normalizeTeam(x.Team) === tTeam && x.Pos === 'TE' && x.depthChart === 2 && x._cleanName !== p._cleanName);
                if (teamTE2 && (teamTE2.stats?.targets >= 40 || (teamTE2.targetShare && teamTE2.targetShare >= 12.0))) {
                    p._teCommitteeThreat = true;
                    p._teCommitteeNote = `Faces route competition from ${teamTE2.Player} (${teamTE2.stats?.targets || 40}+ proj targets), capping 12-personnel target ceiling.`;
                    adjMultiplier -= 0.035;
                }
            }

            // 3. QB: Bridge Veteran / Short-Leash Rookie Threat
            if (p.Pos === 'QB' && p.depthChart === 1) {
                const rookieBackup = this.allPlayers.find(x => this.normalizeTeam(x.Team) === tTeam && x.Pos === 'QB' && x.depthChart === 2 && (x.age && x.age <= 23) && (x.ecr || x.adp || 150) <= 120);
                if (rookieBackup && p.age && p.age >= 28) {
                    p._shortLeashRisk = true;
                    p._shortLeashNote = `Bridge starter risk: High probability of losing starting snaps to rookie ${rookieBackup.Player} if the team struggles.`;
                    adjMultiplier -= 0.050; // Docks full-season expectation for benching risk
                }
            }

            // 4. Inherited Role Volume & Synthetic Imputation (Rookies / Team Changers)
            let lacksIndividualMetrics = false;
            if (p.Pos === 'QB') lacksIndividualMetrics = (p.trueAccuracy === undefined) && (p.p2s === undefined);
            else if (['RB', 'WR', 'TE'].includes(p.Pos)) lacksIndividualMetrics = (p.targetShare === undefined) && (p.brokenTackles === undefined) && (p.yacAtt === undefined);

            if (lacksIndividualMetrics) {
                p.isNewRole = true;
                
                // ⚡ SYNTHETIC IMPUTATION ENGINE 
                // Places rookies/no-stat players on mathematical equal footing with veterans 
                // by replacing missing individual stat bonuses (like target share or WOPR) with 
                // their inferred scheme/depth chart value.
                let syntheticBoost = 0;

                if (p.depthChart === 1 || p.depthChart === 2) {
                    if (p.Pos === 'WR') {
                        syntheticBoost += p.depthChart === 1 ? 0.05 : 0.02; // Replaces Alpha Target Share bonus
                        if (teamDist && teamDist['WR %'] >= 60.0) syntheticBoost += 0.03; // Replaces WOPR bonus
                        if (passEnv && passEnv.onTgtPct >= 75.0) syntheticBoost += 0.02; // Replaces True Catch Rate bonus
                        if (recEnv && recEnv.adot >= 8.5) syntheticBoost += 0.02; // Inherits deep-threat vertical scheme
                        if (passEnv && passEnv.playActionYds >= 900) syntheticBoost += 0.02; // Inherits high-efficiency PA targets
                    } else if (p.Pos === 'RB') {
                        syntheticBoost += p.depthChart === 1 ? 0.06 : 0.03; // Replaces HVO / Touches bonus
                        if (rushEnv && rushEnv.ybcAtt >= 2.6) syntheticBoost += 0.03; // Replaces Independent YAC bonus
                        if (teamDist && teamDist['RB %'] >= 18.0) syntheticBoost += 0.02; // Replaces Satellite target bonus
                    } else if (p.Pos === 'TE') {
                        syntheticBoost += p.depthChart === 1 ? 0.04 : 0;
                        if (teamDist && teamDist['TE %'] >= 22.0) syntheticBoost += 0.03;
                    } else if (p.Pos === 'QB') {
                        syntheticBoost += p.depthChart === 1 ? 0.04 : 0;
                        if (passEnv && passEnv.pktTime >= 2.5) syntheticBoost += 0.03; // Replaces clean pocket / P2S bonus
                        if (p.stats && p.stats.rushAtt >= 60) syntheticBoost += 0.05; // Replaces Konami Code history bonus
                    }
                }
                
                adjMultiplier += syntheticBoost;
                p.syntheticBoost = syntheticBoost; // Save for UI explanations
            }

            // 5. Multi-Tiered Sample Confidence & Volume Density Engine
            let pastGp = p.pastStats?.gp ?? p.boomBust?.games ?? 17;
            let sampleConfidence = 1.0;
            if (pastGp <= 4) sampleConfidence = 0.45;       // Micro-Sample (1-4 GP)
            else if (pastGp <= 8) sampleConfidence = 0.68;  // Partial-Sample (5-8 GP)
            else if (pastGp <= 13) sampleConfidence = 0.88; // Solid-Sample (9-13 GP)
            else sampleConfidence = 1.00;                   // Full-Season (14+ GP)

            let isMicroSample = pastGp <= 4;
            let isPartialSample = pastGp > 4 && pastGp <= 8;

            // ===========================================================
            // MULTI-YEAR TRENDING & 65/35 BLENDED STATS ENGINE (2024 + 2025)
            // ===========================================================
            let s25 = p.pastStats;
            let s24 = p.stats2024;

            if (s25 && s24 && s25.gp > 0 && s24.gp > 0) {
                let w25 = 0.65;
                let w24 = 0.35;

                // Injury Reversal: If 2025 was a severe injury year (<= 6 games), rely more on 2024
                if (s25.gp <= 6 && s24.gp >= 14) {
                    w25 = 0.40;
                    w24 = 0.60;
                    p._isInjuryBounceback = true;
                }

                p.blendedPpg = ((p.pastPpg || 0) * w25) + ((s24.ppg || 0) * w24);

                // ✨ BLEND 2024 & 2025 BOOM/BUST CONSISTENCY RATES ✨
                if (p.boomBust && p.boomBust24 && p.boomBust.games > 0 && p.boomBust24.games > 0) {
                    p.boomBust.boom = (p.boomBust.boom * w25) + (p.boomBust24.boom * w24);
                    p.boomBust.top6 = ((p.boomBust.top6 || 0) * w25) + ((p.boomBust24.top6 || 0) * w24);
                    p.boomBust.top12 = ((p.boomBust.top12 || 0) * w25) + ((p.boomBust24.top12 || 0) * w24);
                    p.boomBust.bust = (p.boomBust.bust * w25) + (p.boomBust24.bust * w24);
                    p.boomBust.other = ((p.boomBust.other || 0) * w25) + ((p.boomBust24.other || 0) * w24);
                    
                    // Combine total games (boosts sample confidence downstream)
                    p.boomBust.games += p.boomBust24.games; 
                }

                let share25 = p.targetShare || s25.targetShare || 0;
                let share24 = s24.targetShare || 0;
                if (share25 >= 24.0 && share24 >= 24.0) {
                    p._isProvenMultiYearAlpha = true;
                    adjMultiplier += 0.035; 
                }

                let projPpg = (p.ProjPts || 0) / Math.max(1, p.stats?.gp || 17);
                if (s24.ppg > 0 && (p.pastPpg || 0) > s24.ppg * 1.12 && projPpg > (p.pastPpg || 0) * 1.05) {
                    p._isAscendingCareerArc = true;
                    upsideMultiplier += 0.12;
                    ceilingTags.push("3-Year Ascending Arc");
                } else if ((p.pastPpg || 0) < s24.ppg * 0.85 && projPpg < (p.pastPpg || 0) && (p.age || 25) >= 28) {
                    p._isDecliningCareerArc = true;
                    adjMultiplier -= 0.035;
                }
            }
            // ✨ Catch players who missed 2025 entirely (e.g. torn ACL in camp) but were active in 2024
            else if (s24 && s24.gp > 0 && (!s25 || s25.gp === 0)) {
                p.blendedPpg = s24.ppg || 0;
                
                if (p.boomBust24 && p.boomBust24.games > 0) {
                    // Initialize the primary boomBust object using 2024 data
                    p.boomBust = {
                        boom: p.boomBust24.boom,
                        top6: p.boomBust24.top6 || 0,
                        top12: p.boomBust24.top12 || 0,
                        bust: Math.min(100, (p.boomBust24.bust || 0) + 5), // +5% bust penalty for rust/year off
                        games: p.boomBust24.games,
                        other: p.boomBust24.other || 0
                    };
                }
                
                // Flag them so the narrative engine knows they are a major injury return
                p._isMajorReturn = true; 
            }

            // 2nd-Level: Volume Density Check
            let tgtsPerGame = (p.pastStats?.targets || 0) / Math.max(1, pastGp);
            let touchesPerGame = ((p.pastStats?.rushAtt || 0) + (p.pastStats?.rec || 0)) / Math.max(1, pastGp);
            let hasAlphaDensity = (['WR', 'TE'].includes(p.Pos) && tgtsPerGame >= 7.5) || (p.Pos === 'RB' && touchesPerGame >= 15.0);

            if ((isMicroSample || isPartialSample) && hasAlphaDensity) {
                sampleConfidence = Math.min(0.85, sampleConfidence + 0.18);
                p._isSmallSampleAlpha = true;
            }

            // --- FEATURE: Targets Per Snap (TPS) ---
            if (['WR', 'TE'].includes(p.Pos) && p.pastStats && p.pastStats.targets && p.snaps && p.snaps >= 100) {
                p.tps = p.pastStats.targets / p.snaps;
                if (p.tps >= 0.22) {
                    adjMultiplier += (0.04 * sampleConfidence);
                    p._isEliteTargetEarner = true;
                }
            }

            // ⚡ 1. DEDUPLICATED RECEIVER METRICS (WOPR priority, with both upside & trap penalty)
            if (['WR', 'TE'].includes(p.Pos)) {
                let meanWopr = p.Pos === 'WR' ? wrWoprMean : teWoprMean;
                let stdWopr = p.Pos === 'WR' ? wrWoprStd : teWoprStd;
                let meanTgt = p.Pos === 'WR' ? wrTgtMean : teTgtMean;
                let stdTgt = p.Pos === 'WR' ? wrTgtStd : teTgtStd;

                // Derive primary opportunity Z-Score (WOPR preferred; Target Share fallback)
                let primaryZ = null;
                if (p.wopr != null) {
                    primaryZ = (p.wopr - meanWopr) / stdWopr;
                } else if (p.targetShare != null) {
                    primaryZ = (p.targetShare - meanTgt) / stdTgt;
                }

                if (primaryZ !== null) {
                    // Positive Reward (Deduplicated, prevents runaway scores on studs)
                    if (primaryZ > 0) {
                        adjMultiplier += Math.min(0.05, primaryZ * 0.018 * sampleConfidence);
                    }
                    
                    // Negative Penalty (Catches over-projected receivers with bad target command)
                    if (p.ProjPts > (p.Pos === 'WR' ? 120 : 95) && primaryZ < -0.6) {
                        adjMultiplier -= 0.04; 
                    }
                }

                // Red Zone Target Density
                if (p.rzTgt && p.pastStats && p.pastStats.targets) {
                    let rzDensity = p.rzTgt / Math.max(1, p.pastStats.targets);
                    if (rzDensity >= 0.20 && p.rzTgt >= (p.Pos === 'WR' ? 12 : 8)) {
                        adjMultiplier += (0.025 * sampleConfidence);
                    }
                }
            }

            // ⚡ 2. DEDUPLICATED RB ELUSIVENESS (Prevent BT + YAC double-counting)
            if (p.Pos === 'RB') {
                let yacBonus = (p.yacAtt && p.yacAtt >= 3.2) ? 0.025 : 0;
                let btBonus = (p.brokenTackles != null) ? Math.min(0.025, ((p.brokenTackles - rBtMean) / rBtStd) * 0.012) : 0;
                
                // Mutually exclusive: take the higher of the two
                adjMultiplier += Math.max(yacBonus, btBonus) * sampleConfidence;

                if (p.hvo != null) {
                    let zScore = (p.hvo - rHvoMean) / rHvoStd;
                    if (zScore > 0) adjMultiplier += Math.min(0.05, zScore * 0.018 * sampleConfidence);
                }
            }

            // Expected Touchdowns (xTD) Regression Engine
            if (p.pastStats && p.pastStats.gp >= 4 && p.xTD !== undefined && p.pastStats.totalTd !== undefined) {
                let pastTdDiff = p.pastStats.totalTd - p.xTD;
                let isExplosivePlaymaker = (p.pastStats.bigPlays >= 8) || (p.err && p.err >= 3.5);
                
                // Calculate what the Consensus is currently projecting him for
                let projTds = (p.stats?.passTd || 0) + (p.stats?.rushTd || 0) + (p.stats?.recTd || 0);
                
                if (pastTdDiff >= 4.5 && !p._isSmallSampleAlpha && !isExplosivePlaymaker && !p._isAscendingRole) {
                    p._isFlukeTDScorer = true; // Always flag it for the UI narrative
                    
                    // Only apply the penalty if the Consensus is STILL projecting him for too many TDs
                    if (projTds > p.xTD) {
                        adjMultiplier -= 0.05;
                    }
                } else if (pastTdDiff <= -4.0) {
                    p._positiveTdRegression = true; // Always flag it for the UI narrative
                    
                    // Only apply the mathematical bonus if the Consensus is STILL projecting him below his true xTD
                    if (projTds < p.xTD) {
                        adjMultiplier += 0.05;
                    }
                }
            }

            if (['WR', 'TE'].includes(p.Pos)) {
                // 1. RACR & Unrealized Air Yards Regression Engine
                if (p.airYards && p.airYards > 400 && p.pastStats?.recYds) {
                    p.racr = p.pastStats.recYds / p.airYards;
                    p.unrealizedAirYards = Math.max(0, p.airYards - p.pastStats.recYds);

                    // High opportunity + low conversion = Prime Positive Regression Buy
                    if (p.wopr && p.wopr >= 0.55 && p.racr < 0.65) {
                        adjMultiplier += (0.035 * sampleConfidence);
                        p._positiveRacrRegression = true;
                        ceilingTags.push("High Unrealized Air Yards (RACR Buy)");
                    } 
                    // High conversion on low air share = Efficiency Regression Warning
                    else if (p.racr > 1.15 && p.wopr && p.wopr < 0.40) {
                        adjMultiplier -= (0.025 * sampleConfidence);
                    }
                }

                // 2. Pocket Protection vs. Deep-Route aDOT Clashing
                if (p.aDOT && passEnv?.pktTime) {
                    if (p.aDOT >= 12.5 && passEnv.pktTime < 2.30) {
                        adjMultiplier -= (0.03 * sampleConfidence); // Deep routes won't have time to develop
                        p._deepRoutePocketRisk = true;
                    } else if (p.aDOT >= 12.5 && passEnv.pktTime >= 2.55) {
                        adjMultiplier += (0.03 * sampleConfidence); // Synergy: Deep routes get elite pocket protection
                        p._deepRoutePocketSynergy = true;
                    }
                }

                // 3. Independent YAC vs Scheme YAC
                if (p.yacAtt !== undefined && recEnv && recEnv.yacPerRec) {
                    if (p.yacAtt >= 5.5 && recEnv.yacPerRec <= 5.0) {
                        adjMultiplier += (0.04 * sampleConfidence);
                        p._isIndependentYACCreator = true;
                    } else if (p.yacAtt >= 6.0 && recEnv.yacPerRec > 5.5) {
                        adjMultiplier += (0.02 * sampleConfidence);
                        p._isSchemeYACBeneficiary = true;
                    }
                }

                if (p.ypt && p.targetShare && p.targetShare >= 15) {
                    if (p.ypt >= 10.5) adjMultiplier += (0.05 * sampleConfidence);
                    else if (p.ypt >= 9.0) adjMultiplier += (0.025 * sampleConfidence);
                    else if (p.ypt < 6.5) adjMultiplier -= 0.05;
                    
                    // Alpha Synergy: High Volume + High Efficiency
                    if (p.targetShare >= 25 && p.ypt >= 9.5) {
                        adjMultiplier += (0.03 * sampleConfidence); 
                    }
                }
                if (p.trueCatchRate) {
                    if (p.trueCatchRate >= 92) adjMultiplier += (0.03 * sampleConfidence);
                    else if (p.trueCatchRate >= 86) adjMultiplier += (0.015 * sampleConfidence);
                }
                if (p.dropRate) {
                    if (p.dropRate > 10) adjMultiplier -= 0.04;
                    else if (p.dropRate > 7) adjMultiplier -= 0.02;
                }
            }

            // 🎯 4-TIER QB VALUATION & ESCAPABILITY MATRIX
            if (p.Pos === 'QB') {
                const rushYds = p.stats?.rushYds || 0;
                const rushAtt = p.stats?.rushAtt || 0;
                const p2s = p.p2s;
                const pressRate = p.pressureRate;

                // A. 4-Tier Mobility Classification
                let qbMobilityTier = 4;
                let mobilityBonus = 0.0;

                if (rushYds >= 650 || rushAtt >= 115) {
                    qbMobilityTier = 1; // Konami Alpha
                    mobilityBonus = 0.015; // ⚡ REDUCED: Was 0.055. (Drives stay alive longer, but rush yds already in consensus)
                    p._qbArchetype = 'Konami Code Alpha';
                    p._isFlyer = true;
                    upsideMultiplier += 0.30; // ⚡ REMAINS HIGH: Ceiling is where this trait shines
                    ceilingTags.push("Konami Code Rushing Weapon");
                } else if (rushYds >= 425 || rushAtt >= 75) {
                    qbMobilityTier = 2; 
                    mobilityBonus = 0.010; // ⚡ REDUCED: Was 0.035
                    p._qbArchetype = 'Dynamic Dual-Threat';
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    ceilingTags.push("Dual-Threat Rushing Floor");
                } else if (rushYds >= 225 || rushAtt >= 45) {
                    qbMobilityTier = 3; // Mobile Scrambler (Lawrence, Mahomes, Love)
                    mobilityBonus = 0.015;
                    p._qbArchetype = 'Mobile Pocket Scrambler';
                } else {
                    qbMobilityTier = 4; // Pure Pocket Passer (Goff, Burrow, Cousins, Stroud)
                    mobilityBonus = -0.010;
                    p._qbArchetype = 'Pure Pocket Passer';
                }
                adjMultiplier += mobilityBonus;

                // B. Interactive Pressure-to-Sack (P2S%) Matrix
                if (p2s !== undefined) {
                    // ⚡ Continuous Scaler: Center league average around 20.0%. 
                    let p2sDelta = 20.0 - p2s; // Positive = better than average, Negative = worse
                    let baseP2sMod = p2sDelta * 0.003; // 1% variance = 0.003 multiplier shift
                    
                    // Pocket passers (Tier 4) are hurt significantly more by high sack rates than scramblers
                    let mobilitySensitivity = (qbMobilityTier === 4) ? 1.4 : (qbMobilityTier === 3 ? 1.1 : 0.8);
                    
                    // Only apply the penalty scaler to negative deltas, leave positive rewards normalized
                    if (p2sDelta < 0) {
                        baseP2sMod *= mobilitySensitivity; 
                    }
                    
                    // Bound the absolute maximum effect to realistic boundaries
                    let p2sMod = Math.max(-0.075, Math.min(0.045, baseP2sMod));
                    adjMultiplier += (p2sMod * sampleConfidence);
                }

                // C. Pressure Rate Impact
                if (pressRate !== undefined) {
                    if (pressRate >= 26.0) {
                        adjMultiplier -= (qbMobilityTier === 4 ? 0.045 : 0.020);
                    } else if (pressRate <= 15.0) {
                        adjMultiplier += 0.025;
                    }
                }
            }
            
            // Explosive Run Rate (ERR) - Built safely from merged past stats
            if (p.Pos === 'RB' && p.pastStats && p.pastStats.rushAtt >= 40 && p.pastStats.bigRush !== undefined) {
                p.err = (p.pastStats.bigRush / p.pastStats.rushAtt) * 100;
                if (p.err >= 4.5) {
                    adjMultiplier += (0.03 * sampleConfidence); // Elite explosive rush rate
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
            }

            // ===========================================================
            // 🌟 ROOKIE DRAFT CAPITAL & ATHLETIC PEDIGREE VALUATION
            // ===========================================================
            if (p.isRookie || p.nflDraftPick) {
                let pick = p.nflDraftPick || (p.draftRound ? (p.draftRound * 32 - 16) : 150);
                
                // 1. NFL Draft Capital Multiplier
                if (pick <= 10) {
                    adjMultiplier += 0.065;      // Top 10 Pick: Guaranteed Day-1 Focal Point
                    upsideMultiplier += 0.25;
                    ceilingTags.push("Top-10 Franchise Draft Capital");
                } else if (pick <= 32) {
                    adjMultiplier += 0.040;      // 1st Round: Major Scheme Investment
                    upsideMultiplier += 0.18;
                    ceilingTags.push("1st Round NFL Draft Capital");
                } else if (pick <= 64) {
                    adjMultiplier += 0.020;      // 2nd Round: High-Leverage Opportunity
                    upsideMultiplier += 0.12;
                    ceilingTags.push("Day-2 Draft Capital");
                } else if (pick >= 140) {
                    adjMultiplier -= 0.035;      // Day 3 (Round 5+): Rotational Battle
                }

                // 2. Weight-Adjusted Speed Score (Running Backs)
                if (p.Pos === 'RB' && p.speedScore) {
                    if (p.speedScore >= 112.0) {
                        upsideMultiplier += 0.20;
                        ceilingTags.push(`Elite Size-Speed Athlete (${p.speedScore} Speed Score)`);
                        p._speedScoreBadge = `⚡ Elite Speed Score (${p.speedScore})`;
                    } else if (p.speedScore >= 104.0) {
                        upsideMultiplier += 0.10;
                        ceilingTags.push(`Plus Size-Speed Profile (${p.speedScore})`);
                    } else if (p.speedScore < 94.0) {
                        adjMultiplier -= 0.030;  // Lacks breakaway burst for his weight
                    }
                }

                // 3. Sub-4.40 Speed Weapon (WRs)
                if (p.Pos === 'WR' && p.fortyTime && p.fortyTime <= 4.38) {
                    upsideMultiplier += 0.15;
                    ceilingTags.push(`Blazing 40yd Speed (${p.fortyTime}s)`);
                }
            }

            // =========================================================================
            // 🎯 ENHANCED 5-TIER RB, 5-TIER WR, AND 4-TIER TE ARCHETYPE CLASSIFIERS
            // =========================================================================

            // --- 1. COMPREHENSIVE 8-ARCHETYPE RUNNING BACK VALUATION MATRIX ---
            if (p.Pos === 'RB') {
                const snap = p.snapShare || 0;
                const hvo = p.hvo || 0;
                const tgtShare = p.targetShare || 0;
                const rzCarries = p.rzAtt || (p.pastStats?.rzAtt || 0);
                const projCarries = p.stats?.rushAtt || (p.pastStats?.rushAtt || 0);
                const projTgts = p.stats?.targets || (p.pastStats?.targets || 0);
                const projPts = p.ProjPts || 0;
                const yac = p.yacAtt || 2.4;
                const err = p.err || 0;
                const pAge = p.age || p.Age || 25;
                const isPPR = this.scoring.ppr >= 0.5;

                const isPowerFrame = (p.weight && p.weight >= 214) || (p.bmi && p.bmi >= 30.5);
                const isLowPassing = tgtShare < 8.5 && projTgts <= 32;

                // 1. Uncontested 3-Down Bellcow Alpha
                if ((snap >= 68 || (p.depthChart === 1 && projCarries >= 220)) && hvo >= 65 && (tgtShare >= 9.5 || projTgts >= 45)) {
                    p._rbArchetype = 'Bellcow Alpha';
                    adjMultiplier += 0.015; // ⚡ REDUCED: Was 0.035
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    ceilingTags.push("Three-Down Bellcow Monopoly");
                }
                // 2. High-Leverage Space Back / Satellite Specialist
                else if ((tgtShare >= 12.5 || (projCarries < 150 && projTgts >= 45)) && hvo >= 40) {
                    p._rbArchetype = 'High-Leverage Space Back';
                    p._isSatelliteBack = true;
                    adjMultiplier += (isPPR ? 0.050 : -0.020);
                    upsideMultiplier += 0.18;
                    ceilingTags.push("High-Leverage PPR Space Creator");
                }
                // 3. Designed 1B Co-Starter (Guaranteed Standalone Flex)
                // Allow projected touches (170+ total or 130+ carries) to qualify standalone timeshare backs (e.g. Henderson/Rhamondre)
                else if (p.depthChart === 2 && ((snap >= 42) || (projCarries >= 130 && projPts >= 130) || ((projCarries + projTgts) >= 170))) {
                    p._rbArchetype = '1B Co-Starter';
                    p._isStandaloneCoLead = true;
                    adjMultiplier += 0.040;
                    upsideMultiplier += 0.15;
                    ceilingTags.push("Designed 1B Timeshare / Standalone Flex");
                }
                // 4. Handcuff+ (Touch Floor + Contingent Ceiling)
                else if (p.depthChart === 2 && ((snap >= 28) || (projCarries >= 80 && projPts >= 90) || ((projCarries + projTgts) >= 110))) {
                    p._rbArchetype = 'Handcuff+ Stash';
                    p._isHandcuffPlus = true;
                    p._isFlyer = true;
                    adjMultiplier += 0.015;
                    upsideMultiplier += 0.30;
                    ceilingTags.push("Elite Handcuff+ (Floor Cushion + RB1 Ceiling)");
                }
                // 5. Explosive Chunk Slasher (Tackle-Breaker)
                else if ((yac >= 3.3 || err >= 5.0) && projCarries >= 100 && hvo >= 30) {
                    p._rbArchetype = 'Explosive Chunk Slasher';
                    p._isChunkSlasher = true;
                    adjMultiplier += 0.025;
                    upsideMultiplier += 0.20;
                    ceilingTags.push("Explosive Big-Play Efficiency (High YAC)");
                }
                // 6. 1A Early-Down Power Hammer (Goal-Line Focus)
                else if (isLowPassing && (rzCarries >= 18 || (p.stats?.rushTd || 0) >= 7) && isPowerFrame) {
                    p._rbArchetype = '1A Early-Down Hammer';
                    p._isGoalLineHammer = true;

                    let matchupThreat = this.teamOffensiveThreats[tTeam];
                    let offenseQuality = matchupThreat ? (6.0 - matchupThreat.dstMatchupStars) : 3.0;

                    if (offenseQuality >= 4.0) {
                        adjMultiplier += 0.035;
                        if (p.xTD) p.xTD += 1.2;
                    } else if (offenseQuality <= 2.2) {
                        adjMultiplier -= 0.055;
                        if (p.xTD) p.xTD = Math.max(1.5, p.xTD - 2.0);
                        p._isZeroYardTDTrap = true;
                    }
                }

                // Featured Workhorse / Lead Back (Depth 1 with heavy volume)
                else if (p.depthChart === 1 && (projCarries >= 180 || (p.stats?.rushAtt || 0) >= 180)) {
                    p._rbArchetype = isPowerFrame ? '1A Early-Down Hammer' : 'Featured Workhorse Lead';
                    adjMultiplier += 0.035;
                    upsideMultiplier += 0.12;
                }
                // 7. Ambiguous Backfield Rookie Ascender (Midseason Takeover)
                else if (pAge <= 23 && (p.depthChart === 2 || p.depthChart === 3) && (p._vacatedCarries >= 50 || p.isNewRole)) {
                    p._rbArchetype = 'Rookie Backfield Ascender';
                    p._isAscendingRole = true;
                    p._isFlyer = true;
                    adjMultiplier += 0.020;
                    upsideMultiplier += 0.30;
                    ceilingTags.push("Rookie Midseason Takeover Trajectory");
                }
                // 8. Goal-Line Vulture (Short-Yardage Syphon)
                else if (snap < 40 && (rzCarries >= 16 || (p.stats?.rushTd || 0) >= 5) && isPowerFrame && !p.isRBStarter) {
                    p._rbArchetype = 'Goal-Line Vulture';
                    p._isRedZoneVulture = true;
                    adjMultiplier -= 0.030;
                    upsideMultiplier += 0.10;
                }
                // 9. Pure Contingent Lottery Ticket (Zero Standalone Value)
                else if (p.isRBHandcuff || p.depthChart === 2) {
                    p._rbArchetype = 'Contingent Lottery Ticket';
                    p._isFlyer = true;
                    upsideMultiplier += 0.25;
                    ceilingTags.push("Pure Contingent Lottery Stash");
                }
                // 10. Empty-Touch Committee Trap
                else if (snap < 50 && yac < 2.5 && hvo < 28 && !p.isRBStarter) {
                    p._rbArchetype = 'Empty-Touch Committee Trap';
                    adjMultiplier -= 0.050;
                }
                else {
                    p._rbArchetype = 'Rotational Committee Back';
                }
            }

            // --- 2. WIDE RECEIVER 5-TIER ROUTE TREE & OPPORTUNITY MATRIX ---
            if (p.Pos === 'WR') {
                const teamPassVol = teamDist ? (teamDist['Total Targets'] || 550) : 550;
                const projTgtShare = p.stats?.targets ? ((p.stats.targets / teamPassVol) * 100) : 0;
                const tgtShare = Number(p.targetShare) || projTgtShare;
                const wopr = p.wopr || 0;
                const adot = p.aDOT || 10.0;
                const snap = p.snapShare || 0;
                const ypt = p.ypt || 0;

                // Tier 1: Dominant Alpha Target Funnel (120+ targets or 24%+ share)
                if (tgtShare >= 24.0 || wopr >= 0.58 || (p.depthChart === 1 && (p.stats?.targets || 0) >= 120)) {
                    p._wrArchetype = 'Alpha Target Funnel';
                    adjMultiplier += 0.010;
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    ceilingTags.push("Dominant Alpha Target Funnel");
                }
                // Tier 2: High-Volume Slot Magnet / Chain Mover (Godwin, Rice, Keenan Allen)
                else if (adot <= 9.0 && (tgtShare >= 18.0 || (p.stats?.targets || 0) >= 95) && (p.trueCatchRate || 85) >= 88.0) {
                    p._wrArchetype = 'High-Volume Slot Magnet';
                    p._isShortAdotOperator = true;
                    adjMultiplier += (this.scoring.ppr >= 0.5 ? 0.035 : -0.015);
                    p._isSafeFloor = true;
                }
                // Tier 3: Vertical Spike-Week Weapon (Pickens, Pierce, Jameson Williams)
                else if (adot >= 12.5 && (p.airYards >= 1000 || ((p.stats?.recAvg || 0) >= 14.5 && (p.stats?.targets || 0) >= 65))) {
                    p._wrArchetype = 'Vertical Spike-Week Weapon';
                    p._isSpikeWeekWeapon = true;
                    p._isFlyer = true;
                    upsideMultiplier += 0.25;
                    ceilingTags.push("Vertical Spike-Week Ceiling");
                }
                // Tier 4: Capped Beta WR2 in Run-Heavy/Spread Attack
                else if (p.depthChart === 2 && (teamDist ? teamDist['WR %'] < 55.0 : false)) {
                    p._wrArchetype = 'Capped Beta WR2';
                    adjMultiplier -= 0.035;
                }
                // Tier 5: Cardio King Decoy (High snaps, zero targets)
                else if (snap >= 75.0 && tgtShare <= 11.5 && (p.stats?.targets || 0) < 60) {
                    p._wrArchetype = 'Cardio King Decoy';
                    p._isCardioKing = true;
                    adjMultiplier -= 0.070;
                }
                // Traps: Empty Calories Receiver (High volume, abysmal efficiency)
                else if (tgtShare >= 18.0 && ypt > 0 && ypt <= 6.5) {
                    p._wrArchetype = 'Empty Calories Volume Trap';
                    p._isEmptyCalories = true;
                    adjMultiplier -= 0.060;
                }
                else {
                    p._wrArchetype = 'Secondary Target Option';
                }
            }

            // --- 3. TIGHT END 4-TIER DETACHMENT & ALIGNMENT HIERARCHY ---
            if (p.Pos === 'TE') {
                const teamPassVol = teamDist ? (teamDist['Total Targets'] || 550) : 550;
                const projTgtShare = p.stats?.targets ? ((p.stats.targets / teamPassVol) * 100) : 0;
                const tgtShare = Number(p.targetShare) || projTgtShare;
                const rzTgt = p.rzTgt || 0;
                const projPts = p.ProjPts || 0;
                const wopr = p.wopr || 0;
                const snap = p.snapShare || 0;

                // Tier 1: Detached Alpha "Big Slot" Weapon
                if (tgtShare >= 17.5 || projPts >= 195 || wopr >= 0.44 || (p.depthChart === 1 && (p.stats?.targets || 0) >= 100)) {
                    p._teArchetype = 'Detached Alpha "Big Slot"';
                    adjMultiplier += 0.055;
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    ceilingTags.push("Detached TE Matchup Weapon");
                }
                // Tier 2: Middle-of-Field (MOF) Chain Mover (70+ targets or 13%+ share)
                else if (tgtShare >= 13.0 || (p.depthChart === 1 && (p.stats?.targets || 0) >= 70) || ((p.stats?.targets || 0) >= 75 && (rzTgt >= 8 || (p.stats?.recTd || 0) >= 5))) {
                    p._teArchetype = 'Middle-of-Field Chain Mover';
                    adjMultiplier += 0.020;
                    p._isSafeFloor = true;
                }
                // Tier 3: Red-Zone TD Specialist / Touchdown-or-Bust
                else if (tgtShare < 13.5 && (rzTgt >= 10 || (p.stats?.recTd || 0) >= 6)) {
                    p._teArchetype = 'Red-Zone TD Specialist';
                    p._isTDorBust = true;
                    adjMultiplier -= 0.020;
                    upsideMultiplier += 0.15;
                }
                // Tier 4: Inline Blocker / Cardio TE Trap
                else if (snap >= 65.0 && tgtShare <= 10.0 && (p.stats?.targets || 0) < 45) {
                    p._teArchetype = 'Inline Blocker Trap';
                    adjMultiplier -= 0.060;
                }
                else {
                    p._teArchetype = 'Rotational Tight End';
                }
            }

            // 7. Advanced Team Environment Metrics & Scheme Archetypes
            if (passEnv) {
                // Play-Action & RPO Scheme Impact
                if (['QB', 'WR', 'TE'].includes(p.Pos)) {
                    if (passEnv.playActionYds >= 1100 || passEnv.rpoYds >= 700) adjMultiplier += 0.035;
                    else if (passEnv.playActionYds >= 850 || passEnv.rpoYds >= 450) adjMultiplier += 0.018;
                    else if (passEnv.playActionYds < 500 && passEnv.rpoYds < 200) adjMultiplier -= 0.018;
                }

                // Quick-Release vs. Deep-Vertical Pocket Time Dynamics
                if (['QB', 'WR', 'TE'].includes(p.Pos)) {
                    const isQuickThrowScheme = passEnv.pktTime > 0 && passEnv.pktTime <= 2.25;
                    const isLongDevelopingScheme = passEnv.pktTime >= 2.55;

                    if (isQuickThrowScheme) {
                        // Quick-strike schemes insulate pass catchers from poor line ranks
                        if (p.olPassBlk && p.olPassBlk >= 22) adjMultiplier += 0.015;
                    } else if (isLongDevelopingScheme) {
                        // Deep vertical schemes demand elite protection to avoid drive-killing sacks
                        if (p.olPassBlk && p.olPassBlk <= 8) adjMultiplier += 0.025;
                        else if (p.olPassBlk && p.olPassBlk >= 24) adjMultiplier -= 0.025;
                    }
                }

                // Residual historical pressure modifier (blended with olPassBlk)
                if (passEnv.prssPct >= 28.0) adjMultiplier -= 0.015;
                else if (passEnv.prssPct >= 25.0) adjMultiplier -= 0.008;
                else if (passEnv.prssPct <= 18.0) adjMultiplier += 0.010;
            }

            // Team Starting QB Accuracy Impact on Pass Catchers
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

                    // Power Push / Goal-Line Conversion Efficiency
                    if (rushEnv.firstDownRate && rushEnv.firstDownRate >= 25.0 && ((p.rzAtt && p.rzAtt >= 20) || (p.stats && p.stats.rushTd >= 6))) {
                        adjMultiplier += 0.020;
                    }
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

            // ⚡ Fumble Rate Benching Risk
            let projTouches = (p.stats?.rushAtt || 0) + (p.stats?.rec || 0);
            if (p.Pos === 'RB' && projTouches >= 100 && p.stats?.fum > 0) {
                p.fumbleRate = projTouches / p.stats.fum; // Touches per fumble
                
                // If they fumble more than once every 55 touches
                if (p.fumbleRate <= 55.0) {
                    adjMultiplier -= 0.035; 
                    p._fumbleRisk = true; 
                    ceilingTags.push("⚠️ High Benching Risk (Fumbles)"); // ⚡ FIXED: push to local array
                }
            }

            // ===========================================================
            // 10. DYNAMIC UPSIDE, CEILING & VOLATILITY CLASSIFICATIONS
            // ===========================================================
            // (Variables upsideMultiplier and ceilingTags are now safely declared at the top of the loop)

            // 🌟 INHERITED ROLE FLAG (For Rookies & Free Agents)
            let isInheritedStarter = p.isNewRole && p.depthChart === 1;

            // -----------------------------------------------------------
            // RB CLASSIFICATION
            // -----------------------------------------------------------
            if (p.Pos === 'RB') {
                // 🚀 CEILING / FLYER TRAITS

                // =========================================================================
                // 🎯 TEAM OFFENSIVE ECOSYSTEM & ROOKIE SYNTHETIC IMPUTATION ENGINE
                // =========================================================================
                if (p.depthChart >= 2 || p.isRBHandcuff) {
                    const teamKey = this.normalizeTeam(p.Team);
                    const starter = p.starterName 
                        ? this.matchPlayerFast(p.starterName, p.Team, 'RB')
                        : this.allPlayers.find(x => this.normalizeTeam(x.Team) === teamKey && x.Pos === 'RB' && x.depthChart === 1);

                    // A. Base Starter Value & Historical Injury Probability
                    const starterProj = starter ? (starter.ProjPts || 180) : 180;
                    const starterGp = starter?.pastStats?.gp || 17;
                    const starterInjuryRisk = starterGp <= 10 ? 0.32 : (starterGp <= 14 ? 0.24 : 0.18);

                    // B. Team Offensive Scoring Ecosystem (Red Zone Visits & Passing Scheme)
                    const matchupThreat = this.teamOffensiveThreats[tTeam];
                    const offenseQuality = matchupThreat ? (6.0 - matchupThreat.dstMatchupStars) : 3.0; // 1.0 (Anemic) to 5.0 (Elite)
                    const teamRbTargetRate = teamDist ? (parseFloat(teamDist['RB %']) || 16.0) : 16.0;

                    let ecosystemMultiplier = 1.0;
                    if (offenseQuality >= 4.2) ecosystemMultiplier += 0.15;      // Top-5 NFL Scoring Offense
                    else if (offenseQuality >= 3.5) ecosystemMultiplier += 0.08; // Above-Average Offense
                    else if (offenseQuality <= 2.0) ecosystemMultiplier -= 0.18; // Bottom-5 Anemic Offense

                    if (teamRbTargetRate >= 19.0) ecosystemMultiplier += 0.08;   // High Pass-Catching RB Scheme
                    else if (teamRbTargetRate <= 12.0) ecosystemMultiplier -= 0.06;

                    // C. Rookie & New Role Synthetic Imputation (Replaces missing NFL career stats)
                    let yacVal = p.yacAtt;
                    let tgtShareVal = p.targetShare;

                    if (yacVal === undefined || p.isNewRole) {
                        const rushEnv = this.teamAdvRush[tTeam];
                        yacVal = rushEnv && rushEnv.ybcAtt >= 2.6 ? 2.90 : 2.50;
                        if (p.weight && parseInt(p.weight, 10) >= 215) yacVal += 0.20; // Power frame bonus
                    }

                    if (tgtShareVal === undefined || p.isNewRole) {
                        tgtShareVal = (teamRbTargetRate >= 18.0) ? 11.5 : 8.0;
                    }

                    // D. Continuous Proportional Talent Scaling
                    const errVal = p.err || 3.50;
                    const olRank = p.olRunBlk || 16.5;

                    const deltaYac = (yacVal - 2.50) * 0.08;
                    const deltaRec = (tgtShareVal - 8.0) * 0.006;
                    const deltaBurst = (errVal - 3.50) * 0.010;
                    const deltaLine = (16.5 - olRank) * 0.004;

                    const talentMultiplier = Math.max(0.70, Math.min(1.35, 1.0 + deltaYac + deltaRec + deltaBurst + deltaLine));

                    // E. Physical 3-Down Workhorse Monopoly Scaling
                    const pWeight = p.weight ? parseInt(p.weight, 10) : 210;
                    let monopolyFactor = 0.65;
                    if (pWeight >= 214 && tgtShareVal >= 9.5) {
                        monopolyFactor = 0.80; // True 3-down frame + receiving profile
                        p._isThreeDownHeir = true;
                    } else if (pWeight < 200 && tgtShareVal < 8.0) {
                        monopolyFactor = 0.45; // High committee splinter risk
                        p._isSplinterRisk = true;
                    }

                    // =========================================================================
                    // 🎯 DECOUPLED CONDITIONAL POTENTIAL (IF THINGS GO RIGHT = 100% ROLE HEIR)
                    // =========================================================================
                
                    // A. Blended Draft Value (Factors in probability of injury to set fair draft cost)
                    p.contingentDraftEquity = (starterProj * 0.60 * monopolyFactor * talentMultiplier * ecosystemMultiplier) * starterInjuryRisk;

                    // B. TRUE CONDITIONAL POTENTIAL (If things go right: Starter misses time & backup inherits role)
                    // In this upside universe, probability is 1.0, NOT 0.20!
                    p.contingentPeakPoints = (starterProj * 0.85 * monopolyFactor * talentMultiplier * ecosystemMultiplier);
                
                    // C. Upside Score uses Full Potential Points
                    p.contingentUpsideScore = p.contingentPeakPoints;

                    // Boost ceiling multiplier based on conditional potential
                    const scaledUpsideBonus = Math.max(0.10, Math.min(0.60, (p.contingentPeakPoints - (p.ProjPts || 100)) / 150));
                    upsideMultiplier += scaledUpsideBonus;
                    p._isFlyer = true;

                    // G. Categorize Proportional Scouting Badges
                    if (p.contingentDraftEquity >= 38.0) {
                        p._contingentTier = '👑 Diamond Contingent League-Winner';
                        p._contingentNote = `Elite underlying talent (${yacVal.toFixed(1)} YAC, ${tgtShareVal.toFixed(1)}% Tgt Share) in a high-volume offensive ecosystem.`;
                        ceilingTags.push("Diamond Contingent League-Winner");
                    } else if (p.contingentDraftEquity >= 26.0) {
                        p._contingentTier = '💎 High-Ceiling Contingent Stash';
                        p._contingentNote = `High-efficiency backup with strong pass-catching and tackle-breaking elusiveness.`;
                        ceilingTags.push("High-Ceiling Contingent Stash");
                    } else if (monopolyFactor <= 0.50 || talentMultiplier <= 0.85) {
                        p._contingentTier = '⚠️ Committee Splinter Risk';
                        p._contingentNote = `Limited efficiency baseline (${yacVal.toFixed(1)} YAC); starter injury likely causes a multi-back rotation.`;
                    } else {
                        p._contingentTier = '🎲 Standard Contingent Stash';
                        p._contingentNote = `Situational rotational depth.`;
                    }
                }

                // Continuous Youth Upside Scale (Max +22% at 21yo, fades to +4% at 24yo)
                if (pAge && pAge <= 24) {
                    p._isFlyer = true;
                    let youthBoost = Math.max(0.04, (25 - pAge) * 0.06);
                    upsideMultiplier += youthBoost;
                    if (pAge <= 23 && !ceilingTags.includes("Breakout Age")) ceilingTags.push("Breakout Age");
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

                // 🛡️ SAFE FLOOR TRAITS (RB) - Accepts 2025 actuals OR 2026 projected volume
                let projTouches = (p.stats?.rushAtt || 0) + (p.stats?.targets || 0);
                let hasVolumeFloor = (p.targetShare && p.targetShare >= 10) ||  (p.snapShare && p.snapShare >= 60) || (p.hvo && p.hvo >= 50) || (p.depthChart === 1 && projTouches >= 200) ||(p._rbArchetype === '1B Co-Starter' && projTouches >= 170);

                let hasRedZoneFloor = (p.rzAtt && p.rzAtt >= 35) || ((p.stats?.rushTd || 0) >= 7);
                let hasSchemeFloor = (rushEnv && rushEnv.ybcAtt >= 2.5 && (p.snapShare >= 45 || p.depthChart <= 2)) || (p.olTier === 'S' || p.olTier === 'A');

                // 🌟 ROOKIE/NEW STARTER INHERITED FLOOR
                // If a rookie steps into a starting job behind an elite line or high YBC scheme, their floor is instantly safe.
                if (isInheritedStarter && ((rushEnv && rushEnv.ybcAtt >= 2.5) || p.olTier === 'S' || p.olTier === 'A')) {
                    hasSchemeFloor = true;
                }

                if (hasVolumeFloor || hasRedZoneFloor || hasSchemeFloor) {
                    p._isSafeFloor = true;
                }

                if (p._isAscendingRole) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.20;
                    if (!ceilingTags.includes("Expanding Featured Role")) ceilingTags.push("Expanding Featured Role");
                }
                
                if (p._isDecliningRole) upsideMultiplier -= 0.15;
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

                // 🛡️ SAFE FLOOR TRAITS (WR/TE) - Accepts 2025 actuals OR 2026 projected targets
                let hasTargetFloor = (p.targetShare && p.targetShare >= 20) || (p.depthChart === 1 && (p.stats?.targets || 0) >= 115);
                let hasEfficiencyFloor = (p.trueCatchRate && p.trueCatchRate >= 85.0) || ((p.stats?.rec && p.stats?.targets) ? (p.stats.rec / p.stats.targets >= 0.68) : false);
                let hasRedZoneFloor = (p.rzTgt && p.rzTgt >= 15) || ((p.stats?.recTd || 0) >= 7);
                
                // 🌟 ROOKIE/NEW STARTER INHERITED FLOOR
                // If a rookie is named WR1/TE1 on a team that funnels targets to that position, they inherit that floor.
                if (isInheritedStarter && teamDist) {
                    if (p.Pos === 'WR' && teamDist['WR %'] >= 60.0) hasTargetFloor = true;
                    if (p.Pos === 'TE' && teamDist['TE %'] >= 22.0) hasTargetFloor = true;
                }

                if ((hasTargetFloor && (!p.aDOT || p.aDOT < 11.0)) || hasEfficiencyFloor || hasRedZoneFloor) {
                    p._isSafeFloor = true;
                }

                if (p._isAscendingRole) {
                    p._isFlyer = true;
                    upsideMultiplier += 0.15;
                    if (!ceilingTags.includes("Ascending Target Share")) ceilingTags.push("Ascending Target Share");
                }

                if (p._isDecliningRole) upsideMultiplier -= 0.15;
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

            if (p.isTeamChanger && p._envDelta && p._envDelta >= 0.02) {
                // Meaningful scheme upgrades naturally raise a player's ceiling
                upsideMultiplier += 0.10;
                if (!ceilingTags.includes("Scheme Upgrade Catalyst")) ceilingTags.push("Scheme Upgrade Catalyst");
            }

            p._ceilingTags = [...new Set(ceilingTags)];

            const rawBasePts = baselines[p.Pos] || 0;

            // 🎯 TRUE RIGHT-TAIL CEILING (POTENTIAL IF THINGS GO RIGHT)
            if (p.Pos === 'RB' && p.depthChart >= 2 && p.contingentPeakPoints) {
                p.ceilingProjPts = Math.max(p.ProjPts * upsideMultiplier, p.contingentPeakPoints);
            } else if (['WR', 'TE'].includes(p.Pos) && p._isAscendingRole && p._vacatedAirYards >= 500) {
                // Air yards convert to fantasy points at ~0.035, capped at a realistic 40-point surge
                let airYardBump = Math.min(40.0, p._vacatedAirYards * 0.035);
                p.ceilingProjPts = Math.min(p.ProjPts * 1.38, (p.ProjPts * upsideMultiplier) + airYardBump);
            } else {
                // Standard starters capped at 1.35x ceiling
                p.ceilingProjPts = Math.min(p.ProjPts * 1.35, p.ProjPts * upsideMultiplier);
            }

            // Upside Score measures their Potential Ceiling against the starting baseline
            p.upsideScore = Math.max(0, p.ceilingProjPts - rawBasePts);

            // 🚑 ADVANCED INJURY FEATURE ENGINEERING (Hidden Value & Volatility)
            if (p.Min_Missed_26 !== undefined && p.Max_Missed_26 !== undefined) {
                let minMissed = Number(p.Min_Missed_26);
                let maxMissed = Number(p.Max_Missed_26);
                let expectedMissed = (minMissed + maxMissed) / 2;

                if (expectedMissed > 0) {
                    let expectedGames = Math.max(1, 17 - expectedMissed);
                    let bestCaseGames = Math.max(1, 17 - minMissed);
                    let worstCaseGames = Math.max(1, 17 - maxMissed);

                    // 1. Feature: True Healthy PPG
                    p._healthyPpg = (p.ProjPts || 0) / expectedGames;

                    // 2. Feature: Hidden Ceiling (Upside Score Boost)
                    let hiddenCeilingPts = p._healthyPpg * bestCaseGames;
                    if (hiddenCeilingPts > p.ProjPts) {
                        let ceilingDelta = hiddenCeilingPts - p.ProjPts;
                        p.upsideScore = (p.upsideScore || 0) + (ceilingDelta * 0.65); 
                    }

                    // 3. Feature: Timeline Volatility (Bust Risk Penalty)
                    let injuryUncertainty = maxMissed - minMissed;
                    if (injuryUncertainty >= 3) {
                        if (!p.boomBust) p.boomBust = { boom: 0, bust: 20, top12: 0, games: 17 };
                        p.boomBust.bust = Math.min(100, p.boomBust.bust + (injuryUncertainty * 4));
                    }

                    // 4. Feature: Adjusted Floor
                    let expectedFloorPts = p._healthyPpg * worstCaseGames;
                    p.floorPpg = (expectedFloorPts / 17);
                }
            }

            // =============================================================
            // DYNAMIC VARIANCE SPREAD (Decoupled Floor/Ceiling Bounds)
            // =============================================================
            
            // 1. Position-Specific Base Volatility
            let baseVar = 0.22;
            if (p.Pos === 'QB') baseVar = 0.18; 
            else if (p.Pos === 'WR') baseVar = 0.24; 
            else if (p.Pos === 'TE') baseVar = 0.26; 
            else if (p.Pos === 'PK') baseVar = 0.32; 
            else if (p.Pos === 'DST') baseVar = 0.45; 

            // DECOUPLED VARIANCE: Upside traits raise ceilVar, Risk traits raise floorVar
            let ceilVar = baseVar;
            let floorVar = baseVar;

            // 2. Role & Archetype Volatility (Bimodal Traits)
            if (p.isRBHandcuff) { ceilVar += 0.12; floorVar += 0.12; } 
            if (p._isRedZoneVulture) { floorVar += 0.08; } // Vultures bust easily, but ceiling is capped by lack of yards
            if (p._isFlyer) { ceilVar += 0.06; floorVar += 0.04; }
            if (p.isRookie || p.isNewRole) { ceilVar += 0.05; floorVar += 0.05; }

            // 3. Structural Risks (ONLY affects the downside / floor)
            if (p.Pos === 'QB' && p._shortLeashRisk) floorVar += 0.10;
            if (p.Pos === 'TE' && p._isTDorBust) floorVar += 0.08;
            if (p.Pos === 'WR' && p._isCardioKing) floorVar += 0.08;
            if (p.Pos === 'WR' && p._isEmptyCalories) ceilVar -= 0.05; // Tightens ceiling

            // 4. Continuous Age Volatility 
            if (pAgeVal && pAgeVal <= 24) {
                let youthVar = (25 - pAgeVal) * 0.025;
                ceilVar += youthVar;
                floorVar += youthVar; // Young players are volatile in both directions
            }

            // 5. Continuous Depth of Target (aDOT)
            if (p.aDOT) {
                let aDotDelta = p.aDOT - 9.5;
                ceilVar += (aDotDelta * 0.012);
                floorVar += (aDotDelta * 0.012);
            }

            // 6. Target Share Stability (Higher Share = Tightened Floor)
            if (p.targetShare && ['WR', 'TE', 'RB'].includes(p.Pos)) {
                if (p.targetShare > 12.0) {
                    floorVar -= Math.min(0.08, (p.targetShare - 12.0) * 0.004); // Volume secures the floor
                }
            }

            // 7. Environmental Trickle-Down (QB Play & O-Line)
            if (p._passingTreeType === 'Crowded Committee Spread') floorVar += 0.05;
            
            if (['WR', 'TE'].includes(p.Pos)) {
                let teamQB = this.allPlayers.find(q => q._cleanTeam === tTeam && q._cleanPos === 'QB' && q.depthChart === 1);
                if (teamQB && teamQB.trueAccuracy && teamQB.trueAccuracy < 65.0) floorVar += 0.05;
            } else if (p.Pos === 'QB') {
                if (p.p2s && p.p2s >= 20.0) floorVar += 0.04;
                if (p.pastStats && p.pastStats.int >= 14) floorVar += 0.04;
                if (p.stats && p.stats.rushAtt) floorVar -= Math.min(0.06, (p.stats.rushAtt / 100) * 0.05);
            }

            // 8. Safe Floor & Trajectory Adjustments
            if (p._isSafeFloor) floorVar -= 0.06;
            if (p._isAscendingRole) { ceilVar += 0.04; floorVar -= 0.02; }
            if (p._isDecliningRole) { ceilVar -= 0.04; floorVar += 0.06; }

            // 9. Historical Boom / Bust
            if (p.boomBust && p.boomBust.games >= 4) {
                let bb = p.boomBust;
                let sampleWeight = Math.min(1.0, bb.games / 14);
                let bustTolerance = p.Pos === 'WR' ? 28 : (p.Pos === 'QB' ? 18 : 22);
                let top12Baseline = p.Pos === 'QB' ? 58 : (p.Pos === 'TE' ? 42 : 48);

                let pastTouches = (p.pastStats?.rushAtt || 0) + (p.pastStats?.rec || 0);
                let pastTargets = p.pastStats?.targets || 0;
                let pastPassAtt = p.pastStats?.passAtt || 0;
                let hasSignificantPastVolume = (p.Pos === 'RB' && pastTouches >= 100) || (['WR', 'TE'].includes(p.Pos) && pastTargets >= 60) || (p.Pos === 'QB' && pastPassAtt >= 200);

                let isRoleExpansion = (p._isAscendingRole || p.isNewRole || (p._vacatedTgts >= 30) || (p._vacatedCarries >= 60) || p._inheritsGoalLineWork) && !hasSignificantPastVolume;
                if (isRoleExpansion) {
                    bustTolerance += 20;
                    sampleWeight *= 0.5;
                }

                if (bb.bust > bustTolerance) floorVar += ((bb.bust - bustTolerance) * 0.005) * sampleWeight;
                if (bb.top12 > top12Baseline) floorVar -= ((bb.top12 - top12Baseline) * 0.003) * sampleWeight;
            }

            if (p._scriptRisk) floorVar += 0.06; 
            if (p._coldWeatherRisk) floorVar += 0.03; 
            if (p._fumbleRisk) floorVar += 0.04; 

            // Final Bounds Safety Check
            p.ceilVar = Math.max(0.06, Math.min(0.65, ceilVar));
            p.floorVar = Math.max(0.06, Math.min(0.65, floorVar));
            
            // Legacy mapping so old code doesn't break
            p.varianceSpread = p.floorVar; 

            // ===========================================================
            // FINAL CALCULATIONS: PROJECTION EDGE ENGINE & HUBRIS CURVE
            // ===========================================================

            p.ConsensusPts = p.ProjPts;
            let baseVBD = p.ConsensusPts - rawBasePts;

            // Apply Asymptotic Diminishing Returns (The "Hubris Curve")
            let rawDrift = adjMultiplier - 1.0;
            let maxDrift = 0.14; 
            let dampenedDrift = Math.sign(rawDrift) * maxDrift * (1 - Math.exp(-Math.abs(rawDrift) / maxDrift));
            let finalMultiplier = 1.0 + dampenedDrift;

            p.ModelPts = p.ConsensusPts * finalMultiplier;
            p.Edge = p.ModelPts - p.ConsensusPts;

            // Derive Standard and Model VBD
            p.VBD = baseVBD;
            p.AdvVBD = p.ModelPts - rawBasePts;

            // Range of Outcomes: Statistical 10th & 90th Percentile Modeling
            // Full-season counting projections are evaluated over 17 games to prevent pace-inflation
            let activeGames = (p._isSuspended || p._isShortIR || p._isPupList) ? Math.max(1, p.stats?.gp || 17) : 17;
            let modelPpg = (p.ModelPts) / activeGames;

            // A. FLOOR (10th Percentile Outcome using floorVar)
            let rawFloor = modelPpg * Math.max(0.0, 1 - (p.floorVar * 1.28));
            let totalProjTouches = (p.stats?.rushAtt || 0) + (p.stats?.targets || 0);

            let isPureZeroRole = (p._rbArchetype === 'Contingent Lottery Ticket' && totalProjTouches < 100) || p._isCardioKing || (p._isTDorBust && p.ModelPts < 100);
            p.floorPpg = isPureZeroRole ? 0.0 : Math.max(0.0, rawFloor);

            // B. CEILING (90th Percentile Outcome using ceilVar)
            let standardCeiling = modelPpg * (1 + (p.ceilVar * 1.28));

            if (p.contingentPeakPoints && p.Pos === 'RB' && p.depthChart >= 2) {
                p.ceilingPpg = Math.max(standardCeiling, p.contingentPeakPoints / 17);
            } else if (p.ceilingProjPts) {
                p.ceilingPpg = Math.max(standardCeiling, p.ceilingProjPts / 17);
            } else {
                p.ceilingPpg = standardCeiling;
            }

            // C. Format-Specific Archetype Caps 
            if (p.Pos === 'RB' && p._isGoalLineHammer && this.scoring.ppr >= 0.5) {
                p.ceilingPpg = Math.min(modelPpg * 1.15, p.ceilingPpg);
            } else if (p.Pos === 'RB' && p._isSatelliteBack && this.scoring.ppr === 0) {
                p.ceilingPpg = Math.min(modelPpg * 1.10, p.ceilingPpg);
            }

            // 🌟 ASYMPTOTIC "HUMAN LIMITS" CEILING CAPS
            // Prevents mathematical anomalies from exceeding historic peak thresholds
            let posMax = 22.0;
            if (p.Pos === 'QB') posMax = 29.0; 
            else if (p.Pos === 'RB') posMax = 27.0; 
            else if (p.Pos === 'WR') posMax = 26.0; // Historical peak: Kupp 2021 (25.9 PPG)
            else if (p.Pos === 'TE') posMax = 22.0; // Historical peak: Kelce 2020 (20.9 PPG)

            if (p.ceilingPpg > posMax * 0.85) {
                let threshold = posMax * 0.85; 
                let excess = p.ceilingPpg - threshold;
                p.ceilingPpg = threshold + (excess * (posMax - threshold) / (excess + (posMax - threshold)));
            }

            // Probability Engine: Z-Score conversion using player's volatility
            let stdDev = Math.max(5.0, p.ModelPts * p.floorVar);
            let zScore = p.Edge / stdDev;
            
            const getNormProb = (z) => {
                let sign = z < 0 ? -1 : 1;
                let x = Math.abs(z) / Math.sqrt(2.0);
                let t = 1.0 / (1.0 + 0.3275911 * x);
                let erf = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
                return 0.5 * (1.0 + sign * erf);
            };
            
            p.OverProb = getNormProb(zScore);

            // 5. Derive Standard and Model VBD
            p.VBD = baseVBD;
            p.AdvVBD = p.ModelPts - rawBasePts;

            // 3. Gentle Compression for Streaming / Replaceable Positions
            if (p.Pos === 'PK') {
                p.VBD *= 0.35;
                p.AdvVBD *= 0.35;
            } else if (p.Pos === 'DST') {
                p.VBD *= 0.40;
                p.AdvVBD *= 0.40;
            }

            // 4. NaN Safety Guards
            if (isNaN(p.VBD)) p.VBD = 0;
            if (isNaN(p.AdvVBD)) p.AdvVBD = p.VBD;

            // 11. INJURY PENALTIES & PHYSICAL ATTRIBUTES (BMI) - Single-Penalty Model
            const applySignedFactor = (val, factor) => val >= 0 ? val * factor : (factor >= 1 ? val / factor : val * (1 / factor));

            if (p._isSeasonIR) {
                // Out for the entire season
                p.AdvVBD = -999;
                p.ProjPts = 0;
                p.floorPpg = 0;
                p.ceilingPpg = 0;
                p._ceilingTags.push("🚨 Out for Season (IR)");
            } else if (p._isMajorReturn) {
                // Year-1 Return post-major 2025 surgery (e.g. ACL, Achilles)
                p.floorVar = Math.min(0.65, p.floorVar + 0.04); 
                p.AdvVBD = applySignedFactor(p.AdvVBD, 0.96); 
                p._ceilingTags.push("📈 Year-1 Major Injury Return (Second-Half Surge)");
            } else if (p._isFullyCleared) {
                // Fully cleared with no restrictions
                p.AdvVBD = applySignedFactor(p.AdvVBD, 1.0); 
            } else if (p._isSuspended) {
                // Games missed are ALREADY deducted in ProjPts
                p.AdvVBD = applySignedFactor(p.AdvVBD, 0.95);
                p._ceilingTags.push(`⚖️ Serving ${p._gamesSuspended || 4}-Game Suspension`);
            } else if (p._isShortIR || p._isPupList) {
                p.floorVar = Math.min(0.65, p.floorVar + 0.06);
                p.AdvVBD = applySignedFactor(p.AdvVBD, 0.94); 
                p._ceilingTags.push(p._isPupList ? "🚨 Starting Season on PUP List" : "🏥 Starting Season on Short-Term IR");
            } else if (p._isSoftTissueRisk) {
                // Live in-camp soft-tissue re-injury risk
                p.floorVar = Math.min(0.65, p.floorVar + 0.08);
                p.AdvVBD = applySignedFactor(p.AdvVBD, 0.92);
                p._ceilingTags.push("⚠️ Live Soft Tissue Re-Injury Risk");
            } else if (p._isSlowRampUp) {
                let isMajor = p._injuryPenalty === 'major_recovery';
                p.floorVar = Math.min(0.65, p.floorVar + (isMajor ? 0.08 : 0.04));
                p.AdvVBD = applySignedFactor(p.AdvVBD, isMajor ? 0.92 : 0.96);
            } else if (p._isMissedTime) {
                p.floorVar = Math.min(0.65, p.floorVar + 0.05);
                p.AdvVBD = applySignedFactor(p.AdvVBD, 0.94);
                p._ceilingTags.push("⚠️ Expected to Miss Time");
            } else if (p.injuryStatus && !p._isSuspended) {
                // Generic fallback for live tags not in TSV
                if (['IR', 'PUP', 'NA', 'COV'].includes(p.injuryStatus.toUpperCase())) {
                    p.AdvVBD = applySignedFactor(p.AdvVBD, 0.92); 
                } else if (p.injuryStatus === 'Out') {
                    p.AdvVBD = applySignedFactor(p.AdvVBD, 0.94);
                } else if (p.injuryStatus === 'Doubtful') {
                    p.AdvVBD = applySignedFactor(p.AdvVBD, 0.96);
                } else if (p.injuryStatus === 'Questionable') {
                    p.AdvVBD = applySignedFactor(p.AdvVBD, 0.98);
                }
            }

            // Sync variance spread so legacy UI components don't break
            p.varianceSpread = p.floorVar;

            // Recalculate Floor PPG dynamically if injury widened the floor risk
            if (p.floorPpg > 0.0) {
                let updatedFloor = modelPpg * Math.max(0.0, 1 - (p.floorVar * 1.28));
                p.floorPpg = Math.max(0.0, updatedFloor);
            }

            // BMI Calculator for Running Backs
            if (p.height && p.weight && p.Pos === 'RB') {
                let hMatch = String(p.height).match(/(\d+)['\-]+(\d+)/);
                let inches = hMatch ? ((parseInt(hMatch[1]) * 12) + parseInt(hMatch[2])) : parseInt(p.height, 10);
                let weightLbs = parseInt(p.weight, 10);
                if (inches > 0 && weightLbs > 0) {
                    p.bmi = (weightLbs / (inches * inches)) * 703;
                    if (p.bmi >= 31.5) p.AdvVBD = applySignedFactor(p.AdvVBD, 1.02);
                }
            }

            // Range of Outcomes / Upside Potential Bonus (Adds ceiling metrics)
            let upsideBonus = 0;
            pastGp = p.pastStats?.gp || 17;

            if (pastGp <= 6 && p.pastPpg >= 15.0) {
                upsideBonus += Math.min(0.20, (p.pastPpg - 14.0) * 0.015);
            }
            if (p.aDOT && p.aDOT > 8.0) upsideBonus += Math.min(0.08, (p.aDOT - 8.0) * 0.012); 
            if (p.hvo && p.hvo > 30) upsideBonus += Math.min(0.08, (p.hvo - 30) * 0.0015);      
            if (p.pastStats && p.pastStats.bigPlays) upsideBonus += Math.min(0.08, p.pastStats.bigPlays * 0.006); 

            // 💥 Historical Boom Rate Spike Bonus (Adds to upsideScore & UI badge)
            if (p.boomBust && p.boomBust.games >= 4) {
                let bb = p.boomBust;
                let sampleWeight = Math.min(1.0, bb.games / 14);
                let boomBaseline = p.Pos === 'TE' ? 12 : (p.Pos === 'QB' ? 22 : 16);

                if (bb.boom > boomBaseline || bb.top6 > (boomBaseline * 1.8)) {
                    let boomDiff = Math.max(bb.boom - boomBaseline, (bb.top6 - (boomBaseline * 1.8)) * 0.5);
                    upsideBonus += (boomDiff * 0.008) * sampleWeight;
                    p._isFlyer = true;
                    if (boomDiff >= 5 && p._ceilingTags && !p._ceilingTags.includes("Spike Week Dominance")) {
                        p._ceilingTags.push("Spike Week Dominance");
                    }
                }
            }

            // Combine upsideBonus with the dynamic upsideScore from Step 10
            if (p.upsideScore > 0) {
                p.upsideScore = p.upsideScore * (1 + upsideBonus);
            }
        });

        // Fail-safe sort
        this.allPlayers.sort((a, b) => (b.AdvVBD || 0) - (a.AdvVBD || 0));

        // Assign static ranks and absolute pre-draft baseline tiers across the entire player pool
        let posTracker = {};
        this.allPlayers.forEach((p, index) => {
            p.ovrRank = index + 1;
            posTracker[p.Pos] = (posTracker[p.Pos] || 0) + 1;
            p.posRank = `${p.Pos}${posTracker[p.Pos]}`;
        });

        // ⚡ Calibrated 7-Tier Distribution based on full draft pool
        ['QB', 'RB', 'WR', 'TE', 'PK', 'DST'].forEach(pos => {
            let allPos = this.allPlayers.filter(p => p.Pos === pos).sort((a, b) => (b.AdvVBD || 0) - (a.AdvVBD || 0));
            if (!allPos.length) return;

            let topVal = allPos[0].AdvVBD || 0;
            let minVal = allPos[allPos.length - 1].AdvVBD || 0;
            let totalSpread = Math.max(1.0, topVal - minVal);

            // Dynamic tier step sizing scaled to span 7 tiers across the player pool
            let baseStep = totalSpread / 6.8;
            let currentTierNum = 1;

            allPos[0].staticTier = 1;
            for (let i = 1; i < allPos.length; i++) {
                let prevVal = allPos[i - 1].AdvVBD || 0;
                let currVal = allPos[i].AdvVBD || 0;
                let dropFromTierTop = (allPos.find(p => p.staticTier === currentTierNum)?.AdvVBD || prevVal) - currVal;

                // Move to next tier if a natural drop occurs or bracket distance is reached
                if ((dropFromTierTop >= baseStep || (prevVal - currVal) >= (baseStep * 0.75)) && currentTierNum < 7) {
                    currentTierNum++;
                }
                allPos[i].staticTier = currentTierNum;
            }
        });

        this.availablePlayers = [...this.allPlayers];
    },

    // Helper: Returns positional groups respecting true absolute baseline tiers
    getPositionalTiers(pos) {
        let avail = this.availablePlayers.filter(p => p.Pos === pos);
        if (!avail.length) return [];

        let tierMap = {};
        avail.forEach(p => {
            let t = p.staticTier || 1;
            if (!tierMap[t]) tierMap[t] = [];
            tierMap[t].push(p);
        });

        return Object.keys(tierMap).sort((a, b) => a - b).map(t => tierMap[t]);
    },

    parseHistory(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return;

        const headers = rows[0].split('\t').map(h => h.trim().toUpperCase());
        const roundIdx = headers.indexOf('ROUND');
        const teamIdx = headers.indexOf('TEAM');
        const playerIdx = headers.indexOf('PLAYER');
        const posIdx = headers.findIndex(h => h.includes('POS'));
        const nflTeamIdx = headers.findIndex(h => h.includes('NFL'));
        const yearIdx = headers.indexOf('YEAR');

        const profiles = {};

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split('\t');
            if (cols.length < 4) continue;

            const round = parseInt(cols[roundIdx], 10);
            const teamName = cols[teamIdx]?.replace(/,/g, '').trim();
            const playerName = cols[playerIdx]?.replace(/,/g, '').trim();
            const pos = this.normalizePos(cols[posIdx]);
            const rawNflTeam = nflTeamIdx !== -1 ? cols[nflTeamIdx]?.trim() : '';
            const year = yearIdx !== -1 ? (cols[yearIdx]?.trim() || 'default') : 'default';

            if (!teamName || !pos) continue;

            if (!profiles[teamName]) {
                profiles[teamName] = {
                    name: teamName,
                    years: new Set(),
                    yearlyPicks: {}, // year -> { r1: pos, r2: pos }
                    yearlyPosCounts: {}, // year -> { QB: 0, RB: 0, WR: 0, TE: 0 }
                    earlyRBs: 0, earlyWRs: 0,
                    firstQbRound: 99, firstTeRound: 99,
                    qbAvgRound: 0, qbCount: 0,
                    teAvgRound: 0, teCount: 0,
                    pkAvgRound: 0, pkCount: 0,
                    dstAvgRound: 0, dstCount: 0,
                    midRoundRBs: 0, midRoundWRs: 0,
                    teamTally: {},
                    playerTally: {} // ⚡ NEW: Track Player Loyalty
                };
            }

            let p = profiles[teamName];
            p.years.add(year);

            if (!p.yearlyPicks[year]) p.yearlyPicks[year] = {};
            if (!p.yearlyPosCounts[year]) p.yearlyPosCounts[year] = { QB: 0, RB: 0, WR: 0, TE: 0, PK: 0, DST: 0 };

            if (round === 1 && !p.yearlyPicks[year].r1) p.yearlyPicks[year].r1 = pos;
            if (round === 2 && !p.yearlyPicks[year].r2) p.yearlyPicks[year].r2 = pos;
            p.yearlyPosCounts[year][pos] = (p.yearlyPosCounts[year][pos] || 0) + 1;

            // Rounds 1-3 Early Capital
            if (round <= 3) {
                if (pos === 'RB') p.earlyRBs++;
                if (pos === 'WR') p.earlyWRs++;
            }

            // Rounds 6-10 Depth Capital
            if (round >= 6 && round <= 10) {
                if (pos === 'RB') p.midRoundRBs++;
                if (pos === 'WR') p.midRoundWRs++;
            }

            // Positional Targets
            if (pos === 'QB' && round < p.firstQbRound) p.firstQbRound = round;
            if (pos === 'TE' && round < p.firstTeRound) p.firstTeRound = round;

            if (pos === 'QB' && round < 12) { p.qbAvgRound += round; p.qbCount++; }
            if (pos === 'TE' && round < 12) { p.teAvgRound += round; p.teCount++; }
            if (pos === 'PK') { p.pkAvgRound += round; p.pkCount++; }
            if (pos === 'DST') { p.dstAvgRound += round; p.dstCount++; }

            // Team Bias Tracking
            let nflTeam = this.normalizeTeam(rawNflTeam);
            if (!nflTeam) {
                let matchedPlayer = this.matchPlayerFast(playerName, '', pos);
                if (matchedPlayer && matchedPlayer.Team) nflTeam = this.normalizeTeam(matchedPlayer.Team);
            }
            if (nflTeam) {
                p.teamTally[nflTeam] = (p.teamTally[nflTeam] || 0) + 1;
            }

            // ⚡ NEW: Player Loyalty Tracking
            if (playerName) {
                let cleanName = this.normalizeName(playerName);
                p.playerTally[cleanName] = (p.playerTally[cleanName] || 0) + 1;
            }
        }

        // Finalize Strategy Archetypes & Personalities
        for (let key in profiles) {
            let p = profiles[key];
            let draftsCount = Math.max(1, p.years.size);

            let avgEarlyRBs = p.earlyRBs / draftsCount;
            let avgEarlyWRs = p.earlyWRs / draftsCount;
            let avgMidRBs = p.midRoundRBs / draftsCount;

            p.qbAvgRound = p.qbCount > 0 ? (p.qbAvgRound / p.qbCount) : 10;
            p.teAvgRound = p.teCount > 0 ? (p.teAvgRound / p.teCount) : 10;
            p.pkAvgRound = p.pkCount > 0 ? (p.pkAvgRound / p.pkCount) : 15;
            p.dstAvgRound = p.dstCount > 0 ? (p.dstAvgRound / p.dstCount) : 15;

            p.draftsEarlyQB = p.firstQbRound <= 5;
            p.draftsEarlyTE = p.firstTeRound <= 5;

            // ⚡ NEW: Calculate Average Total Positional Roster Limits
            let totalQBs = 0, totalTEs = 0;
            for (let yr in p.yearlyPosCounts) {
                totalQBs += p.yearlyPosCounts[yr].QB;
                totalTEs += p.yearlyPosCounts[yr].TE;
            }
            p.draftsBackupQB = (totalQBs / draftsCount) >= 1.5; // Do they average > 1.5 QBs a year?
            p.draftsBackupTE = (totalTEs / draftsCount) >= 1.5;

            // =========================================================
            // EMPIRICAL BEHAVIOR MATRIX
            // =========================================================
            let r1r3Picks = p.earlyRBs + p.earlyWRs + (p.qbAvgRound <= 3 ? 1 : 0) + (p.teAvgRound <= 3 ? 1 : 0);
            let totalEarlyPicks = Math.max(1, r1r3Picks);

            p.empirical = {
                // Historical Positional Distribution in Rounds 1-3
                earlyRBRate: p.earlyRBs / totalEarlyPicks,
                earlyWRRate: p.earlyWRs / totalEarlyPicks,
                earlyQBRate: (p.qbAvgRound <= 3 ? 1 : 0) / draftsCount,
                earlyTERate: (p.teAvgRound <= 3 ? 1 : 0) / draftsCount,
                
                // Target acquisition horizons
                qbTargetRound: p.qbAvgRound,
                teTargetRound: p.teAvgRound,
                pkTargetRound: p.pkAvgRound,
                dstTargetRound: p.dstAvgRound,
                
                // Behaviors
                handcuffRate: p.likesHandcuffs ? 0.75 : 0.20,
                backupQBRate: p.draftsBackupQB ? 0.80 : 0.15,
                backupTERate: p.draftsBackupTE ? 0.80 : 0.15
            };
            
            // To maintain UI badge compatibility, derive a dynamic label from the empirical math
            if (p.empirical.earlyRBRate >= 0.60) p.strategy = "Robust-RB";
            else if (p.empirical.earlyWRRate >= 0.60) p.strategy = "Zero-RB";
            else if (p.empirical.earlyRBRate > 0.3 && p.empirical.earlyWRRate > 0.3) p.strategy = "Hero-RB";
            else p.strategy = "Balanced";

            p.likesHandcuffs = avgMidRBs >= 1.5;
            p.reachesForKicker = p.pkAvgRound <= 12;
            p.reachesForDST = p.dstAvgRound <= 12;

            // NFL Team Fandom
            let maxTally = 0, bias = 'None';
            for (let teamKey in p.teamTally) {
                let avgTally = p.teamTally[teamKey] / draftsCount;
                if (avgTally > maxTally && avgTally >= 1.5) {
                    maxTally = avgTally;
                    bias = teamKey;
                }
            }
            p.teamBias = bias;

            // ⚡ NEW: Identify "Player Crushes" (Drafted 3+ times across multiple years)
            p.playerCrushes = [];
            for (let playerName in p.playerTally) {
                if (p.playerTally[playerName] >= 3) {
                    p.playerCrushes.push(playerName);
                }
            }
        }

        this.managerProfiles = profiles;
    },

    parseDefData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) return [];
        
        // Normalize headers to lowercase to match your TSV exactly
        const headers = rows[0].split('\t').map(h => h.trim().toLowerCase());
        const parsed = [];

        const getVal = (rowVals, key) => {
            const idx = headers.indexOf(key.toLowerCase());
            return idx !== -1 ? parseFloat(rowVals[idx]) : 0;
        };
        const getStr = (rowVals, key) => {
            const idx = headers.indexOf(key.toLowerCase());
            return idx !== -1 ? rowVals[idx].trim() : '';
        };

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t').map(v => v.trim());
            if (vals.length < 4) continue;

            let city = getStr(vals, 'city');
            let teamName = getStr(vals, 'team');
            let abv = getStr(vals, 'abv') || getStr(vals, 'team');

            let defInt = getVal(vals, 'int');
            let safety = getVal(vals, 'sfty') || getVal(vals, 'safety');
            let sack = getVal(vals, 'sck') || getVal(vals, 'sacks') || getVal(vals, 'sack');
            let defFum = getVal(vals, 'frec') || getVal(vals, 'fr');
            let rawDTD = getVal(vals, 'dtd') || getVal(vals, 'def td');
            let realDefTDs = rawDTD > 10 ? (rawDTD / 10) : rawDTD;

            let papg = getVal(vals, 'ppg') || getVal(vals, 'papg') || 20.0;
            let ptsAllowed = getVal(vals, 'pts') || Math.round(papg * 17);

            let p = {
                Player: `${city} ${teamName}`.trim() || `${this.normalizeTeam(abv)} Defense`,
                Pos: 'DST',
                Team: this.normalizeTeam(abv),
                stats: {
                    defInt: defInt,
                    safety: safety,
                    sack: sack,
                    defFum: defFum,
                    defTd: realDefTDs,
                    ptsAllowed: ptsAllowed,
                    papg: parseFloat(papg.toFixed(1)),
                    rushYdsAllowed: getVal(vals, 'rush'),
                    totalYdsAllowed: getVal(vals, 'total'),
                    ypg: getVal(vals, 'avg')
                },
                ProjPts: 0, VBD: 0, AdvVBD: 0
            };

            if (p.Player && p.Team) parsed.push(p);
        }
        return parsed;
    },

    parseKickerData(text) {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const headers = rows[0].split('\t').map(h => h.trim().toLowerCase());
        const parsed = [];

        for (let i = 1; i < rows.length; i++) {
            const vals = rows[i].split('\t');
            let p = {
                Player: vals[headers.indexOf('player')],
                Pos: 'PK',
                Team: vals[headers.indexOf('team')],
                stats: {
                    fgTotal: parseFloat(vals[headers.indexOf('fgm')]) || 0,
                    xp: parseFloat(vals[headers.indexOf('xpm')]) || 0
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

            // 1. Read Custom Name Input
            let customNameInput = document.getElementById(`custom-name-team-${i + 1}`);
            let customName = customNameInput ? customNameInput.value.trim() : "";

            // 2. Read AI Profile if in Mock mode
            let dropdown = document.getElementById(`profile-team-${i + 1}`);
            let selectedProfileName = dropdown ? dropdown.value : "";
            let profile = null;

            if (selectedProfileName) {
                profile = availableProfiles.find(p => p.name === selectedProfileName);
            }

            // 3. Resolve Team Name (Defaults to typed custom name)
            let teamName = customName || (isUser ? "My Team" : `Team ${i + 1}`);

            // 4. In Mock Draft mode: Assign AI personality and use profile name if no custom name was entered
            if (this.settings.draftMode === 'mock' && !isUser) {
                if (!profile && availableProfiles.length > 0) {
                    let unassigned = availableProfiles.filter(p => !usedProfiles.includes(p.name));
                    let pool = unassigned.length > 0 ? unassigned : availableProfiles;
                    let profileIndex = Math.floor(Math.random() * pool.length);
                    profile = pool[profileIndex];
                    usedProfiles.push(profile.name);
                }

                // If left blank or default "Team X", use the AI profile's name
                if (!customName || customName === `Team ${i + 1}`) {
                    if (profile) teamName = profile.name;
                }
            }

            this.teamsById[id] = {
                id: id, 
                name: teamName,
                isCPU: this.settings.draftMode === 'mock' ? !isUser : false,
                profile: profile, 
                roster: [],
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

window.State = State;
