import { BufferAttribute, BufferGeometry, Color } from 'three'
import { B } from '../blocks'
import {
  CHUNK, CLEARING, COTTAGE, D, G0, GATE_X, GOLDEN_TREE, H, HEDGE_H, MAZE_N, MAZE_PITCH, MAZE_SEED,
  MAZE_SIZE, MAZE_X0, MAZE_Z0, PADDY, POND, W,
} from '../constants'
import { P } from '../palette'
import { clamp, fbm, hash3, mulberry32, smooth } from '../rng'
import { Grid } from './grid'
import { Maze, N, S, E, Wt, cellIndex, countOpenings, generateMaze, solveMaze } from './maze'
import { BoxFx, MeshBuilder } from './meshBuilder'
import { grassColor, meshChunk } from './mesher'
import { birch, goldenTree, oak, pine, rock, topiary, willow } from './nature'
import {
  AddBox, bench, bookshelf, buildCottage, buildGate, easel, fence, gallery, lantern, lanternPost, mapTable,
  noticeboard, placer, postbox, urn, workshop,
} from './structures'

export type Instances = number[] // x, y, z, rotY, scale, r, g, b repeated

export interface Station {
  id: string
  x: number
  z: number
  y: number
  prompt: string
}

export interface World {
  grid: Grid
  maze: Maze
  solution: number[]
  chunks: BufferGeometry[]
  water: BufferGeometry
  grass: Instances
  flowers: Instances
  rice: Instances
  reeds: Instances
  stations: Station[]
  cellCenter: (c: number) => [number, number]
  exit: { x: number; z: number }
  entrance: { x: number; z: number }
  dock: { x: number; z: number }
  chimney: [number, number, number]
}

const tick = () => new Promise<void>((r) => setTimeout(r))
const colorOf = (hex: string) => new Color(hex)

export const inPond = (x: number, z: number) => pondField(x, z) < 1
export function pondField(x: number, z: number) {
  const dx = (x - POND.x) / POND.rx
  const dz = (z - POND.z) / POND.rz
  return dx * dx + dz * dz + (fbm(x * 0.07, z * 0.07, 41, 2) - 0.5) * 0.7
}

function isPlayable(x: number, z: number) {
  if (x >= 14 && x <= 242 && z >= 186 && z <= 308) return true
  if (x >= 78 && x <= 178 && z >= 146 && z <= 181) return true
  if (x >= GATE_X - 3 && x <= GATE_X + 3 && z >= 180 && z <= 187) return true
  if (x >= MAZE_X0 && x < MAZE_X0 + MAZE_SIZE && z >= MAZE_Z0 && z <= 147) return true
  const dx = (x - CLEARING.x) / CLEARING.rx
  const dz = (z - CLEARING.z) / CLEARING.rz
  return dx * dx + dz * dz < 1
}

function flatness(x: number, z: number) {
  const ell = (cx: number, cz: number, rx: number, rz: number) => {
    const d = Math.hypot((x - cx) / rx, (z - cz) / rz)
    return 1 - smooth(0.85, 1.35, d)
  }
  return Math.max(
    ell(128, 262, 34, 30),
    ell(POND.x, POND.z, POND.rx * 1.35, POND.rz * 1.4),
    ell(192, 231, 56, 50),
    ell(128, 225, 12, 50),
    z < 192 ? 1 : 0,
  )
}

function pathLine(g: Grid, pts: [number, number][], width: number, block: number, alt: number) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const wob = (fbm((ax + (bx - ax) * t) * 0.15, (az + (bz - az) * t) * 0.15, 8, 2) - 0.5) * 2.4
      const cx = ax + (bx - ax) * t + wob * (bz !== az ? 1 : 0)
      const cz = az + (bz - az) * t + wob * (bx !== ax && bz === az ? 1 : 0)
      const R = width / 2
      for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) {
        for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
          const x = Math.round(cx + dx)
          const z = Math.round(cz + dz)
          const d = Math.hypot(dx, dz)
          if (d > R + 0.4) continue
          if (d > R - 0.6 && hash3(x, 9, z) < 0.35) continue
          const c = g.col(x, z)
          g.surface[c] = hash3(x, 2, z) < 0.22 ? alt : block
          g.reserved[c] = 1
        }
      }
    }
  }
}

function stampTerrain(g: Grid) {
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) g.blocked[g.col(x, z)] = isPlayable(x, z) ? 0 : 1

  // Chamfer distance from the playable area, so hills can rise smoothly away from it.
  const dist = new Float32Array(W * D)
  for (let i = 0; i < dist.length; i++) dist[i] = g.blocked[i] ? 1e6 : 0
  const relax = (x: number, z: number, dx: number, dz: number, w: number) => {
    const nx = x + dx, nz = z + dz
    if (nx < 0 || nz < 0 || nx >= W || nz >= D) return
    const v = dist[nz * W + nx] + w
    if (v < dist[z * W + x]) dist[z * W + x] = v
  }
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    relax(x, z, -1, 0, 1); relax(x, z, 0, -1, 1); relax(x, z, -1, -1, 1.41); relax(x, z, 1, -1, 1.41)
  }
  for (let z = D - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
    relax(x, z, 1, 0, 1); relax(x, z, 0, 1, 1); relax(x, z, 1, 1, 1.41); relax(x, z, -1, 1, 1.41)
  }

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      const roll = (fbm(x * 0.028, z * 0.028, 1, 3) - 0.5) * 11 * (1 - flatness(x, z))
      const d = dist[c]
      const hill = d > 3 ? (d - 3) * 0.3 * (0.55 + fbm(x * 0.03, z * 0.03, 5, 3)) : 0
      g.height[c] = clamp(Math.round(G0 + roll + hill), 7, H - 22)
      g.surface[c] = B.GRASS
    }
  }
  return dist
}

