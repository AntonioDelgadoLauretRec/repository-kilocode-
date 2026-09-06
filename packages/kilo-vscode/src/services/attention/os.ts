import * as vscode from "vscode"
import { exec } from "../../util/process"
import type { AttentionNotice } from "./service"

type Command = {
  cmd: string
  args: string[]
}

const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char)
}

function apple(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
}

function app() {
  return vscode.env.appName.includes("Insiders") ? "Microsoft.VisualStudioCodeInsiders" : "Microsoft.VisualStudioCode"
}

function text(notice: AttentionNotice) {
  return [
    notice.message,
    notice.workspace ? `Workspace: ${notice.workspace}` : undefined,
    notice.session ? `Session: ${notice.session}` : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}

export function notificationCommand(notice: AttentionNotice, platform = process.platform): Command | undefined {
  if (platform === "win32") {
    const xml = `<toast><visual><binding template="ToastGeneric"><text>${escape(notice.message)}</text>${notice.workspace ? `<text>Workspace: ${escape(notice.workspace)}</text>` : ""}${notice.session ? `<text>Session: ${escape(notice.session)}</text>` : ""}</binding></visual></toast>`
    const script = [
      "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
      "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] > $null",
      "$xml = New-Object Windows.Data.Xml.Dom.XmlDocument",
      `$xml.LoadXml('${xml}')`,
      "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${app()}').Show($toast)`,
    ].join("; ")
    return {
      cmd: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    }
  }
  if (platform === "darwin") {
    return { cmd: "osascript", args: ["-e", `display notification "${apple(text(notice))}" with title "Kilo Code"`] }
  }
  if (platform === "linux") {
    return { cmd: "notify-send", args: ["--app-name=Kilo Code", "--urgency=normal", "Kilo Code", text(notice)] }
  }
}

let chain = Promise.resolve()
let queued = 0
const limit = 3
const timeout = 10_000

/** Sends a real native notification and reports whether the underlying command succeeded. */
export function testOSNotification(platform = process.platform): Promise<{ ok: boolean; error?: string }> {
  const command = notificationCommand({ message: "This is a test notification from Kilo Code." }, platform)
  if (!command) return Promise.resolve({ ok: false, error: "OS notifications aren't supported on this platform." })
  return exec(command.cmd, command.args, { timeout }).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  )
}

export function showOSNotification(notice: AttentionNotice): void {
  const command = notificationCommand(notice)
  if (!command || queued >= limit) return
  queued += 1
  // Serialized with a small cap so bursts cannot pile up native helper processes.
  chain = chain
    .then(() =>
      exec(command.cmd, command.args, { timeout }).then(
        () => undefined,
        (error) => {
          console.debug("[Kilo New] OS notification failed", { cmd: command.cmd, error })
        },
      ),
    )
    .finally(() => {
      queued -= 1
    })
}
