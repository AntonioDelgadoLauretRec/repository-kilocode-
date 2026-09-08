import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { ClaudeMigration } from "@/kilocode/config/claude-migration"
import { tmpdir } from "../../fixture/fixture"

async function files(root: string) {
  return {
    rules: await fs.readFile(path.join(root, ".claude", "CLAUDE.md")),
    skill: await fs.readFile(path.join(root, ".claude", "skills", "audit", "SKILL.md")),
    mcp: await fs.readFile(path.join(root, ".claude.json")),
  }
}

describe("Claude global configuration migration", () => {
  test("imports the supported subset without touching Claude files", async () => {
    await using tmp = await tmpdir()
    const home = path.join(tmp.path, "home")
    const config = path.join(tmp.path, "config")
    const state = path.join(tmp.path, "state")
    await fs.mkdir(path.join(home, ".claude", "skills", "audit"), { recursive: true })
    await fs.mkdir(config, { recursive: true })
    const source = {
      rules: "Use the repository's existing test conventions.\n",
      skill: "Review the changed files and report only actionable findings.\n",
      mcp: JSON.stringify({
        mcpServers: {
          local: { command: "npx", args: ["-y", "example-mcp"], env: { TOKEN: "secret-token" } },
          remote: { type: "http", url: "https://example.test/mcp", headers: { Authorization: "Bearer secret-token" } },
        },
        projects: { [tmp.path]: { mcpServers: { projectOnly: { command: "ignored" } } } },
      }),
    }
    await fs.writeFile(path.join(home, ".claude", "CLAUDE.md"), source.rules)
    await fs.writeFile(path.join(home, ".claude", "skills", "audit", "SKILL.md"), source.skill)
    await fs.writeFile(path.join(home, ".claude.json"), source.mcp)
    const before = await files(home)

    const previous = Global.Path.config
    ;(Global.Path as { config: string }).config = config
    try {
      const result = await ClaudeMigration.run({ enabled: true, roots: { home, config, state } })
      expect(result.status).toBe("complete")
      if (result.status !== "complete") return
      expect(result.receipt.items.filter((item) => item.status === "imported")).toHaveLength(4)
      expect(await fs.readFile(path.join(config, "AGENTS.md"), "utf8")).toBe(source.rules)
      expect(await fs.readFile(path.join(config, "skills", "audit", "SKILL.md"), "utf8")).toContain('name: "audit"')

      const native = JSON.parse(await fs.readFile(path.join(config, "kilo.jsonc"), "utf8"))
      expect(native.mcp.local).toEqual({
        type: "local",
        command: ["npx", "-y", "example-mcp"],
        environment: { TOKEN: "secret-token" },
        enabled: false,
      })
      expect(native.mcp.remote).toEqual({
        type: "remote",
        url: "https://example.test/mcp",
        headers: { Authorization: "Bearer secret-token" },
        enabled: false,
        oauth: false,
      })
      expect(native.mcp.projectOnly).toBeUndefined()
      expect(JSON.stringify(result.receipt)).not.toContain("secret-token")
      expect(await files(home)).toEqual(before)
      expect(ClaudeMigration.globalHandoff({ state })).toBe(true)
      expect((await ClaudeMigration.notification({ state }))?.id).toBe(ClaudeMigration.NOTIFICATION_ID)
    } finally {
      ;(Global.Path as { config: string }).config = previous
    }
  })

  test("preserves existing Kilo files and never retries after completion", async () => {
    await using tmp = await tmpdir()
    const home = path.join(tmp.path, "home")
    const config = path.join(tmp.path, "config")
    const state = path.join(tmp.path, "state")
    await fs.mkdir(path.join(home, ".claude", "skills", "unsafe"), { recursive: true })
    await fs.mkdir(config, { recursive: true })
    await fs.writeFile(path.join(home, ".claude", "CLAUDE.md"), "source rules")
    await fs.writeFile(path.join(home, ".claude", "skills", "unsafe", "SKILL.md"), "---\ncontext: fork\n---\nunsafe")
    await fs.writeFile(path.join(home, ".claude", "skills", "unsafe", "helper.txt"), "dependency")
    await fs.writeFile(
      path.join(home, ".claude.json"),
      JSON.stringify({ mcpServers: { existing: { command: "ignored" } } }),
    )
    await fs.writeFile(path.join(config, "AGENTS.md"), "existing rules")
    await fs.writeFile(
      path.join(config, "kilo.jsonc"),
      JSON.stringify({ mcp: { existing: { type: "local", command: ["keep"] } } }),
    )

    const previous = Global.Path.config
    ;(Global.Path as { config: string }).config = config
    try {
      const first = await ClaudeMigration.run({ enabled: true, roots: { home, config, state } })
      expect(first.status).toBe("complete")
      if (first.status !== "complete") return
      expect(first.receipt.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: "instructions", reason: "destination-exists", status: "skipped" }),
          expect.objectContaining({
            category: "skill",
            name: "unsafe",
            reason: "skill-bundle-unsupported",
            status: "skipped",
          }),
          expect.objectContaining({
            category: "mcp",
            name: "existing",
            reason: "mcp-name-conflict",
            status: "skipped",
          }),
        ]),
      )
      await fs.writeFile(path.join(home, ".claude", "CLAUDE.md"), "changed source")
      await fs.mkdir(path.join(home, ".claude", "skills", "new"))
      await fs.writeFile(path.join(home, ".claude", "skills", "new", "SKILL.md"), "new skill")
      const second = await ClaudeMigration.run({ enabled: true, roots: { home, config, state } })
      expect(second.status).toBe("already-attempted")
      expect(await fs.readFile(path.join(config, "AGENTS.md"), "utf8")).toBe("existing rules")
      expect(await fs.readFile(path.join(config, "kilo.jsonc"), "utf8")).not.toContain('"new"')
    } finally {
      ;(Global.Path as { config: string }).config = previous
    }
  })

  test("imports minimal skill metadata and rejects dynamic or bundled skills", async () => {
    await using tmp = await tmpdir()
    const home = path.join(tmp.path, "home")
    const config = path.join(tmp.path, "config")
    const state = path.join(tmp.path, "state")
    await fs.mkdir(path.join(home, ".claude", "skills", "metadata"), { recursive: true })
    await fs.mkdir(path.join(home, ".claude", "skills", "dynamic"), { recursive: true })
    await fs.mkdir(path.join(home, ".claude", "skills", "bundle"), { recursive: true })
    await fs.mkdir(config, { recursive: true })
    await fs.writeFile(
      path.join(home, ".claude", "skills", "metadata", "SKILL.md"),
      "---\ndescription: Review files\n---\nBody\n",
    )
    await fs.writeFile(path.join(home, ".claude", "skills", "dynamic", "SKILL.md"), "Use $ARGUMENTS[0].\n")
    await fs.writeFile(path.join(home, ".claude", "skills", "bundle", "SKILL.md"), "Body\n")
    await fs.writeFile(path.join(home, ".claude", "skills", "bundle", "helper.txt"), "Helper\n")

    const previous = Global.Path.config
    ;(Global.Path as { config: string }).config = config
    try {
      const result = await ClaudeMigration.run({ enabled: true, roots: { home, config, state } })
      expect(result.status).toBe("complete")
      if (result.status !== "complete") return
      expect(await fs.readFile(path.join(config, "skills", "metadata", "SKILL.md"), "utf8")).toBe(
        '---\nname: "metadata"\ndescription: "Review files"\n---\nBody\n',
      )
      expect(result.receipt.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "dynamic", reason: "unsupported-markdown", status: "skipped" }),
          expect.objectContaining({ name: "bundle", reason: "skill-bundle-unsupported", status: "skipped" }),
        ]),
      )
    } finally {
      ;(Global.Path as { config: string }).config = previous
    }
  })

  test("does not create a receipt when there is no source", async () => {
    await using tmp = await tmpdir()
    const roots = {
      home: path.join(tmp.path, "home"),
      config: path.join(tmp.path, "config"),
      state: path.join(tmp.path, "state"),
    }
    const result = await ClaudeMigration.run({ enabled: true, roots })
    expect(result).toEqual({ status: "no-source" })
    expect(ClaudeMigration.hasAttempt(roots)).toBe(false)
  })

  test("defers custom routing without claiming an attempt", async () => {
    await using tmp = await tmpdir()
    const roots = {
      home: path.join(tmp.path, "home"),
      config: path.join(tmp.path, "config"),
      state: path.join(tmp.path, "state"),
    }
    await fs.mkdir(path.join(roots.home, ".claude"), { recursive: true })
    await fs.writeFile(path.join(roots.home, ".claude", "CLAUDE.md"), "source")
    const previous = process.env.KILO_CONFIG_DIR
    process.env.KILO_CONFIG_DIR = path.join(tmp.path, "custom")
    try {
      expect(await ClaudeMigration.run({ enabled: true, roots })).toEqual({ status: "unsupported-context" })
      expect(ClaudeMigration.hasAttempt(roots)).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.KILO_CONFIG_DIR
      else process.env.KILO_CONFIG_DIR = previous
    }
  })
})
