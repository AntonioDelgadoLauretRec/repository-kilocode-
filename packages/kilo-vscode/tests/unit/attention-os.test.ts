import { describe, expect, it } from "bun:test"
import { notificationCommand, testOSNotification } from "../../src/services/attention/os"

describe("OS attention notifications", () => {
  const notice = {
    message: "Kilo task completed.",
    workspace: "kilo-vscode",
    session: "Add notifications",
  }

  it("builds a Windows WinRT notification command", () => {
    const command = notificationCommand(notice, "win32")

    expect(command?.cmd).toBe("powershell.exe")
    expect(command?.args.slice(0, 3)).toEqual(["-NoProfile", "-NonInteractive", "-EncodedCommand"])
    const script = Buffer.from(command?.args.at(-1) ?? "", "base64").toString("utf16le")
    expect(script).toContain("CreateToastNotifier('Microsoft.VisualStudioCode')")
    expect(script).toContain("Workspace: kilo-vscode")
    expect(script).toContain("Session: Add notifications")
  })

  it("builds an escaped macOS osascript command", () => {
    const command = notificationCommand(
      { message: 'Kilo said "done"', workspace: "repo", session: "path\\name" },
      "darwin",
    )

    expect(command).toEqual({
      cmd: "osascript",
      args: [
        "-e",
        'display notification "Kilo said \\"done\\" Workspace: repo Session: path\\\\name" with title "Kilo Code"',
      ],
    })
  })

  it("builds a Linux notify-send command", () => {
    expect(notificationCommand(notice, "linux")).toEqual({
      cmd: "notify-send",
      args: [
        "--app-name=Kilo Code",
        "--urgency=normal",
        "Kilo Code",
        "Kilo task completed.\nWorkspace: kilo-vscode\nSession: Add notifications",
      ],
    })
  })

  it("escapes Pango markup in the Linux body so the toast is not dropped", () => {
    // libnotify parses the body as markup: a raw `<` or `&` from a workspace or
    // session name can make the daemon reject the notification outright.
    const command = notificationCommand(
      { message: "Kilo task completed.", workspace: "foo & bar", session: "<b>fix</b>" },
      "linux",
    )

    expect(command?.args.at(-1)).toBe("Kilo task completed.\nWorkspace: foo &amp; bar\nSession: &lt;b&gt;fix&lt;/b&gt;")
    // Quotes and apostrophes are not markup, so they stay readable.
    expect(notificationCommand({ message: `it's "done"` }, "linux")?.args.at(-1)).toBe(`it's "done"`)
  })

  it("does not build a command for unsupported platforms", () => {
    expect(notificationCommand(notice, "freebsd")).toBeUndefined()
  })
})

describe("testOSNotification", () => {
  it("reports an explicit error for unsupported platforms without spawning anything", async () => {
    const result = await testOSNotification("freebsd")
    expect(result).toEqual({ ok: false, error: "OS notifications aren't supported on this platform." })
  })

  it("reports a real failure when the native command binary is absent on this host", async () => {
    // Pick a supported platform different from the one running these tests, so
    // its native binary is guaranteed missing here — a genuine failure from the
    // real exec() path, not a mocked one.
    const foreign = process.platform === "win32" ? "linux" : "win32"
    const result = await testOSNotification(foreign)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