function stampPond(g: Grid) {
  for (let z = POND.z - 34; z <= POND.z + 34; z++) {
    for (let x = POND.x - 40; x <= POND.x + 40; x++) {
      const f = pondField(x, z)
      const c = g.col(x, z)
      if (f < 1) {
        g.height[c] = G0 - 1 - Math.round(clamp((1 - f) * 3.4, 0, 3))
        g.surface[c] = f > 0.72 ? B.SAND : B.MUD
        g.water[c] = G0 - 0.28
        g.reserved[c] = 1
      } else if (f < 1.22) {
        g.height[c] = G0
        g.surface[c] = hash3(x, 5, z) < 0.55 ? B.SAND : B.GRASS
        g.reserved[c] = 1
      }
    }
  }
}

function stampPaddies(g: Grid) {
  const { x0, x1, z0, z1 } = PADDY
  const bands = [[150, 177], [178, 205], [206, 233]]
  const rows = [[196, 215], [220, 239], [244, 263]]
  const fields: { x0: number; x1: number; z0: number; z1: number; stage: number; floor: number }[] = []
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const band = clamp(((x - 150) / 28) | 0, 0, 2)
      const c = g.col(x, z)
      g.height[c] = G0 + band
      g.surface[c] = B.GRASS
      g.reserved[c] = 1
    }
  }
  bands.forEach(([bx0, bx1], t) => {
    const top = G0 + t
    rows.forEach(([rz0, rz1], ri) => {
      const f = { x0: bx0 + 2, x1: bx1 - 4, z0: rz0, z1: rz1, stage: (t * 2 + ri) % 3, floor: top - 1 }
      fields.push(f)
      for (let z = f.z0; z <= f.z1; z++) {
        for (let x = f.x0; x <= f.x1; x++) {
          const c = g.col(x, z)
          g.height[c] = top - 1
          g.surface[c] = B.MUD
          g.water[c] = top - 0.55
        }
      }
      // Plank stepping path across the middle of every other field.
      if ((t + ri) % 2 === 0) {
        const mid = (f.z0 + f.z1) >> 1
        for (let x = f.x0; x <= f.x1; x++) {
          const c = g.col(x, mid)
          g.height[c] = top
          g.surface[c] = B.PLANK
          g.water[c] = 0
        }
      }
    })
    if (t < 2) {
      for (let z = z0; z <= z1; z++) {
        for (const x of [bx1 - 2, bx1 - 1]) {
          const c = g.col(x, z)
          g.height[c] = top - 1
          g.surface[c] = B.GRAVEL
          g.water[c] = top - 0.45
          g.waterFlow[c] = 1
        }
      }
      for (const bz of [218, 242]) {
        for (let z = bz - 1; z <= bz + 1; z++) {
          for (const x of [bx1 - 2, bx1 - 1]) {
            const c = g.col(x, z)
            g.height[c] = top
            g.surface[c] = B.PLANK
          }
        }
      }
    }
  })
  return fields
}

function fillColumns(g: Grid) {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      const h = g.height[c]
      const top = g.surface[c]
      for (let y = 0; y < h - 1; y++) g.set(x, y, z, y < h - 4 ? B.STONE : B.DIRT)
      g.set(x, h - 1, z, top)
    }
  }
}

