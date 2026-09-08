export function identity(id: string) {
  const known = id.trim() !== "" && id !== "unknown"
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619) >>> 0
  }
  // Mirror three columns into a five-column pattern. Keep the center visible.
  const mask = known ? (hash >>> 8) | (1 << 8) : (1 << 5) | (1 << 7) | (1 << 8) | (1 << 11)
  const cells = Array.from({ length: 25 }, (_, index) => index).filter((index) => {
    const x = index % 5
    return mask & (1 << (Math.floor(index / 5) * 3 + Math.min(x, 4 - x)))
  })
  return { color: known ? hash % 6 : undefined, cells }
}
