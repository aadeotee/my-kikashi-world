/**
 * The maze is drawn by hand so it stays gentle: one winding walk, two ways through
 * and a few short dead ends. '#' is hedge, '.' is path; odd columns and rows are corridors.
 */
export const MAZE_MAP = [
  '#######.#######',
  '#.....#.#.....#',
  '#.###.#.#.###.#',
  '#...#...#.#...#',
  '###.#####.#.###',
  '#.........#...#',
  '#.#######.###.#',
  '#.#.....#.....#',
  '#.#.###.#####.#',
  '#...#.......#.#',
  '#####.#####.#.#',
  '#.....#...#...#',
  '#.#####.#.###.#',
  '#.......#.....#',
  '#.#########.###',
  '#.#.......#...#',
  '#.#.#####.###.#',
  '#...#...#.....#',
  '#####.#.#####.#',
  '#.....#.......#',
  '#######.#######',
]

/** Hedges are one block thick and corridors three wide, so a map index maps to this block span. */
export const mapToBlocks = (i: number): [number, number] => {
  const start = (i >> 1) * 4 + (i % 2)
  return [start, i % 2 ? start + 2 : start]
}

export const MAZE_BLOCKS_W = mapToBlocks(MAZE_MAP[0].length - 1)[1] + 1
export const MAZE_BLOCKS_H = mapToBlocks(MAZE_MAP.length - 1)[1] + 1

const isPath = (x: number, y: number) => MAZE_MAP[y]?.[x] === '.'
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** Shortest route from the top opening to the bottom one, in map squares. */
export function solveMap() {
  const w = MAZE_MAP[0].length
  const start = MAZE_MAP[0].indexOf('.')
  const goalY = MAZE_MAP.length - 1
  const seen = new Map<number, number>([[start, 0]])
  const queue = [[start, 0]]
  for (let q = 0; q < queue.length; q++) {
    const [x, y] = queue[q]
    const d = seen.get(y * w + x)!
    if (y === goalY) return d
    for (const [dx, dy] of STEPS) {
      const k = (y + dy) * w + x + dx
      if (isPath(x + dx, y + dy) && !seen.has(k)) {
        seen.set(k, d + 1)
        queue.push([x + dx, y + dy])
      }
    }
  }
  return -1
}

export function deadEnds() {
  let n = 0
  MAZE_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!isPath(x, y) || y === 0 || y === MAZE_MAP.length - 1) continue
      if (STEPS.filter(([dx, dy]) => isPath(x + dx, y + dy)).length === 1) n++
    }
  })
  return n
}
