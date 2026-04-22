# Preserved Architecture From Kilo For New Era

This fork is no longer treated as a full product clone.

Its value for New Era is the architecture and operational patterns that are worth preserving and integrating into the existing ecosystem:

- Core runtime plus headless `serve` layer
- Shared SDK / stable contract between runtime and clients
- Agent Manager concepts
- Git worktree isolation for parallel agent execution
- Diff, approval, and review flows
- Agent lifecycle telemetry and execution state
- Strict separation between shared code and New Era specific code
- Gateway pattern for model routing and provider policy

## What this fork is NOT for

This fork is not the canonical place to build a full Kilo replacement for New Era.
It should not become another oversized monorepo competing with Paperclip, Panel CEO, n8n, or Supabase.

## New Era mapping

- Supabase remains the source of truth
- Paperclip remains the orchestration layer
- Panel CEO remains the operational control surface
- n8n remains the mechanical automation layer
- Claude Code / Codex / OpenClaw remain execution agents

This fork is only a pattern library and extraction ground for selected ideas.

## Keep

### 1. Core runtime plus serve
Use the Kilo idea of a stable headless service that clients talk to over a consistent API.

### 2. SDK boundary
Preserve the principle of a shared contract between runtime and clients.

### 3. Agent Manager
Preserve the concepts of multi-session control, tab/session handling, and worktree-aware execution.

### 4. Worktree isolation
Preserve one-worktree-per-agent or one-worktree-per-issue execution strategy for safe parallelism.

### 5. Review and approval UX
Preserve diff viewers, explicit approvals, and controlled auto-approve modes.

### 6. Telemetry and lifecycle
Preserve agent start, exit, failure, retry, approval, and session-level observability.

### 7. Gateway pattern
Preserve a unified routing layer for model/provider choice and fallback policy.

## Do not preserve as priorities

- Desktop app as a core priority
- Docs site as a core priority
- JetBrains product surface
- Full UI library reuse
- Broad provider sprawl
- Product marketing positioning from upstream Kilo

## Practical direction

This fork should help New Era extract reusable operational patterns, not inherit unnecessary monorepo complexity.
