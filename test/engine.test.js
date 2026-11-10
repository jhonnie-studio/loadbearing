import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, normalizeConfig, transition, validate, measurementJql } from '../src/backend/engine.js';

const def = (o) => normalizeConfig({ statement: 's', jql: 'project = X', ...o });

test('count below threshold holds', () => {
  assert.equal(judge(def({ op: '<', threshold: '3' }), { value: 0 }, '2026-11-10').state, 'holding');
});
test('count one below threshold is at risk', () => {
  assert.equal(judge(def({ op: '<', threshold: '3' }), { value: 2 }, '2026-11-10').state, 'at-risk');
});
test('count reaching threshold breaks', () => {
  const r = judge(def({ op: '<', threshold: '3' }), { value: 3 }, '2026-11-10');
  assert.equal(r.state, 'broken');
  assert.match(r.reason, /fewer than 3/);
});
test('>= capacity check', () => {
  assert.equal(judge(def({ op: '>=', threshold: '40', checkType: 'sum', field: 'f' }), { value: 30 }, '2026-11-10').state, 'broken');
  assert.equal(judge(def({ op: '>=', threshold: '40', checkType: 'sum', field: 'f' }), { value: 60 }, '2026-11-10').state, 'holding');
});
test('deadline states', () => {
  const d = def({ checkType: 'deadline', deadline: '2026-12-01' });
  assert.equal(judge(d, { value: 0 }, '2026-12-05').state, 'holding');
  assert.equal(judge(d, { value: 2 }, '2026-12-05').state, 'broken');
  assert.equal(judge(d, { value: 2 }, '2026-11-28').state, 'at-risk');
  assert.equal(judge(d, { value: 2 }, '2026-11-10').state, 'holding');
  assert.match(measurementJql(d), /statusCategory != Done/);
});
test('transitions', () => {
  assert.equal(transition('holding', 'broken'), 'tripped');
  assert.equal(transition('broken', 'holding'), 'restored');
  assert.equal(transition('holding', 'holding'), null);
  assert.equal(transition('holding', 'at-risk'), 'warning');
});
test('validation', () => {
  assert.equal(validate(normalizeConfig({})).length, 2);
  assert.equal(validate(def({ checkType: 'deadline' })).length, 1);
});
