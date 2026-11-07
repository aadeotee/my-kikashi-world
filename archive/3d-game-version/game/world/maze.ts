import { mulberry32 } from '../rng'

export const N = 1
export const E = 2
export const S = 4
export const Wt = 8
const DIRS = [
  { bit: N, dx: 0, dz: -1, opp: S },
  { bit: E, dx: 1, dz: 0, opp: Wt },
  { bit: S, dx: 0, dz: 1, opp: N },
  { bit: Wt, dx: -1, dz: 0, opp: E },
]

export interface Maze {
  n: number
  open: Uint8Array
  entrance: number
  exit: number
  /** Cells of the central courtyard. */
  court: Set<number>
}

export const cellIndex = (n: number, i: number, j: number) => j * n + i

/**
 * Recursive-backtracker maze, then braided: some dead ends get knocked through so there are
 * loops and several routes. A courtyard is opened in the middle as a landmark.
 */
export function generateMaze(n: number, seed: number, braid = 0.3): Maze {
  const rnd = mulberry32(seed)
  const open = new Uint8Array(n * n)
  const seen = new Uint8Array(n * n)
  const stack = [cellIndex(n, n >> 1, n - 1)]
  seen[stack[0]] = 1
  while (stack.length) {
    const c = stack[stack.length - 1]
    const i = c % n
    const j = (c / n) | 0
    const options = DIRS.filter((d) => {
      const x = i + d.dx
      const z = j + d.dz
      return x >= 0 && z >= 0 && x < n && z < n && !seen[cellIndex(n, x, z)]
    })
    if (!options.length) {
      stack.pop()
      continue
    }
    const d = options[(rnd() * options.length) | 0]
    const next = cellIndex(n, i + d.dx, j + d.dz)
    open[c] |= d.bit
    open[next] |= d.opp
    seen[next] = 1
    stack.push(next)
  }

  for (let c = 0; c < n * n; c++) {
    if (countOpenings(open[c]) !== 1 || rnd() > braid) continue
    const i = c % n
    const j = (c / n) | 0
    const options = DIRS.filter((d) => {
      const x = i + d.dx
      const z = j + d.dz
      return !(open[c] & d.bit) && x >= 0 && z >= 0 && x < n && z < n
    })
    if (!options.length) continue
    const d = options[(rnd() * options.length) | 0]
    open[c] |= d.bit
    open[cellIndex(n, i + d.dx, j + d.dz)] |= d.opp
  }

  const court = new Set<number>()
  const m = n >> 1
  for (let j = m - 1; j <= m + 1; j++) {
    for (let i = m - 1; i <= m + 1; i++) {
      const c = cellIndex(n, i, j)
      court.add(c)
      if (i < m + 1) {
        open[c] |= E
        open[cellIndex(n, i + 1, j)] |= Wt
      }
      if (j < m + 1) {
        open[c] |= S
        open[cellIndex(n, i, j + 1)] |= N
      }
    }
  }

  return { n, open, entrance: n >> 1, exit: Math.floor(n * 0.76), court }
}

export const countOpenings = (bits: number) =>
  (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1) + ((bits >> 3) & 1)

/** Breadth-first shortest route from the entrance cell to the exit cell. */
export function solveMaze(m: Maze): number[] {
  const { n, open } = m
  const start = cellIndex(n, m.entrance, n - 1)
  const goal = cellIndex(n, m.exit, 0)
  const prev = new Int32Array(n * n).fill(-1)
  prev[start] = start
  const queue = [start]
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]
    if (c === goal) break
    const i = c % n
    const j = (c / n) | 0
    for (const d of DIRS) {
      if (!(open[c] & d.bit)) continue
      const next = cellIndex(n, i + d.dx, j + d.dz)
      if (prev[next] !== -1) continue
      prev[next] = c
      queue.push(next)
    }
  }
  if (prev[goal] === -1) return []
  const path = [goal]
  while (path[path.length - 1] !== start) path.push(prev[path[path.length - 1]])
  return path.reverse()
}

export function deadEnds(m: Maze) {
  const out: number[] = []
  for (let c = 0; c < m.open.length; c++) if (countOpenings(m.open[c]) === 1) out.push(c)
  return out
}

/** How many edge-disjoint routes exist from entrance to exit (capped), found by repeated search. */
export function routeCount(m: Maze, cap = 3) {
  const copy: Maze = { ...m, open: m.open.slice() }
  let routes = 0
  while (routes < cap) {
    const path = solveMaze(copy)
    if (!path.length) break
    routes++
    for (let k = 0; k + 1 < path.length; k++) {
      const a = path[k]
      const b = path[k + 1]
      const diff = b - a
      const d = DIRS.find((v) => v.dx + v.dz * m.n === diff)!
      copy.open[a] &= ~d.bit
      copy.open[b] &= ~d.opp
    }
  }
  return routes
}