export async function buildWorld(onProgress: (p: number, label: string) => void): Promise<World> {
  const g = new Grid()
  const nx = W / CHUNK
  const nz = D / CHUNK
  const builders = Array.from({ length: nx * nz }, () => new MeshBuilder())
  const add: AddBox = (x, y, z, sx, sy, sz, c, o?: BoxFx) => {
    const cx = clamp(((x + sx / 2) / CHUNK) | 0, 0, nx - 1)
    const cz = clamp(((z + sz / 2) / CHUNK) | 0, 0, nz - 1)
    builders[cz * nx + cx].box(x, y, z, sx, sy, sz, c, o)
  }

  onProgress(0.04, 'Rolling out the hills')
  await tick()
  const dist = stampTerrain(g)
  stampPond(g)
  const fields = stampPaddies(g)

  // Paths.
  pathLine(g, [[128, 250], [128, 240], [127, 228], [129, 214], [128, 197], [128, 187]], 3.4, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[128, 228], [116, 229], [106, 232]], 2.6, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[129, 218], [140, 219], [151, 218]], 2.6, B.DIRT_PATH, B.GRAVEL)
  for (let z = 187; z <= 196; z++) for (let x = 124; x <= 132; x++) if (hash3(x, 1, z) < 0.8 - (z - 187) * 0.05) g.surface[g.col(x, z)] = B.COBBLE

  // Grand garden forecourt.
  for (let z = 146; z <= 184; z++) {
    for (let x = 124; x <= 132; x++) {
      const c = g.col(x, z)
      g.surface[c] = hash3(x, 3, z) < 0.15 ? B.GRAVEL : B.COBBLE
      g.reserved[c] = 1
    }
  }

  // Maze floor and clearing paths.
  const maze = generateMaze(MAZE_N, MAZE_SEED)
  const P5 = MAZE_PITCH
  const cellCenter = (c: number): [number, number] => [
    MAZE_X0 + 2 + (c % MAZE_N) * P5 + 1.5,
    MAZE_Z0 + 2 + ((c / MAZE_N) | 0) * P5 + 1.5,
  ]
  const exitX = MAZE_X0 + 2 + maze.exit * P5 + 1.5
  const entranceX = MAZE_X0 + 2 + maze.entrance * P5 + 1.5
  pathLine(g, [[exitX, 60], [exitX, 53], [140, 44], [128, 43]], 3, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[128, 43], [108, 40], [97, 40]], 2.4, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[140, 44], [160, 38], [168, 34]], 2.4, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[116, 42], [106, 30], [106, 24]], 2.4, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[146, 42], [152, 30], [152, 25]], 2.4, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[119, 42], [114, 47]], 2.2, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[150, 47], [163, 50]], 2.2, B.DIRT_PATH, B.GRAVEL)

  onProgress(0.14, 'Laying the soil')
  await tick()
  fillColumns(g)

  // Keep the player out of the pond with an invisible lip over the water, then build the dock.
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      if (g.water[c] > 0 && inPond(x, z)) g.fill(x, g.height[c], z, x, G0 + 3, z, B.BARRIER)
    }
  }
  const dock = { x: 96, z: 232 }
  for (let x = 92; x <= 107; x++) {
    for (let z = 231; z <= 233; z++) {
      g.fill(x, G0 - 3, z, x, G0 + 3, z, B.AIR)
      g.set(x, G0 - 1, z, B.PLANK)
      g.height[g.col(x, z)] = G0
      if (x % 4 === 0) add(x + 0.3, G0 - 3, z === 232 ? 234 : z, 0.3, 3.2, 0.3, P.timber)
    }
    if (x <= 104 && x % 3 === 0) {
      for (const z of [231, 233.75]) add(x + 0.4, G0, z, 0.16, 0.9, 0.16, P.timber)
    }
  }
  add(92, G0 + 0.8, 231, 12, 0.1, 0.12, P.plankLight, { grounded: false })
  add(92, G0 + 0.8, 233.8, 12, 0.1, 0.12, P.plankLight, { grounded: false })
  g.fill(92, G0, 230, 104, G0 + 3, 230, B.BARRIER)
  g.fill(92, G0, 234, 104, G0 + 3, 234, B.BARRIER)
  g.fill(91, G0, 230, 91, G0 + 3, 234, B.BARRIER)
  // Seed bucket and a little stool at the end of the dock.
  add(93, G0, 231.2, 0.7, 0.6, 0.7, P.plank, { tex: 0.2 })
  add(93.08, G0 + 0.6, 231.28, 0.54, 0.06, 0.54, P.butter)
  add(92.4, G0, 232.9, 0.8, 0.45, 0.7, P.plankLight)

  buildCottage(g, add)
  buildGate(g, add, builders[0])
  onProgress(0.24, 'Building the cottage')
  await tick()

  const reds = [P.rose, P.butter, P.cream, P.terracottaLight, P.periwinkle, P.plum]
  const flowers: Instances = []
  const grass: Instances = []
  const rice: Instances = []
  const reeds: Instances = []
  const put = (out: Instances, x: number, y: number, z: number, ry: number, s: number, c: Color) =>
    out.push(x, y, z, ry, s, c.r, c.g, c.b)

  // Cottage garden.
  const fx0 = 106, fx1 = 150, fz0 = 244, fz1 = 288
  fence(g, add, fx0, fz0, 125, fz0)
  fence(g, add, 131, fz0, fx1, fz0)
  fence(g, add, fx0, fz0, fx0, fz1)
  fence(g, add, fx1, fz0, fx1, fz1)
  fence(g, add, fx0, fz1, fx1, fz1)
  // Mailbox at the garden gap.
  add(131.4, G0, 242.4, 0.24, 1.4, 0.24, P.timber)
  add(131, G0 + 1.4, 241.8, 1, 0.7, 1.5, P.periwinkle, { tex: 0.12 })
  add(131, G0 + 2.1, 241.8, 1, 0.14, 1.5, P.cream, { grounded: false })
  add(132, G0 + 1.8, 242.6, 0.08, 0.6, 0.12, P.terracotta, { grounded: false })
  g.set(131, G0, 242, B.BARRIER)
  g.set(131, G0 + 1, 242, B.BARRIER)

  // Flower beds beside the garden path.
  const r = mulberry32(2024)
  const bed = (x0: number, z0: number, x1: number, z1: number) => {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        g.set(x, g.h(x, z) - 1, z, B.SOIL)
        g.reserved[g.col(x, z)] = 1
        for (let k = 0; k < 3; k++)
          put(flowers, x + r(), g.h(x, z), z + r(), r() * 6, 0.8 + r() * 0.5, colorOf(reds[(r() * reds.length) | 0]))
      }
    }
  }
  bed(121, 245, 125, 249)
  bed(131, 245, 135, 249)
  bed(112, 246, 118, 248)
  bed(138, 246, 144, 248)

  // Vegetable patch.
  for (let row = 0; row < 4; row++) {
    const z = 272 + row * 3
    for (let x = 138; x <= 147; x++) {
      g.set(x, g.h(x, z) - 1, z, B.SOIL)
      g.set(x, g.h(x, z + 1) - 1, z + 1, B.SOIL)
      g.reserved[g.col(x, z)] = 1
      g.reserved[g.col(x, z + 1)] = 1
      if (x % 2 === 0) {
        const y = g.h(x, z)
        const kind = row % 2
        add(x + 0.25, y, z + 0.4, 0.6, kind ? 0.2 : 0.5, 0.6, kind ? P.terracottaLight : P.moss, { wind: 0.04 })
        add(x + 0.35, y + (kind ? 0.2 : 0.5), z + 0.5, 0.4, 0.45, 0.4, kind ? P.moss : P.sageLight, { wind: 0.14, windTop: true })
      }
    }
  }

  // Well.
  {
    const x = 113, z = 256, y = g.h(x, z)
    g.fill(x - 1, y, z - 1, x + 1, y + 1, z + 1, B.COBBLE)
    g.set(x, y + 1, z, B.AIR)
    g.set(x, y, z, B.AIR)
    g.water[g.col(x, z)] = y + 0.4
    g.fill(x - 2, y, z, x - 2, y + 3, z, B.TIMBER)
    g.fill(x + 2, y, z, x + 2, y + 3, z, B.TIMBER)
    g.fill(x - 2, y + 4, z - 1, x + 2, y + 4, z + 1, B.ROOF)
    g.fill(x - 1, y + 5, z, x + 1, y + 5, z, B.ROOF_LIGHT)
    add(x + 0.2, y + 2.8, z + 0.2, 0.6, 0.5, 0.6, P.plank)
    add(x + 0.48, y + 3.3, z + 0.48, 0.05, 0.75, 0.05, P.stoneDark)
    g.reserve(x - 3, z - 3, x + 3, z + 3)
  }

  // Washing line between two posts.
  {
    const y = g.h(112, 272)
    add(110.4, y, 272.4, 0.2, 3.2, 0.2, P.timber)
    add(122.4, y, 272.4, 0.2, 3.2, 0.2, P.timber)
    add(110.5, y + 3, 272.46, 12, 0.05, 0.05, P.cream, { grounded: false })
    const linen = [P.cream, P.rose, P.butter, P.periwinkle, P.cream]
    linen.forEach((c, i) => add(112 + i * 2.1, y + 1.9, 272.45, 1.4, 1.1, 0.06, c, { wind: 0.3, windTop: false, grounded: false }))
    g.set(110, y, 272, B.BARRIER); g.set(122, y, 272, B.BARRIER)
    g.set(110, y + 1, 272, B.BARRIER); g.set(122, y + 1, 272, B.BARRIER)
  }

  // Signpost at the fork.
  {
    const x = 124, z = 225, y = g.h(x, z)
    add(x + 0.38, y, z + 0.38, 0.24, 2.5, 0.24, P.timber)
    add(x - 1, y + 2, z + 0.42, 1.5, 0.34, 0.1, P.plankLight, { grounded: false })
    add(x + 0.5, y + 1.6, z + 0.42, 1.5, 0.34, 0.1, P.plankLight, { grounded: false })
    add(x - 0.1, y + 2.4, z + 0.42, 1.1, 0.3, 0.1, P.plank, { grounded: false })
    g.set(x, y, z, B.BARRIER); g.set(x, y + 1, z, B.BARRIER)
    g.reserve(x - 1, z - 1, x + 1, z + 1)
  }

  // Pond dressing: rocks, lilies, reeds.
  for (let z = POND.z - 30; z <= POND.z + 30; z++) {
    for (let x = POND.x - 36; x <= POND.x + 36; x++) {
      const f = pondField(x, z)
      const c = g.col(x, z)
      if (x >= 90 && x <= 108 && z >= 229 && z <= 235) continue
      if (f >= 1 && f < 1.2 && hash3(x, 11, z) < 0.05 && g.height[c] === G0) rock(g, x, z, x * 13 + z)
      if (f > 0.82 && f < 1.12 && hash3(x, 12, z) < 0.42) {
        const n = 2 + ((r() * 3) | 0)
        for (let k = 0; k < n; k++)
          put(reeds, x + r(), f < 1 ? g.h(x, z) : G0, z + r(), r() * 6, 0.9 + r() * 0.7, colorOf(r() < 0.3 ? P.sageLight : P.moss))
      }
      if (f < 0.72 && f > 0.25 && hash3(x, 13, z) < 0.02) {
        const s = 0.9 + r() * 0.8
        const y = G0 - 0.25
        add(x, y, z, s, 0.05, s, r() < 0.5 ? P.moss : P.sage, { grounded: false, wind: 0.02 })
        add(x + s * 0.5, y, z + s * 0.5, s * 0.5, 0.05, s * 0.5, P.mossDeep, { grounded: false, wind: 0.02 })
        if (r() < 0.55) {
          add(x + s * 0.3, y + 0.05, z + s * 0.3, 0.34, 0.14, 0.34, r() < 0.5 ? P.rose : P.cream, { grounded: false })
          add(x + s * 0.3 + 0.1, y + 0.17, z + s * 0.3 + 0.1, 0.14, 0.1, 0.14, P.butter, { grounded: false })
        }
      }
    }
  }
  for (const [x, z] of [[58, 214], [99, 214], [50, 240], [70, 258], [106, 250]] as const) g.reserve(x - 4, z - 4, x + 4, z + 4)

  // Paddy crops, stakes and little bridges.
  const stages = [
    { h: 1.1, c: [P.butter, P.sageLight, P.butterDeep], step: 1 },
    { h: 0.85, c: [P.moss, P.sage, P.mossDeep], step: 1 },
    { h: 0.42, c: [P.sageLight, P.moss, P.sage], step: 2 },
  ]
  for (const f of fields) {
    const st = stages[f.stage]
    for (let z = f.z0; z <= f.z1; z += st.step) {
      for (let x = f.x0; x <= f.x1; x += st.step) {
        if (!g.water[g.col(x, z)]) continue
        for (const [ox, oz] of [[0.25, 0.25], [0.75, 0.75]]) {
          const c = colorOf(st.c[(hash3(x, 4, z) * st.c.length) | 0])
          put(rice, x + ox + (r() - 0.5) * 0.14, f.floor, z + oz + (r() - 0.5) * 0.14, r() * 6, st.h * (0.85 + r() * 0.3), c)
        }
      }
    }
    const mid = (f.z0 + f.z1) >> 1
    if (g.surface[g.col(f.x0, mid)] === B.PLANK) {
      for (let x = f.x0; x <= f.x1; x += 4) {
        for (const dz of [-0.22, 1.02]) add(x + 0.4, f.floor, mid + dz, 0.18, 1.5, 0.18, P.timber)
      }
    }
    // Scarecrow standing in the first ripe field.
    if (f.stage === 0 && f.x0 < 160) {
      const x = f.x0 + 12, z = f.z0 + 5, y = f.floor
      add(x + 0.4, y, z + 0.4, 0.2, 3.4, 0.2, P.timber)
      add(x - 0.8, y + 2.4, z + 0.42, 2.6, 0.16, 0.16, P.timber)
      add(x + 0.05, y + 1.5, z + 0.1, 0.9, 1.1, 0.8, P.terracottaLight, { wind: 0.05 })
      add(x + 0.15, y + 2.65, z + 0.2, 0.7, 0.7, 0.6, P.sand)
      add(x - 0.05, y + 3.3, z + 0.05, 1.1, 0.1, 0.9, P.butterDeep)
      add(x + 0.2, y + 3.4, z + 0.2, 0.6, 0.35, 0.5, P.butterDeep)
      g.set(x, y, z, B.BARRIER); g.set(x, y + 1, z, B.BARRIER); g.set(x, y + 2, z, B.BARRIER)
    }
  }
  for (const bx of [175, 203]) {
    const top = bx < 190 ? G0 : G0 + 1
    for (const bz of [217, 241]) {
      for (const dz of [-0.14, 3.02]) {
        add(bx, top + 0.7, bz + dz, 2, 0.1, 0.12, P.plankLight, { grounded: false })
        for (const dx of [0, 1.86]) add(bx + dx, top, bz + dz, 0.14, 0.8, 0.14, P.timber)
      }
    }
  }
  // Grass bunds get a sprinkle of wildflowers below; a hut and rice stacks finish the field.
  for (const [x, z] of [[160, 192], [180, 270], [204, 270], [222, 192]] as const) {
    const y = g.h(x, z)
    add(x, y, z, 1.4, 1.5, 1.4, P.butterDeep, { tex: 0.3 })
    add(x + 0.2, y + 1.5, z + 0.2, 1, 0.5, 1, P.butter, { tex: 0.3 })
    g.fill(x, y, z, x + 1, y + 1, z + 1, B.BARRIER)
    g.reserve(x - 1, z - 1, x + 2, z + 2)
  }

  onProgress(0.34, 'Planting the hedges')
  await tick()
  buildMaze(g, add, maze)

  // Forecourt dressing.
  const yC = G0
  const parterre = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = x0; x <= x1; x++) {
      for (const z of [z0, z1]) g.set(x, yC, z, B.HEDGE)
    }
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) g.set(x, yC, z, B.HEDGE)
    }
    for (let z = z0 + 1; z < z1; z++) {
      for (let x = x0 + 1; x < x1; x++) {
        g.set(x, yC - 1, z, B.SOIL)
        const band = Math.abs(x - (x0 + x1) / 2) + Math.abs(z - (z0 + z1) / 2)
        const c = colorOf(reds[((band / 3) | 0) % 4])
        for (let k = 0; k < 2; k++) put(flowers, x + r(), yC, z + r(), r() * 6, 0.9 + r() * 0.4, c)
      }
    }
    g.reserve(x0, z0, x1, z1)
  }
  parterre(104, 152, 118, 162)
  parterre(138, 152, 152, 162)
  parterre(104, 168, 118, 176)
  parterre(138, 168, 152, 176)
  for (const x of [121, 135]) for (const z of [151, 163, 175]) {
    topiary(g, x, z, yC, z === 163 ? 0 : 1)
    g.reserve(x - 2, z - 2, x + 2, z + 2)
  }
  // Fountain at the crossing of the walks.
  {
    const cx = 128, cz = 165
    for (let z = cz - 6; z <= cz + 6; z++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        const d = Math.hypot(x - cx, z - cz)
        if (d < 5.2) g.set(x, yC - 1, z, B.COBBLE)
        if (d < 4.4 && d > 3.2) {
          g.set(x, yC, z, B.STONE)
          g.set(x, yC + 1, z, B.BARRIER)
        }
        if (d <= 3.2) {
          g.water[g.col(x, z)] = yC + 0.7
          g.set(x, yC + 1, z, B.BARRIER)
          g.set(x, yC + 2, z, B.BARRIER)
          g.set(x, yC, z, B.BARRIER)
        }
      }
    }
    g.fill(cx, yC, cz, cx, yC + 3, cz, B.STONE)
    add(cx - 1, yC + 3, cz - 1, 3, 0.3, 3, P.stoneLight)
    add(cx, yC + 3.3, cz, 1, 1.1, 1, P.stone)
    add(cx - 0.3, yC + 4.4, cz - 0.3, 1.6, 0.24, 1.6, P.stoneLight)
    g.reserve(cx - 6, cz - 6, cx + 6, cz + 6)
  }
  for (const z of [150, 178]) for (const x of [122, 134]) lanternPost(g, add, x, z, yC)
  bench(g, add, 100, yC, 164, true)
  bench(g, add, 154, yC, 164, true)
  for (const [x, z] of [[84, 152], [84, 172], [96, 178], [172, 152], [172, 172], [160, 178], [92, 164], [165, 164]] as const) {
    oak(g, x, z, x * 7 + z, 0.8)
    g.reserve(x - 3, z - 3, x + 3, z + 3)
  }
  // Side hedges enclosing the forecourt.
  for (let z = 146; z <= 184; z++) {
    for (const x of [75, 76, 77, 179, 180, 181]) g.fill(x, g.h(x, z), z, x, g.h(x, z) + 6, z, hash3(x, 7, z) < 0.05 ? B.HEDGE_BLOOM : B.HEDGE)
  }
  for (let x = 75; x <= 181; x++) {
    if (x >= MAZE_X0 && x < MAZE_X0 + MAZE_SIZE) continue
    for (const z of [145, 146]) g.fill(x, g.h(x, z), z, x, g.h(x, z) + 5, z, B.HEDGE)
  }

  // The clearing beyond the maze.
  onProgress(0.42, 'Hanging the lanterns')
  await tick()
  goldenTree(g, GOLDEN_TREE.x, GOLDEN_TREE.z)
  g.reserve(GOLDEN_TREE.x - 8, GOLDEN_TREE.z - 8, GOLDEN_TREE.x + 8, GOLDEN_TREE.z + 8)
  const stations: Station[] = []
  const station = (id: string, prompt: string, x: number, z: number, ix: number, iz: number) => {
    stations.push({ id, x: ix, z: iz, y: G0, prompt })
    g.reserve(x - 3, z - 3, x + 3, z + 3)
  }
  noticeboard(placer(g, add, 92, 40, 1), G0)
  station('about', 'Press E to read the noticeboard', 92, 40, 96, 40)
  gallery(placer(g, add, 106, 22, 0), G0)
  g.reserve(96, 11, 116, 24)
  station('works', 'Press E to enter the gallery', 106, 22, 106, 26)
  workshop(placer(g, add, 152, 22, 0), G0)
  g.reserve(144, 13, 160, 26)
  station('projects', 'Press E to look over the workbench', 152, 22, 152, 26.5)
  bookshelf(placer(g, add, 172, 34, 3), G0)
  station('experiments', 'Press E to browse the bookshelf', 172, 34, 168.5, 34)
  mapTable(placer(g, add, 128, 38, 0), G0)
  station('play', 'Press E to unroll the map', 128, 38, 128, 41.5)
  easel(placer(g, add, 111, 47, 1), G0)
  station('resume', 'Press E to read the framed resume', 111, 47, 114.5, 47)
  postbox(placer(g, add, 166, 50, 3), G0)
  station('contact', 'Press E to open the letterbox', 166, 50, 163, 50)
  for (const [x, z] of [[120, 44], [136, 44], [101, 34], [160, 28], [140, 54], [156, 56], [100, 50], [176, 42]] as const) {
    lanternPost(g, add, x, z, G0)
  }

  onProgress(0.5, 'Growing the trees')
  await tick()
  plantTrees(g, dist)

  // Hand-placed trees that frame the journey.
  willow(g, 58, 214, 5)
  willow(g, 99, 214, 6)
  willow(g, 50, 240, 7)
  birch(g, 70, 258, 3)
  birch(g, 74, 262, 5)
  birch(g, 106, 250, 8)
  for (const [x, z, s] of [[112, 262, 0.2], [143, 262, 0.2], [114, 282, 0.1], [130, 282, 0.2]] as const) oak(g, x, z, x + z, s, B.LEAF_BLOSSOM)
  for (const [x, z] of [[116, 190], [140, 190], [112, 200], [144, 202]] as const) oak(g, x, z, x * 3 + z, 1)
  // A few birches at the clearing's edge, away from every station.
  for (const [x, z] of [[84, 30], [176, 24], [120, 56], [90, 50], [172, 50]] as const) birch(g, x, z, x + z)

  grow(g, r, put, grass, flowers)

  // Mesh everything.
  const chunks: BufferGeometry[] = []
  for (let cz = 0; cz < nz; cz++) {
    for (let cx = 0; cx < nx; cx++) {
      const mb = builders[cz * nx + cx]
      meshChunk(g, cx, cz, mb)
      if (mb.count) chunks.push(mb.geometry())
      builders[cz * nx + cx] = new MeshBuilder()
    }
    onProgress(0.56 + (0.4 * (cz + 1)) / nz, 'Painting it block by block')
    await tick()
  }

  onProgress(0.98, 'Filling the pond')
  await tick()

  return {
    grid: g,
    maze,
    solution: solveMaze(maze),
    chunks,
    water: buildWater(g),
    grass,
    flowers,
    rice,
    reeds,
    stations,
    cellCenter,
    exit: { x: exitX, z: MAZE_Z0 },
    entrance: { x: entranceX, z: MAZE_Z0 + MAZE_SIZE },
    dock,
    chimney: [133, G0 + 1 + 5 + ((COTTAGE.z1 - COTTAGE.z0 + 2) >> 1) + 4.2, 264],
  }
}

