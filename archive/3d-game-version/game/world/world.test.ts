import { beforeAll, describe, expect, it } from 'vitest'
import { B } from '../blocks'
import { COTTAGE, DOOR_X, G0, GATE_X, GATE_Z, MAZE_SIZE, MAZE_Z0 } from '../constants'
import { buildWorld, World } from './generate'
import { walkPath } from './walk'

describe('the finished world', () => {
  let w: World
  const spawn: [number, number, number] = [DOOR_X, G0 + 1, COTTAGE.z0 + 3]
  const inClearing = (_x: number, _y: number, z: number) => z < MAZE_Z0 - 2

  beforeAll(async () => {
    w = await buildWorld(() => undefined)
    w.grid.fill(DOOR_X - 1, G0 + 1, COTTAGE.z0, DOOR_X, G0 + 3, COTTAGE.z0, B.AIR)
  }, 60000)

  it('keeps the gate shut until it has been opened', () => {
    expect(walkPath(w.grid, spawn, inClearing)).toBeNull()
  })

  it('can be walked from the cottage door to the dock and the paddies', () => {
    expect(walkPath(w.grid, spawn, (x, _y, z) => x === 93 && z === 232)).not.toBeNull()
    expect(walkPath(w.grid, spawn, (x, _y, z) => x === 220 && z === 230)).not.toBeNull()
  })

  it('can be walked from the cottage through the gate and maze to the clearing', () => {
    w.grid.fill(GATE_X - 3, G0, GATE_Z + 1, GATE_X + 3, G0 + 6, GATE_Z + 1, B.AIR)
    const path = walkPath(w.grid, spawn, inClearing)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(300)
  })

  it('offers no way round the maze', () => {
    const { exit } = w
    const y = G0
    // Seal the exit and the clearing must become unreachable.
    w.grid.fill(Math.floor(exit.x) - 1, y, MAZE_Z0, Math.floor(exit.x) + 1, y + 3, MAZE_Z0, B.HEDGE)
    expect(walkPath(w.grid, spawn, inClearing)).toBeNull()
    w.grid.fill(Math.floor(exit.x) - 1, y, MAZE_Z0, Math.floor(exit.x) + 1, y + 3, MAZE_Z0, B.AIR)
  })

  it('reaches every station in the clearing', () => {
    expect(w.stations).toHaveLength(7)
    const from: [number, number, number] = [Math.floor(w.exit.x), G0, MAZE_Z0 - 3]
    for (const s of w.stations) {
      const path = walkPath(w.grid, from, (x, _y, z) => Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z) < 2.5)
      expect(path, s.id).not.toBeNull()
    }
  })

  it('keeps the maze a substantial part of the world', () => {
    expect(MAZE_SIZE * MAZE_SIZE).toBeGreaterThan(7000)
  })
})
