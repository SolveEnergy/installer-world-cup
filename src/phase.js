// Fixed tournament schedule, per the "World Cup Kickoff Deck" (Aug 4 - Sep 7).
// All weeks run Monday -> Sunday. Dates are inclusive. Solve Energy is a BC
// company, so times are anchored to Pacific, not the Eastern zone the
// original KW World Cup (Apex Cup) app used.

const SCHEDULE = [
  { key: 'week1', phase: 'league', label: 'Week 1 - League Play', start: '2026-08-04', end: '2026-08-10' },
  { key: 'week2', phase: 'league', label: 'Week 2 - League Play', start: '2026-08-11', end: '2026-08-17' },
  { key: 'week3', phase: 'league', label: 'Week 3 - League Play', start: '2026-08-18', end: '2026-08-24' },
  { key: 'week4', phase: 'league', label: 'Week 4 - League Play', start: '2026-08-25', end: '2026-08-31' },
  { key: 'week5', phase: 'final', label: 'Week 5 - The Knockout Finale', start: '2026-09-01', end: '2026-09-07' },
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
