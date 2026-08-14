// Thin wrapper around the official Notion REST API (no SDK dependency needed -
// Node 18+ ships a global fetch). Reads the "Installer World Cup" database
// directly: Team Name, the Electrician/Install Crew relations (to Company
// Directory.db), and the per-week revenue fields (Week 1-4 Revenue, Week 5
// Final Revenue) - which are now Notion formulas computed from the
// underlying Job Cards/Projects/Ops Checklist/POWRA/Method Statement data,
// not manually entered numbers. Team Type was removed in favor of deriving
// it from which of Electrician/Install Crew are populated - see
// deriveTeamType below.

const NOTION_VERSION = '2022-06-28';
const API_BASE = 'https://api.notion.com/v1';

// Default database id for the "Installer World Cup" database created for
// this competition. Override with NOTION_DATABASE_ID if it ever moves.
const DEFAULT_DATABASE_ID = '5436f4a8-de73-4149-a96e-e06d624aa453';

function getConfig() {
  const token = process.env.NOTION_TOKEN || '';
  const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_DATABASE_ID;
  return { token, databaseId };
}

function isConfigured() {
  return Boolean(getConfig().token);
}

function extractTitle(prop) {
  if (!prop || !Array.isArray(prop.title)) return '';
  return prop.title.map((t) => t.plain_text).join('').trim();
}

function extractRelationIds(prop) {
  if (!prop || !Array.isArray(prop.relation)) return [];
  return prop.relation.map((r) => r.id);
}

// The "Electrician Name" / "Install Crew Names" rollups surface the related
// Company Directory.db person's title property through a relation - handles
// both a single rolled-up item and an array of them (Install Crew can have
// more than one person).
function extractRollupText(prop) {
  if (!prop || prop.type !== 'rollup' || !prop.rollup) return '';
  const r = prop.rollup;
  if (r.type === 'array') {
    return r.array
      .map((item) => {
        if (item.type === 'title') return item.title.map((t) => t.plain_text).join('');
        if (item.type === 'rich_text') return item.rich_text.map((t) => t.plain_text).join('');
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }
  if (r.type === 'string') return r.string || '';
  return '';
}

// No more "Team Type" select field - it was deleted in favor of deriving
// team type from which of Electrician/Install Crew are actually populated.
function deriveTeamType(hasElectrician, hasInstallCrew) {
  if (hasElectrician && hasInstallCrew) return 'Combined Team';
  if (hasElectrician) return 'Solo Electrician';
  if (hasInstallCrew) return 'Install Crew';
  return null;
}

function extractNumber(prop) {
  if (!prop) return 0;
  if (prop.type === 'number') return typeof prop.number === 'number' ? prop.number : 0;
  if (prop.type === 'formula') {
    const f = prop.formula;
    if (f.type === 'number') return typeof f.number === 'number' ? f.number : 0;
    if (f.type === 'string') {
      const n = parseFloat((f.string || '').replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }
  return 0;
}

// "Errors" is a single string-formula field covering all 5 weeks in one go
// (Notion formulas can't call a reusable function per week, so the formula
// itself unrolls the same check 5 times internally). Each line is
// "Wk <n>: <job id> — missing: <reason>; <reason>; ".
function extractFormulaString(prop) {
  if (!prop || prop.type !== 'formula' || !prop.formula) return '';
  return prop.formula.type === 'string' ? prop.formula.string || '' : '';
}

function parseErrors(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const weekMatch = line.match(/^Wk (\d+):\s*/);
      const week = weekMatch ? parseInt(weekMatch[1], 10) : null;
      const rest = weekMatch ? line.slice(weekMatch[0].length) : line;
      const [jobId, reasonsPart] = rest.split(' — missing: ');
      const reasons = (reasonsPart || '')
        .split(';')
        .map((r) => r.trim())
        .filter(Boolean);
      return { week, jobId: (jobId || '').trim(), reasons };
    });
}

async function notionFetch(path, body) {
  const { token } = getConfig();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Notion API ${res.status}: ${text}`);
  }
  return res.json();
}

// Fetches every row of the Installer World Cup database. Returns an array
// of: { name, type, members, weeklyRevenue: [wk1, wk2, wk3, wk4],
//        finalRevenue, excludedJobs: [{week, jobId, reasons: [...]}, ...],
//        pageUrl }
async function fetchInstallerCupRows() {
  const { databaseId } = getConfig();
  const rows = [];
  let cursor;
  do {
    const page = await notionFetch(`/databases/${databaseId}/query`, {
      start_cursor: cursor,
      page_size: 100,
    });
    for (const result of page.results) {
      const props = result.properties;
      const name = extractTitle(props['Team Name']);
      if (!name) continue; // skip blank/placeholder rows

      const hasElectrician = extractRelationIds(props['Electrician']).length > 0;
      const hasInstallCrew = extractRelationIds(props['Install Crew']).length > 0;
      const members = [extractRollupText(props['Electrician Name']), extractRollupText(props['Install Crew Names'])]
        .filter(Boolean)
        .join(', ');

      const excludedJobs = parseErrors(extractFormulaString(props['Errors']));

      rows.push({
        name,
        type: deriveTeamType(hasElectrician, hasInstallCrew),
        members,
        weeklyRevenue: [
          extractNumber(props['Week 1 Revenue']),
          extractNumber(props['Week 2 Revenue']),
          extractNumber(props['Week 3 Revenue']),
          extractNumber(props['Week 4 Revenue']),
        ],
        finalRevenue: extractNumber(props['Week 5 Final Revenue']),
        excludedJobs,
        pageUrl: result.url,
      });
    }
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}

module.exports = { fetchInstallerCupRows, isConfigured, getConfig };
