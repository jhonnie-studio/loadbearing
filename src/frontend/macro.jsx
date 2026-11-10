import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, DatePicker, Heading, Inline, Label, SectionMessage, Select, Spinner, Stack, Strong,
  Tag, TagGroup, Text, TextArea, Textfield, UserPicker, useConfig, useProductContext,
} from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { History, Muted, StateLozenge, ago, card, pickValue } from './common.jsx';

const TYPE_OPTIONS = [
  { label: 'Count of Jira issues (JQL)', value: 'count' },
  { label: 'Sum of a number field (JQL)', value: 'sum' },
  { label: 'Work finished by a date (JQL)', value: 'deadline' },
];
const OP_OPTIONS = [
  { label: 'fewer than (<)', value: '<' },
  { label: 'at most (≤)', value: '<=' },
  { label: 'more than (>)', value: '>' },
  { label: 'at least (≥)', value: '>=' },
  { label: 'exactly (=)', value: '=' },
];

const Config = () => (
  <>
    <Label>The assumption, in plain words</Label>
    <TextArea name="statement" placeholder="We launch only while fewer than 3 Sev-1 bugs are open" />
    <Label>How Tripwire checks it</Label>
    <Select name="checkType" options={TYPE_OPTIONS} defaultValue={TYPE_OPTIONS[0]} />
    <Label>JQL to watch</Label>
    <TextArea name="jql" placeholder='project = OPS AND priority = Highest AND statusCategory != Done' />
    <Label>The plan needs the result to be</Label>
    <Select name="op" options={OP_OPTIONS} defaultValue={OP_OPTIONS[0]} />
    <Label>Limit</Label>
    <Textfield name="threshold" placeholder="3" />
    <Label>Number field to sum (only for “Sum”)</Label>
    <Textfield name="field" placeholder="customfield_10016 (story points)" />
    <Label>Deadline (only for “finished by a date”)</Label>
    <DatePicker name="deadline" placeholder="Pick a date" />
    <Label>Dependent work (JQL) — flagged when this breaks</Label>
    <TextArea name="impactJql" placeholder='project = WEB AND labels = launch' />
    <Label>Owner — notified when it breaks</Label>
    <UserPicker name="owner" />
  </>
);

function clean(cfg) {
  if (!cfg) return null;
  return {
    statement: cfg.statement,
    checkType: pickValue(cfg.checkType),
    jql: cfg.jql,
    op: pickValue(cfg.op),
    threshold: cfg.threshold,
    field: cfg.field,
    deadline: cfg.deadline,
    impactJql: cfg.impactJql,
    owner: pickValue(cfg.owner),
  };
}

const work = (n) => (n === 1 ? '1 piece of work' : `${n} pieces of work`);

const App = () => {
  const config = useConfig();
  const ctx = useProductContext();
  const [a, setA] = useState(null);
  const [busy, setBusy] = useState(false);
  const cfg = clean(config);
  const cfgKey = JSON.stringify(cfg);

  useEffect(() => {
    if (!cfg?.statement) return undefined;
    let alive = true;
    view.getContext().catch(() => ({})).then((vc) => invoke('register', {
      config: cfg,
      pageId: ctx?.extension?.content?.id,
      siteUrl: vc?.siteUrl,
      pageTitle: ctx?.extension?.content?.title,
    })).then((r) => alive && setA(r));
    const t = setInterval(() => invoke('get', { home: a?.home }).then((r) => alive && r && setA(r)), 4000);
    return () => { alive = false; clearInterval(t); };
  }, [cfgKey, ctx?.extension?.content?.id]);

  if (!cfg?.statement) {
    return (
      <SectionMessage title="Add the assumption your plan depends on" appearance="information">
        <Text>Edit the page, select this Tripwire block and click the pencil to describe the assumption and the Jira query that proves it.</Text>
      </SectionMessage>
    );
  }
  if (!a) return <Inline space="space.100"><Spinner size="small" /><Text>Checking against Jira…</Text></Inline>;
  if (a.errors?.length) {
    return <SectionMessage title="Tripwire needs a bit more" appearance="warning">{a.errors.map((e) => <Text key={e}>{e}</Text>)}</SectionMessage>;
  }

  const recheck = async () => {
    setBusy(true);
    try { setA(await invoke('recheck', { id: a.id, home: a.home })); } finally { setBusy(false); }
  };

  return (
    <Box xcss={card(a)}>
      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="center">
          <Inline space="space.100" alignBlock="center">
            <Text>⚡</Text>
            <StateLozenge a={a} />
            <Muted>checked {ago(a.checkedAt)}</Muted>
          </Inline>
          <Button appearance="subtle" spacing="compact" onClick={recheck} isLoading={busy}>Re-check</Button>
        </Inline>
        <Heading size="small">{a.statement}</Heading>
        <Text><Strong>{a.last?.reason || ''}</Strong></Text>
        <Muted>Watching: {a.def.jql}</Muted>
        {a.impact?.length > 0 && (
          <Stack space="space.050">
            <Muted>{a.state === 'broken' ? `${work(a.impact.length)} ${a.impact.length === 1 ? 'is' : 'are'} now exposed:` : `${work(a.impact.length)} depend${a.impact.length === 1 ? 's' : ''} on this:`}</Muted>
            <TagGroup>
              {a.impact.slice(0, 12).map((i) => (
                <Tag key={i.key} text={`${i.key} ${i.summary.slice(0, 28)}`} color={a.state === 'broken' ? 'redLight' : a.state === 'at-risk' ? 'yellowLight' : 'greenLight'} />
              ))}
            </TagGroup>
          </Stack>
        )}
        <History a={a} />
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
ForgeReconciler.addConfig(<Config />);
