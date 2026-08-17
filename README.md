# Installer World Cup Tracker

A live league table for Solve Energy's "Installer World Cup" competition, pulling revenue
straight from the **Installer World Cup** Notion database.

## What it does

- One flat table of teams (Solo Electricians, Install Crews, Combined Teams) — no
  groups, no bracket, unlike the Apex Cup / KW World Cup sales tournament.
- Weekly league points (3 / 1 / 0 across all teams, Weeks 1-4) plus a combined
  4-week-revenue tiebreaker, and a single Week 5 head-to-head Finale between the
  top 2 teams by points, decided by that week's revenue alone.
- Reads each team's weekly revenue straight from Notion's own `Week 1-4 Revenue`
  and `Week 5 Final Revenue` fields.
- Falls back to clearly-labeled **demo data** if no Notion credentials are set, so
  you can preview the whole site immediately.

## How revenue gets computed

The `Week 1-4 Revenue` and `Week 5 Final Revenue` fields are Notion **formulas**
built directly against the underlying Job Cards/Projects data - not manually
entered numbers. This app just reads whatever those formulas resolve to, the
same "trust Notion's own fields" principle Apex Cup uses.

Valid install revenue, per the "World Cup Kickoff Deck": full contract value,
only once a job clears **all four** gates -

- **Ops Checklist**: `Job Cards.db` → `Ops Checklist Submissions` relation is non-empty
- **System Commissioned**: that same submission's `Fully Commissioned System` file field is non-empty
- **POWRA**: `Job Cards.db` → `POWRA Submissions` relation is non-empty
- **Method Statement**: `Job Cards.db` → `Method Statement` relation → `Status` = **Signed** (not just "Filled")
- Revenue amount: `Projects.db` → `Closing Price`

Miss one gate and the job doesn't count *partially* - it counts in whichever
week it actually clears all four.

Team composition now comes from two relation fields on this database instead
of a manual "Team Type" select (which was deleted): `Electrician` (single
person, limit 1) and `Install Crew` (multiple people), both relating to
`Company Directory.db`. The app derives type itself: both populated →
Combined Team, only Electrician → Solo Electrician, only Install Crew →
Install Crew. Two rollup fields, `Electrician Name` and `Install Crew Names`,
surface the actual person names from Company Directory.db so the app can
display them without needing broader Notion access.

## Run it locally

```bash
cd installers-kw-cup
npm install
npm start
```

Open http://localhost:3000. Without any setup this runs in **demo mode**
(sample numbers, labeled "DEMO DATA" in the header) so you can see the whole
site working right away.

## Connect the real Notion database

1. Go to https://www.notion.so/my-integrations and create a new internal
   integration (e.g. "Installer Cup Tracker"). Copy its **Internal Integration
   Secret**.
2. Open the **🏆 Installer World Cup** database in Notion → **···** menu (top right) →
   **Connections** → add your new integration. This is required — Notion
   integrations only see databases you've explicitly shared with them.
3. Copy `.env.example` to `.env` and paste your secret into `NOTION_TOKEN`.
4. Restart the app (`npm start`). The header's "DEMO DATA" badge disappears
   once real data loads.

The database ID is already pre-filled from the database created for this
competition. You only need to set `NOTION_DATABASE_ID` if it later gets
moved/duplicated.

## Deploy to Railway

This repo is set up for Railway's GitHub auto-deploy:

1. Push this folder to a GitHub repo.
2. In Railway: **New Project → GitHub** → select the repo. If it's not
   listed, use **Configure GitHub App** to grant Railway access to it first.
3. Set environment variables under your service's **Variables** tab:
   `NOTION_TOKEN` (required for live data), `NOTION_DATABASE_ID` (optional).
   Don't set `PORT` — Railway injects that automatically.
4. Under **Settings → Networking**, click **Generate Domain** for a public
   URL.
5. Railway auto-detects the Node app and runs `node server.js` (see
   `railway.json` / `Procfile`). No build step needed. Every `git push` to
   the connected branch auto-redeploys.

## Things to double check with the boss

- **Combined Teams**: team type is now derived automatically - a team becomes
  a Combined Team the moment both an `Electrician` and at least one
  `Install Crew` member are linked on its row. No separate flag to set.

## Project structure

```
server.js          Express app + routes
src/notion.js      Notion REST API client (no SDK dependency)
src/phase.js       Fixed weekly schedule (Aug 10 - Sep 13) + phase gating
src/tournament.js  Scoring engine: weekly points, standings, the Finale
src/demoData.js    Deterministic sample data for demo mode
public/            Frontend (static HTML/CSS/JS)
```
