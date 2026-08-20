window.DraftRecap = {
    teamData: {},
    sortedTeams: [],

    generateRecaps() {
        this.teamData = {};
        this.sortedTeams = [];

        const startW = State.settings.startWeek || 1;
        const endW = State.settings.endWeek || 17;
        const numTeams = State.settings.numTeams || 12;

        // 1. Calculate Multi-Tier Standings & Total Points
        let rawTeams = Object.values(State.teamsById).map(team => {
            let basePts = 0, floorPts = 0, ceilingPts = 0;
            let totalProj = 0;
            let byeCollisions = {};

            team.roster.forEach(p => {
                totalProj += (p.ProjPts || 0);
                if (p.byeWeek && p.byeWeek !== 'N/A') {
                    byeCollisions[p.byeWeek] = (byeCollisions[p.byeWeek] || 0) + 1;
                }
            });

            for (let w = startW; w <= endW; w++) {
                basePts += State.calculateOptimalWeeklyScore(team.roster, w);
            }

            // Injury / Worst-Case Floor Simulation
            let floorRoster = team.roster.map(p => {
                let variance = p.boomBust && p.boomBust.bust ? (p.boomBust.bust / 100) : 0.25;
                let mapped = { ...p, weeklyProjections: {} };
                for (let week = 1; week <= 18; week++) {
                    let baseProj = p.weeklyProjections?.[`W${week}`] || 0;
                    mapped.weeklyProjections[`W${week}`] = baseProj * (1 - (variance * 0.65));
                }
                return mapped;
            });

            // TD Luck / Max-Efficiency Ceiling Simulation
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
                ...team, basePts, floorPts, ceilingPts, totalProj,
                benchPts: Math.max(0, totalProj - basePts),
                byeCollisions
            };
        });

        // 2. Pre-Compute League Averages for True Bell-Curve Grading
        let leagueTotals = rawTeams.reduce((sums, t) => {
            sums.basePts += t.basePts;
            sums.benchPts += t.benchPts;
            sums.floorPts += t.floorPts;
            sums.ceilingPts += t.ceilingPts;
            return sums;
        }, { basePts: 0, benchPts: 0, floorPts: 0, ceilingPts: 0 });

        const avgLeagueBase = leagueTotals.basePts / numTeams;
        const avgLeagueBench = leagueTotals.benchPts / numTeams;
        const avgLeagueFloorRatio = leagueTotals.floorPts / leagueTotals.ceilingPts;

        // Calculate Average Positional Unit Strength across the league
        const posSlots = { 
            QB: State.settings.roster.QB?.max || 1, 
            RB: State.settings.roster.RB?.max || 2, 
            WR: State.settings.roster.WR?.max || 2, 
            TE: State.settings.roster.TE?.max || 1 
        };

        const unitAvgs = { QB: 0, RB: 0, WR: 0, TE: 0 };
        rawTeams.forEach(t => {
            ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
                let sorted = t.roster.filter(p => p.Pos === pos).sort((a,b) => (b.ProjPts||0) - (a.ProjPts||0));
                let starters = sorted.slice(0, posSlots[pos]).reduce((s, p) => s + (p.ProjPts || 0), 0);
                let depth = sorted.slice(posSlots[pos]).reduce((s, p) => s + (p.ProjPts || 0), 0);
                unitAvgs[pos] += (starters * 0.75) + (depth * 0.25);
            });
        });
        Object.keys(unitAvgs).forEach(pos => unitAvgs[pos] /= numTeams);

        this.sortedTeams = rawTeams.sort((a, b) => b.basePts - a.basePts);

        // 3. Comprehensive Roster Audit & Grading
        this.sortedTeams.forEach((team, index) => {
            team.projectedRank = index + 1;

            let bestValue = null, worstReach = null, topSleeper = null;
            let maxSteal = 0, worstReachDiff = 0, maxStash = -999;
            let weightedAdpDelta = 0;

            team.roster.forEach(p => {
                let pickNum = p.draftPickNum || 1;
                let roundDrafted = Math.floor((pickNum - 1) / numTeams) + 1;
                let isKickerOrDST = ['PK', 'DST'].includes(p.Pos);

                if (p.adp) {
                    let diff = pickNum - p.adp;
                    let weight = isKickerOrDST ? 0.05 : Math.max(0.1, 1 - (roundDrafted * 0.05));
                    weightedAdpDelta += (diff * weight);

                    if (diff > maxSteal && !isKickerOrDST) {
                        maxSteal = diff;
                        bestValue = p;
                    }
                    if (diff < worstReachDiff && !isKickerOrDST && roundDrafted <= 10) {
                        worstReachDiff = diff;
                        worstReach = p;
                    }
                }

                let pUpside = p.upsideScore || 0;
                if (roundDrafted >= 8 && pUpside > 10 && pUpside > maxStash && p._cleanName !== worstReach?._cleanName && !isKickerOrDST) {
                    maxStash = pUpside;
                    topSleeper = p;
                }
            });

            // ⚡ NUANCED BELL-CURVE GRADING ENGINE ⚡
            let score = 72; // Baseline: The perfectly average team gets a C+

            // A. Starter Strength Edge (Max +/- 16 points)
            let starterEdge = ((team.basePts - avgLeagueBase) / avgLeagueBase) * 100;
            score += Math.max(-16, Math.min(16, starterEdge * 1.5));

            // B. Bench/Depth Edge (Max +/- 7 points)
            let benchEdge = ((team.benchPts - avgLeagueBench) / avgLeagueBench) * 100;
            score += Math.max(-7, Math.min(7, benchEdge * 0.25));

            // C. Value/ADP Edge (Max +/- 6 points)
            score += Math.max(-6, Math.min(6, weightedAdpDelta * 0.12));

            // D. Risk/Volatility Penalty (Max +/- 4 points)
            let teamFloorRatio = team.floorPts / Math.max(1, team.ceilingPts);
            let riskDiff = (teamFloorRatio - avgLeagueFloorRatio) * 100;
            score += Math.max(-4, Math.min(3, riskDiff * 0.5));

            // E. Positional Requirement Penalties
            const coreNeeds = { QB: 1, RB: 2, WR: 2, TE: 1 };
            Object.keys(coreNeeds).forEach(pos => {
                let req = State.settings.roster[pos]?.max || coreNeeds[pos];
                if ((team.counts[pos] || 0) < req) score -= 6.0;
            });
            if ((team.counts['PK'] || 0) < (State.settings.roster['PK']?.max || 1)) score -= 1.5;
            if ((team.counts['DST'] || 0) < (State.settings.roster['DST']?.max || 1)) score -= 1.5;

            // F. Grade Assignment
            score = Math.max(0, Math.min(100, score));
            let grade = 'F'; let color = 'text-gray-500'; let bg = 'bg-gray-100';
            if (score >= 93) { grade = 'A+'; color = 'text-emerald-600'; bg = 'bg-emerald-50 border-emerald-200'; }
            else if (score >= 89) { grade = 'A'; color = 'text-emerald-500'; bg = 'bg-emerald-50 border-emerald-200'; }
            else if (score >= 85) { grade = 'A-'; color = 'text-emerald-400'; bg = 'bg-emerald-50 border-emerald-200'; }
            else if (score >= 82) { grade = 'B+'; color = 'text-indigo-600'; bg = 'bg-indigo-50 border-indigo-200'; }
            else if (score >= 79) { grade = 'B'; color = 'text-indigo-500'; bg = 'bg-indigo-50 border-indigo-200'; }
            else if (score >= 76) { grade = 'B-'; color = 'text-indigo-400'; bg = 'bg-indigo-50 border-indigo-200'; }
            else if (score >= 73) { grade = 'C+'; color = 'text-amber-600'; bg = 'bg-amber-50 border-amber-200'; }
            else if (score >= 70) { grade = 'C'; color = 'text-amber-500'; bg = 'bg-amber-50 border-amber-200'; }
            else if (score >= 66) { grade = 'C-'; color = 'text-amber-400'; bg = 'bg-amber-50 border-amber-200'; }
            else if (score >= 60) { grade = 'D'; color = 'text-rose-500'; bg = 'bg-rose-50 border-rose-200'; }
            else { grade = 'F'; color = 'text-rose-700'; bg = 'bg-rose-100 border-rose-300'; }

            // Unit Aggregation & Strategic Profiling
            let units = this.analyzeUnits(team, unitAvgs, posSlots);
            let streamingAnalysis = this.analyzeStreamingStrategy(team, posSlots);
            let playoffOutlook = this.analyzePlayoffs(team);
            let persona = this.identifyPersona(team, starterEdge, benchEdge, weightedAdpDelta, streamingAnalysis);
            let xFactor = this.identifyXFactor(team);

            team.analysis = {
                grade, color, bg, score, persona, starterEdge, benchEdge,
                bestValue, worstReach, topSleeper,
                units, streamingAnalysis, playoffOutlook, xFactor,
                narrative: this.buildNarrative(team, index + 1, units, persona)
            };

            this.teamData[team.id] = team;
        });

        this.renderDropdown();
    },

    formatPlayerProof(p) {
        if (!p) return '';
        let proofs = [];
        if (p.Pos === 'QB') {
            if (p.stats?.rushYds >= 300) proofs.push(`${p.stats.rushYds} rush yds`);
            if (p.stats?.passTd >= 26) proofs.push(`${p.stats.passTd} pass TDs`);
            if (p.p2s && p.p2s <= 16.0) proofs.push(`elite ${p.p2s.toFixed(1)}% P2S`);
        } else if (p.Pos === 'RB') {
            if (p.hvo && p.hvo >= 40) proofs.push(`${p.hvo} HVO`);
            if (p.targetShare && p.targetShare >= 10) proofs.push(`${p.targetShare}% tgts`);
        } else if (['WR', 'TE'].includes(p.Pos)) {
            if (p.wopr && p.wopr >= 0.50) proofs.push(`${p.wopr.toFixed(2)} WOPR`);
            if (p.targetShare && p.targetShare >= 18) proofs.push(`${p.targetShare}% tgts`);
            if (p._vacatedAirYards >= 600) proofs.push(`+${p._vacatedAirYards} vac air yds`);
        }
        return proofs.length > 0 ? ` <span class="text-indigo-600 font-bold">(${proofs.slice(0, 2).join(' • ')})</span>` : '';
    },

    identifyPersona(team, starterEdge, benchEdge, adpDelta, streaming) {
        let isPpr = State.scoring.ppr >= 0.5;
        let wrCount = team.roster.filter(p => p.Pos === 'WR').length;
        let rbCount = team.roster.filter(p => p.Pos === 'RB').length;

        if (starterEdge >= 8.0 && benchEdge <= -15.0) return { label: "Top-Heavy 'Stars & Scrubs'", icon: "⭐" };
        if (starterEdge <= 0 && benchEdge >= 15.0) return { label: "The Depth Hoarder", icon: "🛡️" };
        if (streaming.isStreamingQB && streaming.isStreamingTE) return { label: "Waiver Wire Warrior", icon: "⚔️" };
        if (adpDelta >= 35) return { label: "The Value Sniper", icon: "🎯" };
        if (isPpr && wrCount >= 6 && rbCount <= 4) return { label: "Zero-RB Tactician", icon: "📡" };
        if (rbCount >= 6 && wrCount <= 4) return { label: "Robust-RB Grinder", icon: "🚜" };
        if (starterEdge > 3 && benchEdge > 3) return { label: "The Complete Juggernaut", icon: "👑" };
        return { label: "Balanced Architect", icon: "⚖️" };
    },

    analyzeStreamingStrategy(team, posSlots) {
        let qbs = team.roster.filter(p => p.Pos === 'QB');
        let tes = team.roster.filter(p => p.Pos === 'TE');

        let isStreamingQB = qbs.length <= posSlots.QB;
        let isStreamingTE = tes.length <= posSlots.TE;

        let topStarters = [...team.roster]
            .sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0))
            .slice(0, (posSlots.QB + posSlots.RB + posSlots.WR + posSlots.TE + (State.settings.roster.Flex?.max || 1)));

        let byeCollisions = {};
        let maxByeCount = 0, maxByeWeek = null;

        topStarters.forEach(p => {
            if (p.byeWeek && p.byeWeek !== 'N/A') {
                byeCollisions[p.byeWeek] = (byeCollisions[p.byeWeek] || 0) + 1;
                if (byeCollisions[p.byeWeek] > maxByeCount) {
                    maxByeCount = byeCollisions[p.byeWeek];
                    maxByeWeek = p.byeWeek;
                }
            }
        });

        let strategyTitle = "", strategyDesc = "";

        if (isStreamingQB && isStreamingTE) {
            strategyTitle = "Dual Flex Maximizer (QB/TE Streamer)";
            strategyDesc = `Opted for a zero-backup QB/TE build. They are prioritizing max bench capacity for RB/WR lottery tickets and will lean on the waiver wire for bye weeks.`;
        } else if (isStreamingQB) {
            strategyTitle = "Single-QB Streaming Strategy";
            strategyDesc = `Drafted minimum required QBs, intending to stream waiver-wire matchups during Week ${qbs[0]?.byeWeek || 'their bye'}.`;
        } else if (isStreamingTE) {
            strategyTitle = "Single-TE Streaming Strategy";
            strategyDesc = `Anchored by ${tes[0]?.Player || 'Starter'}, choosing to stream waiver-wire TEs rather than wasting a bench stash.`;
        } else {
            strategyTitle = "Complete Insurance Depth";
            strategyDesc = `Drafted dedicated in-house backups across QB and TE, prioritizing complete waiver-wire independence at the cost of skill depth.`;
        }

        let byeRisk = maxByeCount >= 4 
            ? `⚠️ <strong>Punt Week Warning:</strong> Week ${maxByeWeek} features <strong>${maxByeCount} key starters on bye</strong>, forcing heavy waiver churn or an intentional punt.`
            : `✅ <strong>Smooth Bye Distribution:</strong> Peak starter bye-week collision is ${maxByeCount} player(s) (${maxByeWeek ? 'Week ' + maxByeWeek : 'No conflicts'}), ensuring safe weekly continuity.`;

        return { isStreamingQB, isStreamingTE, strategyTitle, strategyDesc, byeRisk };
    },

    analyzePlayoffs(team) {
        let coreStarters = [...team.roster]
            .filter(p => !['PK', 'DST'].includes(p.Pos))
            .sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0))
            .slice(0, 7);

        let avgPlayoffStars = coreStarters.length > 0 
            ? coreStarters.reduce((sum, p) => sum + (p.playoffSOS || p.avgStars || 3.0), 0) / coreStarters.length 
            : 3.0;

        let verdict = "";
        if (avgPlayoffStars >= 3.3) {
            verdict = `🔥 <strong>Championship Schedule:</strong> Core starters enjoy a lush <strong>⭐${avgPlayoffStars.toFixed(2)}/5.0 Playoff SOS</strong> during Weeks 15–17.`;
        } else if (avgPlayoffStars <= 2.7) {
            verdict = `⚠️ <strong>Brutal Playoff Slate:</strong> Faces a rigid <strong>⭐${avgPlayoffStars.toFixed(2)}/5.0 Playoff SOS</strong> during the fantasy championship rounds.`;
        } else {
            verdict = `⚖️ <strong>Neutral Playoff Schedule:</strong> Balanced <strong>⭐${avgPlayoffStars.toFixed(2)}/5.0 Playoff SOS</strong> across Weeks 15–17.`;
        }

        return { avgPlayoffStars, verdict };
    },

    analyzeUnits(team, unitAvgs, posSlots) {
        const buildUnitGrade = (pos, icon) => {
            let sorted = team.roster.filter(p => p.Pos === pos).sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0));
            let starters = sorted.slice(0, posSlots[pos]);
            let depth = sorted.slice(posSlots[pos]);

            let starterPts = starters.reduce((sum, p) => sum + (p.ProjPts || 0), 0);
            let depthPts = depth.reduce((sum, p) => sum + (p.ProjPts || 0), 0);
            
            // Starter production is worth 75% of the unit's strength, depth is 25%
            let unitScore = (starterPts * 0.75) + (depthPts * 0.25);
            let leagueAvg = unitAvgs[pos] || 1;
            let ratio = unitScore / leagueAvg;

            let grade = 'C', note = "Average Unit";
            if (ratio >= 1.25) grade = 'A+';
            else if (ratio >= 1.12) grade = 'A';
            else if (ratio >= 1.05) grade = 'B+';
            else if (ratio >= 0.95) grade = 'C';
            else if (ratio >= 0.85) grade = 'D';
            else grade = 'F';

            // Nuance Strings
            if (starterPts / (leagueAvg * 0.75) >= 1.15 && depthPts === 0) note = "Elite Starters, No Depth";
            else if (starterPts / (leagueAvg * 0.75) <= 0.85 && depthPts / (leagueAvg * 0.25) >= 1.3) note = "Deep, but Lacks an Alpha";
            else if (ratio >= 1.15) note = "Dominant Position Group";
            else if (ratio <= 0.85) note = "Severe Positional Weakness";

            let lead = starters[0] ? `${starters[0].Player}${this.formatPlayerProof(starters[0])}` : 'None';
            let summary = '';

            if (pos === 'RB') summary = `${starters.reduce((s, p) => s + (p.hvo||0), 0)} Starter HVO • ${note}`;
            if (pos === 'WR') summary = `${starters.reduce((s, p) => s + (p.stats?.targets||0), 0)} Starter Tgts • ${note}`;
            if (pos === 'QB') summary = starters[0] ? `${starters[0].stats?.passYds || 0} Pass Yds • ${note}` : note;
            if (pos === 'TE') summary = starters[0] ? `${starters[0].stats?.targets || 0} Targets • ${note}` : note;

            return { grade, summary, lead };
        };

        return {
            qb: buildUnitGrade('QB', '🎯'),
            rb: buildUnitGrade('RB', '🏃'),
            wr: buildUnitGrade('WR', '👐'),
            te: buildUnitGrade('TE', '🛡️')
        };
    },

    identifyXFactor(team) {
        let earlyCore = team.roster.filter(p => (p.draftPickNum || 99) <= (State.settings.numTeams || 12) * 8);
        if (earlyCore.length === 0) earlyCore = team.roster;
        
        let xPlayer = [...earlyCore].sort((a, b) => (b.upsideScore || 0) - (a.upsideScore || 0))[0];
        if (!xPlayer) return null;

        let question = "";
        if (xPlayer.Pos === 'RB') {
            question = `If ${xPlayer.Player} sustains his ${xPlayer.hvo || 40}+ High-Value Opportunities and avoids backfield vulturing, this roster has a top-3 league ceiling.`;
        } else if (['WR', 'TE'].includes(xPlayer.Pos)) {
            question = `Everything hinges on ${xPlayer.Player}'s target conversion. If he commands his projected ${xPlayer.targetShare || 20}% target share (${xPlayer.aDOT || 10.0} aDOT), he will produce elite spike weeks.`;
        } else {
            question = `The ceiling of this team relies directly on ${xPlayer.Player}'s ecosystem and dual-threat equity (${xPlayer.stats?.rushYds || 0} proj rush yds).`;
        }

        return { player: xPlayer, question };
    },

    buildNarrative(team, rank, units, persona) {
        let r1 = team.roster[0], r2 = team.roster[1];
        if (!r1 || !r2) return "Draft roster incomplete.";
        let seed = (team.name.length + rank) % 4;

        let intros = [
            `The <strong>${team.name}</strong> exited the draft room projected for <strong>#${rank} overall</strong>. Earning the title of <strong>${persona.label} ${persona.icon}</strong>, they established an uncompromising identity early, locking down Round 1 with <strong>${r1.Player}</strong>${this.formatPlayerProof(r1)}.`,
            `Finishing with the <strong>#${rank} projected standing</strong>, the <strong>${team.name}</strong> executed a calculated blueprint as a true <strong>${persona.label} ${persona.icon}</strong>. Opening with <strong>${r1.Player}</strong> at Pick #${r1.draftPickNum || 1} set the tone for an opportunity-rich roster.`,
            `Projected for <strong>#${rank} overall</strong>, the <strong>${team.name}</strong> built a high-leverage lineup fitting of a <strong>${persona.label} ${persona.icon}</strong>. Their 1-2 punch of <strong>${r1.Player}</strong> and <strong>${r2.Player}</strong> provides immediate separation.`,
            `The <strong>${team.name}</strong> put on a masterclass in roster balance, emerging with the <strong>#${rank} projected seed</strong>. Anchored by the elite profile of <strong>${r1.Player}</strong>, this lineup embodies the <strong>${persona.label} ${persona.icon}</strong> strategy.`
        ];
        return `${intros[seed]} Their receiving corps earned a <strong>${units.wr.grade}</strong> grade, led by ${units.wr.lead}. The ground attack posted a <strong>${units.rb.grade}</strong>, anchored by ${units.rb.lead}.`;
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

        const playerCardHTML = (pl, label, colorCls, icon) => {
            if (!pl) return `<div class="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-xs text-gray-400 italic">No qualifying player found.</div>`;
            let pickNum = pl.draftPickNum || 1;
            let round = Math.floor((pickNum - 1) / numTeams) + 1;
            let pick = ((pickNum - 1) % numTeams) + 1;
            let diff = pl.adp ? (pl.adp - pickNum) : 0;
            let diffStr = diff > 0 ? `<span class="text-emerald-600 font-bold">+${diff.toFixed(0)} Value</span>` : `<span class="text-rose-600 font-bold">${Math.abs(diff).toFixed(0)} Reach</span>`;
            if (label === 'Top Stash / Sleeper') diffStr = `<span class="text-amber-600 font-bold">Upside: ${(pl.upsideScore || 0).toFixed(0)}</span>`;

            let statSummary = '';
            if (pl.stats) {
                if (pl.Pos === 'QB') statSummary = `${pl.stats.passYds || 0} Yds • ${pl.stats.passTd || 0} TD`;
                else if (pl.Pos === 'DST') statSummary = `${pl.stats.sack || 0} Sacks • ${(pl.stats.defInt || 0) + (pl.stats.defFum || 0)} TO`;
                else if (pl.Pos === 'PK') statSummary = `${pl.stats.fgTotal || 0} FGM • ${pl.stats.xp || 0} PAT`;
                else statSummary = `${((pl.stats.rushYds || 0) + (pl.stats.recYds || 0)).toLocaleString()} Yds • ${(pl.stats.rushTd || 0) + (pl.stats.recTd || 0)} TD`;
            }

            return `
            <div class="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer" onclick="UI.showPlayerCard('${pl._cleanName}')">
                <div class="absolute top-0 left-0 w-1.5 h-full ${colorCls}"></div>
                <div class="flex justify-between items-start mb-1.5">
                    <span class="text-[10px] uppercase font-extrabold text-gray-500 tracking-wider flex items-center gap-1">${icon} ${label}</span>
                    <span class="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">${pl.Pos} • ${pl.Team}</span>
                </div>
                <h4 class="font-extrabold text-gray-900 leading-tight text-base">${pl.Player}</h4>
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

        const maxCeil = Math.max(1, team.ceilingPts);
        const basePct = Math.round((team.basePts / maxCeil) * 100);
        const floorPct = Math.round((team.floorPts / maxCeil) * 100);

        const html = `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <!-- Left Column: Grade & Forecast -->
                <div class="lg:col-span-1 space-y-6">
                    <div class="${a.bg} p-6 rounded-2xl shadow-sm border text-center flex flex-col items-center justify-center relative overflow-hidden">
                        <span class="text-[10px] uppercase font-extrabold tracking-widest text-gray-500 mb-1">Final Draft Grade</span>
                        <span class="text-6xl font-black ${a.color} drop-shadow-sm">${a.grade}</span>
                        <span class="text-xs font-bold text-gray-700 mt-2 bg-white/70 px-3 py-1 rounded-full border border-gray-200/70">Projected: #${team.projectedRank} of ${this.sortedTeams.length}</span>
                        <div class="mt-4 pt-3 border-t border-black/5 w-full text-center">
                            <span class="text-[10px] uppercase font-bold text-gray-400 block mb-1">Team Identity</span>
                            <span class="text-sm font-extrabold ${a.color}">${a.persona.icon} ${a.persona.label}</span>
                        </div>
                    </div>

                    <!-- 3-Tier Forecast Gauge -->
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
                    <!-- Starter vs Bench Strength Grid -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                            <div>
                                <span class="text-[10px] font-extrabold uppercase text-slate-500 block mb-0.5">Starting Lineup Edge</span>
                                <span class="text-sm font-bold ${a.starterEdge >= 0 ? 'text-emerald-600' : 'text-rose-500'}">
                                    ${a.starterEdge > 0 ? '+' : ''}${a.starterEdge.toFixed(1)}% vs Average
                                </span>
                            </div>
                            <span class="text-2xl opacity-50">⚔️</span>
                        </div>
                        <div class="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                            <div>
                                <span class="text-[10px] font-extrabold uppercase text-slate-500 block mb-0.5">Bench Depth Edge</span>
                                <span class="text-sm font-bold ${a.benchEdge >= 0 ? 'text-emerald-600' : 'text-rose-500'}">
                                    ${a.benchEdge > 0 ? '+' : ''}${a.benchEdge.toFixed(1)}% vs Average
                                </span>
                            </div>
                            <span class="text-2xl opacity-50">🛡️</span>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 class="text-lg font-extrabold text-gray-900 mb-2.5 flex items-center gap-2">
                            <span class="w-7 h-7 bg-indigo-100 text-indigo-700 flex items-center justify-center rounded-lg text-sm">📝</span> 
                            Draft Recap & Structural Breakdown
                        </h3>
                        <p class="text-gray-700 leading-relaxed text-xs sm:text-sm">${a.narrative}</p>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        ${unitBoxHTML('Quarterbacks', u.qb, '🎯')}
                        ${unitBoxHTML('Backfield', u.rb, '🏃')}
                        ${unitBoxHTML('Receivers', u.wr, '👐')}
                        ${unitBoxHTML('Tight Ends', u.te, '🛡️')}
                    </div>

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

                    ${a.xFactor ? `
                    <div class="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-xl border border-indigo-800/60 shadow-sm flex items-start gap-3">
                        <span class="text-2xl">⚡</span>
                        <div>
                            <h4 class="text-xs font-extrabold text-amber-300 uppercase tracking-wider mb-1">Season-Defining X-Factor: ${a.xFactor.player.Player}</h4>
                            <p class="text-xs text-slate-200 leading-relaxed">${a.xFactor.question}</p>
                        </div>
                    </div>` : ''}

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
