import { describe, expect, it } from 'vitest'
import { MAZE_N, MAZE_SEED } from '../constants'
import { deadEnds, generateMaze, routeCount, solveMaze } from './maze'

describe('garden maze', () => {
  const maze = generateMaze(MAZE_N, MAZE_SEED)

  it('can be solved from the entrance to the exit', () => {
    expect(solveMaze(maze).length).toBeGreaterThan(0)
  })

  it('is a real walk rather than a straight line', () => {
    expect(solveMaze(maze).length).toBeGreaterThanOrEqual(45)
  })

  it('has plenty of dead ends', () => {
    expect(deadEnds(maze).length).toBeGreaterThanOrEqual(15)
  })

  it('has more than one route', () => {
    expect(routeCount(maze)).toBeGreaterThanOrEqual(2)
  })

  it('has every cell reachable', () => {
    const { n, open } = maze
    const seen = new Set([0])
    const queue = [0]
    while (queue.length) {
      const c = queue.pop()!
      const near = [[1, -n], [2, 1], [4, n], [8, -1]] as const
      for (const [bit, step] of near) {
        if (open[c] & bit && !seen.has(c + step)) {
          seen.add(c + step)
          queue.push(c + step)
        }
      }
    }
    expect(seen.size).toBe(n * n)
  })
})
