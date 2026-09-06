# Task Completion Notification

**Priority:** P2
**Issue:** [#12618](https://github.com/Kilo-Org/kilocode/issues/12618) (OS notification half only; per-state tab icons are separate)

## Implementation

- `kilo-code.new.attention.notifications` enables VS Code workbench notifications (default: off).
- `kilo-code.new.attention.OSNotifications` enables native OS notification alerts while VS Code is unfocused (default: off).
- The OS notification setting appears on Windows, macOS, and Linux. `src/services/attention/os.ts` builds the per-platform command: Windows uses WinRT via PowerShell, macOS uses `osascript`, and Linux uses `notify-send`. Delivery is serialized behind a small queue cap so a burst cannot pile up helper processes.
- Linux requires `notify-send` and an active desktop notification daemon; failures are logged and the VS Code notification setting remains available as a portable alternative.
- A **Test** button below the OS notification toggle sends a real native notification immediately and reports success/failure back from the actual OS command, so a user can verify their platform/desktop environment supports it before relying on it. It appears only while the toggle is on, matching the sound row, and its result is cleared when the toggle is switched off.
- The OS and VS Code channels fire independently, not exclusively: the OS toast is a transient, informational ping for when the user isn't looking at any window; the VS Code notification persists as an actionable "Show" entry for whenever they return to the editor. Both can fire for the same event. Each channel's condition (focus for OS, visible session for VS Code) is re-evaluated after session details resolve, since that fetch is async.
- Completion and questions use `showInformationMessage()`; permission requests use `showWarningMessage()`; terminal failures use `showErrorMessage()`.
- Alerts include the originating workspace and session title. The VS Code "Show" action opens that session and scrolls to the latest turn, bypassing the normal per-session scroll-position restore.
- Errors are only announced after the errored root turn closes without retrying; manual aborts are ignored.
- The VS Code notification is suppressed only when the exact originating session is the one currently visible in the sidebar, a Kilo editor tab, or Agent Manager — not merely when Kilo is open.
- OS notifications intentionally have no click action. An earlier "Open Kilo" deep-link action was tried and dropped: it reached VS Code but did not reliably land on the target session, and it triggered a workspace-trust prompt. Native click-to-focus was considered separately and not pursued, to keep behavior uniform across Windows, macOS, and Linux — see PR discussion for the platform-by-platform feasibility breakdown.