function buildMaze(g: Grid, add: AddBox, m: Maze) {
  const n = m.n
  const x0 = MAZE_X0
  const z0 = MAZE_Z0
  const y = G0
  const openAt = (lx: number, lz: number) => {
    const px = lx - 2
    const pz = lz - 2
    const inEntrance = (col: number) => px >= col * MAZE_PITCH && px < col * MAZE_PITCH + 3
    if (lz < 2) return inEntrance(m.exit)
    if (lz >= MAZE_SIZE - 2) return inEntrance(m.entrance)
    if (lx < 2 || lx >= MAZE_SIZE - 2) return false
    const i = (px / MAZE_PITCH) | 0
    const j = (pz / MAZE_PITCH) | 0
    const a = px % MAZE_PITCH
    const b = pz % MAZE_PITCH
    const c = cellIndex(n, i, j)
    if (a < 3 && b < 3) return true
    if (a >= 3 && b < 3) return (m.open[c] & E) !== 0
    if (a < 3 && b >= 3) return (m.open[c] & S) !== 0
    return m.court.has(c) && m.court.has(cellIndex(n, i + 1, j + 1))
  }

  for (let lz = 0; lz < MAZE_SIZE; lz++) {
    for (let lx = 0; lx < MAZE_SIZE; lx++) {
      const x = x0 + lx
      const z = z0 + lz
      const c = g.col(x, z)
      g.reserved[c] = 1
      if (openAt(lx, lz)) {
        const n1 = fbm(x * 0.09, z * 0.09, 21, 2)
        const b = n1 > 0.6 ? B.GRASS : n1 < 0.36 ? B.COBBLE : hash3(x, 6, z) < 0.12 ? B.DIRT_PATH : B.GRAVEL
        g.set(x, y - 1, z, b)
        g.surface[c] = b
      } else {
        const bump = hash3(x >> 1, 3, z >> 1) < 0.12 ? 1 : 0
        for (let k = 0; k < HEDGE_H + bump; k++) {
          const bloom = hash3(x, y + k, z) < 0.05 + (fbm(x * 0.05, z * 0.05, 31, 2) > 0.62 ? 0.16 : 0)
          g.set(x, y + k, z, bloom ? B.HEDGE_BLOOM : B.HEDGE)
        }
      }
    }
  }

  const r = mulberry32(5150)
  // Blossoms studded over the hedge faces, thicker in drifts.
  const blossom = [P.rose, P.cream, P.butter, P.terracottaLight, P.periwinkle]
  for (let lz = 0; lz < MAZE_SIZE; lz++) {
    for (let lx = 0; lx < MAZE_SIZE; lx++) {
      const x = x0 + lx
      const z = z0 + lz
      if (g.get(x, y + 1, z) !== B.HEDGE && g.get(x, y + 1, z) !== B.HEDGE_BLOOM) continue
      const drift = fbm(x * 0.05, z * 0.05, 31, 2) > 0.58 ? 0.3 : 0.05
      const hue = blossom[(fbm(x * 0.04, z * 0.04, 33, 1) * 9) % blossom.length | 0]
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (g.get(x + dx, y + 1, z + dz) !== B.AIR) continue
        for (let k = 1; k < HEDGE_H; k++) {
          if (r() > drift) continue
          const s = 0.16 + r() * 0.14
          const px = dx ? (dx > 0 ? x + 1 : x - 0.05) : x + 0.1 + r() * 0.7
          const pz = dz ? (dz > 0 ? z + 1 : z - 0.05) : z + 0.1 + r() * 0.7
          add(px, y + k + r() * 0.8, pz, dx ? 0.06 : s, s, dz ? 0.06 : s, hue, { wind: 0.06, tex: 0, grounded: false })
        }
      }
    }
  }
  const center = (c: number) => [x0 + 2 + (c % n) * MAZE_PITCH, z0 + 2 + ((c / n) | 0) * MAZE_PITCH] as const

  // Dead ends each hold a small discovery.
  let k = 0
  for (let c = 0; c < m.open.length; c++) {
    if (countOpenings(m.open[c]) !== 1 || m.court.has(c)) continue
    if (c === cellIndex(n, m.entrance, n - 1) || c === cellIndex(n, m.exit, 0)) continue
    const [cx, cz] = center(c)
    const bits = m.open[c]
    const kind = k++ % 5
    const alongX = (bits & (N | S)) !== 0
    const bx = bits & E ? cx : bits & Wt ? cx + 2 : cx
    const bz = bits & S ? cz : bits & N ? cz + 2 : cz
    if (kind === 0) bench(g, add, alongX ? cx : bx, y, alongX ? bz : cz, alongX)
    else if (kind === 1) {
      urn(g, add, bx, y, bz, c)
      urn(g, add, alongX ? bx + 2 : bx, y, alongX ? bz : bz + 2, c + 1)
    } else if (kind === 2) oak(g, cx + 1, cz + 1, c, 0, B.LEAF_BLOSSOM)
    else if (kind === 3) {
      g.fill(cx + 1, y, cz + 1, cx + 1, y + 1, cz + 1, B.STONE)
      add(cx + 0.9, y + 2, cz + 0.9, 1.2, 0.24, 1.2, P.stoneLight)
      add(cx + 1.1, y + 2.24, cz + 1.1, 0.8, 0.8, 0.8, P.stoneDark)
      add(cx + 1.3, y + 3.04, cz + 1.3, 0.4, 0.4, 0.4, P.butter, { glow: 0.4 })
    } else {
      lanternPost(g, add, cx + 1, cz + 1, y)
      for (let i = 0; i < 26; i++) {
        const s = 0.16 + r() * 0.16
        add(cx + r() * 3, y, cz + r() * 3, s, s, s, r() < 0.5 ? P.rose : P.butter, { wind: 0.2 })
      }
    }
  }

  // Central courtyard with a sundial pool and four corner trees.
  const mid = n >> 1
  const [mx, mz] = center(cellIndex(n, mid, mid))
  const px = mx + 1
  const pz = mz + 1
  for (let z = pz - 7; z <= pz + 7; z++) for (let x = px - 7; x <= px + 7; x++) g.set(x, y - 1, z, hash3(x, 8, z) < 0.2 ? B.GRAVEL : B.COBBLE)
  for (let z = pz - 3; z <= pz + 3; z++) {
    for (let x = px - 3; x <= px + 3; x++) {
      const d = Math.hypot(x - px, z - pz)
      if (d < 3.6 && d >= 2.6) { g.set(x, y, z, B.STONE); g.set(x, y + 1, z, B.BARRIER) }
      if (d < 2.6) {
        g.water[g.col(x, z)] = y + 0.7
        g.set(x, y, z, B.BARRIER)
        g.set(x, y + 1, z, B.BARRIER)
      }
    }
  }
  g.fill(px, y, pz, px, y + 2, pz, B.STONE)
  add(px - 0.5, y + 3, pz - 0.5, 2, 0.2, 2, P.butterDeep)
  add(px + 0.4, y + 3.2, pz + 0.3, 0.2, 0.7, 0.5, P.butter)
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) oak(g, px + dx, pz + dz, dx + dz + 40, 0.1, B.LEAF_BIRCH)
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) urn(g, add, px + dx, y, pz + dz, dx * 3 + dz)

  // Lanterns perched on the hedge tops and timber arches over passages give the eye landmarks.
  for (let i = 0; i < 46; i++) {
    const a = 1 + ((r() * (n - 1)) | 0)
    const b = 1 + ((r() * (n - 1)) | 0)
    const lx = x0 + a * MAZE_PITCH
    const lz = z0 + b * MAZE_PITCH
    if (g.get(lx, y + 2, lz) === B.AIR) continue
    add(lx + 0.34, y + HEDGE_H, lz + 0.34, 0.3, 0.7, 0.3, P.timber)
    lantern(add, lx + 0.2, y + HEDGE_H + 0.7, lz + 0.2)
  }
  let arches = 0
  for (let tries = 0; tries < 400 && arches < 16; tries++) {
    const c = (r() * m.open.length) | 0
    if (!(m.open[c] & E) || m.court.has(c)) continue
    const [cx, cz] = center(c)
    const ax = cx + 3
    if (g.get(ax, y + 1, cz - 1) === B.AIR || g.get(ax, y + 1, cz + 3) === B.AIR) continue
    g.fill(ax, y + 4, cz, ax + 1, y + 4, cz + 2, B.TIMBER)
    for (let i = 0; i < 24; i++) {
      const s = 0.16 + r() * 0.2
      add(ax + r() * 2, y + 3.7 + r() * 0.3, cz + r() * 3, s, s, s, [P.rose, P.moss, P.butter][(r() * 3) | 0], { wind: 0.25, grounded: false })
    }
    arches++
  }

  // Entrance and exit archways.
  const arch = (cx: number, z: number, lamps: boolean) => {
    g.fill(cx - 2, y, z, cx - 2, y + 6, z + 1, B.STONE)
    g.fill(cx + 2, y, z, cx + 2, y + 6, z + 1, B.STONE)
    g.fill(cx - 3, y + 5, z - 1, cx + 3, y + 5, z + 2, B.TIMBER)
    g.fill(cx - 2, y + 6, z - 1, cx + 2, y + 6, z + 2, B.ROOF)
    g.fill(cx - 1, y + 7, z, cx + 1, y + 7, z + 1, B.ROOF_LIGHT)
    if (lamps) {
      add(cx - 3 + 0.2, y + 4.3, z - 0.6, 0.6, 0.7, 0.6, '#f7dc97', { glow: 2, tex: 0 })
      add(cx + 3 + 0.2, y + 4.3, z - 0.6, 0.6, 0.7, 0.6, '#f7dc97', { glow: 2, tex: 0 })
    }
    g.fill(cx - 1, y, z, cx + 1, y + 4, z + 1, B.AIR)
    for (let i = 0; i < 50; i++) {
      const s = 0.16 + r() * 0.2
      add(cx - 3 + r() * 7, y + 3.6 + r() * 1.4, z - 0.7 + r() * 3.4, s, s, s, [P.rose, P.moss, P.butter, P.cream][(r() * 4) | 0], { wind: 0.25, grounded: false })
    }
  }
  const ex = x0 + 2 + m.exit * MAZE_PITCH + 1
  const en = x0 + 2 + m.entrance * MAZE_PITCH + 1
  arch(ex, z0, true)
  arch(en, z0 + MAZE_SIZE - 2, true)
}

