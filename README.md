# ⚡ Tripwire

**Every plan rests on assumptions. Tripwire watches them for you.**

Teams write plans in Confluence: *"We launch only while fewer than 3 Sev-1 bugs are open."* *"The API is done by 1 December."* *"We have at least 40 points of capacity this sprint."* Then reality moves on in Jira, and nobody notices that the plan's foundation just cracked.

Tripwire is an Atlassian Forge app (Codegeist 2026, *Apps for Software Teams*) that binds each assumption in a Confluence plan to a **live Jira check**. The moment reality breaks it:

- the assumption on the Confluence page turns **red**, live, with the reason in numbers;
- every piece of dependent Jira work gets a **`tripwire-at-risk`** label, a comment, and a Tripwire panel that explains what broke;
- the assumption's **owner is @mentioned** so they know exactly which plan to revisit;
- the **Tripwire** page in Jira shows every assumption across the organisation: broken, at risk, holding.

When reality recovers, Tripwire says so, and the labels come off.

## How it works

| Piece | Forge module |
|---|---|
| Write an assumption in a plan, bound to JQL | Confluence `macro` (UI Kit, with config) |
| Re-check when Jira changes, then again a few seconds later | `trigger` on issue created / updated / deleted, `consumer` (async events with delay), hourly `scheduledTrigger` |
| See the risk on the work itself | `jira:issueContext` panel, label, ADF comment with owner mention |
| Org-wide view | `jira:globalPage` |
| Ask "which of our assumptions broke?" | `rovo:agent` with four `action`s |
| Use the same tools from any AI client | `rovo:mcp` server exposing the same actions |

Three kinds of check, all deterministic (no LLM calls, no data leaves Atlassian; the app is eligible for **Runs on Atlassian**):

- **Count:** number of issues matching JQL, compared with a limit (`<`, `≤`, `>`, `≥`, `=`).
- **Sum:** sum of a numeric field (for example story points) across JQL.
- **Deadline:** all issues matching JQL must be Done by a date (at risk inside the last 7 days).

An assumption within one step (or 10 %) of its limit is shown **at risk** before it breaks.

## Try it

1. Install the app (installation link in the Devpost submission).
2. In a Confluence page, type `/Tripwire assumption`, describe the assumption, the JQL to watch, the limit, the dependent work (JQL) and the owner.
3. Change something in Jira that breaks it and watch the page.

## Develop

```bash
npm install
npm test            # engine unit tests
forge deploy
forge install
```

## Credits

Built by Naif (Jhonnie Studio) with AI coding tools (Claude Code). MIT licensed.
