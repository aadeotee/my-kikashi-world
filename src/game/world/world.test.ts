import { beforeAll, describe, expect, it } from 'vitest'
import { B } from '../blocks'
import { COTTAGE, DOOR_X, G0, GOLDEN_TREE } from '../constants'
import { buildWorld, pondField, World } from './generate'
import { deadEnds, MAZE_BLOCKS_H, MAZE_BLOCKS_W, MAZE_MAP, solveMap } from './maze'
import { walkPath } from './walk'

describe('the maze stays small and friendly', () => {
  it('is taller than it is wide, and small', () => {
    expect(MAZE_BLOCKS_H).toBeGreaterThan(MAZE_BLOCKS_W)
    expect(MAZE_BLOCKS_W).toBeLessThanOrEqual(30)
    expect(MAZE_BLOCKS_H).toBeLessThanOrEqual(42)
  })

  it('has rows of equal length', () => {
    expect(new Set(MAZE_MAP.map((r) => r.length)).size).toBe(1)
  })

  it('takes a little while but not long', () => {
    const squares = solveMap()
    expect(squares).toBeGreaterThan(30)
    // Two map squares are four blocks; at her walking pace this keeps it under about 25 seconds.
    expect(squares * 2).toBeLessThan(180)
  })

  it('has only a few dead ends', () => {
    expect(deadEnds()).toBeGreaterThan(0)
    expect(deadEnds()).toBeLessThanOrEqual(8)
  })
})

describe('the golden tree', () => {
  it('is the About option, with Contact in the first slot', async () => {
    const w = await buildWorld(() => undefined)
    expect(w.stations[0].id).toBe('contact')
    const about = w.stations.find((s) => s.id === 'about')!
    expect([about.x, about.z]).toEqual([GOLDEN_TREE.x, GOLDEN_TREE.z])
  }, 60000)

  it('keeps its canopy out of the static blocks so every leaf can fall', async () => {
    const w = await buildWorld(() => undefined)
    expect(w.goldLeaves.length / 4).toBeGreaterThan(1000)
    const [x, y, z] = w.goldLeaves
    expect(w.grid.get(x, y, z)).toBe(B.AIR)
  }, 60000)
})

describe('the finished page', () => {
  let w: World
  const spawn: [number, number, number] = [DOOR_X, G0 + 1, COTTAGE.z0 + 3]

  beforeAll(async () => {
    w = await buildWorld(() => undefined)
    w.grid.fill(DOOR_X - 1, G0 + 1, COTTAGE.z0, DOOR_X, G0 + 3, COTTAGE.z0, B.AIR)
  }, 60000)

  it('can be walked from the cottage door through the maze', () => {
    const path = walkPath(w.grid, spawn, (_x, _y, z) => z < w.exit.z - 1)
    expect(path).not.toBeNull()
  })

  it('has a way round the maze for anyone skipping it', () => {
    const shut = [127, G0, 236, 129, G0 + 3, 236] as const
    w.grid.fill(...shut, B.BARRIER)
    expect(walkPath(w.grid, spawn, (_x, _y, z) => z < w.exit.z - 1)).not.toBeNull()
    w.grid.fill(...shut, B.AIR)
  })

  it('lets her reach the pond shore but not walk on the water', () => {
    expect(walkPath(w.grid, spawn, (x, _y, z) => pondField(x, z) < 1.3)).not.toBeNull()
    expect(walkPath(w.grid, spawn, (x, _y, z) => pondField(x, z) < 0.9)).toBeNull()
  })

  it('has every portfolio option', () => {
    expect(w.stations.map((s) => s.id).sort()).toEqual(['about', 'contact', 'experiments', 'play', 'projects', 'resume', 'works'])
  })
})
