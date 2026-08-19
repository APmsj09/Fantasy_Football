window.DraftRecap = {
    teamData: {},
    sortedTeams: [],

    generateRecaps() {
        this.teamData = {};
        this.sortedTeams = [];

        const startW = State.settings.startWeek || 1;
        const endW = State.settings.endWeek || 17;
        const numTeams = State.settings.numTeams || 12;

        // 1. Calculate Multi-Tier Standings (Base, Floor, Ceiling) with FA Streaming Modeling
        let rawTeams = Object.values(State.teamsById).map(team => {
            let basePts = 0;
            let floorPts = 0;
            let ceilingPts = 0;
            let byeCollisions = {};

            team.roster.forEach(p => {
                if (p.byeWeek && p.byeWeek !== 'N/A') {
                    byeCollisions[p.byeWeek] = (byeCollisions[p.byeWeek] || 0) + 1;
                }
            });

            for (let w = startW; w <= endW; w++) {
                basePts += State.calculateOptimalWeeklyScore(team.roster, w);
            }

            // Injury / Worst-Case Floor Simulation (Safe Optional Chaining)
            let floorRoster = team.roster.map(p => {
                let variance = p.boomBust && p.boomBust.bust ? (p.boomBust.bust / 100) : 0.25;
                let mapped = { ...p, weeklyProjections: {} };
                for (let week = 1; week <= 18; week++) {
                    let baseProj = p.weeklyProjections?.[`W${week}`] || 0;
                    mapped.weeklyProjections[`W${week}`] = baseProj * (1 - (variance * 0.65));
                }
                return mapped;
            });

            // TD Luck / Max-Efficiency Ceiling Simulation (Safe Optional Chaining)
            let ceilRoster = team.roster.map(p => {
                let maxMultiplier = 1.25;
                if (p.upsideScore > 0 && p.AdvVBD > 0) {
                    let ratio = p.upsideScore / p.AdvVBD;
                    if (ratio > 1.0) maxMultiplier = Math.min(1.55, ratio);
                }
                let mapped = { ...p, weeklyProjections: {} };
                for (let week = 1; week <= 18; week++) {
                    let baseProj = p.weeklyProjections?.[`W${week}`] || 0;
                    mapped.weeklyProjections[`W${week}`] = baseProj * maxMultiplier;
                }
                return mapped;
            });

            for (let w = startW; w <= endW; w++) {
                floorPts += State.calculateOptimalWeeklyScore(floorRoster, w);
                ceilingPts += State.calculateOptimalWeeklyScore(ceilRoster, w);
            }

            return {
                ...team,
                basePts, floorPts, ceilingPts,
                byeCollisions
            };
        });

        this.sortedTeams = rawTeams.sort((a, b) => b.basePts - a.basePts);

        const avgLeaguePts = this.sortedTeams.reduce((sum, t) => sum + t.basePts, 0) / (this.sortedTeams.length || 1);

        // 2. Comprehensive Roster Audit & Grading
        this.sortedTeams.forEach((team, index) => {
            team.projectedRank = index + 1;

            let bestValue = null;
            let worstReach = null;
            let topSleeper = null;
            let maxSteal = 0;
            let worstReachDiff = 0; // ✅ FIXED: Initialized to 0 so negative reaches are caught
            let maxStash = -999;
            let totalAdpDelta = 0;

            team.roster.forEach(p => {
                let pickNum = p.draftPickNum || 1;
                if (p.adp) {
                    let diff = p.adp - pickNum;
                    totalAdpDelta += diff;

                    if (diff > maxSteal && pickNum <= numTeams * 12) {
                        maxSteal = diff;
                        bestValue = p;
                    }
                    if (diff < worstReachDiff && pickNum <= numTeams * 10) { // ✅ FIXED Check
                        worstReachDiff = diff;
                        worstReach = p;
                    }
                }

                let roundDrafted = Math.floor((pickNum - 1) / numTeams) + 1;
                let pUpside = p.upsideScore || 0;
                if (roundDrafted >= 8 && pUpside > 10 && pUpside > maxStash && p._cleanName !== worstReach?._cleanName) {
                    maxStash = pUpside;
                    topSleeper = p;
                }
            });

            // Grading Algorithm (Scale 0-100)
            let score = 75;
            let ptsDelta = ((team.basePts - avgLeaguePts) / (avgLeaguePts || 1)) * 100;
            score += (ptsDelta * 1.6);
            score += (totalAdpDelta * 0.12);

            const needs = { QB: 1, RB: 2, WR: 2, TE: 1, PK: 1, DST: 1 };
            Object.keys(needs).forEach(pos => {
                let req = State.settings.roster[pos]?.max || needs[pos];
                if ((team.counts[pos] || 0) < req) score -= 8.0;
            });

            score = Math.max(0, Math.min(100, score));
            let grade = 'F'; let color = 'text-gray-500'; let bg = 'bg-gray-100';
            if (score >= 94) { grade = 'A+'; color = 'text-emerald-600'; bg = 'bg-emerald-50 border-emerald-200'; }
            else if (score >= 90) { grade = 'A'; color = 'text-emerald-500'; bg = 'bg-emerald-50 border-emerald-200'; }
            else if (score >= 87) { grade = 'A-'; color = 'text-emerald-400'; bg = 'bg-emerald-50 border-emerald-200'; }
            else if (score >= 83) { grade = 'B+'; color = 'text-indigo-600'; bg = 'bg-indigo-50 border-indigo-200'; }
            else if (score >= 80) { grade = 'B'; color = 'text-indigo-500'; bg = 'bg-indigo-50 border-indigo-200'; }
            else if (score >= 77) { grade = 'B-'; color = 'text-indigo-400'; bg = 'bg-indigo-50 border-indigo-200'; }
            else if (score >= 73) { grade = 'C+'; color = 'text-amber-600'; bg = 'bg-amber-50 border-amber-200'; }
            else if (score >= 70) { grade = 'C'; color = 'text-amber-500'; bg = 'bg-amber-50 border-amber-200'; }
            else if (score >= 65) { grade = 'C-'; color = 'text-amber-400'; bg = 'bg-amber-50 border-amber-200'; }
            else if (score >= 60) { grade = 'D'; color = 'text-rose-500'; bg = 'bg-rose-50 border-rose-200'; }
            else { grade = 'F'; color = 'text-rose-700'; bg = 'bg-rose-100 border-rose-300'; }

            // Unit Aggregation & Strategic Profiling
            let units = this.analyzeUnits(team);
            let streamingAnalysis = this.analyzeStreamingStrategy(team);
            let playoffOutlook = this.analyzePlayoffs(team);
            let xFactor = this.identifyXFactor(team);

            team.analysis = {
                grade, color, bg, score,
                bestValue, worstReach, topSleeper,
                units, streamingAnalysis, playoffOutlook, xFactor,
                narrative: this.buildNarrative(team, index + 1, units, streamingAnalysis, playoffOutlook)
            };

            this.teamData[team.id] = team;
        });

        this.renderDropdown();
    },

    // ⚡ FORMAT STATISTICAL RECEIPT SNIPPET
    formatPlayerProof(p) {
        if (!p) return '';
        let proofs = [];
        if (p.Pos === 'QB') {
            if (p.stats?.rushYds >= 300) proofs.push(`${p.stats.rushYds} rush yds`);
            if (p.stats?.passTd >= 26) proofs.push(`${p.stats.passTd} pass TDs`);
            if (p.p2s && p.p2s <= 16.0) proofs.push(`elite ${p.p2s.toFixed(1)}% P2S`);
        } else if (p.Pos === 'RB') {
            if (p.hvo && p.hvo >= 40) proofs.push(`${p.hvo} HVO touches`);
            if (p.stats?.rushAtt >= 200) proofs.push(`${p.stats.rushAtt} carries`);
            if (p.brokenTackles && p.brokenTackles >= 15) proofs.push(`${p.brokenTackles} broken tackles`);
            if (p.targetShare && p.targetShare >= 10) proofs.push(`${p.targetShare}% target share`);
        } else if (['WR', 'TE'].includes(p.Pos)) {
            if (p.wopr && p.wopr >= 0.50) proofs.push(`${p.wopr.toFixed(2)} WOPR`);
            if (p.targetShare && p.targetShare >= 18) proofs.push(`${p.targetShare}% target share`);
            if (p.aDOT && p.aDOT >= 11.5) proofs.push(`${p.aDOT} aDOT`);
            if (p.stats?.targets >= 110) proofs.push(`${p.stats.targets} targets`);
            if (p._vacatedAirYards >= 600) proofs.push(`+${p._vacatedAirYards} vacated air yds`);
        }
        return proofs.length > 0 ? ` <span class="text-indigo-600 font-bold">(${proofs.slice(0, 2).join(' • ')})</span>` : '';
    },

    // ⚡ WAIVER WIRE & STREAMING ANALYSIS
    analyzeStreamingStrategy(team) {
        let qbs = team.roster.filter(p => p.Pos === 'QB');
        let tes = team.roster.filter(p => p.Pos === 'TE');

        let isStreamingQB = qbs.length === 1;
        let isStreamingTE = tes.length === 1;

        let maxByeWeek = null;
        let maxByeCount = 0;
        for (let week in team.byeCollisions) {
            if (team.byeCollisions[week] > maxByeCount) {
                maxByeCount = team.byeCollisions[week];
                maxByeWeek = week;
            }
        }

        let strategyTitle = "";
        let strategyDesc = "";

        if (isStreamingQB && isStreamingTE) {
            strategyTitle = "Aggressive Flex Maximizer (Dual Streamer)";
            strategyDesc = `Opted for a zero-backup QB/TE build. They will rely on Free Agency streaming (~18.0 PPG QB / ~7.5 PPG TE baselines) during byes to dedicate maximum bench capacity to RB/WR lottery tickets.`;
        } else if (isStreamingQB) {
            strategyTitle = "Single-QB Streaming Strategy";
            strategyDesc = `Drafted a single QB (${qbs[0]?.Player || 'Starter'}), planning to stream waiver-wire matchups during Week ${qbs[0]?.byeWeek || 'their bye'}.`;
        } else if (isStreamingTE) {
            strategyTitle = "Single-TE Streaming Strategy";
            strategyDesc = `Anchored by ${tes[0]?.Player || 'Starter'}, choosing to stream waiver-wire TEs during Week ${tes[0]?.byeWeek || 'the bye'} rather than wasting a bench stash.`;
        } else {
            strategyTitle = "Full In-House Backup Insurance";
            strategyDesc = `Drafted dedicated in-house backups across QB and TE, sacrificing late-round bench stashes in exchange for complete waiver-wire independence.`;
        }

        let byeRisk = maxByeCount >= 4 
            ? `⚠️ <strong>Punt Week Warning:</strong> Week ${maxByeWeek} features <strong>${maxByeCount} starters on bye</strong>, forcing heavy waiver churn or an intentional punt week.`
            : `✅ <strong>Balanced Bye Distribution:</strong> Peak bye-week collision is ${maxByeCount} player(s) (${maxByeWeek ? 'Week ' + maxByeWeek : 'No conflicts'}), ensuring steady weekly lineup continuity.`;

        return { isStreamingQB, isStreamingTE, strategyTitle, strategyDesc, maxByeWeek, maxByeCount, byeRisk };
    },

    // ⚡ PLAYOFF SOS OUTLOOK (WEEKS 15-17)
    analyzePlayoffs(team) {
        let coreStarters = team.roster.slice(0, 7);
        let avgPlayoffStars = coreStarters.length > 0 
            ? coreStarters.reduce((sum, p) => sum + (p.playoffSOS || p.avgStars || 3.0), 0) / coreStarters.length 
            : 3.0;

        let verdict = "";
        if (avgPlayoffStars >= 3.4) {
            verdict = `🔥 <strong>Championship Friendly Schedule:</strong> Core starters enjoy an easy <strong>⭐${avgPlayoffStars.toFixed(2)}/5.0 Playoff SOS</strong> during Weeks 15–17.`;
        } else if (avgPlayoffStars <= 2.8) {
            verdict = `⚠️ <strong>Brutal Playoff Slate:</strong> Faces a tough <strong>⭐${avgPlayoffStars.toFixed(2)}/5.0 Playoff SOS</strong> during the fantasy championship rounds.`;
        } else {
            verdict = `⚖️ <strong>Neutral Playoff Schedule:</strong> Balanced <strong>⭐${avgPlayoffStars.toFixed(2)}/5.0 Playoff SOS</strong> across Weeks 15–17.`;
        }

        return { avgPlayoffStars, verdict };
    },

    // ⚡ POSITIONAL UNIT GRADING (✅ FIXED UNDEFINED CRASHES)
    analyzeUnits(team) {
        let rbs = team.roster.filter(p => p.Pos === 'RB').sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0));
        let wrs = team.roster.filter(p => p.Pos === 'WR').sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0));
        let qbs = team.roster.filter(p => p.Pos === 'QB').sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0));
        let tes = team.roster.filter(p => p.Pos === 'TE').sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0));

        let rbCarries = rbs.reduce((sum, p) => sum + (p.stats?.rushAtt || 0), 0);
        let rbHVO = rbs.reduce((sum, p) => sum + (p.hvo || 0), 0);
        let wrTargets = wrs.reduce((sum, p) => sum + (p.stats?.targets || 0), 0);
        let wrAirYards = wrs.reduce((sum, p) => sum + (p.airYards || p.stats?.recYds || 0), 0);

        let r0 = rbs[0]?.ProjPts || 0; let r1 = rbs[1]?.ProjPts || 0;
        let w0 = wrs[0]?.ProjPts || 0; let w1 = wrs[1]?.ProjPts || 0;

        return {
            rb: {
                grade: (r0 + r1 >= 450) ? 'A+' : ((r0 + r1 >= 350) ? 'B+' : (rbs.length > 0 ? 'C' : 'F')),
                summary: `${rbCarries} Carries • ${rbHVO} High-Value Touches (HVO)`,
                lead: rbs[0] ? `${rbs[0].Player}${this.formatPlayerProof(rbs[0])}` : 'None'
            },
            wr: {
                grade: (w0 + w1 >= 500) ? 'A+' : ((w0 + w1 >= 400) ? 'A-' : (wrs.length > 0 ? 'B-' : 'F')),
                summary: `${wrTargets} Targets • ${wrAirYards.toLocaleString()} Air Yards`,
                lead: wrs[0] ? `${wrs[0].Player}${this.formatPlayerProof(wrs[0])}` : 'None'
            },
            qb: {
                grade: qbs[0] && qbs[0].ProjPts >= 375 ? 'A' : (qbs[0] && qbs[0].ProjPts >= 350 ? 'B' : (qbs.length > 0 ? 'C-' : 'F')),
                summary: qbs[0] ? `${qbs[0].stats?.passYds || 0} Pass Yds • ${qbs[0].stats?.rushYds || 0} Rush Yds` : 'No Starter',
                lead: qbs[0] ? `${qbs[0].Player}${this.formatPlayerProof(qbs[0])}` : 'None'
            },
            te: {
                grade: tes[0] && tes[0].ProjPts >= 230 ? 'A+' : (tes[0] && tes[0].ProjPts >= 190 ? 'B+' : (tes.length > 0 ? 'C' : 'F')),
                summary: tes[0] ? `${tes[0].stats?.targets || 0} Targets • ${tes[0].stats?.recTd || 0} Proj TDs` : 'No Starter',
                lead: tes[0] ? `${tes[0].Player}${this.formatPlayerProof(tes[0])}` : 'None'
            }
        };
    },

    // ⚡ SEASON X-FACTOR INFLECTION POINT
    identifyXFactor(team) {
        let numTeams = State.settings.numTeams || 12;
        let earlyCore = team.roster.filter(p => (p.draftPickNum || 99) <= numTeams * 8);
        if (earlyCore.length === 0) earlyCore = team.roster;
        
        let xPlayer = [...earlyCore].sort((a, b) => (b.upsideScore || 0) - (a.upsideScore || 0))[0];
        if (!xPlayer) return null;

        let question = "";
        if (xPlayer.Pos === 'RB') {
            question = `If ${xPlayer.Player} sustains his ${xPlayer.hvo || 40}+ High-Value Opportunities and avoids backfield vulturing, this roster has a top-3 league ceiling. However, if negative game scripts cap his carry share, their weekly floor takes a direct hit.`;
        } else if (['WR', 'TE'].includes(xPlayer.Pos)) {
            question = `Everything hinges on ${xPlayer.Player}'s target conversion. If he commands his projected ${xPlayer.targetShare || 20}% target share (${xPlayer.aDOT || 12.0} aDOT), he will produce WR1 spike weeks. If QB accuracy falters, his bust volatility could limit playoff consistency.`;
        } else {
            question = `The ceiling of this team relies directly on ${xPlayer.Player}'s dual-threat rushing equity (${xPlayer.stats?.rushYds || 0} projected rushing yards).`;
        }

        return { player: xPlayer, question };
    },

    buildNarrative(team, rank, units, streaming, playoffs) {
        let r1 = team.roster[0];
        let r2 = team.roster[1];
        if (!r1 || !r2) return "Draft roster incomplete.";

        let seed = (team.name.length + rank) % 4;

        let intros = [
            `The <strong>${team.name}</strong> exited the draft room projected for <strong>#${rank} overall</strong> (${team.basePts.toFixed(1)} median projection). They established an uncompromising identity early, locking down Round 1 with <strong>${r1.Player}</strong>${this.formatPlayerProof(r1)} and solidifying their core infrastructure with <strong>${r2.Player}</strong>${this.formatPlayerProof(r2)}.`,
            `Finishing with the <strong>#${rank} projected standing</strong>, the <strong>${team.name}</strong> executed a calculated draft blueprint. Opening with <strong>${r1.Player}</strong>${this.formatPlayerProof(r1)} at Pick #${r1.draftPickNum || 1} set the tone for an opportunity-rich roster, complemented by <strong>${r2.Player}</strong>${this.formatPlayerProof(r2)}.`,
            `Projected for <strong>#${rank} overall</strong> (${team.ceilingPts.toFixed(1)} ceiling forecast), the <strong>${team.name}</strong> built a high-leverage lineup. Their 1-2 punch of <strong>${r1.Player}</strong>${this.formatPlayerProof(r1)} and <strong>${r2.Player}</strong>${this.formatPlayerProof(r2)} gives them immediate weekly starting separation.`,
            `The <strong>${team.name}</strong> put on a masterclass in roster balance, emerging with the <strong>#${rank} projected seed</strong>. Anchored by the elite profile of <strong>${r1.Player}</strong>${this.formatPlayerProof(r1)} alongside <strong>${r2.Player}</strong>${this.formatPlayerProof(r2)}, this lineup balances high-floor security with slate-breaking potential.`
        ];

        let unitAnalysis = `Their receiving corps earned a <strong>${units.wr.grade}</strong> grade, accounting for a massive <strong>${units.wr.summary}</strong> led by ${units.wr.lead}. The ground attack posted a <strong>${units.rb.grade}</strong>, compiling <strong>${units.rb.summary}</strong> anchored by ${units.rb.lead}.`;

        return `${intros[seed]} ${unitAnalysis}`;
    },

    renderDropdown() {
        const select = document.getElementById('recap-team-select');
        if (!select) return;

        select.innerHTML = this.sortedTeams.map(t => `<option value="${t.id}">${t.name} (Proj: #${t.projectedRank} • Grade: ${t.analysis.grade})</option>`).join('');
        if (State.userTeamId) select.value = State.userTeamId;

        select.addEventListener('change', (e) => this.renderTeam(e.target.value));
        this.renderTeam(select.value);
    },

    renderTeam(teamId) {
        const container = document.getElementById('recap-content-container');
        const team = this.teamData[teamId];
        if (!container || !team) return;

        const a = team.analysis;
        const u = a.units;
        const s = a.streamingAnalysis;
        const p = a.playoffOutlook;
        const numTeams = State.settings.numTeams || 12;

        const playerCardHTML = (p, label, colorCls, icon) => {
            if (!p) return `<div class="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-xs text-gray-400 italic">No qualifying player found.</div>`;
            let pickNum = p.draftPickNum || 1;
            let round = Math.floor((pickNum - 1) / numTeams) + 1;
            let pick = ((pickNum - 1) % numTeams) + 1;
            let diff = p.adp ? (p.adp - pickNum) : 0;
            let diffStr = diff > 0 ? `<span class="text-emerald-600 font-bold">+${diff.toFixed(0)} Value</span>` : `<span class="text-rose-600 font-bold">${diff.toFixed(0)} Reach</span>`;
            if (label === 'Top Stash / Sleeper') diffStr = `<span class="text-amber-600 font-bold">Upside: ${(p.upsideScore || 0).toFixed(0)}</span>`;

            let statSummary = '';
            if (p.stats) {
                if (p.Pos === 'QB') {
                    statSummary = `${p.stats.passYds || 0} Yds • ${p.stats.passTd || 0} TD`;
                } else if (p.Pos === 'DST') {
                    statSummary = `${p.stats.sack || 0} Sacks • ${(p.stats.defInt || 0) + (p.stats.defFum || 0)} TO`;
                } else if (p.Pos === 'PK') {
                    statSummary = `${p.stats.fgTotal || 0} FGM • ${p.stats.xp || 0} PAT`;
                } else {
                    let totalYds = (p.stats.rushYds || 0) + (p.stats.recYds || 0);
                    let totalTD = (p.stats.rushTd || 0) + (p.stats.recTd || 0);
                    statSummary = `${totalYds.toLocaleString()} Yds • ${totalTD} TD`;
                }
            }

            return `
            <div class="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer" onclick="UI.showPlayerCard('${p._cleanName}')">
                <div class="absolute top-0 left-0 w-1.5 h-full ${colorCls}"></div>
                <div class="flex justify-between items-start mb-1.5">
                    <span class="text-[10px] uppercase font-extrabold text-gray-500 tracking-wider flex items-center gap-1">${icon} ${label}</span>
                    <span class="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">${p.Pos} • ${p.Team}</span>
                </div>
                <h4 class="font-extrabold text-gray-900 leading-tight text-base">${p.Player}</h4>
                
                <p class="text-[11px] text-gray-500 my-1">${statSummary}</p>
                
                <div class="flex justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 mt-2">
                    <span class="font-semibold text-gray-600">Pick: ${round}.${pick} (Ovr: #${pickNum})</span>
                    <span>${diffStr}</span>
                </div>
            </div>`;
        };

        const unitBoxHTML = (name, data, icon) => `
            <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[11px] font-extrabold uppercase text-gray-700 flex items-center gap-1.5">${icon} ${name}</span>
                    <span class="text-xs font-black px-2 py-0.5 rounded ${data.grade.includes('A') ? 'bg-emerald-100 text-emerald-800' : (data.grade.includes('B') ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700')}">${data.grade}</span>
                </div>
                <p class="text-[11px] text-gray-500 leading-tight">${data.summary}</p>
            </div>
        `;

        // ✅ DYNAMIC GAUGE RATIOS
        const maxCeil = Math.max(1, team.ceilingPts);
        const basePct = Math.round((team.basePts / maxCeil) * 100);
        const floorPct = Math.round((team.floorPts / maxCeil) * 100);

        const html = `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                <!-- Left Column: Grade & Dynamic Forecast -->
                <div class="lg:col-span-1 space-y-6">
                    <div class="${a.bg} p-6 rounded-2xl shadow-sm border text-center flex flex-col items-center justify-center">
                        <span class="text-[10px] uppercase font-extrabold tracking-widest text-gray-500 mb-1">Final Draft Grade</span>
                        <span class="text-6xl font-black ${a.color} drop-shadow-sm">${a.grade}</span>
                        <span class="text-xs font-bold text-gray-700 mt-2 bg-white/70 px-3 py-1 rounded-full border border-gray-200/70">Projected: #${team.projectedRank} of ${this.sortedTeams.length}</span>
                    </div>

                    <!-- 3-Tier Forecast Gauge (Dynamically Sized) -->
                    <div class="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 text-white">
                        <h4 class="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 mb-4 text-center">3-Tier Range of Outcomes</h4>
                        
                        <div class="space-y-4">
                            <div>
                                <div class="flex justify-between text-xs font-bold mb-1">
                                    <span class="text-emerald-400">Ceiling Scenario</span>
                                    <span>${team.ceilingPts.toFixed(1)} pts</span>
                                </div>
                                <div class="w-full bg-slate-800 rounded-full h-2">
                                    <div class="bg-emerald-500 h-2 rounded-full" style="width: 100%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between text-xs font-bold mb-1">
                                    <span class="text-indigo-300">Median Expectation</span>
                                    <span>${team.basePts.toFixed(1)} pts</span>
                                </div>
                                <div class="w-full bg-slate-800 rounded-full h-2">
                                    <div class="bg-indigo-500 h-2 rounded-full" style="width: ${basePct}%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between text-xs font-bold mb-1">
                                    <span class="text-rose-400">Injury Floor</span>
                                    <span>${team.floorPts.toFixed(1)} pts</span>
                                </div>
                                <div class="w-full bg-slate-800 rounded-full h-2">
                                    <div class="bg-rose-500 h-2 rounded-full" style="width: ${floorPct}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Narrative, Strategy & Highlights -->
                <div class="lg:col-span-3 space-y-6">
                    <!-- Executive Summary -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 class="text-lg font-extrabold text-gray-900 mb-2.5 flex items-center gap-2">
                            <span class="w-7 h-7 bg-indigo-100 text-indigo-700 flex items-center justify-center rounded-lg text-sm">📝</span> 
                            Draft Recap & Structural Breakdown
                        </h3>
                        <p class="text-gray-700 leading-relaxed text-xs sm:text-sm">${a.narrative}</p>
                    </div>

                    <!-- Positional Unit Graders -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        ${unitBoxHTML('Quarterbacks', u.qb, '🎯')}
                        ${unitBoxHTML('Backfield', u.rb, '🏃')}
                        ${unitBoxHTML('Receivers', u.wr, '👐')}
                        ${unitBoxHTML('Tight Ends', u.te, '🛡️')}
                    </div>

                    <!-- Tactical Cards: Streaming & Playoff Outlook -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="bg-indigo-50/70 border border-indigo-200 p-4 rounded-xl">
                            <h4 class="text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <span>🔄</span> ${s.strategyTitle}
                            </h4>
                            <p class="text-xs text-indigo-950 leading-relaxed mb-2">${s.strategyDesc}</p>
                            <div class="text-[11px] text-indigo-900 border-t border-indigo-200/60 pt-2">${s.byeRisk}</div>
                        </div>

                        <div class="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                            <h4 class="text-xs font-extrabold text-emerald-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <span>🏆</span> Championship Playoff Path (Wks 15–17)
                            </h4>
                            <p class="text-xs text-emerald-950 leading-relaxed mb-2">${p.verdict}</p>
                            <div class="text-[11px] text-emerald-900 border-t border-emerald-200/60 pt-2">Simulated strength against playoff matchups based on team SOS ratings.</div>
                        </div>
                    </div>

                    <!-- Season X-Factor -->
                    ${a.xFactor ? `
                    <div class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-xl border border-indigo-800/60 shadow-sm flex items-start gap-3">
                        <span class="text-2xl">⚡</span>
                        <div>
                            <h4 class="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-1">Season-Defining X-Factor: ${a.xFactor.player.Player}</h4>
                            <p class="text-xs text-slate-200 leading-relaxed">${a.xFactor.question}</p>
                        </div>
                    </div>` : ''}

                    <!-- Highlight Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        ${playerCardHTML(a.bestValue, 'Best Value / Steal', 'bg-emerald-500', '🔥')}
                        ${playerCardHTML(a.topSleeper, 'Top Stash / Sleeper', 'bg-amber-500', '💎')}
                        ${playerCardHTML(a.worstReach, 'Biggest Reach', 'bg-rose-500', '⚠️')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
};
