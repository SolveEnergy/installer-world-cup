require('dotenv').config();
const path = require('path');
const express = require('express');

const notion = require('./src/notion');
const { buildDemoRows } = require('./src/demoData');
const { computeTournament } = require('./src/tournament');
const { currentWeek, SCHEDULE, leagueWeeksConcluded } = require('./src/phase');

const app = express();
const PORT = process.env.PORT || 3000;

let lastSyncedAt = null;
let lastError = null;

async function getTeams() {
  if (notion.isConfigured()) {
    return { teams: await notion.fetchInstallerCupRows(), demo: false };
  }
  return { teams: buildDemoRows(), demo: true };
}

async function syncAndCompute() {
  const { teams, demo } = await getTeams();
  const tournament = computeTournament(teams);

  lastSyncedAt = new Date().toISOString();
  return {
    demoMode: demo,
    lastSyncedAt,
    now: new Date().toISOString(),
    currentWeek: currentWeek(),
    schedule: SCHEDULE,
    leagueWeeksConcluded: leagueWeeksConcluded(),
    teams,
    tournament,
  };
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/state', async (req, res) => {
  try {
    const state = await syncAndCompute();
    lastError = null;
    res.json(state);
  } catch (err) {
    lastError = err.message;
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const state = await syncAndCompute();
    lastError = null;
    res.json(state);
  } catch (err) {
    lastError = err.message;
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    notionConfigured: notion.isConfigured(),
    lastSyncedAt,
    lastError,
  });
});

app.listen(PORT, () => {
  console.log(`Installer World Cup tracker running on http://localhost:${PORT}`);
  console.log(notion.isConfigured() ? 'Notion: connected (live data)' : 'Notion: not configured (demo data)');
});
