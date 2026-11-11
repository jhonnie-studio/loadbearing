import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, DynamicTable, Heading, Inline, Link, SectionMessage, Spinner, Stack, Strong, Tag, TagGroup, Text, xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { History, Muted, StateLozenge, ago, card } from './common.jsx';

const tile = (bg) => xcss({ backgroundColor: bg, borderRadius: 'border.radius.200', padding: 'space.200', minWidth: '140px' });

function Tile({ n, label, bg }) {
  return (
    <Box xcss={tile(bg)}>
      <Heading size="large">{String(n)}</Heading>
      <Text>{label}</Text>
    </Box>
  );
}

const ORDER = { broken: 0, 'at-risk': 1, holding: 2, unknown: 3 };

const App = () => {
  const [all, setAll] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => invoke('list', {}).then((r) => alive && setAll(r || []));
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!all) return <Spinner />;
  const sorted = [...all].sort((a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9));
  const count = (s) => all.filter((a) => a.state === s).length;
  const exposed = new Set(all.filter((a) => a.state === 'broken').flatMap((a) => (a.impact || []).map((i) => i.key)));

  const recheckAll = async () => {
    setBusy(true);
    try { setAll(await invoke('recheckAll', {})); } finally { setBusy(false); }
  };

  const rows = sorted.map((a) => ({
    key: a.id,
    cells: [
      { key: 's', content: <StateLozenge a={a} /> },
      { key: 'a', content: <Stack space="space.050"><Text><Strong>{a.statement}</Strong></Text><Muted>{a.last?.reason}</Muted></Stack> },
      { key: 'p', content: a.pageUrl ? <Link href={a.pageUrl} openNewTab>{a.pageTitle || 'Plan'}</Link> : <Muted>—</Muted> },
      { key: 'i', content: <Text>{String(a.impact?.length || 0)}</Text> },
      { key: 'c', content: <Muted>{ago(a.checkedAt)}</Muted> },
    ],
  }));

  return (
    <Stack space="space.300">
      <Inline spread="space-between" alignBlock="center">
        <Stack space="space.050">
          <Heading size="large">🏛️ Loadbearing</Heading>
          <Muted>Every plan rests on assumptions. These are yours, checked live against Jira.</Muted>
        </Stack>
        <Button appearance="primary" onClick={recheckAll} isLoading={busy}>Re-check all now</Button>
      </Inline>

      <Inline space="space.200">
        <Tile n={count('broken')} label="Broken" bg="color.background.danger" />
        <Tile n={count('at-risk')} label="At risk" bg="color.background.warning" />
        <Tile n={count('holding')} label="Holding" bg="color.background.success" />
        <Tile n={exposed.size} label="Issues exposed" bg="color.background.neutral" />
      </Inline>

      {all.length === 0 && (
        <SectionMessage title="No assumptions yet" appearance="information">
          <Text>Open a plan in Confluence, type /Loadbearing and describe what your plan depends on.</Text>
        </SectionMessage>
      )}

      {sorted.filter((a) => a.state === 'broken').map((a) => (
        <Box key={a.id} xcss={card(a)}>
          <Stack space="space.100">
            <Inline space="space.100" alignBlock="center">
              <StateLozenge a={a} />
              <Text><Strong>{a.statement}</Strong></Text>
            </Inline>
            <Text>{a.last?.reason}</Text>
            <Inline space="space.100" alignBlock="center">
              <Text>📄 {a.pageTitle || 'Plan'}</Text><Text>→</Text><Text>🏛️ assumption</Text><Text>→</Text>
              <Text>{`${a.impact?.length || 0} exposed`}</Text>
            </Inline>
            <TagGroup>
              {(a.impact || []).map((i) => <Tag key={i.key} text={`${i.key} · ${i.summary.slice(0, 32)}`} color="redLight" />)}
            </TagGroup>
            <History a={a} />
          </Stack>
        </Box>
      ))}

      {all.length > 0 && (
        <DynamicTable
          head={{ cells: [
            { key: 's', content: 'State' }, { key: 'a', content: 'Assumption' }, { key: 'p', content: 'Plan' },
            { key: 'i', content: 'Dependent work' }, { key: 'c', content: 'Checked' },
          ] }}
          rows={rows}
        />
      )}
    </Stack>
  );
};

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
