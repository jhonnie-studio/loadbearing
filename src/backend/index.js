import Resolver from '@forge/resolver';
import { Queue } from '@forge/events';
import { describe, evaluate, evaluateAll, freshen, register, risksForIssue } from './service.js';
import { deleteAssumption, getAssumption, listAssumptions } from './store.js';

const recheckQueue = new Queue({ key: 'tripwire-recheck' });

// ---------- UI resolvers (macro, Jira issue panel, dashboard) ----------
const resolver = new Resolver();

resolver.define('register', async ({ payload, context }) => {
  const id = context.localId || payload.localId;
  const pageId = context.extension?.content?.id || payload.pageId;
  return register({ id, pageId, config: payload.config || {}, siteUrl: context.siteUrl });
});

resolver.define('get', async ({ payload, context }) => freshen(await getAssumption(payload.id || context.localId, payload.home)));

resolver.define('recheck', async ({ payload }) => {
  const a = await getAssumption(payload.id, payload.home);
  return a ? evaluate(a, 'manual re-check') : null;
});

resolver.define('list', async () => listAssumptions());

resolver.define('recheckAll', async () => evaluateAll('manual re-check'));

resolver.define('remove', async ({ payload }) => {
  await deleteAssumption(payload.id, payload.home);
  return listAssumptions();
});

resolver.define('issueRisks', async ({ context }) => {
  const key = context.extension?.issue?.key;
  return key ? risksForIssue(key) : [];
});

export const handler = resolver.getDefinitions();

// ---------- Jira product events: re-check now, and again shortly after (search index lag) ----------
export async function onIssueEvent(event) {
  console.log('tripwire issue event', event?.eventType, event?.issue?.key);
  const project = event?.issue?.fields?.project?.key || event?.issue?.key?.split('-')[0];
  const projects = project ? [project] : undefined;
  await evaluateAll(`Jira ${event?.eventType?.split(':').pop() || 'event'}: ${event?.issue?.key || ''}`.trim(), projects);
  await recheckQueue.push({ body: { cause: `follow-up after ${event?.issue?.key || 'issue change'}`, projects }, delayInSeconds: 6 });
}

export async function onRecheck(event) {
  await evaluateAll(event?.body?.cause || 'follow-up', event?.body?.projects);
}

export async function onSchedule() {
  await evaluateAll('scheduled check');
}

// ---------- Rovo agent actions (also exposed as MCP tools) ----------
export async function actionListAssumptions() {
  const all = await listAssumptions();
  if (!all.length) return 'No assumptions are being watched yet. Add the Tripwire macro to a Confluence plan page.';
  const order = { broken: 0, 'at-risk': 1, holding: 2, unknown: 3 };
  all.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));
  const counts = all.reduce((m, a) => ({ ...m, [a.state]: (m[a.state] || 0) + 1 }), {});
  return [`Watching ${all.length} assumptions: ${counts.broken || 0} broken, ${counts['at-risk'] || 0} at risk, ${counts.holding || 0} holding.`, '', ...all.map(describe)].join('\n');
}

export async function actionIssueRisk(payload) {
  const key = String(payload?.issueKey || '').trim().toUpperCase();
  if (!key) return 'Please give me a Jira issue key, like OPS-12.';
  const risks = await risksForIssue(key);
  if (!risks.length) return `${key} does not depend on any watched plan assumption.`;
  return [`${key} depends on ${risks.length} plan assumption(s):`, '', ...risks.map(describe)].join('\n');
}

export async function actionRecheck() {
  const all = await evaluateAll('Rovo re-check');
  if (!all.length) return 'Nothing to check yet.';
  return ['Re-checked every assumption against live Jira data:', '', ...all.map(describe)].join('\n');
}

export async function actionFindAssumption(payload) {
  const q = String(payload?.topic || '').toLowerCase();
  const all = await listAssumptions();
  const words = q.split(/\W+/).filter((w) => w.length > 2);
  const hits = all.filter((a) => {
    const hay = `${a.statement} ${a.def?.jql} ${a.pageTitle}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
  if (!hits.length) return `No watched assumption mentions "${payload?.topic}".`;
  return hits.map(describe).join('\n\n');
}
