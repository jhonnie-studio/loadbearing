import React from 'react';
import { Box, Inline, Lozenge, Text, xcss } from '@forge/react';

export const STATE = {
  holding: { label: 'HOLDING', appearance: 'success', color: 'color.border.success', bg: 'color.background.success' },
  'at-risk': { label: 'AT RISK', appearance: 'moved', color: 'color.border.warning', bg: 'color.background.warning' },
  broken: { label: 'BROKEN', appearance: 'removed', color: 'color.border.danger', bg: 'color.background.danger' },
  unknown: { label: 'NOT CHECKED', appearance: 'default', color: 'color.border', bg: 'color.background.neutral' },
};

export const stateOf = (a) => STATE[a?.state] || STATE.unknown;

export function StateLozenge({ a }) {
  const s = stateOf(a);
  return <Lozenge appearance={s.appearance} isBold>{s.label}</Lozenge>;
}

export function card(a) {
  const s = stateOf(a);
  return xcss({
    borderColor: s.color,
    borderStyle: 'solid',
    borderWidth: 'border.width',
    borderLeftWidth: 'border.width.outline',
    borderRadius: 'border.radius.200',
    backgroundColor: a?.state === 'broken' ? 'color.background.danger' : 'elevation.surface.raised',
    padding: 'space.200',
  });
}

export function ago(iso) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** A row of coloured dots showing the last state changes. */
export function History({ a }) {
  const h = (a?.history || []).slice(-12);
  if (!h.length) return null;
  const dot = { holding: '🟢', 'at-risk': '🟡', broken: '🔴' };
  return (
    <Inline space="space.050" alignBlock="center">
      <Text size="small" color="color.text.subtlest">History</Text>
      <Text size="small">{h.map((x) => dot[x.state] || '⚪').join(' ')}</Text>
    </Inline>
  );
}

export const pickValue = (v) => (v && typeof v === 'object' ? v.value ?? v.id ?? v.accountId ?? '' : v);

export function Muted({ children }) {
  return <Text size="small" color="color.text.subtlest">{children}</Text>;
}

export const spacer = xcss({ paddingTop: 'space.100' });

export function Pad({ children }) {
  return <Box xcss={spacer}>{children}</Box>;
}
