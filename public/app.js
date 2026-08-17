const TYPE_COLORS = {
  'Solo Electrician': 'var(--type-solo)',
  'Install Crew': 'var(--type-crew)',
  'Combined Team': 'var(--type-combined)',
};

// Mirrors src/phase.js PHASE_ORDER - keep in sync if that ever changes.
const PHASE_ORDER = { pre: 0, league: 1, final: 2, post: 3 };
function phaseReached(current, target) {
  return (PHASE_ORDER[current] ?? 0) >= (PHASE_ORDER[target] ?? 0);
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n || 0);
}

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.style) node.style.cssText = opts.style;
  for (const c of children) node.appendChild(c);
  return node;
}

function typeBadge(type) {
  return el('span', {
    class: 'type-badge',
    text: type || 'Unassigned',
    style: `color:${TYPE_COLORS[type] || 'var(--text-dim)'}`,
  });
}

// Jobs that cleared the date window for a week but got left out for
// missing one of the completion gates, per the "Week N Errors" Notion
// formulas. Only rendered when a team actually has any.
function excludedJobsBlock(excludedJobs) {
  if (!excludedJobs || !excludedJobs.length) return null;
  const list = el('div', { class: 'excluded-jobs' });
  for (const { week, jobId, reasons } of excludedJobs) {
    list.appendChild(
      el('div', {
        class: 'excluded-job-row',
        text: `Wk ${week}: ${jobId} — missing ${reasons.join(', ')}`,
      })
    );
  }
  return list;
}

// Teams are ranked within their own category now (Electrician vs Crew),
// not against each other - see src/tournament.js. Builds one category's
// table; renderStandings calls this once per category.
function buildCategoryTable(state, categoryStandings, title) {
  const card = el('div', { class: 'category-card' });
  card.appendChild(el('h3', { class: 'category-title', text: title }));

  const table = el('table', { class: 'team-table' });
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', { text: 'Pos' }),
      el('th', { text: 'Team' }),
      el('th', { text: 'Wk 1' }),
      el('th', { text: 'Wk 2' }),
      el('th', { text: 'Wk 3' }),
      el('th', { text: 'Wk 4' }),
      el('th', { text: 'Revenue' }),
      el('th', { text: 'Pts' }),
    ]),
  ]);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const s of categoryStandings.standings) {
    const team = state.teams.find((t) => t.name === s.name);
    const tr = el('tr', { class: s.finalist ? 'finalist' : '' });

    const posBadge = el('span', {
      class: `pos-badge ${s.position === 1 ? 'p1' : s.position === 2 ? 'p2' : ''}`,
      text: s.position ? String(s.position) : '—',
    });
    const posTd = el('td');
    posTd.appendChild(posBadge);
    tr.appendChild(posTd);

    const nameTd = el('td', { class: 'team-name-cell' });
    nameTd.appendChild(el('div', { class: 'team-name', text: s.name }));
    const metaRow = el('div', { class: 'team-meta' });
    metaRow.appendChild(typeBadge(s.type));
    if (s.members) metaRow.appendChild(el('span', { class: 'team-members', text: s.members }));
    nameTd.appendChild(metaRow);
    for (const badge of s.badges || []) {
      const isWin = badge.startsWith('W');
      const weekNum = parseInt(badge.replace(/\D/g, ''), 10);
      const concluded = Boolean(state.leagueWeeksConcluded && state.leagueWeeksConcluded[weekNum - 1]);
      const kind = isWin ? 'week-badge-win' : 'week-badge-ru';
      nameTd.appendChild(
        el('span', { class: `week-badge ${kind} ${concluded ? '' : 'week-badge-pending'}`, text: badge })
      );
    }
    const excludedBlock = excludedJobsBlock(team ? team.excludedJobs : null);
    if (excludedBlock) nameTd.appendChild(excludedBlock);
    tr.appendChild(nameTd);

    const weekly = team ? team.weeklyRevenue : [0, 0, 0, 0];
    tr.appendChild(el('td', { text: fmtMoney(weekly[0]) }));
    tr.appendChild(el('td', { text: fmtMoney(weekly[1]) }));
    tr.appendChild(el('td', { text: fmtMoney(weekly[2]) }));
    tr.appendChild(el('td', { text: fmtMoney(weekly[3]) }));
    tr.appendChild(el('td', { text: fmtMoney(s.cumulativeRevenue) }));
    tr.appendChild(el('td', { text: String(s.points), style: 'font-weight:800' }));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  card.appendChild(el('div', { class: 'table-scroll' }, [table]));
  return card;
}

