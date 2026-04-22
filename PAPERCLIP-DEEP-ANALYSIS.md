# Paperclip Deep Analysis For New Era

## Executive reading

Paperclip is not another coding agent.
Paperclip is the company-level orchestration layer that sits above heterogeneous agents.

Its own README defines it as open-source orchestration for zero-human companies and explicitly states:

- OpenClaw is an employee
- Paperclip is the company

That framing matters because it makes Paperclip a management and governance system, not an execution agent.

## What Paperclip really is

At runtime, Paperclip is built as:

- a Node.js server
- a React UI
- a CLI
- a workspace of adapters, plugins, and shared packages

It is designed to coordinate many agents toward business goals instead of managing isolated prompt sessions.

## Architectural shape

The workspace layout shows a clear split:

- `server/`
- `ui/`
- `cli/`
- `packages/*`
- `packages/adapters/*`
- `packages/plugins/*`

That means Paperclip is not a single app. It is a modular orchestration platform.

## Why Paperclip fits New Era

New Era already operates with:

- Supabase as source of truth
- n8n as mechanical automation
- Paperclip as agent orchestration
- Panel CEO as operational surface

Paperclip is the correct layer for:

- org charts
n- governance
- budgets
- ticketing
- multi-agent coordination
- persistent execution context
- wakeup / heartbeat logic
- auditability

It is not the right layer for replacing your content DB, your operational control plane, or your automations engine.

## Core strengths found in Paperclip

### 1. Orchestration identity is correct
Paperclip does not pretend to be the worker.
It manages workers.
That is architecturally correct for New Era.

### 2. Heterogeneous adapter model
The server depends on multiple adapters such as:

- claude local
- codex local
- cursor local
- gemini local
- openclaw gateway
- opencode local
- pi local

This confirms that Paperclip is designed as a unifying orchestration layer across runtimes.

### 3. Persistent state and embedded DB defaults
Paperclip can run with embedded Postgres for local dev and supports external Postgres in broader deployments.
That gives it strong local reproducibility and practical bootstrap value.

### 4. Worktree-aware operational model
The development docs go deep on worktree-local instances, isolated DBs, isolated ports, seeded worktrees, and protections against duplicate execution.
This is not cosmetic. It is one of Paperclip's strongest ideas.

### 5. Strong company model
Its public framing includes:

- goals
- budgets
- governance
- org chart
- tickets
- multi-company isolation
- audit log

This matches the management problem you are solving.

## Boundaries Paperclip should keep in New Era

### Paperclip should own

- companies
- areas / teams / reporting lines
- agents and runtime metadata
- budgets and wakeup policy
- issue / task orchestration
- assignment and escalation logic
- governance and approvals at orchestration level

### Paperclip should not become

- the canonical business data store
- the only UI for all operations
- the automation engine for external workflows
- the source of truth for all metrics
- the replacement for Supabase
- the replacement for Panel CEO presentation logic

## Correct relationship between systems

### Supabase
Still the source of truth for operational and business state.

### Paperclip
The orchestration and governance layer for agent companies.

### n8n
The mechanical workflow layer.

### Panel CEO
The executive operating system / visual control plane.

### Kilo-derived ideas
Useful as tactical patterns for runtime, SDK, worktrees, and review UX.

## What to borrow from Kilo into a Paperclip-centered ecosystem

### Strong candidate 1: headless runtime boundary
Paperclip benefits from execution backends that expose a stable service interface.

### Strong candidate 2: Agent Manager ideas
Paperclip already owns orchestration. Kilo's Agent Manager patterns can enhance execution visibility and session control.

### Strong candidate 3: review and diff flows
These improve controlled execution and approvals.

### Strong candidate 4: execution lifecycle telemetry
This is useful when fed back into Supabase and surfaced in Panel CEO.

### Strong candidate 5: provider gateway discipline
Useful for cost policy, model routing, fallback, and quotas.

## Risks in Paperclip

### 1. Product sprawl risk
Because it includes server, UI, CLI, adapters, plugins, and company concepts, it can become too central if not bounded.

### 2. Overlapping control plane risk
If Paperclip and Panel CEO both try to be the main control surface, confusion appears fast.

### 3. Embedded assumptions risk
Some defaults are excellent for local-first open-source onboarding but should not automatically define your production architecture.

### 4. Adapter explosion risk
Supporting many runtimes is powerful, but it increases operational surface area.

## Recommendation for New Era

Use Paperclip as the canonical orchestration company layer.
Do not replace it with Kilo.
Instead, strengthen Paperclip with selected Kilo patterns:

- worktree-safe execution discipline
- runtime / serve abstraction where useful
- session control UX
- diff / approval UX
- telemetry improvements
- provider gateway hardening

## Final conclusion

Paperclip is strategically more important to New Era than this Kilo fork.

Kilo is useful as an extraction source for execution patterns.
Paperclip is the actual management substrate that fits your company model.

That means the correct move is:

- keep Paperclip as orchestration core
- keep Supabase as source of truth
- keep Panel CEO as executive UI
- keep n8n as automation layer
- use this fork only to preserve selected Kilo execution patterns
