import api, { route } from '@forge/api';
import { labelOps } from './labels.js';

async function jira(path, opts = {}) {
  const res = await api.asApp().requestJira(path, {
    ...opts,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Page through /search/jql and return issues with the given fields. */
export async function searchIssues(jql, fields = ['summary', 'status'], max = 500) {
  const issues = [];
  let nextPageToken;
  do {
    const body = { jql, fields, maxResults: Math.min(100, max - issues.length) };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const page = await jira(route`/rest/api/3/search/jql`, { method: 'POST', body: JSON.stringify(body) });
    issues.push(...(page.issues || []));
    nextPageToken = page.isLast === false ? page.nextPageToken : undefined;
  } while (nextPageToken && issues.length < max);
  return issues;
}

export async function countIssues(jql) {
  const issues = await searchIssues(jql, ['status'], 1000);
  return issues.length;
}

export async function sumField(jql, field) {
  const issues = await searchIssues(jql, [field], 1000);
  return issues.reduce((s, i) => {
    const v = i.fields?.[field];
    const n = typeof v === 'number' ? v : Number.parseFloat(v?.value ?? v);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export async function impactIssues(jql) {
  if (!jql) return [];
  const issues = await searchIssues(jql, ['summary', 'status', 'issuetype', 'assignee'], 50);
  return issues.map((i) => ({
    key: i.key,
    summary: i.fields?.summary || '',
    status: i.fields?.status?.name || '',
    statusCategory: i.fields?.status?.statusCategory?.key || '',
    type: i.fields?.issuetype?.name || '',
    assignee: i.fields?.assignee?.displayName || null,
  }));
}

export async function setAtRiskLabel(issueKey, on) {
  await jira(route`/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    body: JSON.stringify({ update: { labels: labelOps(on) } }),
  });
}

function text(t, marks) {
  return marks ? { type: 'text', text: t, marks } : { type: 'text', text: t };
}

/** Post an ADF comment explaining the trip (or the recovery). */
export async function commentTransition(issueKey, a, kind) {
  const tripped = kind === 'tripped';
  const content = [
    text(tripped ? '🔴 Loadbearing: a plan assumption this work depends on just broke. ' : '✅ Loadbearing: the assumption this work depends on holds again. ', [{ type: 'strong' }]),
  ];
  const para2 = [text('Assumption: '), text(`“${a.statement}”`, [{ type: 'em' }])];
  if (a.pageUrl) para2.push(text(' (from '), text(a.pageTitle || 'the plan', [{ type: 'link', attrs: { href: a.pageUrl } }]), text(')'));
  const para3 = [text(a.last?.reason || '')];
  if (tripped && a.owner) {
    para3.push(text(' Owner: '), { type: 'mention', attrs: { id: a.owner } }, text(' — please revisit the plan.'));
  }
  const body = {
    body: {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content },
        { type: 'paragraph', content: para2 },
        { type: 'paragraph', content: para3 },
      ],
    },
  };
  await jira(route`/rest/api/3/issue/${issueKey}/comment`, { method: 'POST', body: JSON.stringify(body) });
}
