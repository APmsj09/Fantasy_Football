/**
 * NFL Team Fantasy Research & Tactical Breakdown Engine
 * File: js/research.js
 */

window.TeamResearch = {
    selectedTeam: 'BUF',

    nflTeams: [
        { code: 'ARI', name: 'Arizona Cardinals', city: 'Arizona', conf: 'NFC', div: 'NFC West', color: 'from-red-600 to-red-900', accent: 'border-red-600' },
        { code: 'ATL', name: 'Atlanta Falcons', city: 'Atlanta', conf: 'NFC', div: 'NFC South', color: 'from-red-700 to-black', accent: 'border-red-700' },
        { code: 'BAL', name: 'Baltimore Ravens', city: 'Baltimore', conf: 'AFC', div: 'AFC North', color: 'from-purple-800 to-slate-950', accent: 'border-purple-700' },
        { code: 'BUF', name: 'Buffalo Bills', city: 'Buffalo', conf: 'AFC', div: 'AFC East', color: 'from-blue-700 to-blue-950', accent: 'border-blue-600' },
        { code: 'CAR', name: 'Carolina Panthers', city: 'Carolina', conf: 'NFC', div: 'NFC South', color: 'from-sky-600 to-slate-900', accent: 'border-sky-500' },
        { code: 'CHI', name: 'Chicago Bears', city: 'Chicago', conf: 'NFC', div: 'NFC North', color: 'from-blue-900 to-orange-950', accent: 'border-orange-600' },
        { code: 'CIN', name: 'Cincinnati Bengals', city: 'Cincinnati', conf: 'AFC', div: 'AFC North', color: 'from-orange-600 to-black', accent: 'border-orange-500' },
        { code: 'CLE', name: 'Cleveland Browns', city: 'Cleveland', conf: 'AFC', div: 'AFC North', color: 'from-amber-800 to-stone-900', accent: 'border-orange-600' },
        { code: 'DAL', name: 'Dallas Cowboys', city: 'Dallas', conf: 'NFC', div: 'NFC East', color: 'from-blue-900 to-slate-800', accent: 'border-blue-500' },
        { code: 'DEN', name: 'Denver Broncos', city: 'Denver', conf: 'AFC', div: 'AFC West', color: 'from-orange-600 to-blue-950', accent: 'border-orange-500' },
        { code: 'DET', name: 'Detroit Lions', city: 'Detroit', conf: 'NFC', div: 'NFC North', color: 'from-cyan-600 to-slate-800', accent: 'border-cyan-500' },
        { code: 'GB',  name: 'Green Bay Packers', city: 'Green Bay', conf: 'NFC', div: 'NFC North', color: 'from-emerald-800 to-amber-900', accent: 'border-emerald-600' },
        { code: 'HOU', name: 'Houston Texans', city: 'Houston', conf: 'AFC', div: 'AFC South', color: 'from-blue-950 to-red-950', accent: 'border-red-600' },
        { code: 'IND', name: 'Indianapolis Colts', city: 'Indianapolis', conf: 'AFC', div: 'AFC South', color: 'from-blue-700 to-slate-900', accent: 'border-blue-600' },
        { code: 'JAX', name: 'Jacksonville Jaguars', city: 'Jacksonville', conf: 'AFC', div: 'AFC South', color: 'from-teal-700 to-slate-900', accent: 'border-teal-500' },
        { code: 'KC',  name: 'Kansas City Chiefs', city: 'Kansas City', conf: 'AFC', div: 'AFC West', color: 'from-red-600 to-amber-900', accent: 'border-red-600' },
        { code: 'LA',  name: 'Los Angeles Rams', city: 'Los Angeles', conf: 'NFC', div: 'NFC West', color: 'from-blue-600 to-amber-700', accent: 'border-blue-500' },
        { code: 'LAC', name: 'Los Angeles Chargers', city: 'Los Angeles', conf: 'AFC', div: 'AFC West', color: 'from-sky-500 to-amber-600', accent: 'border-sky-400' },
        { code: 'LV',  name: 'Las Vegas Raiders', city: 'Las Vegas', conf: 'AFC', div: 'AFC West', color: 'from-slate-700 to-black', accent: 'border-slate-400' },
        { code: 'MIA', name: 'Miami Dolphins', city: 'Miami', conf: 'AFC', div: 'AFC East', color: 'from-teal-600 to-orange-700', accent: 'border-teal-400' },
        { code: 'MIN', name: 'Minnesota Vikings', city: 'Minnesota', conf: 'NFC', div: 'NFC North', color: 'from-purple-800 to-amber-900', accent: 'border-purple-600' },
        { code: 'NE',  name: 'New England Patriots', city: 'New England', conf: 'AFC', div: 'AFC East', color: 'from-blue-950 to-red-900', accent: 'border-blue-700' },
        { code: 'NO',  name: 'New Orleans Saints', city: 'New Orleans', conf: 'NFC', div: 'NFC South', color: 'from-amber-700 to-stone-900', accent: 'border-amber-500' },
        { code: 'NYG', name: 'New York Giants', city: 'New York', conf: 'NFC', div: 'NFC East', color: 'from-blue-800 to-red-950', accent: 'border-blue-600' },
        { code: 'NYJ', name: 'New York Jets', city: 'New York', conf: 'AFC', div: 'AFC East', color: 'from-emerald-800 to-slate-950', accent: 'border-emerald-600' },
        { code: 'PHI', name: 'Philadelphia Eagles', city: 'Philadelphia', conf: 'NFC', div: 'NFC East', color: 'from-teal-900 to-slate-900', accent: 'border-teal-600' },
        { code: 'PIT', name: 'Pittsburgh Steelers', city: 'Pittsburgh', conf: 'AFC', div: 'AFC North', color: 'from-amber-600 to-black', accent: 'border-amber-500' },
        { code: 'SEA', name: 'Seattle Seahawks', city: 'Seattle', conf: 'NFC', div: 'NFC West', color: 'from-blue-900 to-emerald-900', accent: 'border-emerald-500' },
        { code: 'SF',  name: 'San Francisco 49ers', city: 'San Francisco', conf: 'NFC', div: 'NFC West', color: 'from-red-700 to-amber-900', accent: 'border-red-600' },
        { code: 'TB',  name: 'Tampa Bay Buccaneers', city: 'Tampa Bay', conf: 'NFC', div: 'NFC South', color: 'from-red-800 to-stone-900', accent: 'border-red-600' },
        { code: 'TEN', name: 'Tennessee Titans', city: 'Tennessee', conf: 'AFC', div: 'AFC South', color: 'from-sky-700 to-blue-950', accent: 'border-sky-600' },
        { code: 'WAS', name: 'Washington Commanders', city: 'Washington', conf: 'NFC', div: 'NFC East', color: 'from-amber-900 to-rose-950', accent: 'border-amber-600' }
    ],

    init() {
        this.populateDropdown();
        this.attachEvents();
        if (State.allPlayers && State.allPlayers.length > 0) {
            this.render();
        }
    },

    populateDropdown() {
        const select = document.getElementById('research-team-select');
        if (!select) return;

        select.innerHTML = this.nflTeams.map(t => 
            `<option value="${t.code}" ${t.code === this.selectedTeam ? 'selected' : ''}>${t.name} (${t.code})</option>`
        ).join('');
    },

    attachEvents() {
        const select = document.getElementById('research-team-select');
        if (select) {
            select.addEventListener('change', (e) => {
                this.selectedTeam = e.target.value;
                this.render();
            });
        }

        // Re-render when switching to research tab
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === 'research-screen') {
                btn.addEventListener('click', () => {
                    setTimeout(() => this.render(), 30);
                });
            }
        });
    },

    // ⚡ Compute dynamic Letter Grade & UI Colors
    getGradeDetails(score) {
        if (score >= 93) return { grade: 'A+', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
        if (score >= 88) return { grade: 'A', color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' };
        if (score >= 84) return { grade: 'A-', color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' };
        if (score >= 80) return { grade: 'B+', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' };
        if (score >= 76) return { grade: 'B', color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-200' };
        if (score >= 72) return { grade: 'B-', color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-200' };
        if (score >= 68) return { grade: 'C+', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
        if (score >= 64) return { grade: 'C', color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' };
        if (score >= 58) return { grade: 'C-', color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' };
        if (score >= 50) return { grade: 'D', color: 'text-rose-500', bg: 'bg-rose-50 border-rose-200' };
        return { grade: 'F', color: 'text-rose-700', bg: 'bg-rose-100 border-rose-300' };
    },

    // ⚡ Target Draft Window Algorithm based on ADP & VBD
    getDraftWindow(p) {
        let adp = p.adp || (p.ovrRank ? p.ovrRank * 1.05 : 200);
        let round = Math.floor((adp - 1) / 12) + 1;
        let pickInRound = Math.round(((adp - 1) % 12) + 1);

        if (adp <= 12) return { text: `Round 1 (Pick #${adp.toFixed(0)})`, badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', category: 'Early Round Anchor' };
        if (adp <= 24) return { text: `Round 2 (Pick #${adp.toFixed(0)})`, badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', category: 'Core Foundation' };
        if (adp <= 48) return { text: `Rounds 3–4 (Pick #${adp.toFixed(0)})`, badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', category: 'Starter Target' };
        if (adp <= 84) return { text: `Rounds 5–7 (Pick #${adp.toFixed(0)})`, badge: 'bg-indigo-50 text-indigo-700 border-indigo-100', category: 'Mid-Round Value' };
        if (adp <= 120) return { text: `Rounds 8–10 (Pick #${adp.toFixed(0)})`, badge: 'bg-amber-100 text-amber-800 border-amber-200', category: 'Flex / High Upside' };
        if (adp <= 168) return { text: `Rounds 11–14 (Pick #${adp.toFixed(0)})`, badge: 'bg-amber-50 text-amber-700 border-amber-100', category: 'Late-Round Stash' };
        return { text: `Round 15+ / Waiver Wire`, badge: 'bg-slate-100 text-slate-700 border-slate-200', category: 'Deep Stash / Stream' };
    },

    // ⚡ Player Tactical Role Tag
    getPlayerTacticalTag(p) {
        if (p.Pos === 'QB') {
            if (p.stats && p.stats.rushAtt >= 60) return { text: 'Konami Code Dual-Threat', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
            if (p.p2s && p.p2s <= 14.0) return { text: 'Pocket Escapability Anchor', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
            return { text: 'Field General Passer', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
        }
        if (p.Pos === 'RB') {
            if (p.hvo && p.hvo >= 60) return { text: 'Three-Down Workhorse (HVO)', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
            if (p._isGoalLineHammer) return { text: 'Goal-Line Hammer', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
            if (p._isSatelliteBack) return { text: 'PPR Satellite Specialist', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
            if (p.isRBHandcuff) return { text: 'High-Upside Contingent Stash', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
            return { text: 'Early-Down Committee Lead', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
        }
        if (p.Pos === 'WR') {
            if (p.targetShare >= 24.0 || (p.wopr && p.wopr >= 0.60)) return { text: 'Alpha WR1 Target Funnel', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
            if (p.aDOT && p.aDOT >= 12.5) return { text: 'Vertical Deep-Threat', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
            if (p._isShortAdotOperator) return { text: 'Slot Chain-Mover', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
            return { text: 'High-End WR2', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
        }
        if (p.Pos === 'TE') {
            if (p.targetShare >= 18.0 || p.ProjPts >= 200) return { text: 'Elite Top-Tier Matchup Weapon', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
            if (p._isTDorBust) return { text: 'Red-Zone TD Specialist', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
            return { text: 'Streamable Starting TE', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
        }
        if (p.Pos === 'DST') {
            return { text: 'Defensive Unit', cls: 'bg-slate-100 text-slate-800 border-slate-200' };
        }
        return { text: 'Specialist', cls: 'bg-slate-100 text-slate-800 border-slate-200' };
    },

    // ⚡ Build Rich Statistical Receipts
    getPlayerProofPoints(p) {
        let proofs = [];
        if (p.Pos === 'QB') {
            if (p.stats?.passYds) proofs.push(`${p.stats.passYds} Pass Yds`);
            if (p.stats?.passTd) proofs.push(`${p.stats.passTd} Pass TDs`);
            if (p.stats?.rushYds >= 200) proofs.push(`${p.stats.rushYds} Rush Yds`);
            if (p.p2s && p.p2s <= 16.0) proofs.push(`Low ${p.p2s.toFixed(1)}% P2S`);
        } else if (p.Pos === 'RB') {
            if (p.stats?.rushAtt) proofs.push(`${p.stats.rushAtt} Carries`);
            if (p.hvo && p.hvo >= 30) proofs.push(`${p.hvo} HVO Touches`);
            if (p.targetShare && p.targetShare >= 8) proofs.push(`${p.targetShare}% Tgt Share`);
            if (p.yacAtt && p.yacAtt >= 2.8) proofs.push(`${p.yacAtt.toFixed(1)} YAC/Att`);
            if (p.brokenTackles && p.brokenTackles >= 10) proofs.push(`${p.brokenTackles} Broken Tackles`);
        } else if (['WR', 'TE'].includes(p.Pos)) {
            if (p.stats?.targets) proofs.push(`${p.stats.targets} Proj Targets`);
            if (p.targetShare && p.targetShare >= 14) proofs.push(`${p.targetShare}% Tgt Share`);
            if (p.wopr && p.wopr >= 0.45) proofs.push(`${p.wopr.toFixed(2)} WOPR`);
            if (p.aDOT && p.aDOT >= 10.0) proofs.push(`${p.aDOT} aDOT`);
            if (p.trueCatchRate && p.trueCatchRate >= 85) proofs.push(`${p.trueCatchRate.toFixed(1)}% Catch Rate`);
        } else if (p.Pos === 'DST') {
            if (p.stats?.sack) proofs.push(`${p.stats.sack} Sacks`);
            if (p.stats) proofs.push(`${(p.stats.defInt || 0) + (p.stats.defFum || 0)} Turnovers`);
            if (p.stats?.papg) proofs.push(`${p.stats.papg.toFixed(1)} PAPG`);
        } else if (p.Pos === 'PK') {
            if (p.stats?.fgTotal) proofs.push(`${p.stats.fgTotal} FGs`);
            if (p.stats?.xp) proofs.push(`${p.stats.xp} PATs`);
        }
        return proofs;
    },

    render() {
        const container = document.getElementById('research-content-container');
        if (!container) return;

        const teamCode = this.selectedTeam;
        const meta = this.nflTeams.find(t => t.code === teamCode) || this.nflTeams[0];

        // 1. Fetch State Data & Players for Selected Team
        const teamPlayers = State.allPlayers.filter(p => State.normalizeTeam(p.Team) === teamCode);
        const passEnv = State.teamAdvPass ? State.teamAdvPass[teamCode] : null;
        const rushEnv = State.teamAdvRush ? State.teamAdvRush[teamCode] : null;
        const recEnv = State.teamAdvRec ? State.teamAdvRec[teamCode] : null;
        const teamDist = (State.teamTargets || []).find(t => State.normalizeTeam(t.Team) === teamCode) || (State.teamTargetsMap ? State.teamTargetsMap[teamCode] : null);
        const threatObj = State.teamOffensiveThreats ? State.teamOffensiveThreats[teamCode] : null;

        // 2. Offense Grade Calculation
        let topSkillProj = teamPlayers
            .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.Pos))
            .sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0))
            .slice(0, 6)
            .reduce((sum, p) => sum + (p.ProjPts || 0), 0);

        let offScore = 74;
        if (topSkillProj >= 1450) offScore += 18;
        else if (topSkillProj >= 1250) offScore += 10;
        else if (topSkillProj <= 950) offScore -= 14;

        if (passEnv && passEnv.onTgtPct >= 76.0) offScore += 4;
        if (passEnv && passEnv.badPct >= 18.0) offScore -= 4;
        if (rushEnv && rushEnv.ybcAtt >= 2.8) offScore += 4;
        offScore = Math.max(45, Math.min(99, offScore));
        const offGrade = this.getGradeDetails(offScore);

        // 3. Offensive Line Grade Calculation
        let firstOL = teamPlayers.find(p => p.olTier || p.olRank);
        let olTier = firstOL?.olTier || 'C';
        let olRunBlk = firstOL?.olRunBlk ?? 16;
        let olPassBlk = firstOL?.olPassBlk ?? 16;

        let olScore = 75;
        if (olTier === 'S') olScore = 96;
        else if (olTier === 'A') olScore = 89;
        else if (olTier === 'B') olScore = 81;
        else if (olTier === 'C') olScore = 73;
        else if (olTier === 'D') olScore = 62;
        else if (olTier === 'F') olScore = 48;
        const olGrade = this.getGradeDetails(olScore);

        // 4. Defensive Unit Grade Calculation
        let teamDST = teamPlayers.find(p => p.Pos === 'DST');
        let defScore = 75;
        if (teamDST) {
            let sacks = teamDST.stats?.sack || 35;
            let turnovers = (teamDST.stats?.defInt || 0) + (teamDST.stats?.defFum || 0);
            let papg = teamDST.stats?.papg || 20.0;
            defScore = 50 + (sacks * 0.45) + (turnovers * 0.75) - (papg * 0.7);
        }
        defScore = Math.max(45, Math.min(98, defScore));
        const defGrade = this.getGradeDetails(defScore);

        // 5. Tactical Target Distribution & Scheme Pace
        let totalTargets = teamDist ? (teamDist['Total Targets'] || 550) : 550;
        let wrPct = teamDist ? parseFloat(teamDist['WR %'] || 58.0) : 58.0;
        let rbPct = teamDist ? parseFloat(teamDist['RB %'] || 18.0) : 18.0;
        let tePct = teamDist ? parseFloat(teamDist['TE %'] || 24.0) : 24.0;

        let schemePace = "Balanced Pace";
        if (totalTargets >= 580) schemePace = "High-Volume Pass Funnel";
        else if (totalTargets <= 510) schemePace = "Run-Heavy Ground Assault";

        // 6. Tactical Writeup Synthesis
        let startingQB = teamPlayers.find(p => p.Pos === 'QB' && p.depthChart === 1) || teamPlayers.filter(p => p.Pos === 'QB').sort((a,b)=>(b.ProjPts||0)-(a.ProjPts||0))[0];
        let leadRB = teamPlayers.find(p => p.Pos === 'RB' && p.depthChart === 1) || teamPlayers.filter(p => p.Pos === 'RB').sort((a,b)=>(b.ProjPts||0)-(a.ProjPts||0))[0];
        let alphaWR = teamPlayers.find(p => p.Pos === 'WR' && p.depthChart === 1) || teamPlayers.filter(p => p.Pos === 'WR').sort((a,b)=>(b.ProjPts||0)-(a.ProjPts||0))[0];
        let primaryTE = teamPlayers.find(p => p.Pos === 'TE' && p.depthChart === 1) || teamPlayers.filter(p => p.Pos === 'TE').sort((a,b)=>(b.ProjPts||0)-(a.ProjPts||0))[0];

        let tacticalSummary = `
            The <strong>${meta.name}</strong> enter the 2026 campaign operating a <strong>${schemePace}</strong> (${totalTargets} pass attempts). 
            Under center, <strong>${startingQB ? startingQB.Player : 'their QB'}</strong> commands an attack backed by a <strong>Tier ${olTier}</strong> offensive line 
            (Pass Block #${olPassBlk}, Run Block #${olRunBlk}). 
            Their scheme distributes <strong>${wrPct}%</strong> of targets to wide receivers, <strong>${rbPct}%</strong> to running backs, and <strong>${tePct}%</strong> to tight ends.
        `;

        let keyTakeaway = "";
        if (wrPct >= 62.0) {
            keyTakeaway = `🔥 <strong>High-Volume Perimeter Funnel:</strong> This passing tree heavily condenses targets into wide receivers. Both ${alphaWR ? alphaWR.Player : 'the WR1'} and secondary receivers benefit from high route volume and deep air yards.`;
        } else if (tePct >= 22.0) {
            keyTakeaway = `🛡️ <strong>Tight End Priority Scheme:</strong> Tight ends command an above-average ${tePct}% target share, insulating ${primaryTE ? primaryTE.Player : 'their TE'} with premium red-zone looks and third-down equity.`;
        } else if (rbPct >= 20.0) {
            keyTakeaway = `🏃 <strong>High-Value Pass-Catching Backfield:</strong> Running backs absorb ${rbPct}% of passes, creating immense PPR floor opportunities for ${leadRB ? leadRB.Player : 'the lead back'} out of the backfield.`;
        } else {
            keyTakeaway = `⚖️ <strong>Balanced Offensive Spread:</strong> Volume is evenly distributed across all three skill units, making individual efficiency and touchdown conversion the primary drivers of fantasy value.`;
        }

        // 7. Build Player Roster Cards
        const renderPlayerSection = (title, icon, posFilter) => {
            const players = teamPlayers
                .filter(p => posFilter.includes(p.Pos))
                .sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0));

            if (players.length === 0) return '';

            return `
                <div class="mb-6">
                    <h4 class="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span>${icon}</span> ${title}
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${players.map(p => {
                            const dWindow = this.getDraftWindow(p);
                            const tTag = this.getPlayerTacticalTag(p);
                            const proofs = this.getPlayerProofPoints(p);
                            const ppg = ((p.ProjPts || 0) / Math.max(1, p.stats?.gp || 17)).toFixed(1);
                            const depthBadge = p.depthChart ? `<span class="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">#${p.depthChart} ${p.Pos}</span>` : '';
                            const injBadge = p.injuryStatus ? `<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200">🏥 ${p.injuryStatus}</span>` : '';

                            return `
                                <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
                                     onclick="UI.showPlayerCard('${p._cleanName}')">
                                    <div>
                                        <div class="flex justify-between items-start mb-1.5 gap-2">
                                            <div>
                                                <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                                                    <span class="text-xs font-extrabold text-gray-900">${p.Player}</span>
                                                    ${depthBadge}
                                                    ${injBadge}
                                                </div>
                                                <div class="flex items-center gap-1.5">
                                                    <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${tTag.cls}">${tTag.text}</span>
                                                </div>
                                            </div>
                                            <div class="text-right shrink-0">
                                                <span class="text-xs font-black text-indigo-600 block">${(p.ProjPts || 0).toFixed(1)} pts</span>
                                                <span class="text-[10px] text-gray-400 font-semibold">${ppg} PPG</span>
                                            </div>
                                        </div>

                                        <!-- Draft Target Window Pill -->
                                        <div class="my-2.5 flex items-center justify-between text-[11px] p-2 rounded-lg border ${dWindow.badge}">
                                            <span class="font-bold flex items-center gap-1">🎯 ${dWindow.text}</span>
                                            <span class="font-semibold text-[10px] opacity-90">${dWindow.category}</span>
                                        </div>

                                        <!-- Statistical Proofs -->
                                        ${proofs.length > 0 ? `
                                        <div class="text-[11px] text-gray-600 flex flex-wrap gap-1.5 mb-1">
                                            ${proofs.map(pr => `<span class="bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">${pr}</span>`).join('')}
                                        </div>` : ''}
                                    </div>

                                    <div class="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] font-semibold">
                                        <div>
                                            <span class="text-slate-400">Model Edge: </span>
                                            <span class="${(p.Edge || 0) >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-bold'}">
                                                ${(p.Edge || 0) >= 0 ? '+' : ''}${(p.Edge || 0).toFixed(1)} (${Math.round((p.OverProb || 0.5) * 100)}% Over)
                                            </span>
                                        </div>
                                        <span class="text-indigo-600 font-bold hover:underline">Scout Card &rarr;</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        };

        // 8. Generate Complete HTML Output
        const html = `
            <div class="space-y-6">
                <!-- Top Team Banner -->
                <div class="bg-gradient-to-r ${meta.color} text-white p-6 rounded-2xl shadow-md border ${meta.accent} relative overflow-hidden">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        <div class="flex items-center space-x-4">
                            <div class="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center font-black text-2xl tracking-tight text-white shadow-inner">
                                ${meta.code}
                            </div>
                            <div>
                                <span class="text-xs uppercase font-extrabold tracking-widest text-white/70 block">${meta.conf} • ${meta.div}</span>
                                <h3 class="text-2xl sm:text-3xl font-black text-white tracking-tight">${meta.name}</h3>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <span class="bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold">
                                📋 Total Targets: ${totalTargets}
                            </span>
                            <span class="bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold">
                                🛡️ O-Line Tier ${olTier} (#${olPassBlk} Pass / #${olRunBlk} Run)
                            </span>
                            <span class="bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold">
                                ⚡ Matchup SOS: ⭐${(teamDST?.avgStars || 3.0).toFixed(1)}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 3-Pillar Unit Grades Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Offense Grade -->
                    <div class="${offGrade.bg} p-5 rounded-2xl border shadow-sm flex items-center justify-between">
                        <div>
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 block">Offensive Firepower</span>
                            <h4 class="text-base font-extrabold text-gray-900 mt-0.5">Offensive Unit</h4>
                            <p class="text-[11px] text-gray-600 mt-1">${schemePace} • ${passEnv ? passEnv.onTgtPct + '% Accuracy' : 'Solid Base'}</p>
                        </div>
                        <span class="text-4xl font-black ${offGrade.color}">${offGrade.grade}</span>
                    </div>

                    <!-- O-Line Grade -->
                    <div class="${olGrade.bg} p-5 rounded-2xl border shadow-sm flex items-center justify-between">
                        <div>
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 block">Trench Quality</span>
                            <h4 class="text-base font-extrabold text-gray-900 mt-0.5">Offensive Line</h4>
                            <p class="text-[11px] text-gray-600 mt-1">Tier ${olTier} • ${rushEnv ? rushEnv.ybcAtt + ' YBC/Att' : 'Pass Blk #' + olPassBlk}</p>
                        </div>
                        <span class="text-4xl font-black ${olGrade.color}">${olGrade.grade}</span>
                    </div>

                    <!-- DST Grade -->
                    <div class="${defGrade.bg} p-5 rounded-2xl border shadow-sm flex items-center justify-between">
                        <div>
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 block">Havoc & Turnover Equity</span>
                            <h4 class="text-base font-extrabold text-gray-900 mt-0.5">Defense / Special Teams</h4>
                            <p class="text-[11px] text-gray-600 mt-1">${teamDST?.stats?.sack || 35} Sacks • ${teamDST?.stats?.papg || 20.0} PAPG</p>
                        </div>
                        <span class="text-4xl font-black ${defGrade.color}">${defGrade.grade}</span>
                    </div>
                </div>

                <!-- Offensive Scheme & Positional Target Funnel -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h4 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span>📊</span> Offensive Scheme & Target Funnel Architecture
                    </h4>

                    <div class="space-y-2 mb-4">
                        <div class="flex justify-between text-xs font-bold text-gray-700">
                            <span>Wide Receivers (${wrPct}%)</span>
                            <span>Tight Ends (${tePct}%)</span>
                            <span>Running Backs (${rbPct}%)</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden shadow-inner">
                            <div class="bg-indigo-600 h-3" style="width: ${wrPct}%" title="WR Share: ${wrPct}%"></div>
                            <div class="bg-amber-500 h-3" style="width: ${tePct}%" title="TE Share: ${tePct}%"></div>
                            <div class="bg-emerald-500 h-3" style="width: ${rbPct}%" title="RB Share: ${rbPct}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-gray-400 font-semibold">
                            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span> WR Targets: ${Math.round((totalTargets * wrPct) / 100)}</span>
                            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> TE Targets: ${Math.round((totalTargets * tePct) / 100)}</span>
                            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> RB Targets: ${Math.round((totalTargets * rbPct) / 100)}</span>
                        </div>
                    </div>

                    <!-- Tactical Writeup Callout -->
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs sm:text-sm text-gray-700 leading-relaxed space-y-2">
                        <p>${tacticalSummary}</p>
                        <div class="pt-2 border-t border-slate-200/70 text-xs text-indigo-950 font-medium">${keyTakeaway}</div>
                    </div>
                </div>

                <!-- Positional Units & Key Fantasy Players -->
                <div>
                    <h3 class="text-lg font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                        <span>🎯</span> Key Fantasy Assets & Draft Target Windows
                    </h3>

                    ${renderPlayerSection('Quarterback Room', '🎯', ['QB'])}
                    ${renderPlayerSection('Backfield & Running Backs', '🏃', ['RB'])}
                    ${renderPlayerSection('Wide Receivers & Pass Catchers', '👐', ['WR'])}
                    ${renderPlayerSection('Tight Ends & Specialists', '🛡️', ['TE'])}
                    ${renderPlayerSection('Defense & Kicking Units', '⚡', ['DST', 'PK'])}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
};

// Auto-initialize when document loads
document.addEventListener('DOMContentLoaded', () => {
    TeamResearch.init();
});
