---
name: tripwire
description: Check whether the assumptions behind a team's Confluence plans still hold against live Jira data, using the Tripwire Forge app's MCP tools. Use when the user asks if a plan, launch or deadline is still safe, which plan assumptions broke, or whether a Jira issue depends on a broken assumption.
---

# Tripwire

Tripwire is an Atlassian Forge app. Teams write plan assumptions in Confluence
("we launch only while fewer than 3 Sev-1 bugs are open") and bind each one to a
live Jira check (a JQL count, a field sum, or a deadline). Each assumption is
always in one of three states:

- **BROKEN**: reality no longer matches the plan.
- **AT RISK**: one step (or 10 %) from the limit, or a deadline within 7 days.
- **HOLDING**: the plan's premise is still true.

## Connect

1. A site admin installs Tripwire and turns on its MCP tools in
   admin.atlassian.com → Apps → Sites → (your site) → Connected apps → Tripwire.
2. Add this MCP server to your agent (OAuth 2.1; you approve the site and tools):
   `https://mcp.atlassian.com/forge/fc193347-383c-4527-b2e4-26c93d6fdd56`
3. Tool calls run with your own Atlassian permissions.

## Tools

| Tool | Use it when | Input |
|---|---|---|
| `list-assumptions` | "Is our plan still safe?", "What broke?" | none |
| `issue-risk` | The user names a Jira issue | `issueKey`, e.g. `ATLAS-3` |
| `find-assumption` | The user names a topic ("launch", "capacity", "payments") | `topic` |
| `recheck-assumptions` | The user wants fresh numbers right now | none |

## How to answer

1. Start with `list-assumptions` unless the user named an issue (`issue-risk`)
   or a topic (`find-assumption`). Call `recheck-assumptions` only when asked
   for fresh data or when the last check looks old.
2. Lead with anything BROKEN, then AT RISK. Give the reason in numbers exactly
   as the tool returned it ("Now 3; the plan needs fewer than 3").
3. Link the Confluence plan page and list the dependent Jira issues.
4. Suggest one next step for the assumption's owner (revisit the plan, re-scope,
   or move the date).
5. Never invent assumptions, numbers, issues or owners the tools did not return.

## Before you change code

If the user asks you to change code covered by a BROKEN assumption (for example,
work under a dependent Jira issue), tell them first which assumption broke and
why, so the plan owner can decide.
