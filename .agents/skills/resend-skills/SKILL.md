---
name: resend-skills
description: >-
  Installs and applies Resend’s official Agent Skills bundle (resend/resend-skills).
  Covers npx install, RESEND_API_KEY, verified domains, and which bundled skill to use
  for API sends, React Email, CLI, deliverability, and agent inbox workflows. Use when
  working with Resend, transactional email, React Email, Resend CLI, webhooks, DNS or
  email deliverability, or when the user mentions npx skills add resend/resend-skills.
---

# Resend Agent Skills (official bundle)

## Install

From the project root (interactive picker — space to toggle skills):

```bash
npx skills add resend/resend-skills
```

Non-interactive options (from the `skills` CLI):

- `-y` / `--yes` — install without prompts
- `-g` / `--global` — install globally instead of project-scoped

Prefer project-scoped installs so the skill files are versioned with the repo when appropriate.

Upstream repo: [resend/resend-skills](https://github.com/resend/resend-skills) (Agent Skills format, Cursor plugin included).

## Prerequisites

- Resend account and a **verified sending domain**
- API key in the environment as `RESEND_API_KEY` ([resend.com/api-keys](https://resend.com/api-keys))

Never commit API keys. Use local env files or the host’s secret manager.

## Bundled skills (pick what you need at install time)

| Skill | Use for |
| --- | --- |
| `resend` | Sending mail via the Resend HTTP API (batching, retries, webhooks) |
| `react-email` | HTML emails built with React Email components |
| `resend-cli` | Terminal operations against Resend |
| `email-best-practices` | Deliverability, authentication (SPF/DKIM/DMARC), compliance, UX |
| `agent-email-inbox` | Secure inbox patterns for agents receiving and acting on email |

Skills synced from other Resend repos should be edited upstream, not in `resend-skills` (see repo README).

## MCP

The bundle documents a **Resend MCP server** for tool-based API access ([resend-mcp](https://github.com/resend/resend-mcp)). If the user already wires MCP separately, avoid duplicating configuration; align env vars and keys with their chosen setup.

## Agent workflow

1. If Resend-specific instructions are missing locally, ensure the bundle is installed (`npx skills add resend/resend-skills`) so the detailed skills are on disk.
2. For implementation work, follow the **installed** skill that matches the task (`resend`, `react-email`, etc.) — those files are the source of truth for API patterns.
3. After changes, verify sends against Resend’s dashboard/logs and respect domain verification and rate limits.
