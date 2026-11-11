import api, { route } from '@forge/api';
import { Queue } from '@forge/events';

// Legacy key, kept for installed sites (the app was called Tripwire before).
const notifyQueue = new Queue({ key: 'tripwire-recheck' });
import { judge, measurementJql, normalizeConfig, transition, validate } from './engine.js';
import { countIssues, sumField, impactIssues, setAtRiskLabel, commentTransition } from './jira.js';
import { getAssumption, homeProject, listAssumptions, saveAssumption } from './store.js';

const today = () => new Date().toISOString().slice(0, 10);

async function pageInfo(pageId) {
  if (!pageId) return {};
  try {
    const res = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.error('page lookup failed', res.status, (await res.text()).slice(0, 200));
      return {};
    }
    const p = await res.json();
    const base = p._links?.base || '';
    return { pageTitle: p.title, pageUrl: p._links?.webui ? `${base}${p._links.webui}` : undefined };
  } catch (e) {
    console.error('page lookup error', e.message);
    return {};
  }
}

/** Called by the Confluence macro every time it renders with a config. */
export async function register({ id, pageId, config, siteUrl, pageTitle }) {
  const def = normalizeConfig(config);
  const errors = validate(def);
  const existing = await getAssumption(id, homeProject(def));
  const sameDef = existing && JSON.stringify(existing.def) === JSON.stringify(def);
  if (errors.length) return { ...(existing || {}), id, def, errors };

  // A changed definition is a new assumption: start its history fresh.
  let a = existing && sameDef ? existing : {
    id, def, state: 'unknown', history: [], impact: [], createdAt: existing?.createdAt || new Date().toISOString(),
  };
  a.statement = def.statement;
  a.owner = def.owner;
  if (!a.pageId || a.pageId !== pageId || !a.pageTitle) {
    Object.assign(a, { pageId }, await pageInfo(pageId));
    if (!a.pageTitle && pageTitle) a.pageTitle = pageTitle;
    if (a.pageUrl && a.pageUrl.startsWith('/') && siteUrl) a.pageUrl = `${siteUrl}/wiki${a.pageUrl}`;
    if (!a.pageUrl && siteUrl && pageId) a.pageUrl = `${siteUrl}/wiki/pages/viewpage.action?pageId=${pageId}`;
  }
  if (!sameDef || !a.checkedAt) a = await evaluate(a, 'configured', { notify: false });
  else await saveAssumption(a);
  return a;
}

async function measure(def) {
  const jql = measurementJql(def);
  if (def.checkType === 'sum') return { value: await sumField(jql, def.field) };
  return { value: await countIssues(jql) };
}

/** Re-measure one assumption, store the result and fire side-effects on a state change. */
export async function evaluate(a, cause = 'check', { notify: mayNotify = true } = {}) {
  const def = a.def;
  let result;
  try {
    result = judge(def, await measure(def), today());
  } catch (e) {
    result = { state: 'error', value: null, reason: String(e.message || e).slice(0, 200) };
  }
  const prev = a.state;
  const now = new Date().toISOString();
  a.last = { ...result, at: now, cause };
  a.checkedAt = now;
  try {
    a.impact = await impactIssues(def.impactJql);
  } catch {
    a.impact = a.impact || [];
  }
  const kind = result.state === 'error' ? null : transition(prev, result.state);
  if (result.state !== 'error') a.state = result.state;
  if (kind || !a.history.length) {
    a.history = [...a.history, { at: now, state: a.state, value: result.value, reason: result.reason, cause }].slice(-40);
  }
  if (kind === 'tripped') a.trippedAt = now;

  // Side-effects on Jira work are never done here: a serialised queue job (one at a time per
  // assumption) compares the stored state with what the work was last told, so concurrent
  // evaluations can never comment twice.
  await saveAssumption(a);
  const target = a.state === 'broken' ? 'broken' : 'ok';
  if (mayNotify && result.state !== 'error' && (a.notified || 'ok') !== target) {
    await notifyQueue.push({ body: { kind: 'notify', id: a.id, home: a.home }, concurrency: { key: `n-${a.id}`.slice(0, 60), limit: 1 } })
      .catch((e) => console.error('queue push failed', e.message));
  }
  return a;
}

/** Queue consumer: tell dependent work about a break/recovery exactly once. */
export async function deliverNotification(id, home) {
  const a = await getAssumption(id, home);
  if (!a) return;
  const target = a.state === 'broken' ? 'broken' : 'ok';
  if ((a.notified || 'ok') === target) return;
  a.notified = target;
  await saveAssumption(a);
  await notify(a, target === 'broken' ? 'tripped' : 'restored');
}

async function notify(a, kind) {
  const all = kind === 'restored' ? await listAssumptions() : [];
  for (const issue of a.impact.slice(0, 25)) {
    try {
      if (kind === 'tripped') {
        await setAtRiskLabel(issue.key, true);
      } else {
        const stillBroken = all.some((o) => o.id !== a.id && o.state === 'broken' && o.impact?.some((i) => i.key === issue.key));
        if (!stillBroken) await setAtRiskLabel(issue.key, false);
      }
      await commentTransition(issue.key, a, kind);
    } catch (e) {
      console.error('notify failed', issue.key, e.message);
    }
  }
}

export async function evaluateAll(cause = 'check', projectKeys, opts = {}) {
  const all = await listAssumptions(projectKeys);
  const out = [];
  for (const a of all) {
    if (!a.def || validate(a.def).length) continue;
    out.push(await evaluate(a, cause, opts));
  }
  return out;
}

/** Re-measure only if the last check is older than maxAgeMs (used by open pages). */
export async function freshen(a, maxAgeMs = 10000) {
  if (!a || validate(a.def).length) return a;
  if (a.checkedAt && Date.now() - Date.parse(a.checkedAt) < maxAgeMs) return a;
  return evaluate(a, 'live check', { notify: false });
}

export async function risksForIssue(issueKey) {
  const all = await listAssumptions();
  return all.filter((a) => a.impact?.some((i) => i.key === issueKey));
}

/** Plain-text summary used by the Rovo agent and MCP tools. */
export function describe(a) {
  const icon = { holding: '🟢', 'at-risk': '🟡', broken: '🔴', unknown: '⚪' }[a.state] || '⚪';
  const lines = [
    `${icon} ${a.state.toUpperCase()}: "${a.statement}"`,
    `   ${a.last?.reason || 'Not checked yet.'}`,
    `   Watches: ${a.def.jql}`,
  ];
  if (a.pageTitle) lines.push(`   Plan: ${a.pageTitle}${a.pageUrl ? ` (${a.pageUrl})` : ''}`);
  if (a.impact?.length) lines.push(`   Dependent work (${a.impact.length}): ${a.impact.slice(0, 8).map((i) => i.key).join(', ')}`);
  if (a.trippedAt && a.state === 'broken') lines.push(`   Broke at: ${a.trippedAt}`);
  return lines.join('\n');
}