function plantTrees(g: Grid, dist: Float32Array) {
  const r = mulberry32(1234)
  const placed: [number, number][] = []
  const far = (x: number, z: number, d: number) => {
    for (const [px, pz] of placed) if ((px - x) ** 2 + (pz - z) ** 2 < d * d) return false
    return true
  }
  for (let i = 0; i < 9000; i++) {
    const x = 4 + ((r() * (W - 8)) | 0)
    const z = 4 + ((r() * (D - 8)) | 0)
    const c = g.col(x, z)
    if (g.reserved[c] || g.water[c]) continue
    if (x >= MAZE_X0 - 2 && x <= MAZE_X0 + MAZE_SIZE + 2 && z >= MAZE_Z0 - 2 && z <= MAZE_Z0 + MAZE_SIZE + 2) continue
    if (g.get(x, g.h(x, z), z) !== B.AIR) continue
    const out = g.blocked[c] === 1
    const d = dist[c]
    if (x >= 80 && x <= 176 && z >= 148 && z <= 181) continue
    // Keep the clearing open so the golden tree stands alone.
    if (Math.hypot((x - CLEARING.x) / CLEARING.rx, (z - CLEARING.z) / CLEARING.rz) < 0.97) continue
    // Leave the view of the cottage open from the path.
    if (x >= 100 && x <= 156 && z >= 196 && z <= 292) continue
    // Sparse in the open meadows, thick beyond the edge of the playable land.
    const spacing = out ? (d < 26 ? 6.5 : 10) : 13
    if (!out && fbm(x * 0.04, z * 0.04, 77, 2) < 0.47) continue
    if (!far(x, z, spacing)) continue
    // Keep the clearing's ring from walling off the view with trunks too close to stations.
    placed.push([x, z])
    const k = r()
    if (out && k < 0.55) pine(g, x, z, (r() * 1000) | 0)
    else if (k < 0.75) oak(g, x, z, (r() * 1000) | 0, 0.3 + r() * 0.7)
    else birch(g, x, z, (r() * 1000) | 0)
  }
}

