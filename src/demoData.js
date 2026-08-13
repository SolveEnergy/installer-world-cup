// Deterministic sample data so the site is fully browsable before a real
// NOTION_TOKEN is configured. Numbers are stable across restarts (seeded
// from the team's name) and are clearly labeled "DEMO DATA" in the UI -
// they are not real revenue figures. Team names/types here mirror the
// roster Torin locked in on Aug 12, 2026, but this file is never read once
// a NOTION_TOKEN is set - see src/notion.js for the live path.

const DEMO_TEAMS = [
  { name: 'Bailey & Carter', type: 'Install Crew', members: 'Bailey Schlatter, Carter Dagg' },
  { name: 'Jacob & Akira', type: 'Install Crew', members: 'Jacob, Akira' },
  { name: 'Connor & Eric', type: 'Install Crew', members: 'Connor, Eric L' },
  { name: 'Averel', type: 'Solo Electrician', members: 'Averel' },
  { name: 'Reece Thomas', type: 'Solo Electrician', members: 'Reece Thomas' },
  { name: 'Dusan Podsednik', type: 'Solo Electrician', members: 'Dusan Podsednik' },
  { name: 'Adonis, Aleks & Tristan', type: 'Install Crew', members: 'Adonis Liu, Aleks, Tristan' },
  { name: 'Andrew & Wyatt', type: 'Install Crew', members: 'Andrew Robertson, Wyatt Richards' },
];

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoRevenue(seed, min, max) {
  const rnd = mulberry32(seed);
  return Math.round((min + rnd() * (max - min)) / 100) * 100;
}

function buildDemoRows() {
  return DEMO_TEAMS.map((team) => {
    const seed = seedFromString(team.name);
    const weeklyRevenue = [1, 2, 3, 4].map((w) => demoRevenue(seed + w, 6000, 32000));
    return {
      name: team.name,
      type: team.type,
      members: team.members,
      weeklyRevenue,
      finalRevenue: demoRevenue(seed + 5, 6000, 32000),
      notes: '',
      pageUrl: null,
    };
  });
}

module.exports = { buildDemoRows };
