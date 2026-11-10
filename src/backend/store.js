import { kvs } from '@forge/kvs';

const INDEX = 'tripwire:index';
const key = (id) => `tripwire:a:${id}`;

export async function listIds() {
  return (await kvs.get(INDEX)) || [];
}

export async function getAssumption(id) {
  return kvs.get(key(id));
}

export async function listAssumptions() {
  const ids = await listIds();
  const all = await Promise.all(ids.map((id) => kvs.get(key(id))));
  return all.filter(Boolean);
}

export async function saveAssumption(a) {
  await kvs.set(key(a.id), a);
  const ids = await listIds();
  if (!ids.includes(a.id)) {
    ids.push(a.id);
    await kvs.set(INDEX, ids);
  }
  return a;
}

export async function deleteAssumption(id) {
  await kvs.delete(key(id));
  const ids = (await listIds()).filter((x) => x !== id);
  await kvs.set(INDEX, ids);
}