function grow(
  g: Grid, r: () => number,
  put: (o: Instances, x: number, y: number, z: number, ry: number, s: number, c: Color) => void,
  grass: Instances, flowers: Instances,
) {
  const tint = new Color()
  const wild = [P.rose, P.butter, P.cream, P.periwinkle, P.terracottaLight].map(colorOf)
  for (let z = 2; z < D - 2; z++) {
    for (let x = 2; x < W - 2; x++) {
      const c = g.col(x, z)
      if (g.surface[c] !== B.GRASS || g.water[c]) continue
      const y = g.height[c]
      if (g.get(x, y, z) !== B.AIR || g.get(x, y - 1, z) !== B.GRASS) continue
      const out = g.blocked[c] === 1
      const meadow = fbm(x * 0.06, z * 0.06, 61, 2)
      const clearing = z < 62
      const pGrass = out ? 0.14 : 0.42 + meadow * 0.55
      if (r() < pGrass) {
        // Blades take the colour of the ground they grow from, nudged lighter or darker.
        grassColor(x, z, tint)
        tint.multiplyScalar(0.94 + r() * 0.34)
        put(grass, x + r(), y, z + r(), r() * 6, 0.75 + r() * 0.65 + meadow * 0.3, tint)
      }
      const pFlower = out ? 0 : smooth(0.52, 0.72, meadow) * 0.22 + (clearing ? 0.2 : 0.012)
      if (r() < pFlower) {
        // Patches of one colour read better than confetti.
        const pick = (fbm(x * 0.09, z * 0.09, 71, 1) * wild.length * 1.6) % wild.length | 0
        put(flowers, x + r(), y, z + r(), r() * 6, 0.75 + r() * 0.5, r() < 0.75 ? wild[pick] : wild[(r() * wild.length) | 0])
      }
    }
  }
}

