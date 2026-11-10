import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Link, SectionMessage, Spinner, Stack, Strong, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { History, Muted, StateLozenge, ago, card } from './common.jsx';

const App = () => {
  const [risks, setRisks] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => invoke('issueRisks', {}).then((r) => alive && setRisks(r || []));
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!risks) return <Spinner size="small" />;
  if (!risks.length) return <Muted>This work does not depend on any watched plan assumption.</Muted>;

  const broken = risks.filter((a) => a.state === 'broken');
  return (
    <Stack space="space.150">
      {broken.length > 0 && (
        <SectionMessage appearance="error" title={`${broken.length === 1 ? 'A plan assumption' : `${broken.length} plan assumptions`} behind this work broke`}>
          <Text>Check with the owner before continuing.</Text>
        </SectionMessage>
      )}
      {risks.map((a) => (
        <Box key={a.id} xcss={card(a)}>
          <Stack space="space.075">
            <StateLozenge a={a} />
            <Text><Strong>{a.statement}</Strong></Text>
            <Text>{a.last?.reason}</Text>
            {a.pageUrl && <Link href={a.pageUrl} openNewTab>Open plan: {a.pageTitle || 'Confluence page'}</Link>}
            <Muted>checked {ago(a.checkedAt)}</Muted>
            <History a={a} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
