# New Era — Kilo Extraction Fork

This repository is no longer treated as a full Kilo product fork.

It is now repurposed as a **New Era extraction fork** whose purpose is to preserve only the Kilo concepts worth integrating into the existing ecosystem:

- Core runtime plus headless `serve` layer
- Stable SDK boundary between runtime and clients
- Agent Manager concepts
- Git worktree isolation
- Review, diff, and approval flows
- Agent lifecycle telemetry
- Gateway pattern for model routing and provider policy

## Why this exists

New Era already has a clearer operating stack:

- **Supabase** = source of truth
- **Paperclip** = orchestration layer
- **Panel CEO** = operational control surface
- **n8n** = mechanical automation layer
- **Claude Code / Codex / OpenClaw** = execution agents

Because of that, the full Kilo monorepo is unnecessary overhead.
This fork exists only to preserve and study the execution patterns that still add value.

## Canonical documents in this fork

- `PRESERVED-ARCHITECTURE.md` — what should actually be kept from Kilo
- `PAPERCLIP-DEEP-ANALYSIS.md` — why Paperclip remains strategically more important for New Era

## What not to preserve as priorities

- Desktop app as a core priority
- Full upstream Kilo product positioning
- Docs site as a core priority
- JetBrains product surface
- Broad provider sprawl
- Full UI library reuse

## Practical rule

This repo is a **pattern extraction ground**, not a competing operating system.
If a change does not strengthen the New Era stack around Paperclip, Supabase, Panel CEO, or controlled execution, it should not be a priority here.
