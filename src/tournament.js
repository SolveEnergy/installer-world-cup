// Core scoring engine. Pure functions only - no I/O here - so this is easy
// to unit-test and reason about independently of Notion plumbing.
//
// Scoring rules:
//   League play (Weeks 1-4): every week stands alone. Teams are ranked
//   WITHIN their own category, not against each other - Solo Electricians
//   compete only against other Solo Electricians, Install Crews only
//   against other Install Crews. Top team in each category earns 3 pts that
//   week, second earns 1 pt, everyone else in that category earns 0. A week
//   where every team in a category made $0 awards no points in that
//   category (there's no real 1st place if nobody installed anything).
//   Points add up across all 4 weeks. Ties on total points within a
//   category are broken by that category's combined 4-week revenue.
//
//   The Finale (Week 5): the #1 Electrician and #1 Crew (by category
//   points) go head to head - the Finale is always one of each, by
//   construction, not by chance. Scored fresh on that week's revenue alone;
//   league points don't carry into this result, they only decided who's in
//   it.
//
// "Combined Team" (electrician + crew combined) isn't scored under either
// category right now - none are registered on the current roster. If one
// ever is, this needs revisiting (see CATEGORIES below).

const CATEGORIES = [
  { key: 'electrician', type: 'Solo Electrician', label: 'Electrician' },
  { key: 'crew', type: 'Install Crew', label: 'Crew' },
];

function pointsForRank(rank, revenue) {
  if (revenue <= 0) return 0; // nobody "wins" a week where nothing sold
  if (rank === 0) return 3;
  if (rank === 1) return 1;
  return 0;
}

// Ranks a single category's teams within each of the 4 league weeks
// independently.
function computeWeeklyResults(categoryTeams) {
  return [0, 1, 2, 3].map((weekIdx) => {
    const ranked = [...categoryTeams].sort(
      (a, b) => (b.weeklyRevenue[weekIdx] || 0) - (a.weeklyRevenue[weekIdx] || 0)
    );
    return ranked.map((team, rank) => {
      const revenue = team.weeklyRevenue[weekIdx] || 0;
      return { name: team.name, revenue, rank: rank + 1, points: pointsForRank(rank, revenue) };
    });
  });
}

// Computes one category's standings (e.g. just the Solo Electricians).
function computeCategoryStandings(categoryTeams) {
  const weeklyResults = computeWeeklyResults(categoryTeams);

  const standings = categoryTeams.map((team) => {
    const points = weeklyResults.reduce((sum, week) => {
      const entry = week.find((w) => w.name === team.name);
      return sum + (entry ? entry.points : 0);
    }, 0);
    const cumulativeRevenue = team.weeklyRevenue.reduce((a, b) => a + b, 0);
    // Weekly "W1"/"RU2"-style badges - who won and who was runner-up each
    // week, within this category. Only awarded for weeks with real
    // (non-zero) revenue, matching the "nobody wins a week where nothing
    // sold" rule above.
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
  // position - a category where nobody has sold anything yet should show
  // no ranking at all, not an arbitrary tie-break order. Position 1 is this
  // category's Finale representative.
  standings.sort((a, b) => b.points - a.points || b.cumulativeRevenue - a.cumulativeRevenue);
  let rankCounter = 0;
  standings.forEach((s) => {
    if (s.cumulativeRevenue > 0) {
      rankCounter += 1;
      s.position = rankCounter;
      s.finalist = rankCounter === 1;
    } else {
      s.position = null;
      s.finalist = false;
    }
  });

  return { weeklyResults, standings };
}

// Splits teams into their category and computes standings for each
// independently.
function computeStandings(teams) {
  const result = {};
  for (const category of CATEGORIES) {
    const categoryTeams = teams.filter((t) => t.type === category.type);
    result[category.key] = computeCategoryStandings(categoryTeams);
  }
  return result;
}

// The Finale: the #1 Electrician vs the #1 Crew, decided by Week 5 revenue
// alone. Returns null until both category winners are actually decided.
function computeFinal(categoryStandings, teams) {
  const topElectrician = categoryStandings.electrician.standings.find((s) => s.finalist);
  const topCrew = categoryStandings.crew.standings.find((s) => s.finalist);
  if (!topElectrician || !topCrew) return null;

  const teamByName = new Map(teams.map((t) => [t.name, t]));
  const revenueA = teamByName.get(topElectrician.name)?.finalRevenue || 0;
  const revenueB = teamByName.get(topCrew.name)?.finalRevenue || 0;
  return {
    teamA: topElectrician.name,
    teamB: topCrew.name,
    labelA: 'Top Electrician',
    labelB: 'Top Crew',
    revenueA,
    revenueB,
    champion: revenueA >= revenueB ? topElectrician.name : topCrew.name,
  };
}

function computeTournament(teams) {
  const categoryStandings = computeStandings(teams);
  const final = computeFinal(categoryStandings, teams);
  return { ...categoryStandings, final };
}

module.exports = {
  CATEGORIES,
  pointsForRank,
  computeWeeklyResults,
  computeStandings,
  computeCategoryStandings,
  computeFinal,
  computeTournament,
};
