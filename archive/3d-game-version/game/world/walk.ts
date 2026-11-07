import { SOLID } from '../blocks'
import { W } from '../constants'
import type { Grid } from './grid'

/**
 * Walkable-space search over the finished voxels: a column can be entered if she can stand in
 * it and the ledge is one step up or a short drop down, exactly what the player controller allows.
 */
export function walkPath(g: Grid, from: [number, number, number], goal: (x: number, y: number, z: number) => boolean) {
  const stand = (x: number, y: number, z: number) =>
    !g.solid(x, y, z) && !g.solid(x, y + 1, z) && (SOLID[g.get(x, y - 1, z)] === 1 || g.solid(x, y - 1, z))
  const key = (x: number, y: number, z: number) => y * W * 512 + z * W + x
  const prev = new Map<number, number>()
  const start = key(...from)
  prev.set(start, start)
  const queue: [number, number, number][] = [from]
  for (let q = 0; q < queue.length; q++) {
    const [x, y, z] = queue[q]
    if (goal(x, y, z)) {
      const path: [number, number][] = []
      let k = key(x, y, z)
      while (k !== start) {
        path.push([(k % W) + 0.5, (Math.floor(k / W) % 512) + 0.5])
        k = prev.get(k)!
      }
      return path.reverse()
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const nz = z + dz
      for (let ny = y + 1; ny >= y - 4; ny--) {
        if (!stand(nx, ny, nz)) continue
        // A step up also needs headroom above where she stands now.
        if (ny > y && g.solid(x, y + 2, z)) break
        const nk = key(nx, ny, nz)
        if (!prev.has(nk)) {
          prev.set(nk, key(x, y, z))
          queue.push([nx, ny, nz])
        }
        break
      }
    }
  }
  return null
}
