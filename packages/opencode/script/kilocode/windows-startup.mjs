// Compare launchers, not release builds. Run serially on an otherwise idle Windows runner.
import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

assert.equal(process.platform, "win32", "This benchmark requires real Windows and PowerShell")
assert.equal(process.arch, "x64")
assert.match(process.env.BASE_SHA ?? "", /^[a-f0-9]{40}$/)
const root = mkdtempSync(path.join(os.tmpdir(), "kilo-startup-"))
const out = path.resolve(process.env.BENCHMARK_OUT ?? path.join(root, "results"))
mkdirSync(out, { recursive: true })
const hash = (data) => createHash("sha256").update(data).digest("hex")
const version = "7.5.6"
const url = `https://registry.npmjs.org/@kilocode/cli-windows-x64-baseline/-/cli-windows-x64-baseline-${version}.tgz`
const integrity = "NeTyUmgGkXb17AoBXrDAXvte8Gs7uYVTP42dM4rNPnjB3vE87/Xez10e8e+OWQiWK3y3yNMVxcLepzpsgLcW2A=="
const response = await fetch(url)
assert.ok(response.ok, `Artifact download: ${response.status}`)
const archive = Buffer.from(await response.arrayBuffer())
assert.equal(createHash("sha512").update(archive).digest("base64"), integrity)
const tar = path.join(root, "native.tgz")
writeFileSync(tar, archive)
execFileSync("tar.exe", ["-xzf", tar, "-C", root], { windowsHide: true })
const pkg = path.join(root, "package")
assert.equal(JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8")).version, version)
const exe = path.join(pkg, "bin", "kilo.exe")
const wrappers = {
  before: execFileSync("git", ["show", `${process.env.BASE_SHA}:packages/opencode/bin/kilo`]),
  after: readFileSync(new URL("../../bin/kilo", import.meta.url)),
}
assert.notEqual(hash(wrappers.before), hash(wrappers.after), "Launchers must differ")
const powershell = execFileSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
  { encoding: "utf8", windowsHide: true },
).trim()
const metadata = {
  base: process.env.BASE_SHA,
  head: process.env.HEAD_SHA,
  os: { type: os.type(), release: os.release(), version: os.version(), arch: os.arch() },
  cpu: { model: os.cpus().at(0)?.model, count: os.cpus().length },
  powershell,
  node: process.version,
  native: {
    version,
    runtime: "Bun 1.3.14 (published 7.5.6 build)",
    url,
    integrity: `sha512-${integrity}`,
    sha256: hash(readFileSync(exe)),
  },
  wrappers: Object.fromEntries(Object.entries(wrappers).map(([name, value]) => [name, hash(value)])),
  repetitions: 6,
  policy:
    "Separate fixture per mode/launcher; one discarded warm-up per command; alternating pair order; serial execution. Cold means only CPU metadata cache miss, not OS or native data cold. No Defender changes. No instrumentation or native rebuild.",
}
writeFileSync(path.join(out, "metadata.json"), JSON.stringify(metadata, null, 2))

const commands = [["--version"], ["debug", "--version"], ["debug", "startup"], ["debug", "paths"]]
const samples = []
const fixtures = new Map()
for (const mode of ["cold", "warm", "native"]) {
  for (const name of ["before", "after"]) {
    const dir = path.join(root, `${mode}-${name}`)
    const bin = path.join(dir, "node_modules", "@kilocode", "cli", "bin")
    mkdirSync(bin, { recursive: true })
    const wrapper = path.join(bin, "kilo")
    writeFileSync(wrapper, wrappers[name])
    // Both candidate names resolve to the very same published executable and sidecars.
    for (const variant of ["cli-windows-x64", "cli-windows-x64-baseline"]) {
      symlinkSync(pkg, path.join(dir, "node_modules", "@kilocode", variant), "junction")
    }
    const env = Object.fromEntries(
      ["PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "SystemDrive"].flatMap((key) =>
        process.env[key] ? [[key, process.env[key]]] : [],
      ),
    )
    for (const key of [
      "HOME",
      "USERPROFILE",
      "APPDATA",
      "LOCALAPPDATA",
      "PROGRAMDATA",
      "XDG_CONFIG_HOME",
      "XDG_DATA_HOME",
      "XDG_STATE_HOME",
      "XDG_CACHE_HOME",
      "XDG_RUNTIME_DIR",
      "TMP",
      "TEMP",
      "TMPDIR",
    ]) {
      env[key] = path.join(dir, key === "USERPROFILE" ? "HOME" : key)
      mkdirSync(env[key], { recursive: true })
    }
    Object.assign(env, {
      HOMEDRIVE: path.parse(env.HOME).root.replace(/[\\/]$/, ""),
      HOMEPATH: env.HOME.slice(path.parse(env.HOME).root.length - 1),
      KILO_TELEMETRY_LEVEL: "off",
      DO_NOT_TRACK: "1",
      OTEL_SDK_DISABLED: "true",
      KILO_DISABLE_MODELS_FETCH: "1",
      KILO_DISABLE_AUTOUPDATE: "1",
      KILO_DISABLE_PROJECT_CONFIG: "1",
      KILO_CONFIG_CONTENT: "{}",
      KILO_TREE_SITTER_WASM_DIR: path.join(pkg, "bin", "tree-sitter"),
      CI: "1",
    })
    fixtures.set(`${mode}-${name}`, {
      dir,
      wrapper,
      env,
      cache: path.join(env.XDG_CACHE_HOME, "kilo", "bin", "windows-avx2.json"),
    })
  }
}

