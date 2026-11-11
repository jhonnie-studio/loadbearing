// Pure evaluation logic for Loadbearing assumptions (no Forge imports, unit-testable).

export const CHECK_TYPES = {
  count: 'Number of Jira issues matching a JQL query',
  sum: 'Sum of a numeric field across a JQL query',
  deadline: 'Work must be finished by a date',
};

export const OPS = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '=': (a, b) => a === b,
};

export const OP_WORDS = {
  '<': 'fewer than',
  '<=': 'at most',
  '>': 'more than',
  '>=': 'at least',
  '=': 'exactly',
};

/** Normalise raw macro config into an assumption definition. */
export function normalizeConfig(cfg = {}) {
  const type = CHECK_TYPES[cfg.checkType] ? cfg.checkType : 'count';
  const op = OPS[cfg.op] ? cfg.op : '<';
  const threshold = Number.parseFloat(cfg.threshold);
  return {
    statement: String(cfg.statement || '').trim(),
    checkType: type,
    jql: String(cfg.jql || '').trim(),
    op,
    threshold: Number.isFinite(threshold) ? threshold : 0,
    field: String(cfg.field || '').trim(),
    deadline: cfg.deadline || '',
    impactJql: String(cfg.impactJql || '').trim(),
    owner: cfg.owner || null,
  };
}

export function validate(def) {
  const errors = [];
  if (!def.statement) errors.push('Write the assumption in plain words.');
  if (!def.jql) errors.push('Add the JQL query Loadbearing should watch.');
  if (def.checkType === 'sum' && !def.field) errors.push('Pick the numeric field to sum (for example customfield_10016).');
  if (def.checkType === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(def.deadline)) errors.push('Set the deadline date.');
  return errors;
}

/**
 * Decide whether an assumption holds.
 * measurement: { value:number, openCount?:number } ; today: 'YYYY-MM-DD'
 * returns { state: 'holding'|'broken'|'at-risk', value, reason }
 */
export function judge(def, measurement, today) {
  const value = measurement.value;
  if (def.checkType === 'deadline') {
    // value = issues in the JQL that are NOT done yet
    const daysLeft = daysBetween(today, def.deadline);
    if (value === 0) return { state: 'holding', value, reason: 'All tracked work is done.' };
    if (daysLeft < 0) return { state: 'broken', value, reason: `${plural(value, 'issue')} still open after ${def.deadline}.` };
    if (daysLeft <= 7) return { state: 'at-risk', value, reason: `${plural(value, 'issue')} open, ${plural(daysLeft, 'day')} to ${def.deadline}.` };
    return { state: 'holding', value, reason: `${plural(value, 'issue')} open, ${plural(daysLeft, 'day')} left.` };
  }
  const ok = OPS[def.op](value, def.threshold);
  const want = `${OP_WORDS[def.op]} ${fmt(def.threshold)}`;
  if (!ok) return { state: 'broken', value, reason: `Now ${fmt(value)}; the plan needs ${want}.` };
  // within 1 step (or 10%) of the limit = at risk
  const margin = Math.max(1, Math.abs(def.threshold) * 0.1);
  const near = (def.op === '<' || def.op === '<=') ? def.threshold - value <= margin
    : (def.op === '>' || def.op === '>=') ? value - def.threshold <= margin : false;
  if (near) return { state: 'at-risk', value, reason: `Now ${fmt(value)}; one step from the limit (${want}).` };
  return { state: 'holding', value, reason: `Now ${fmt(value)}; the plan needs ${want}.` };
}

/** Describe a state transition, or null if nothing changed. */
export function transition(prevState, nextState) {
  if (prevState === nextState) return null;
  if (nextState === 'broken') return 'tripped';
  if (prevState === 'broken') return 'restored';
  if (nextState === 'at-risk') return 'warning';
  return 'changed';
}

export function daysBetween(a, b) {
  const d = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(b) - d(a)) / 86400000);
}

export function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Deadline checks only count unfinished work. */
export function measurementJql(def) {
  if (def.checkType === 'deadline') return `(${def.jql}) AND statusCategory != Done`;
  return def.jql;
}
