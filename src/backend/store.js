// Shared state lives in a Jira *project property* on the assumption's home project.
// Forge storage is per installation, so the Confluence macro and the Jira trigger/panels
// could not see each other's KVS. A project property is readable and writable from both.
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';

const PROP = 'tripwire.assumptions';
const homeKey = (id) => `tripwire:home:${id}`;

async function jira(path, opts = {}) {
  return api.asApp().requestJira(path, {
    ...opts,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  });
}

/** The first project named in a JQL query, e.g. `project = ATLAS` → ATLAS. */
export function homeProject(def) {
  for (const q of [def?.jql, def?.impactJql]) {
    const m = /project\s*(?:=|in)\s*\(?\s*"?([A-Za-z][A-Za-z0-9_]+)"?/i.exec(q || '');
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export async function readProject(projectKey) {
  const res = await jira(route`/rest/api/3/project/${projectKey}/properties/${PROP}`);
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body.value) ? body.value : [];
}

async function writeProject(projectKey, list) {
  const res = await jira(route`/rest/api/3/project/${projectKey}/properties/${PROP}`, {
    method: 'PUT',
    body: JSON.stringify(list),
  });
  if (!res.ok) throw new Error(`Saving to project ${projectKey} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

function compact(a) {
  return { ...a, history: (a.history || []).slice(-15), impact: (a.impact || []).slice(0, 25) };
}

export async function getAssumption(id, home) {
  const projectKey = home || (await kvs.get(homeKey(id)));
  if (!projectKey) return null;
  return (await readProject(projectKey)).find((a) => a.id === id) || null;
}

export async function saveAssumption(a) {
  const projectKey = a.home || homeProject(a.def);
  if (!projectKey) throw new Error('The JQL must name a project, e.g. "project = ATLAS AND …"');
  a.home = projectKey;
  const list = await readProject(projectKey);
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = compact(a); else list.push(compact(a));
  await writeProject(projectKey, list);
  await kvs.set(homeKey(a.id), projectKey).catch(() => {});
  return a;
}

export async function deleteAssumption(id, home) {
  const projectKey = home || (await kvs.get(homeKey(id)));
  if (!projectKey) return;
  await writeProject(projectKey, (await readProject(projectKey)).filter((a) => a.id !== id));
}

/** Projects that hold Tripwire assumptions. */
async function projectsWithAssumptions() {
  const keys = [];
  let startAt = 0;
  for (;;) {
    const res = await jira(route`/rest/api/3/project/search?maxResults=50&startAt=${startAt}`);
    if (!res.ok) break;
    const page = await res.json();
    keys.push(...(page.values || []).map((p) => p.key));
    if (page.isLast !== false || !page.values?.length) break;
    startAt += page.values.length;
  }
  return keys;
}

export async function listAssumptions(projectKeys) {
  const keys = projectKeys || (await projectsWithAssumptions());
  const lists = await Promise.all(keys.map((k) => readProject(k).catch(() => [])));
  return lists.flat();
}