async function run(mode, name, args, repetition) {
  const item = fixtures.get(`${mode}-${name}`)
  assert.ok(item)
  if (mode === "cold") rmSync(item.cache, { force: true })
  const cache = () => {
    try {
      const entry = JSON.parse(readFileSync(item.cache, "utf8"))
      return { avx2: entry.avx2, sha256: hash(readFileSync(item.cache)) }
    } catch (err) {
      if (err.code === "ENOENT") return null
      throw err
    }
  }
  const previous = cache()
  const start = performance.now()
  const child = spawn(mode === "native" ? exe : process.execPath, mode === "native" ? args : [item.wrapper, ...args], {
    cwd: item.dir,
    env: item.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })
  const sample = {
    mode,
    name,
    command: args.join(" "),
    repetition,
    cacheBefore: previous,
    stdout: "",
    stderr: "",
    firstStdout: null,
    firstStderr: null,
    exit: null,
  }
  for (const stream of ["stdout", "stderr"]) {
    child[stream].setEncoding("utf8")
    child[stream].on("data", (text) => {
      const key = stream === "stdout" ? "firstStdout" : "firstStderr"
      sample[key] ??= performance.now() - start
      sample[stream] += text
    })
  }
  const finished = Promise.withResolvers()
  const timeout = setTimeout(() => {
    execFileSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true })
    finished.reject(new Error("CLI exceeded 60 seconds"))
  }, 60_000)
  child.on("error", finished.reject)
  child.on("exit", () => {
    sample.exit = performance.now() - start
  })
  child.on("close", (status, signal) => finished.resolve({ status, signal }))
  const result = await finished.promise.finally(() => clearTimeout(timeout))
  Object.assign(sample, result, { close: performance.now() - start, cacheAfter: cache() })
  sample.printed = args.at(-1) === "startup" ? Number(sample.stdout.trim()) : null
  // Only fixture paths are emitted by these commands. Normalize them before publication.
  for (const stream of ["stdout", "stderr"])
    sample[stream] = sample[stream].replaceAll(root, "<fixture>").replaceAll(root.replaceAll("\\", "/"), "<fixture>")
  samples.push(sample)
  appendFileSync(path.join(out, "samples.jsonl"), JSON.stringify(sample) + "\n")
  assert.equal(result.status, 0, sample.stderr)
  assert.equal(result.signal, null)
  if (args.at(-1) === "--version") assert.equal(sample.stdout.trim(), version)
  if (sample.printed !== null) assert.ok(Number.isFinite(sample.printed) && sample.printed > 0)
  if (mode !== "native" && name === "after")
    assert.equal(typeof sample.cacheAfter?.avx2, "boolean", "Real PowerShell must return a validated result")
  if (mode === "warm" && name === "after" && previous)
    assert.equal(sample.cacheAfter.sha256, previous.sha256, "Warm cache must not be rewritten")
  console.log(`${mode} ${name} ${sample.command} #${repetition}: ${sample.exit.toFixed(1)}ms`)
}

// Warm native data, DLL extraction, and every command path for both isolated profiles.
for (const mode of ["cold", "warm", "native"]) {
  for (const args of commands) {
    for (const name of ["before", "after"]) await run(mode, name, args, -1)
  }
}
for (const mode of ["cold", "warm", "native"]) {
  for (let repetition = 0; repetition < metadata.repetitions; repetition++) {
    for (const args of commands) {
      for (const name of repetition % 2 ? ["after", "before"] : ["before", "after"])
        await run(mode, name, args, repetition)
    }
  }
}
const median = (values) => {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b)
  if (!sorted.length) return null
  return (sorted.at(Math.floor((sorted.length - 1) / 2)) + sorted.at(Math.floor(sorted.length / 2))) / 2
}
const summary = []
for (const mode of ["cold", "warm", "native"]) {
  for (const args of commands) {
    for (const name of ["before", "after"]) {
      const group = samples.filter(
        (sample) =>
          sample.mode === mode && sample.name === name && sample.command === args.join(" ") && sample.repetition >= 0,
      )
      summary.push({
        mode,
        name,
        command: args.join(" "),
        n: group.length,
        ...Object.fromEntries(
          ["firstStdout", "firstStderr", "printed", "exit", "close"].map((key) => [
            key,
            median(group.map((sample) => sample[key])),
          ]),
        ),
      })
    }
  }
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2))
const markdown = [
  "## Windows Startup",
  "",
  "Same published CLI 7.5.6 executable, Node " +
    process.version +
    ". Six alternating measured pairs per row; milliseconds. Cold refers only to the CPU cache. Native before/after are unchanged-binary noise controls.",
  "",
  "| Mode | Command | Launcher | N | First stdout | Native printed timer | Exit |",
  "|---|---|---|---|---|---|---|",
  ...summary.map(
    (row) =>
      `| ${row.mode} | ${row.command} | ${row.name} | ${row.n} | ${row.firstStdout?.toFixed(1) ?? "n/a"} | ${row.printed?.toFixed(1) ?? "n/a"} | ${row.exit.toFixed(1)} |`,
  ),
  "",
  "First stderr, close, exit status, warm-ups, cache validation, hashes, and raw output are in the artifact. No native startup fix or reproduction of the reporter's host is claimed.",
  "",
].join("\n")
writeFileSync(path.join(out, "summary.md"), markdown)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
