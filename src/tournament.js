// Core scoring engine. Pure functions only - no I/O here - so this is easy
// to unit-test and reason about independently of Notion plumbing.
//
// Scoring rules (from the "World Cup Kickoff Deck"):
//   League play (Weeks 1-4): every week stands alone - rank ALL teams by
//   that week's revenue. 1st = 3 pts, 2nd = 1 pt, everyone else = 0. A week
//   where every team made $0 awards no points to anyone (there's no real
//   1st place if nobody installed anything). Points add up across all 4
//   weeks. Ties on total points are broken by combined 4-week revenue.
//
//   The Finale (Week 5): the top 2 teams by league points go head to head,
//   scored fresh on that week's revenue alone - league points don't carry
//   into this result, they only decided who's in it.
//
// There are no groups and no bracket here (unlike Apex Cup) - just one flat
// table of teams and a single final matchup.

function pointsForRank(rank, revenue) {
  if (revenue <= 0) return 0; // nobody "wins" a week where nothing sold
  if (rank === 0) return 3;
  if (rank === 1) return 1;
  return 0;
}

// Ranks all teams within each of the 4 league weeks independently.
function computeWeeklyResults(teams) {
  return [0, 1, 2, 3].map((weekIdx) => {
    const ranked = [...teams].sort(
      (a, b) => (b.weeklyRevenue[weekIdx] || 0) - (a.weeklyRevenue[weekIdx] || 0)
    );
    return ranked.map((team, rank) => {
      const revenue = team.weeklyRevenue[weekIdx] || 0;
      return { name: team.name, revenue, rank: rank + 1, points: pointsForRank(rank, revenue) };
    });
  });
}

// Computes the flat league standings across all teams.
function computeStandings(teams) {
  const weeklyResults = computeWeeklyResults(teams);

  const standings = teams.map((team) => {
    const points = weeklyResults.reduce((sum, week) => {
      const entry = week.find((w) => w.name === team.name);
      return sum + (entry ? entry.points : 0);
    }, 0);
    const cumulativeRevenue = team.weeklyRevenue.reduce((a, b) => a + b, 0);
    // Weekly "W1"/"RU2"-style badges - who won and who was runner-up each
    // week. Only awarded for weeks with real (non-zero) revenue, matching
    // the "nobody wins a week where nothing sold" rule above.
    const badges = weeklyResults
      .map((week, weekIdx) => {
        const entry = week.find((w) => w.name === team.name);
        if (!entry || entry.revenue <= 0) return null;
        if (entry.rank === 1) return `W${weekIdx + 1}`;
        if (entry.rank === 2) return `RU${weekIdx + 1}`;
        return null;
      })
      .filter(Boolean);
    return {
      name: team.name,
      type: team.type,
      members: team.members,
      points,
      cumulativeRevenue,
      badges,
      pageUrl: team.pageUrl,
    };
  });

  // Only teams with real (non-zero) cumulative revenue get a numbered
  // position / can be marked a "finalist" - a table where nobody has sold
  // anything yet should show no ranking at all, not an arbitrary tie-break
  // order.
  standings.sort((a, b) => b.points - a.points || b.cumulativeRevenue - a.cumulativeRevenue);
  let rankCounter = 0;
  let finalistCount = 0;
  standings.forEach((s) => {
    if (s.cumulativeRevenue > 0) {
      rankCounter += 1;
      s.position = rankCounter;
      if (finalistCount < 2) {
        s.finalist = true;
        finalistCount += 1;
      } else {
        s.finalist = false;
      }
    } else {
      s.position = null;
      s.finalist = false;
    }
  });

  return { weeklyResults, standings };
}

// The Finale: the top 2 teams by league points, decided by Week 5 revenue
// alone. Returns null until both finalist spots are actually filled.
function computeFinal(standings, teams) {
  const finalists = standings.filter((s) => s.finalist).sort((a, b) => a.position - b.position);
  if (finalists.length < 2) return null;
  const teamByName = new Map(teams.map((t) => [t.name, t]));
  const [a, b] = finalists;
  const revenueA = teamByName.get(a.name)?.finalRevenue || 0;
  const revenueB = teamByName.get(b.name)?.finalRevenue || 0;
  return {
    teamA: a.name,
    teamB: b.name,
    seedA: a.position,
    seedB: b.position,
    revenueA,
    revenueB,
    champion: revenueA >= revenueB ? a.name : b.name,
  };
}

function computeTournament(teams) {
  const { weeklyResults, standings } = computeStandings(teams);
  const final = computeFinal(standings, teams);
  return { weeklyResults, standings, final };
}

module.exports = {
  pointsForRank,
  computeWeeklyResults,
  computeStandings,
  computeFinal,
  computeTournament,
};
