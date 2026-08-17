// Fixed tournament schedule, per the actual season start used in the Notion
// "Start Date" formula field (Aug 10 - Sep 13, 2026 - moved back from the
// deck's original Aug 4 kickoff). All weeks run Sunday -> Saturday, matching
// that Start Date being a Sunday. Dates are inclusive. Solve Energy is a BC
// company, so times are anchored to Pacific, not the Eastern zone the
// original KW World Cup (Apex Cup) app used.

const SCHEDULE = [
  { key: 'week1', phase: 'league', label: 'Week 1 - League Play', start: '2026-08-10', end: '2026-08-16' },
  { key: 'week2', phase: 'league', label: 'Week 2 - League Play', start: '2026-08-17', end: '2026-08-23' },
  { key: 'week3', phase: 'league', label: 'Week 3 - League Play', start: '2026-08-24', end: '2026-08-30' },
  { key: 'week4', phase: 'league', label: 'Week 4 - League Play', start: '2026-08-31', end: '2026-09-06' },
  { key: 'week5', phase: 'final', label: 'Week 5 - The Knockout Finale', start: '2026-09-07', end: '2026-09-13' },
];

// Ordering used to gate the UI: the Finale should only ever be revealed once
// we've actually reached that point on the calendar, regardless of what the
// (possibly all-zero, pre-season) data looks like.
const PHASE_ORDER = { pre: 0, league: 1, final: 2, post: 3 };

function phaseReached(currentPhaseKey, targetPhaseKey) {
  return (PHASE_ORDER[currentPhaseKey] ?? 0) >= (PHASE_ORDER[targetPhaseKey] ?? 0);
}

function toDate(s, time = '00:00:00') {
  return new Date(`${s}T${time}-07:00`); // Pacific time (Solve Energy is BC-based)
}

function currentWeek(now = new Date()) {
  for (const w of SCHEDULE) {
    if (now >= toDate(w.start) && now <= toDate(w.end, '23:59:59')) return w;
  }
  if (now < toDate(SCHEDULE[0].start)) return { key: 'pre', phase: 'pre', label: 'Not started yet' };
  return { key: 'post', phase: 'post', label: 'Tournament complete' };
}

function weeksForPhase(phase) {
  return SCHEDULE.filter((w) => w.phase === phase);
}

// [week1Concluded, ..., week4Concluded] - used to show weekly W#/RU# badges
// as "pending" (still live, could change) vs. final, since whoever enters
// that week's revenue in Notion could still amend it right up until it ends.
function leagueWeeksConcluded(now = new Date()) {
  return weeksForPhase('league').map((w) => now > toDate(w.end, '23:59:59'));
}

module.exports = { SCHEDULE, currentWeek, weeksForPhase, toDate, PHASE_ORDER, phaseReached, leagueWeeksConcluded };
