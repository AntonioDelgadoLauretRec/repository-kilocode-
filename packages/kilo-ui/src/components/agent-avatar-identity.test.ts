import { describe, expect, test } from "bun:test"
import { identity } from "./agent-avatar-identity"

describe("agent avatar identity", () => {
  test("uses the same identity for the same participant", () => {
    expect(identity("ses_agent-one")).toEqual(identity("ses_agent-one"))
    expect(identity("ses_agent-one").cells).not.toEqual(identity("ses_agent-two").cells)
  })

  test("keeps unknown participants neutral", () => {
    expect(identity("").color).toBeUndefined()
    expect(identity("unknown")).toEqual(identity(""))
    expect(identity("  ")).toEqual(identity(""))
    expect(identity("main").color).toBeNumber()
  })

  test("produces visible symmetric patterns within the avatar", () => {
    for (const id of ["main", "ses_agent-one", "ses_agent-two", "participant", ""]) {
      const avatar = identity(id)
      expect(avatar.cells.length).toBeGreaterThan(0)
      for (const cell of avatar.cells) {
        expect(cell).toBeGreaterThanOrEqual(0)
        expect(cell).toBeLessThan(25)
        expect(avatar.cells).toContain(Math.floor(cell / 5) * 5 + 4 - (cell % 5))
      }
    }
  })
})