function renderStandings(state) {
  const container = document.getElementById('standings-card');
  container.innerHTML = '';
  container.appendChild(buildCategoryTable(state, state.tournament.electrician, 'Electrician'));
  container.appendChild(buildCategoryTable(state, state.tournament.crew, 'Crew'));
}

function matchRow(label, name, revenue, isWinner) {
  return el('div', { class: `match-row ${isWinner ? 'winner' : ''}` }, [
    el('span', {}, [
      label ? el('span', { class: 'seed', text: label }) : document.createTextNode(''),
      document.createTextNode(name),
    ]),
    el('span', { text: revenue == null ? '' : fmtMoney(revenue) }),
  ]);
}

function renderFinal(state) {
  const root = document.getElementById('final');
  root.innerHTML = '';
  const { tournament, currentWeek } = state;
  const finalReached = phaseReached(currentWeek.phase, 'final');

  if (!finalReached || !tournament.final) {
    const topElectrician = tournament.electrician.standings.find((s) => s.finalist);
    const topCrew = tournament.crew.standings.find((s) => s.finalist);
    const note =
      topElectrician || topCrew
        ? 'Locked in so far - scored fresh once Week 5 opens.'
        : 'League play in progress — the top Electrician and top Crew by points after Week 4 meet here.';
    root.appendChild(
      el('div', { class: 'match-card tbd-card' }, [
        matchRow('Top Electrician', topElectrician ? topElectrician.name : 'TBD', null, false),
        el('div', { class: 'match-vs', text: 'VS' }),
        matchRow('Top Crew', topCrew ? topCrew.name : 'TBD', null, false),
      ])
    );
    root.appendChild(el('div', { class: 'empty-note', text: note }));
    return;
  }

  const f = tournament.final;
  const card = el('div', { class: 'match-card' });
  card.appendChild(matchRow(f.labelA, f.teamA, f.revenueA, f.champion === f.teamA));
  card.appendChild(el('div', { class: 'match-vs', text: 'VS' }));
  card.appendChild(matchRow(f.labelB, f.teamB, f.revenueB, f.champion === f.teamB));
  root.appendChild(card);
  root.appendChild(
    el('div', { class: 'champion-card' }, [
      el('div', { class: 'trophy', text: '🏆' }),
      el('div', { class: 'champ-name', text: f.champion }),
      el('div', { class: 'champ-sub', text: 'Installer World Cup Champion — Port Renfrew Cabin Trip' }),
    ])
  );
}

function renderStatus(state) {
  document.getElementById('phase-label').textContent = state.currentWeek.label;
  document.getElementById('demo-pill').classList.toggle('hidden', !state.demoMode);
  const syncedDate = new Date(state.lastSyncedAt);
  document.getElementById('synced-label').textContent = `Last synced ${syncedDate.toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}`;
}

async function loadState() {
  const res = await fetch('/api/state');
  const state = await res.json();
  renderStatus(state);
  renderStandings(state);
  renderFinal(state);
}

async function sync() {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = 'Syncing…';
  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    const state = await res.json();
    renderStatus(state);
    renderStandings(state);
    renderFinal(state);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync now';
  }
}

document.getElementById('sync-btn').addEventListener('click', sync);

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

loadState();