function buildWater(g: Grid) {
  const pos: number[] = []
  const depth: number[] = []
  const flow: number[] = []
  const idx: number[] = []
  const depthAt = (x: number, z: number) => {
    let n = 0
    let t = 0
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        t++
        if (g.water[g.col(clamp(x + dx, 0, W - 1), clamp(z + dz, 0, D - 1))] > 0) n++
      }
    }
    return smooth(0.55, 1, n / t)
  }
  let v = 0
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      const lvl = g.water[c]
      if (!lvl) continue
      const deep = inPond(x, z) ? 1 : 0.1
      pos.push(x, lvl, z + 1, x + 1, lvl, z + 1, x + 1, lvl, z, x, lvl, z)
      for (const [dx, dz] of [[0, 1], [1, 1], [1, 0], [0, 0]]) depth.push(depthAt(x + dx - 0.5 | 0, z + dz - 0.5 | 0) * deep)
      for (let k = 0; k < 4; k++) flow.push(g.waterFlow[c])
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3)
      v += 4
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('aDepth', new BufferAttribute(new Float32Array(depth), 1))
  geo.setAttribute('aFlow', new BufferAttribute(new Float32Array(flow), 1))
  geo.setIndex(new BufferAttribute(new Uint32Array(idx), 1))
  geo.computeBoundingSphere()
  return geo
}
