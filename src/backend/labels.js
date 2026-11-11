// Jira label handling (pure, unit-testable).
export const LABEL = 'assumption-at-risk';
// Label used before the rename to Loadbearing. Removed whenever we touch an issue's labels,
// so issues labelled by the old version don't keep a stale label.
export const LEGACY_LABELS = ['tripwire-at-risk'];

/** Jira `update.labels` operations to mark an issue at risk (on) or clear it (off). */
export function labelOps(on) {
  const legacy = LEGACY_LABELS.map((l) => ({ remove: l }));
  return on ? [{ add: LABEL }, ...legacy] : [{ remove: LABEL }, ...legacy];
}
