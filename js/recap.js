window.DraftRecap = {
    teamData: {},
    sortedTeams: [],
    leagueAwards: {},
    activeSubTab: 'overview', // 'overview' | 'starters' | 'depth' | 'awards'

    generateRecaps() {
        this.teamData = {};
        this.sortedTeams = [];
        this.leagueAwards = {};

        const startW = State.settings.startWeek || 1;
        const endW = State.settings.endWeek || 17;
        const numTeams = State.settings.numTeams || 12;

        // 1. Calculate Standings & 3-Tier Outcomes
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

            let floorRoster = team.roster.map(p => {
                let variance = p.boomBust && p.boomBust.bust ? (p.boomBust.bust / 100) : 0.25;
                let mapped = { ...p, weeklyProjections: {} };
                for (let week = 1; week <= 18; week++) {
                    let baseProj = p.weeklyProjections?.[`W${week}`] || 0;
                    mapped.weeklyProjections[`W${week}`] = baseProj * (1 - (variance * 0.65));
                }
                return mapped;
            });

            let ceilRoster = team.roster.map(p => {
                let maxMultiplier = 1.25;
                if (p.upsideScore > 0 && p.AdvVBD > 0) {
                    let ratio = p.upsideScore / p.AdvVBD;
                    if (ratio > 1.0) maxMultiplier = Math.min(1.45, ratio);
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

        // 2. Pre-Compute League Averages
        let leagueTotals = rawTeams.reduce((sums, t) => {
            sums.basePts += t.basePts;
            sums.benchPts += t.benchPts;
            sums.floorPts += t.floorPts;
            sums.ceilingPts += t.ceilingPts;
            return sums;
        }, { basePts: 0, benchPts: 0, floorPts: 0, ceilingPts: 0 });

        const avgLeagueBase = leagueTotals.basePts / numTeams;
        const avgLeagueBench = leagueTotals.benchPts / numTeams;
        const avgLeagueFloorRatio = leagueTotals.floorPts / Math.max(1, leagueTotals.ceilingPts);

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
                
                let starterWeight = ['QB', 'TE'].includes(pos) && posSlots[pos] === 1 ? 0.88 : 0.75;
                let depthWeight = 1.0 - starterWeight;
                unitAvgs[pos] += (starters * starterWeight) + (depth * depthWeight);
            });
        });
        Object.keys(unitAvgs).forEach(pos => unitAvgs[pos] /= numTeams);

        // 🎲 3. FAST MONTE CARLO SEASON SIMULATION (1,000 Iterations)
        this.runMonteCarloSimulations(rawTeams);

        this.sortedTeams = rawTeams.sort((a, b) => b.basePts - a.basePts);

        // 4. Score & Grade Every Team
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
                    let adpDiff = p.adp - pickNum; // Positive = Value, Negative = Reach
                    let weight = isKickerOrDST ? 0.05 : Math.max(0.15, 1 - (roundDrafted * 0.05));
                    weightedAdpDelta += (adpDiff * weight);

                    if (adpDiff > maxSteal && !isKickerOrDST && roundDrafted <= 14) {
                        maxSteal = adpDiff;
                        bestValue = p;
                    }
                    if (adpDiff < worstReachDiff && !isKickerOrDST && roundDrafted <= 10) {
                        worstReachDiff = adpDiff;
                        worstReach = p;
                    }
                }

                let pUpside = p.upsideScore || 0;
                if (roundDrafted >= 8 && pUpside > 10 && pUpside > maxStash && p._cleanName !== worstReach?._cleanName && !isKickerOrDST) {
                    maxStash = pUpside;
                    topSleeper = p;
                }
            });

            // Bell-Curve Scoring Algorithm
            let score = 72;
            let starterEdge = ((team.basePts - avgLeagueBase) / avgLeagueBase) * 100;
            score += Math.max(-16, Math.min(16, starterEdge * 1.5));

            let benchEdge = ((team.benchPts - avgLeagueBench) / (avgLeagueBench || 1)) * 100;
            score += Math.max(-7, Math.min(7, benchEdge * 0.25));

            score += Math.max(-6, Math.min(6, weightedAdpDelta * 0.12));

            let teamFloorRatio = team.floorPts / Math.max(1, team.ceilingPts);
            let riskDiff = (teamFloorRatio - avgLeagueFloorRatio) * 100;
            score += Math.max(-4, Math.min(3, riskDiff * 0.5));

            const coreNeeds = { QB: 1, RB: 2, WR: 2, TE: 1 };
            Object.keys(coreNeeds).forEach(pos => {
                let req = State.settings.roster[pos]?.max || coreNeeds[pos];
                if ((team.counts[pos] || 0) < req) score -= 6.0;
            });
            if ((team.counts['PK'] || 0) < (State.settings.roster['PK']?.max || 1)) score -= 1.5;
            if ((team.counts['DST'] || 0) < (State.settings.roster['DST']?.max || 1)) score -= 1.5;

            score = Math.max(0, Math.min(100, score));
            let grade = 'F', color = 'text-gray-500', bg = 'bg-gray-100';
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

            let units = this.analyzeUnits(team, unitAvgs, posSlots);
            let streamingAnalysis = this.analyzeStreamingStrategy(team, posSlots);
            let playoffOutlook = this.analyzePlayoffs(team);
            let persona = this.identifyPersona(team, starterEdge, benchEdge, weightedAdpDelta, streamingAnalysis);
            let xFactor = this.identifyXFactor(team);
            let lineup = this.getProjectedStarters(team);

            team.analysis = {
                grade, color, bg, score, persona, starterEdge, benchEdge,
                bestValue, worstReach, topSleeper, lineup,
                units, streamingAnalysis, playoffOutlook, xFactor
            };
            team.analysis.narrative = this.buildNarrative(team, index + 1, units, persona);

            this.teamData[team.id] = team;
        });

        // 🏆 5. COMPUTE LEAGUE-WIDE SUPERLATIVES & TROPHIES
        this.computeLeagueSuperlatives();

        this.renderDropdown();
    },

    // 🎲 1,000-ITERATION MONTE CARLO SEASON SIMULATOR
    runMonteCarloSimulations(teams) {
        const totalSims = 1000;
        const weeks = 14; // Regular season weeks
        const playoffSpots = 4; // Top 4 make playoffs

        const simResults = teams.map(t => ({
            id: t.id,
            meanWeekly: t.basePts / 17,
            stdDev: Math.max(8.0, (t.ceilingPts - t.floorPts) / 38),
            winsTotal: 0,
            playoffTotal: 0,
            titleTotal: 0
        }));

        for (let sim = 0; sim < totalSims; sim++) {
            let weeklyScores = simResults.map(r => {
                let scores = [];
                for (let w = 0; w < weeks; w++) {
                    // Box-Muller normal distribution
                    let u = 0, v = 0;
                    while (u === 0) u = Math.random();
                    while (v === 0) v = Math.random();
                    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                    scores.push(Math.max(60, r.meanWeekly + (num * r.stdDev)));
                }
                return { id: r.id, scores, wins: 0, pts: 0 };
            });

            // Simulate round-robin matchups
            for (let w = 0; w < weeks; w++) {
                let shuffled = [...weeklyScores].sort(() => Math.random() - 0.5);
                for (let i = 0; i < shuffled.length; i += 2) {
                    let teamA = shuffled[i];
                    let teamB = shuffled[i + 1];
                    if (!teamB) continue;

                    teamA.pts += teamA.scores[w];
                    teamB.pts += teamB.scores[w];

                    if (teamA.scores[w] > teamB.scores[w]) teamA.wins++;
                    else teamB.wins++;
                }
            }

            weeklyScores.sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.pts - a.pts);

            // Record wins & playoff teams
            weeklyScores.forEach((teamRes, seed) => {
                let target = simResults.find(x => x.id === teamRes.id);
                target.winsTotal += teamRes.wins;
                if (seed < playoffSpots) target.playoffTotal++;
                if (seed === 0) target.titleTotal++; // Seed 1 champion proxy
            });
        }

        // Attach metrics to teams
        teams.forEach(team => {
            let res = simResults.find(x => x.id === team.id);
            let avgWins = (res.winsTotal / totalSims).toFixed(1);
            let avgLosses = (weeks - avgWins).toFixed(1);
            let playoffOdds = Math.round((res.playoffTotal / totalSims) * 100);
            let titleOdds = Math.round((res.titleTotal / totalSims) * 100);

            team.simRecord = `${Math.round(avgWins)}-${Math.round(avgLosses)}`;
            team.playoffOdds = playoffOdds;
            team.titleOdds = Math.max(1, titleOdds);
        });
    },

    // 🏆 AUDIT LEAGUE-WIDE SUPERLATIVES & TROPHIES
    computeLeagueSuperlatives() {
        let bestSteal = null, maxStealDiff = -999;
        let worstReach = null, maxReachDiff = 999;
        let chaosTeam = null, maxVariance = -999;
        let fortressTeam = null, maxFloorRatio = -999;
        let benchHoarder = null, maxBenchEdge = -999;
        let stackKing = null, maxStackPower = -999;

        Object.values(this.teamData).forEach(team => {
            const a = team.analysis;

            // 1. Steal of the Draft
            if (a.bestValue && a.bestValue.adp) {
                let diff = a.bestValue.adp - (a.bestValue.draftPickNum || 1);
                if (diff > maxStealDiff) {
                    maxStealDiff = diff;
                    bestSteal = { team: team.name, player: a.bestValue.Player, diff: Math.round(diff), pick: a.bestValue.draftPickNum };
                }
            }

            // 2. Biggest Reach
            if (a.worstReach && a.worstReach.adp) {
                let diff = (a.worstReach.draftPickNum || 1) - a.worstReach.adp;
                if (diff > maxReachDiff) {
                    maxReachDiff = diff;
                    worstReach = { team: team.name, player: a.worstReach.Player, diff: Math.round(diff), pick: a.worstReach.draftPickNum };
                }
            }

            // 3. Chaos Gremlin (Boom/Bust Ceiling)
            let variance = team.ceilingPts - team.floorPts;
            if (variance > maxVariance) {
                maxVariance = variance;
                chaosTeam = { team: team.name, ceiling: team.ceilingPts.toFixed(1), floor: team.floorPts.toFixed(1) };
            }

            // 4. Iron Fortress (Safest Floor)
            let floorRatio = team.floorPts / Math.max(1, team.ceilingPts);
            if (floorRatio > maxFloorRatio) {
                maxFloorRatio = floorRatio;
                fortressTeam = { team: team.name, floor: team.floorPts.toFixed(1) };
            }

            // 5. Bench Hoarder
            if (a.benchEdge > maxBenchEdge) {
                maxBenchEdge = a.benchEdge;
                benchHoarder = { team: team.name, edge: a.benchEdge.toFixed(1) };
            }

            // 6. Stacking King
            let qbs = team.roster.filter(p => p.Pos === 'QB');
            if (qbs.length > 0) {
                let qb = qbs[0];
                let teammates = team.roster.filter(p => p._cleanTeam === qb._cleanTeam && ['WR', 'TE'].includes(p.Pos));
                if (teammates.length > 0) {
                    let topPartner = teammates[0];
                    let stackPts = (qb.ProjPts || 0) + (topPartner.ProjPts || 0);
                    if (stackPts > maxStackPower) {
                        maxStackPower = stackPts;
                        stackKing = { team: team.name, qb: qb.Player, target: topPartner.Player, nflTeam: qb.Team };
                    }
                }
            }
        });

        this.leagueAwards = {
            bestSteal, worstReach, chaosTeam, fortressTeam, benchHoarder, stackKing
        };
    },

    // 📋 ONE-CLICK GROUP CHAT DIGEST EXPORTER
    copyLeagueSummary() {
        let text = `🏈 **DRAFT PRO: 2026 LEAGUE SEASON PREVIEW & POWER RANKINGS** 🏈\n\n`;
        text += `📊 **PROJECTED REGULAR SEASON STANDINGS**\n`;
        this.sortedTeams.forEach((t, i) => {
            text += `${i + 1}. **${t.name}** | Grade: **${t.analysis.grade}** | Proj: ${t.simRecord} (${t.playoffOdds}% Playoffs) | ${t.analysis.persona.icon} ${t.analysis.persona.label}\n`;
        });

        text += `\n🏆 **DRAFT ROOM SUPERLATIVES & AWARDS**\n`;
        if (this.leagueAwards.bestSteal) {
            text += `🔥 **Steal of the Draft:** ${this.leagueAwards.bestSteal.player} (Pick #${this.leagueAwards.bestSteal.pick}, +${this.leagueAwards.bestSteal.diff} value) ➔ *${this.leagueAwards.bestSteal.team}*\n`;
        }
        if (this.leagueAwards.worstReach) {
            text += `⚠️ **Biggest Head-Scratcher:** ${this.leagueAwards.worstReach.player} (Pick #${this.leagueAwards.worstReach.pick}, ${this.leagueAwards.worstReach.diff} picks early) ➔ *${this.leagueAwards.worstReach.team}*\n`;
        }
        if (this.leagueAwards.stackKing) {
            text += `⚡ **Correlation Kings:** ${this.leagueAwards.stackKing.qb} + ${this.leagueAwards.stackKing.target} (${this.leagueAwards.stackKing.nflTeam}) ➔ *${this.leagueAwards.stackKing.team}*\n`;
        }
        if (this.leagueAwards.chaosTeam) {
            text += `💣 **Chaos Gremlin (Max Ceiling):** ${this.leagueAwards.chaosTeam.team} (${this.leagueAwards.chaosTeam.ceiling} max pts)\n`;
        }
        if (this.leagueAwards.fortressTeam) {
            text += `🛡️ **Iron Fortress (Safest Floor):** ${this.leagueAwards.fortressTeam.team} (${this.leagueAwards.fortressTeam.floor} floor pts)\n`;
        }

        navigator.clipboard.writeText(text).then(() => {
            alert("📋 Copied full league draft recap & power rankings to your clipboard!");
        });
    },

    getProjectedStarters(team) {
        let roster = [...team.roster].sort((a, b) => (b.ProjPts || 0) - (a.ProjPts || 0));
        let r = State.settings.roster;
        let starters = [];
        let bench = [];
        let counts = { QB: 0, RB: 0, WR: 0, TE: 0, FlexRBWR: 0, Flex: 0, Superflex: 0, PK: 0, DST: 0 };

        roster.forEach(p => {
            let pos = p.Pos;
            let max = r[pos]?.max !== undefined ? r[pos].max : (['PK', 'DST'].includes(pos) ? 1 : 2);
            if (counts[pos] < max) {
                let slotLabel = max > 1 ? `${pos}${counts[pos] + 1}` : pos;
                starters.push({ ...p, displaySlot: slotLabel });
                counts[pos]++;
            } else {
                bench.push(p);
            }
        });

        let remainingBench = [];
        bench.forEach(p => {
            let pos = p.Pos;
            if (['RB', 'WR'].includes(pos) && counts['FlexRBWR'] < (r.FlexRBWR?.max || 0)) {
                starters.push({ ...p, displaySlot: 'FLEX (W/R)' });
                counts['FlexRBWR']++;
            } else if (['RB', 'WR', 'TE'].includes(pos) && counts['Flex'] < (r.Flex?.max || 0)) {
                starters.push({ ...p, displaySlot: 'FLEX' });
                counts['Flex']++;
            } else if (['QB', 'RB', 'WR', 'TE'].includes(pos) && counts['Superflex'] < (r.Superflex?.max || 0)) {
                starters.push({ ...p, displaySlot: 'SUPERFLEX' });
                counts['Superflex']++;
            } else {
                remainingBench.push(p);
            }
        });

        return { starters, bench: remainingBench };
    },

    formatPlayerProof(p) {
        if (!p) return '';
        let proofs = [];
        if (p.Pos === 'QB') {
            if (p.stats?.rushYds >= 300) proofs.push(`${p.stats.rushYds} rush yds`);
            if (p.stats?.passTd >= 26) proofs.push(`${p.stats.passTd} pass TDs`);
        } else if (p.Pos === 'RB') {
            if (p.hvo && p.hvo >= 40) proofs.push(`${p.hvo} HVO`);
            if (p.targetShare && p.targetShare >= 10) proofs.push(`${p.targetShare}% tgts`);
        } else if (['WR', 'TE'].includes(p.Pos)) {
            if (p.wopr && p.wopr >= 0.50) proofs.push(`${p.wopr.toFixed(2)} WOPR`);
            if (p.targetShare && p.targetShare >= 18) proofs.push(`${p.targetShare}% tgts`);
        }
        return proofs.length > 0 ? ` <span class="text-indigo-600 font-bold">(${proofs.slice(0, 2).join(' • ')})</span>` : '';
    },

    identifyPersona(team, starterEdge, benchEdge, adpDelta, streaming) {
        let isPpr = State.scoring.ppr >= 0.5;
        let wrCount = team.roster.filter(p => p.Pos === 'WR').length;
        let rbCount = team.roster.filter(p => p.Pos === 'RB').length;
        let r1Pos = team.roster[0]?.Pos;
        let r2Pos = team.roster[1]?.Pos;

        if (r1Pos === 'RB' && (r2Pos === 'RB' || rbCount >= 5)) return { label: "Robust-RB Grinder", icon: "🚜" };
        if (r1Pos === 'RB' && r2Pos !== 'RB') return { label: "Hero-RB Strategist", icon: "🦸" };
        if (r1Pos !== 'RB' && r2Pos !== 'RB' && isPpr && wrCount >= 6) return { label: "Zero-RB Tactician", icon: "📡" };

        if (starterEdge >= 6.0 && benchEdge <= -10.0) return { label: "Top-Heavy 'Stars & Scrubs'", icon: "⭐" };
        if (starterEdge <= 0 && benchEdge >= 12.0) return { label: "The Depth Hoarder", icon: "🛡️" };
        if (streaming.isStreamingQB && streaming.isStreamingTE) return { label: "Waiver Wire Warrior", icon: "⚔️" };
        if (adpDelta >= 35) return { label: "The Value Sniper", icon: "🎯" };
        if (starterEdge > 2.5 && benchEdge > 2.5) return { label: "The Complete Juggernaut", icon: "👑" };
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
        const buildUnitGrade = (pos) => {
            let sorted = team.roster.filter(p => p.Pos === pos).sort((a,b) => (b.ProjPts || 0) - (a.ProjPts || 0));
            let starters = sorted.slice(0, posSlots[pos]);
            let depth = sorted.slice(posSlots[pos]);

            let starterPts = starters.reduce((sum, p) => sum + (p.ProjPts || 0), 0);
            let depthPts = depth.reduce((sum, p) => sum + (p.ProjPts || 0), 0);
            
            let starterWeight = ['QB', 'TE'].includes(pos) && posSlots[pos] === 1 ? 0.88 : 0.75;
            let depthWeight = 1.0 - starterWeight;

            let unitScore = (starterPts * starterWeight) + (depthPts * depthWeight);
            let leagueAvg = unitAvgs[pos] || 1;
            let ratio = unitScore / leagueAvg;

            let grade = 'C', note = "Average Unit";
            if (ratio >= 1.20) grade = 'A+';
            else if (ratio >= 1.10) grade = 'A';
            else if (ratio >= 1.04) grade = 'B+';
            else if (ratio >= 0.96) grade = 'C+';
            else if (ratio >= 0.90) grade = 'C';
            else if (ratio >= 0.82) grade = 'D';
            else grade = 'F';

            if (starterPts / (leagueAvg * starterWeight) >= 1.10 && depthPts === 0) {
                note = (grade.includes('A') || grade.includes('B')) ? "High-End Starter (Zero Depth)" : "Solitary Starter";
            } else if (starterPts / (leagueAvg * starterWeight) <= 0.88 && depthPts / (leagueAvg * depthWeight) >= 1.2) {
                note = "Deep, but Lacks an Alpha";
            } else if (ratio >= 1.10) {
                note = "Dominant Position Group";
            } else if (ratio <= 0.82) {
                note = "Severe Positional Weakness";
            }

            let lead = starters[0] ? `${starters[0].Player}${this.formatPlayerProof(starters[0])}` : 'None';
            let summary = '';

            if (pos === 'RB') summary = `${starters.reduce((s, p) => s + (p.hvo||0), 0)} Starter HVO • ${note}`;
            if (pos === 'WR') summary = `${starters.reduce((s, p) => s + (p.stats?.targets||0), 0)} Starter Tgts • ${note}`;
            if (pos === 'QB') summary = starters[0] ? `${starters[0].stats?.passYds || 0} Pass Yds • ${note}` : note;
            if (pos === 'TE') summary = starters[0] ? `${starters[0].stats?.targets || 0} Targets • ${note}` : note;

            return { grade, summary, lead };
        };

        return {
            qb: buildUnitGrade('QB'),
            rb: buildUnitGrade('RB'),
            wr: buildUnitGrade('WR'),
            te: buildUnitGrade('TE')
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

    // =========================================================================
    // 🎙️ DYNAMIC MULTI-STORYLINE NARRATIVE & LEAGUE CHAT COLUMNIST ENGINE
    // =========================================================================
    buildNarrative(team, rank, units, persona) {
        const r1 = team.roster[0];
        const r2 = team.roster[1];
        const r3 = team.roster[2];
        if (!r1 || !r2) return "Draft roster incomplete.";

        const a = team.analysis || {};
        const numTeams = State.settings.numTeams || 12;
        const seed = (team.name.length + rank * 13 + (r1.draftPickNum || 1)) % 5;

        // 1. CATCHPHRASE HEADLINE GENERATOR
        let headline = "";
        if (rank === 1) headline = "🏆 THE TITLE FAVORITE JUGGERNAUT";
        else if (rank <= 3) headline = "👑 HEAVYWEIGHT CONTENDER";
        else if (persona.label.includes("Stars & Scrubs") || (a.starterEdge >= 5 && a.benchEdge <= -10)) headline = "💣 THE TICKING TIME BOMB (TOP HEAVY)";
        else if (persona.label.includes("Zero-RB")) headline = "📡 THE AIR-RAID PERIMETER REVOLUTION";
        else if (persona.label.includes("Robust-RB")) headline = "🚜 TRENCH WARFARE & GROUND HAMMERS";
        else if (persona.label.includes("Value Sniper")) headline = "🎯 THE DRAFT ROOM BANDIT";
        else if (persona.label.includes("Waiver Wire")) headline = "⚔️ THE FLEX STREAMING GAMBIT";
        else if (rank >= 10) headline = "🩹 LIVING ON A PRAYER & WAIVER WIRES";
        else headline = "⚖️ THE CALCULATED BLUEPRINT";

        // 2. OPENING 3-ROUND STRATEGY ANALYSIS
        let draftStartCommentary = "";
        const r1Pos = r1.Pos, r2Pos = r2.Pos, r3Pos = r3 ? r3.Pos : "";

        if (r1Pos === 'RB' && r2Pos === 'RB') {
            draftStartCommentary = `committed to an old-school, smash-mouth identity by spending back-to-back early capital on <strong>${r1.Player}</strong> and <strong>${r2.Player}</strong>, locking down workhorse rushing equity before the RB board evaporated.`;
        } else if (r1Pos === 'WR' && r2Pos === 'WR') {
            draftStartCommentary = `unleashed an aggressive aerial assault, anchoring their foundation with the elite receiving tandem of <strong>${r1.Player}</strong> and <strong>${r2.Player}</strong> to build an overwhelming weekly PPR ceiling.`;
        } else if (['TE', 'QB'].includes(r1Pos) || ['TE', 'QB'].includes(r2Pos)) {
            let unicorn = ['TE', 'QB'].includes(r1Pos) ? r1 : r2;
            let partner = unicorn === r1 ? r2 : r1;
            draftStartCommentary = `executed a high-stakes structural gambit, paying the premium for a positional unicorn in <strong>${unicorn.Player}</strong> (${unicorn.Pos}) alongside <strong>${partner.Player}</strong> (${partner.Pos}) to create an immediate weekly mismatch.`;
        } else if (r1Pos === 'RB' && r2Pos === 'WR') {
            draftStartCommentary = `executed the textbook Hero-RB blueprint, locking in <strong>${r1.Player}</strong> as an uncontested backfield bellcow before immediately pivoting to <strong>${r2.Player}</strong> to anchor their pass-catching corps.`;
        } else if (r1Pos === 'WR' && r2Pos === 'RB') {
            draftStartCommentary = `built around premier target share, securing alpha wideout <strong>${r1.Player}</strong> at the top of the board and reinforcing their ground game with <strong>${r2.Player}</strong>.`;
        } else {
            draftStartCommentary = `laid their core infrastructure with <strong>${r1.Player}</strong> and <strong>${r2.Player}</strong>.`;
        }

        // 3. SEED-BASED INTRO PARAGRAPH
        let openingParagraph = "";
        if (rank <= 3) {
            const contenderIntros = [
                `The <strong>${team.name}</strong> exited the draft room as the consensus <strong>#${rank} projected powerhouse</strong>. Embracing their identity as <strong>${persona.label} ${persona.icon}</strong>, they ${draftStartCommentary}`,
                `Putting on a clinic in draft capital efficiency, the <strong>${team.name}</strong> emerged with the <strong>#${rank} overall projected seed</strong>. They initiated their draft by ${draftStartCommentary}`,
                `Few rosters in the league boast more weekly starting firepower than the <strong>${team.name}</strong> (Rank <strong>#${rank} overall</strong>). Operating as a true <strong>${persona.label} ${persona.icon}</strong>, they established control early by ${draftStartCommentary}`
            ];
            openingParagraph = contenderIntros[seed % contenderIntros.length];
        } else if (rank <= 8) {
            const playoffIntros = [
                `Projected firmly in the postseason hunt at <strong>#${rank} overall</strong>, the <strong>${team.name}</strong> assembled a competitive lineup fitting of a <strong>${persona.label} ${persona.icon}</strong>. Their strategy began by ${draftStartCommentary}`,
                `The <strong>${team.name}</strong> navigated the draft board into a balanced <strong>#${rank} projected standing</strong>. They initiated their campaign by ${draftStartCommentary}`,
                `Securing the <strong>#${rank} projected seed</strong>, the <strong>${team.name}</strong> built a lineup with legitimate dark-horse upside. They laid their early foundation by ${draftStartCommentary}`
            ];
            openingParagraph = playoffIntros[seed % playoffIntros.length];
        } else {
            const underdogIntros = [
                `The <strong>${team.name}</strong> face an uphill climb after exiting the draft projected for <strong>#${rank} overall</strong>. Embracing the identity of a <strong>${persona.label} ${persona.icon}</strong>, their draft kicked off by ${draftStartCommentary}`,
                `Landing at the <strong>#${rank} projected seed</strong>, the <strong>${team.name}</strong> face major structural depth questions heading into Week 1. While they started their draft by ${draftStartCommentary}`,
                `Exiting the draft room at <strong>#${rank} of ${numTeams}</strong>, the <strong>${team.name}</strong> carry a volatile high-risk profile. They committed early by ${draftStartCommentary}`
            ];
            openingParagraph = underdogIntros[seed % underdogIntros.length];
        }

        // 4. POSITIONAL PRAISE & ROAST ENGINE (Unit Breakdown)
        const unitRanks = [
            { pos: 'Wide Receivers', key: 'wr', grade: units.wr.grade, summary: units.wr.summary, lead: units.wr.lead },
            { pos: 'Backfield', key: 'rb', grade: units.rb.grade, summary: units.rb.summary, lead: units.rb.lead },
            { pos: 'Quarterback room', key: 'qb', grade: units.qb.grade, summary: units.qb.summary, lead: units.qb.lead },
            { pos: 'Tight End spot', key: 'te', grade: units.te.grade, summary: units.te.summary, lead: units.te.lead }
        ];

        const gradeValues = { 'A+': 9, 'A': 8, 'A-': 7, 'B+': 6, 'B': 5, 'B-': 4, 'C+': 3, 'C': 2, 'C-': 1, 'D': 0, 'F': -1 };
        unitRanks.sort((x, y) => (gradeValues[y.grade] ?? 0) - (gradeValues[x.grade] ?? 0));

        const bestUnit = unitRanks[0];
        const worstUnit = unitRanks[unitRanks.length - 1];

        let unitAnalysis = "";
        // Praise best unit
        if (gradeValues[bestUnit.grade] >= 7) {
            unitAnalysis += `Their undeniable crown jewel is their <strong>${bestUnit.pos}</strong> (<span class="font-bold text-emerald-600">Grade: ${bestUnit.grade}</span>), an elite room anchored by ${bestUnit.lead}. `;
        } else if (gradeValues[bestUnit.grade] >= 5) {
            unitAnalysis += `Their most reliable group is their <strong>${bestUnit.pos}</strong> (${bestUnit.grade}), led by ${bestUnit.lead}. `;
        } else {
            unitAnalysis += `Their most functional starting unit is their <strong>${bestUnit.pos}</strong> (${bestUnit.grade}), headlined by ${bestUnit.lead}. `;
        }

        // Roast/Critique worst unit
        if (gradeValues[worstUnit.grade] <= 0) {
            unitAnalysis += `However, their roster contains a glaring Achilles' heel at <strong>${worstUnit.pos}</strong> (<span class="font-bold text-rose-600">Grade: ${worstUnit.grade}</span>), representing a severe positional liability that rivals will target.`;
        } else if (gradeValues[worstUnit.grade] <= 3) {
            unitAnalysis += `On the flip side, their <strong>${worstUnit.pos}</strong> (${worstUnit.grade}) lacks true alpha upside and could struggle during difficult weekly matchups.`;
        } else {
            unitAnalysis += `Impressively, they avoided any failing position rooms, maintaining balanced floor across every starting slot.`;
        }

        // 5. DRAFT ROOM MOVES (Steals, Reaches & Streaming Tactics)
        let draftMoves = [];
        if (a.bestValue && a.bestValue.adp) {
            let stealDiff = Math.round(a.bestValue.adp - (a.bestValue.draftPickNum || 1));
            if (stealDiff >= 18) {
                draftMoves.push(`<strong>Draft Room Bandit:</strong> Snagging <strong>${a.bestValue.Player}</strong> at Pick #${a.bestValue.draftPickNum} (ADP #${a.bestValue.adp.toFixed(0)}, <span class="text-emerald-600 font-bold">+${stealDiff} pick value</span>) was one of the sharpest value falls in the draft.`);
            }
        }
        if (a.worstReach && a.worstReach.adp) {
            let reachDiff = Math.round((a.worstReach.draftPickNum || 1) - a.worstReach.adp);
            if (reachDiff >= 18) {
                draftMoves.push(`<strong>Reaching for Need:</strong> Selecting <strong>${a.worstReach.Player}</strong> at Pick #${a.worstReach.draftPickNum} (<span class="text-rose-600 font-bold">${reachDiff} picks ahead of ADP</span>) burned early capital.`);
            }
        }
        if (a.streamingAnalysis?.isStreamingQB && a.streamingAnalysis?.isStreamingTE) {
            draftMoves.push(`<strong>Zero-Backup Gambit:</strong> Punting both QB and TE backups allows them to hoard high-upside RB/WR lottery tickets on the bench.`);
        }

        let draftMovesHTML = draftMoves.length > 0 ? ` ${draftMoves.join(' ')}` : '';

        // 6. CHAT-READY BOLD VERDICT / WATERCOOLER PREDICTION
        let boldVerdict = "";
        if (rank <= 3) {
            const verdicts = [
                `🏆 <strong>Championship Forecast:</strong> An absolute title frontrunner. If their core starters stay healthy, this team is a lock to be playing for the trophy in Week 17.`,
                `🏆 <strong>Championship Forecast:</strong> High weekly floor meets slate-breaking spike weeks. Expect them to lead the league in weekly high-score payouts.`,
                `🏆 <strong>Championship Forecast:</strong> A complete powerhouse with zero fatal flaws. The rest of the league will need major injury luck to knock them out.`
            ];
            boldVerdict = verdicts[seed % verdicts.length];
        } else if (rank <= 8) {
            const verdicts = [
                `⚖️ <strong>Playoff Forecast:</strong> A dangerous postseason contender. If their secondary flex options hit their midseason upside, they can easily crash the championship game.`,
                `⚖️ <strong>Playoff Forecast:</strong> Solid playoff lock with dark-horse upside. Their season will be decided by how well they manage midseason bye weeks.`,
                `⚖️ <strong>Playoff Forecast:</strong> A high-floor competitor capable of knocking off the top seeds on any given Sunday if their top picks produce.`
            ];
            boldVerdict = verdicts[seed % verdicts.length];
        } else {
            const verdicts = [
                `🚨 <strong>Season Outlook:</strong> Playoff hopes will require relentless waiver wire churning and hitting on late-round backup lottery tickets.`,
                `🚨 <strong>Season Outlook:</strong> An uphill climb. Survival hinges on trading for depth early before bye-week collisions take their toll.`,
                `🚨 <strong>Season Outlook:</strong> High-risk profile. One major starter injury could send them spiraling into the consolation bracket.`
            ];
            boldVerdict = verdicts[seed % verdicts.length];
        }

        return `
            <div class="space-y-3">
                <div class="text-[11px] font-black tracking-wider uppercase text-indigo-600 mb-1 flex items-center gap-1.5">
                    <span>${headline}</span>
                </div>
                <p class="leading-relaxed text-slate-700">${openingParagraph}</p>
                <p class="leading-relaxed text-slate-700">${unitAnalysis}${draftMovesHTML}</p>
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 font-medium leading-snug shadow-sm">
                    ${boldVerdict}
                </div>
            </div>
        `;
    },

    switchSubTab(tabKey) {
        this.activeSubTab = tabKey;
        const currentTeamId = document.getElementById('recap-team-select')?.value || State.userTeamId;
        this.renderTeam(currentTeamId);
    },

    renderDropdown() {
        const select = document.getElementById('recap-team-select');
        if (!select) return;

        select.innerHTML = this.sortedTeams.map(t => `<option value="${t.id}">${t.name} (Proj: #${t.projectedRank} • ${t.simRecord} • Grade: ${t.analysis.grade})</option>`).join('');
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
            if (!pl) {
                return `
                <div class="bg-slate-50 border border-slate-200 border-dashed p-4 rounded-xl flex flex-col items-center justify-center text-center">
                    <span class="text-xl mb-1 opacity-40">${icon}</span>
                    <span class="text-[10px] uppercase font-bold text-slate-400 block">${label}</span>
                    <span class="text-xs text-slate-400 italic">No qualifying player</span>
                </div>`;
            }

            let pickNum = pl.draftPickNum || 1;
            let round = Math.floor((pickNum - 1) / numTeams) + 1;
            let pick = ((pickNum - 1) % numTeams) + 1;
            let adpDiff = pl.adp ? (pl.adp - pickNum) : 0;
            let diffStr = adpDiff > 0 
                ? `<span class="text-emerald-600 font-bold">+${adpDiff.toFixed(0)} Value</span>` 
                : `<span class="text-rose-600 font-bold">${Math.abs(adpDiff).toFixed(0)} Reach</span>`;

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
                    <span class="text-xs font-black px-2 py-0.5 rounded ${data.grade.includes('A') ? 'bg-emerald-100 text-emerald-800' : (data.grade.includes('B') ? 'bg-indigo-100 text-indigo-800' : (data.grade.includes('C') ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'))}">${data.grade}</span>
                </div>
                <p class="text-[11px] text-gray-500 leading-tight">${data.summary}</p>
            </div>
        `;

        const maxCeil = Math.max(1, team.ceilingPts);
        const basePct = Math.round((team.basePts / maxCeil) * 100);
        const floorPct = Math.round((team.floorPts / maxCeil) * 100);

        // TAB 1: OVERVIEW & STRATEGY
        const overviewHTML = `
            <div class="space-y-6">
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
                    <div class="text-gray-700 leading-relaxed text-xs sm:text-sm">${a.narrative}</div>
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
        `;

        // TAB 2: PROJECTED STARTING LINEUP
        let totalStartingPts = a.lineup.starters.reduce((s, p) => s + (p.ProjPts || 0), 0);
        let weeklyAvgPPG = (totalStartingPts / 17).toFixed(1);

        const startersHTML = `
            <div class="space-y-4">
                <div class="bg-indigo-900 text-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                        <span class="text-[10px] uppercase font-bold text-indigo-300 block">Projected Starting Output</span>
                        <h4 class="text-xl font-black text-white">${totalStartingPts.toFixed(1)} Total Pts <span class="text-xs font-semibold text-indigo-200">(${weeklyAvgPPG} PPG)</span></h4>
                    </div>
                    <span class="bg-white/10 border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-300">
                        ${a.starterEdge >= 0 ? '+' : ''}${a.starterEdge.toFixed(1)}% vs. League Avg Starters
                    </span>
                </div>

                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table class="min-w-full text-xs text-left">
                        <thead class="bg-slate-50 text-[10px] uppercase font-extrabold text-slate-500 border-b border-slate-200">
                            <tr>
                                <th class="px-4 py-2.5">Slot</th>
                                <th class="px-4 py-2.5">Player</th>
                                <th class="px-4 py-2.5">Team</th>
                                <th class="px-4 py-2.5 text-center">Bye</th>
                                <th class="px-4 py-2.5 text-right">Proj Pts</th>
                                <th class="px-4 py-2.5 text-right">PPG</th>
                                <th class="px-4 py-2.5">Role / Archetype</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${a.lineup.starters.map(p => `
                                <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="UI.showPlayerCard('${p._cleanName}')">
                                    <td class="px-4 py-2.5 font-black text-indigo-600">${p.displaySlot}</td>
                                    <td class="px-4 py-2.5 font-extrabold text-slate-900">${p.Player}</td>
                                    <td class="px-4 py-2.5 text-slate-500 font-semibold">${p.Team} • ${p.Pos}</td>
                                    <td class="px-4 py-2.5 text-center text-slate-500 font-medium">${p.byeWeek !== 'N/A' ? 'Wk ' + p.byeWeek : '-'}</td>
                                    <td class="px-4 py-2.5 text-right font-black text-slate-900">${p.ProjPts.toFixed(1)}</td>
                                    <td class="px-4 py-2.5 text-right font-bold text-emerald-600">${(p.ProjPts / 17).toFixed(1)}</td>
                                    <td class="px-4 py-2.5">
                                        <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                            ${p._rbArchetype || p._wrArchetype || p._teArchetype || p._qbArchetype || 'Starter'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // TAB 3: POSITIONAL DEPTH
        const renderDepthGroup = (posTitle, icon, players) => `
            <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                    <h4 class="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">${icon} ${posTitle}</h4>
                    <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${players.length} Player(s)</span>
                </div>
                <div class="space-y-2">
                    ${players.map((p, idx) => `
                        <div class="flex justify-between items-center p-2 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition cursor-pointer" onclick="UI.showPlayerCard('${p._cleanName}')">
                            <div>
                                <span class="font-black text-xs text-slate-900 mr-1.5">${p.Player}</span>
                                <span class="text-[10px] font-bold ${idx === 0 ? 'text-indigo-600' : 'text-slate-400'}">(${idx === 0 ? 'Starter' : 'Depth #' + (idx + 1)})</span>
                                <span class="block text-[10px] text-slate-400 mt-0.5">${p.Team} • Wk ${p.byeWeek || '-'} Bye</span>
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-black text-slate-900 block">${p.ProjPts.toFixed(1)} pts</span>
                                <span class="text-[10px] font-bold text-emerald-600">${(p.ProjPts / 17).toFixed(1)} PPG</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const qbs = team.roster.filter(p => p.Pos === 'QB').sort((a,b) => (b.ProjPts||0)-(a.ProjPts||0));
        const rbs = team.roster.filter(p => p.Pos === 'RB').sort((a,b) => (b.ProjPts||0)-(a.ProjPts||0));
        const wrs = team.roster.filter(p => p.Pos === 'WR').sort((a,b) => (b.ProjPts||0)-(a.ProjPts||0));
        const tes = team.roster.filter(p => p.Pos === 'TE').sort((a,b) => (b.ProjPts||0)-(a.ProjPts||0));
        const kDst = team.roster.filter(p => ['PK', 'DST'].includes(p.Pos)).sort((a,b) => (b.ProjPts||0)-(a.ProjPts||0));

        const depthHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${renderDepthGroup('Quarterback Room', '🎯', qbs)}
                ${renderDepthGroup('Running Back Depth', '🏃', rbs)}
                ${renderDepthGroup('Wide Receiver Depth', '👐', wrs)}
                ${renderDepthGroup('Tight Ends & Specialists', '🛡️', [...tes, ...kDst])}
            </div>
        `;

        // TAB 4: LEAGUE-WIDE SUPERLATIVES & TROPHY ROOM
        const aw = this.leagueAwards;
        const awardCard = (title, icon, recipient, subtitle, badgeCls) => `
            <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-start gap-3">
                <span class="text-3xl">${icon}</span>
                <div>
                    <span class="text-[10px] uppercase font-extrabold text-slate-400 block">${title}</span>
                    <h4 class="font-extrabold text-sm text-slate-900 mt-0.5">${recipient}</h4>
                    <p class="text-xs text-slate-600 mt-1 leading-snug">${subtitle}</p>
                </div>
            </div>
        `;

        const awardsHTML = `
            <div class="space-y-4">
                <div class="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-4 rounded-2xl shadow-sm flex justify-between items-center">
                    <div>
                        <span class="text-[10px] uppercase font-bold text-amber-100 block">League Trophy Showcase</span>
                        <h4 class="text-lg font-black">🏆 2026 Draft Superlatives & Awards</h4>
                    </div>
                    <button onclick="DraftRecap.copyLeagueSummary()" class="bg-white text-amber-900 px-3 py-1.5 rounded-xl font-extrabold text-xs shadow hover:bg-amber-50 transition flex items-center gap-1.5">
                        📋 Copy Chat Blast
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${awardCard('Steal of the Draft', '🔥', aw.bestSteal ? `${aw.bestSteal.player} (Pick #${aw.bestSteal.pick})` : 'N/A', `Drafted by <strong>${aw.bestSteal?.team || 'N/A'}</strong> at a massive <strong class="text-emerald-600">+${aw.bestSteal?.diff || 0} pick value</strong> past ADP.`)}
                    ${awardCard('Biggest Head-Scratcher', '🚨', aw.worstReach ? `${aw.worstReach.player} (Pick #${aw.worstReach.pick})` : 'N/A', `Selected by <strong>${aw.worstReach?.team || 'N/A'}</strong> at <strong class="text-rose-600">${aw.worstReach?.diff || 0} picks ahead of ADP</strong>.`)}
                    ${awardCard('Correlation Kings (Top Stack)', '⚡', aw.stackKing ? `${aw.stackKing.qb} + ${aw.stackKing.target}` : 'N/A', `Drafted by <strong>${aw.stackKing?.team || 'N/A'}</strong> to monopolize the ${aw.stackKing?.nflTeam || ''} passing attack.`)}
                    ${awardCard('Chaos Gremlin (Max Ceiling)', '💣', aw.chaosTeam ? aw.chaosTeam.team : 'N/A', `Highest weekly ceiling potential in the league with a <strong>${aw.chaosTeam?.ceiling || 0} max projection</strong>.`)}
                    ${awardCard('Iron Fortress (Safest Floor)', '🛡️', aw.fortressTeam ? aw.fortressTeam.team : 'N/A', `Most insulated starting lineup with a rock-solid <strong>${aw.fortressTeam?.floor || 0} injury floor</strong>.`)}
                    ${awardCard('The Bench Hoarder', '📦', aw.benchHoarder ? aw.benchHoarder.team : 'N/A', `Deepest overall roster with <strong>+${aw.benchHoarder?.edge || 0}% bench production</strong> over league average.`)}
                </div>
            </div>
        `;

        let currentTabHTML = overviewHTML;
        if (this.activeSubTab === 'starters') currentTabHTML = startersHTML;
        else if (this.activeSubTab === 'depth') currentTabHTML = depthHTML;
        else if (this.activeSubTab === 'awards') currentTabHTML = awardsHTML;

        // Sub-Tab Navigation Header
        const tabNavHTML = `
            <div class="flex gap-2 p-1.5 bg-slate-200/80 rounded-2xl mb-6 shadow-inner flex-wrap sm:flex-nowrap">
                <button onclick="DraftRecap.switchSubTab('overview')" class="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl transition whitespace-nowrap ${this.activeSubTab === 'overview' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                    📝 Executive Overview
                </button>
                <button onclick="DraftRecap.switchSubTab('starters')" class="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl transition whitespace-nowrap ${this.activeSubTab === 'starters' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                    ⚔️ Projected Starters
                </button>
                <button onclick="DraftRecap.switchSubTab('depth')" class="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl transition whitespace-nowrap ${this.activeSubTab === 'depth' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                    📊 Positional Depth
                </button>
                <button onclick="DraftRecap.switchSubTab('awards')" class="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl transition whitespace-nowrap ${this.activeSubTab === 'awards' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                    🏆 Superlatives & Awards
                </button>
            </div>
        `;

        const html = `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <!-- Left Column: Grade, Record, Identity, 3-Tier Outcomes -->
                <div class="lg:col-span-1 space-y-6">
                    <div class="${a.bg} p-6 rounded-2xl shadow-sm border text-center flex flex-col items-center justify-center relative overflow-hidden">
                        <span class="text-[10px] uppercase font-extrabold tracking-widest text-gray-500 mb-1">Final Draft Grade</span>
                        <span class="text-6xl font-black ${a.color} drop-shadow-sm">${a.grade}</span>
                        <span class="text-xs font-bold text-gray-700 mt-2 bg-white/70 px-3 py-1 rounded-full border border-gray-200/70">Projected: #${team.projectedRank} of ${this.sortedTeams.length}</span>
                        
                        <!-- 🎲 Monte Carlo Season Record & Playoff Odds -->
                        <div class="mt-4 pt-3 border-t border-black/5 w-full flex justify-around items-center">
                            <div>
                                <span class="text-[10px] uppercase font-bold text-gray-400 block">Sim Record</span>
                                <span class="text-sm font-black text-slate-900">${team.simRecord}</span>
                            </div>
                            <div class="border-l border-black/10 pl-3">
                                <span class="text-[10px] uppercase font-bold text-gray-400 block">Playoff Odds</span>
                                <span class="text-sm font-black text-emerald-600">${team.playoffOdds}%</span>
                            </div>
                            <div class="border-l border-black/10 pl-3">
                                <span class="text-[10px] uppercase font-bold text-gray-400 block">Title Odds</span>
                                <span class="text-sm font-black text-indigo-600">${team.titleOdds}%</span>
                            </div>
                        </div>

                        <div class="mt-3 pt-2 border-t border-black/5 w-full text-center">
                            <span class="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Team Identity</span>
                            <span class="text-xs font-extrabold ${a.color}">${a.persona.icon} ${a.persona.label}</span>
                        </div>
                    </div>

                    <!-- 3-Tier Outcomes Gauge -->
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

                <!-- Right Column: Sub-Tabs & Tab Content -->
                <div class="lg:col-span-3">
                    ${tabNavHTML}
                    ${currentTabHTML}
                </div>
            </div>
        `;
        container.innerHTML = html;
    }
};
