# Tripwire privacy policy

_Last updated: 10 November 2026_

Tripwire is a Forge app that runs entirely on Atlassian's infrastructure ("Runs on Atlassian" eligible). It has no servers of its own and sends no data outside Atlassian.

**What it stores.** For each assumption you add to a Confluence page, Tripwire stores:
- the assumption text, the JQL queries and limits you typed;
- the Atlassian account ID of the owner you picked;
- the latest check result, a short history of state changes, and the keys and summaries of up to 25 dependent Jira issues.

This data lives in a Jira project property on your own site, and briefly in Forge storage, both managed by Atlassian.

**What it does with it.** Tripwire only uses this data to check the assumption against Jira, show the result, label and comment on dependent issues, and answer Rovo questions. It doesn't sell, share or analyse it.

**Removal.** Delete the Tripwire block from the page, or uninstall the app, and the data stops being used. Ask your site admin to delete the `tripwire.assumptions` project property to remove it completely.

**Contact.** jhonnie.studio@gmail.com
