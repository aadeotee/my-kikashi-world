import { BufferAttribute, BufferGeometry, Color } from 'three'
import { portfolio } from '../../content/portfolio'
import { B } from '../blocks'
import { BENCH, CHUNK, COTTAGE, D, G0, GOLDEN_TREE, H, HEDGE_H, MAZE_TOP, MAZE_X0, POND, W } from '../constants'
import { P } from '../palette'
import { clamp, fbm, hash3, mulberry32, smooth } from '../rng'
import { Grid } from './grid'
import { MAZE_BLOCKS_H, MAZE_BLOCKS_W, MAZE_MAP, mapToBlocks } from './maze'
import { BoxFx, MeshBuilder } from './meshBuilder'
import { grassColor, meshChunk } from './mesher'
import { birch, goldenTree, oak, pine, rock, willow } from './nature'
import {
  AddBox, bench, bookshelf, buildCottage, easel, fence, gallery, lanternPost, mapTable, placer, postbox, workshop,
} from './structures'

export type Instances = number[] // x, y, z, rotY, scale, r, g, b repeated

export interface Station {
  id: string
  label: string
  x: number
  z: number
}

export interface World {
  grid: Grid
  chunks: BufferGeometry[]
  water: BufferGeometry
  grass: Instances
  flowers: Instances
  reeds: Instances
  stations: Station[]
  /** The golden canopy, kept out of the static mesh so each leaf can fall: x, y, z, shade repeated. */
  goldLeaves: number[]
  entrance: { x: number; z: number }
  exit: { x: number; z: number }
  chimney: [number, number, number]
}

const tick = () => new Promise<void>((r) => setTimeout(r))
const colorOf = (hex: string) => new Color(hex)

export const inPond = (x: number, z: number) => pondField(x, z) < 1
export function pondField(x: number, z: number) {
  const dx = (x - POND.x) / POND.rx
  const dz = (z - POND.z) / POND.rz
  return dx * dx + dz * dz + (fbm(x * 0.09, z * 0.09, 41, 2) - 0.5) * 0.6
}

function pathLine(g: Grid, pts: [number, number][], width: number, block: number, alt: number) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = ax + (bx - ax) * t
      const cz = az + (bz - az) * t
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

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  I: ['#####', '..#..', '..#..', '..#..', '#####'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
}
const LETTER = 0.5
/** Where the raised ground lettering sits, by centre point. */
const IMPRINTS = [
  { word: 'POND', x: 98, z: 226 },
  { word: 'MAZE', x: 137.5, z: 239 },
  { word: 'SKIP', x: 154.5, z: 216 },
]

const imprintWidth = (word: string) => (word.length * 6 - 1) * LETTER

/** A patch of soil for the word to sit on, so it reads clearly against the grass. */
function stampImprintPad(g: Grid, x: number, z: number, word: string) {
  const hw = imprintWidth(word) / 2 + 1
  for (let bz = Math.floor(z - 2.6); bz <= Math.ceil(z + 2.2); bz++) {
    for (let bx = Math.floor(x - hw); bx <= Math.ceil(x + hw); bx++) {
      const c = g.col(bx, bz)
      g.surface[c] = B.SOIL
      g.height[c] = G0
      g.reserved[c] = 1
    }
  }
}

/** Letters are laid out for the viewer, who sees the page from the north: reading runs towards low X. */
function imprint(add: AddBox, x: number, z: number, word: string) {
  const left = x + imprintWidth(word) / 2
  const top = z + (5 * LETTER) / 2
  ;[...word].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, r) => {
      for (let c = 0; c < 5; c++) {
        if (row[c] !== '#') continue
        add(left - (i * 6 + c + 1) * LETTER, G0, top - (r + 1) * LETTER, LETTER * 0.96, 0.5, LETTER * 0.96, P.cream, { tex: 0.06 })
      }
    })
  })
}

function stampTerrain(g: Grid) {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      // The page column stays flat; the land only rolls gently out at the margins.
      const edge = smooth(36, 60, Math.abs(x - 128))
      g.height[c] = clamp(Math.round(G0 + (fbm(x * 0.03, z * 0.03, 1, 3) - 0.35) * 9 * edge), 8, H - 22)
      g.surface[c] = B.GRASS
    }
  }
}

function stampPond(g: Grid) {
  for (let z = POND.z - 16; z <= POND.z + 16; z++) {
    for (let x = POND.x - 22; x <= POND.x + 22; x++) {
      const f = pondField(x, z)
      const c = g.col(x, z)
      if (f < 1) {
        g.height[c] = G0 - 1 - Math.round(clamp((1 - f) * 3, 0, 2))
        g.surface[c] = f > 0.72 ? B.SAND : B.MUD
        g.water[c] = G0 - 0.28
        g.reserved[c] = 1
      } else if (f < 1.25) {
        g.height[c] = G0
        g.surface[c] = hash3(x, 5, z) < 0.55 ? B.SAND : B.GRASS
        g.reserved[c] = 1
      }
    }
  }
}

function fillColumns(g: Grid) {
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      const h = g.height[c]
      for (let y = 0; y < h - 1; y++) g.set(x, y, z, y < h - 4 ? B.STONE : B.DIRT)
      g.set(x, h - 1, z, g.surface[c])
    }
  }
}

function buildMaze(g: Grid, add: AddBox) {
  const y = G0
  const r = mulberry32(5150)
  const blooms = [P.rose, P.cream, P.butter, P.terracottaLight]
  MAZE_MAP.forEach((row, my) => {
    const [z0, z1] = mapToBlocks(my)
    for (let mx = 0; mx < row.length; mx++) {
      const [x0, x1] = mapToBlocks(mx)
      for (let bz = z0; bz <= z1; bz++) {
        for (let bx = x0; bx <= x1; bx++) {
          const x = MAZE_X0 + bx
          const z = MAZE_TOP - bz
          if (row[mx] === '.') {
            g.set(x, y - 1, z, hash3(x, 6, z) < 0.18 ? B.COBBLE : B.GRAVEL)
            continue
          }
          for (let k = 0; k < HEDGE_H; k++) g.set(x, y + k, z, B.HEDGE)
          if (r() < 0.16) {
            const s = 0.2 + r() * 0.16
            add(x + r() * 0.7, y + HEDGE_H, z + r() * 0.7, s, 0.1, s, blooms[(r() * blooms.length) | 0], { wind: 0.08, tex: 0, grounded: false })
          }
        }
      }
    }
  })
  g.reserve(MAZE_X0 - 2, MAZE_TOP - MAZE_BLOCKS_H - 1, MAZE_X0 + MAZE_BLOCKS_W + 2, MAZE_TOP + 2)
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

  onProgress(0.08, 'Rolling out the garden')
  await tick()
  stampTerrain(g)
  stampPond(g)

  const midX = MAZE_X0 + (MAZE_BLOCKS_W - 1) / 2
  const bottom = MAZE_TOP - MAZE_BLOCKS_H + 1
  pathLine(g, [[128, 250], [128.5, MAZE_TOP + 1]], 3.4, B.DIRT_PATH, B.GRAVEL)
  pathLine(g, [[midX, bottom - 1], [midX, 190]], 3.4, B.DIRT_PATH, B.GRAVEL)
  // The way round the maze, for anyone who would rather skip it.
  pathLine(g, [[129, 242.7], [145.5, 242.7], [145.5, 192], [129, 192]], 2.6, B.DIRT_PATH, B.GRAVEL)
  for (const { word, x, z } of IMPRINTS) {
    stampImprintPad(g, x, z, word)
    // Tall things stand up the screen, so keep the ground in front of each word free of trees.
    g.reserve(x - 14, z - 26, x + 14, z + 3)
  }
  pathLine(g, [[128, 184], [128, 104]], 3, B.DIRT_PATH, B.GRAVEL)
  for (const z of [166, 146, 126]) pathLine(g, [[116, z], [140, z]], 2.2, B.DIRT_PATH, B.GRAVEL)

  onProgress(0.2, 'Laying the soil')
  await tick()
  fillColumns(g)
  buildCottage(g, add)
  buildMaze(g, add)
  for (const { word, x, z } of IMPRINTS) imprint(add, x, z, word)

  // She can wander freely inside these bounds, but not into the water.
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = g.col(x, z)
      if (x < 84 || x > 172 || z > 300) g.blocked[c] = 1
      if (g.water[c] > 0) g.fill(x, g.height[c], z, x, G0 + 6, z, B.BARRIER)
    }
  }

  const r = mulberry32(2024)
  const reds = [P.rose, P.butter, P.cream, P.terracottaLight, P.periwinkle, P.plum]
  const flowers: Instances = []
  const grass: Instances = []
  const reeds: Instances = []
  const put = (out: Instances, x: number, y: number, z: number, ry: number, s: number, c: Color) =>
    out.push(x, y, z, ry, s, c.r, c.g, c.b)

  // Cottage garden.
  fence(g, add, 112, 244, 125, 244)
  fence(g, add, 131, 244, 146, 244)
  fence(g, add, 112, 244, 112, 276)
  fence(g, add, 146, 244, 146, 276)
  add(131.4, G0, 242.4, 0.24, 1.4, 0.24, P.timber)
  add(131, G0 + 1.4, 241.8, 1, 0.7, 1.5, P.periwinkle, { tex: 0.12 })
  add(131, G0 + 2.1, 241.8, 1, 0.14, 1.5, P.cream, { grounded: false })
  add(132, G0 + 1.8, 242.6, 0.08, 0.6, 0.12, P.terracotta, { grounded: false })
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
  bed(114, 246, 118, 248)
  bed(138, 246, 144, 248)

  // Pond dressing.
  for (let z = POND.z - 14; z <= POND.z + 14; z++) {
    for (let x = POND.x - 20; x <= POND.x + 20; x++) {
      const f = pondField(x, z)
      const c = g.col(x, z)
      if (f >= 1 && f < 1.2 && hash3(x, 11, z) < 0.05 && g.height[c] === G0) rock(g, x, z, x * 13 + z)
      if (f > 0.82 && f < 1.12 && hash3(x, 12, z) < 0.3) {
        for (let k = 0; k < 2; k++)
          put(reeds, x + r(), f < 1 ? g.h(x, z) : G0, z + r(), r() * 6, 0.8 + r() * 0.5, colorOf(r() < 0.3 ? P.sageLight : P.moss))
      }
      if (f < 0.7 && f > 0.2 && hash3(x, 13, z) < 0.03) {
        const s = 0.9 + r() * 0.7
        const y = G0 - 0.25
        add(x, y, z, s, 0.05, s, r() < 0.5 ? P.moss : P.sage, { grounded: false, wind: 0.02 })
        if (r() < 0.55) add(x + s * 0.3, y + 0.05, z + s * 0.3, 0.34, 0.14, 0.34, r() < 0.5 ? P.rose : P.cream, { grounded: false })
      }
    }
  }

  // Bench she rests on. It carries no collision: she only ever walks here in the closing scene.
  bench(g, add, BENCH.x, G0, BENCH.z, true)
  g.fill(BENCH.x, G0, BENCH.z, BENCH.x + 2, G0 + 1, BENCH.z, B.AIR)
  g.reserve(BENCH.x - 2, BENCH.z - 2, BENCH.x + 5, BENCH.z + 2)

  onProgress(0.34, 'Setting out the options')
  await tick()
  // The page is viewed from the north, so screen-left is the higher X.
  const L = 142
  const R = 114
  const stations: Station[] = [
    { id: 'contact', label: portfolio.sections.contact.title, x: L, z: 170 },
    { id: 'works', label: portfolio.sections.works.title, x: R, z: 170 },
    { id: 'projects', label: portfolio.sections.projects.title, x: L, z: 150 },
    { id: 'experiments', label: portfolio.sections.experiments.title, x: R, z: 150 },
    { id: 'play', label: portfolio.sections.play.title, x: L, z: 130 },
    { id: 'resume', label: portfolio.sections.resume.title, x: R, z: 130 },
    { id: 'about', label: portfolio.sections.about.title, x: GOLDEN_TREE.x, z: GOLDEN_TREE.z },
  ]
  postbox(placer(g, add, L, 170, 2), G0)
  gallery(placer(g, add, R, 170, 2), G0)
  workshop(placer(g, add, L, 150, 2), G0)
  bookshelf(placer(g, add, R, 150, 2), G0)
  mapTable(placer(g, add, L, 130, 2), G0)
  easel(placer(g, add, R, 130, 2), G0)
  for (const s of stations) g.reserve(s.x - 10, s.z - 4, s.x + 10, s.z + 11)
  for (const [x, z] of [[124, 180], [132, 180]] as const) lanternPost(g, add, x, z, G0)
  goldenTree(g, GOLDEN_TREE.x, GOLDEN_TREE.z)
  const goldLeaves = liftCanopy(g)
  g.reserve(GOLDEN_TREE.x - 14, GOLDEN_TREE.z - 14, GOLDEN_TREE.x + 14, GOLDEN_TREE.z + 14)

  onProgress(0.46, 'Growing the trees')
  await tick()
  willow(g, 72, 240, 5)
  for (const [x, z] of [[109, 262], [150, 262], [106, 280], [152, 282]] as const) oak(g, x, z, x + z, 0.2, B.LEAF_BLOSSOM)
  plantTrees(g, r)
  grow(g, r, put, grass, flowers)

  const chunks: BufferGeometry[] = []
  for (let cz = 0; cz < nz; cz++) {
    for (let cx = 0; cx < nx; cx++) {
      const mb = builders[cz * nx + cx]
      meshChunk(g, cx, cz, mb)
      if (mb.count) chunks.push(mb.geometry())
      builders[cz * nx + cx] = new MeshBuilder()
    }
    onProgress(0.5 + (0.46 * (cz + 1)) / nz, 'Painting it block by block')
    await tick()
  }

  return {
    grid: g,
    chunks,
    water: buildWater(g),
    grass,
    flowers,
    reeds,
    stations,
    goldLeaves,
    entrance: { x: midX + 0.5, z: MAZE_TOP + 0.5 },
    exit: { x: midX + 0.5, z: bottom },
    chimney: [133, G0 + 1 + 5 + ((COTTAGE.z1 - COTTAGE.z0 + 2) >> 1) + 4.2, 264],
  }
}

function liftCanopy(g: Grid) {
  const out: number[] = []
  const { x: cx, z: cz } = GOLDEN_TREE
  for (let y = G0; y < H; y++) {
    for (let z = cz - 26; z <= cz + 26; z++) {
      for (let x = cx - 26; x <= cx + 26; x++) {
        if (g.get(x, y, z) !== B.LEAF_GOLD) continue
        // Undersides sit in their own shade, standing in for the static mesh's baked occlusion.
        out.push(x, y, z, g.get(x, y + 1, z) === B.LEAF_GOLD ? 0.8 : 1)
      }
    }
  }
  for (let i = 0; i < out.length; i += 4) g.set(out[i], out[i + 1], out[i + 2], B.AIR)
  return out
}

/** Trees fill the margins either side of the page column, leaving the column itself clear. */
function plantTrees(g: Grid, r: () => number) {
  const placed: [number, number][] = []
  for (let i = 0; i < 5000; i++) {
    const x = 30 + ((r() * 196) | 0)
    const z = 60 + ((r() * 250) | 0)
    if (Math.abs(x - 128) < 30 && z < 244) continue
    if (Math.abs(x - 128) < 26) continue
    const c = g.col(x, z)
    if (g.reserved[c] || g.water[c] || pondField(x, z) < 1.6) continue
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 81)) continue
    placed.push([x, z])
    const k = r()
    if (k < 0.2) pine(g, x, z, (r() * 1000) | 0)
    else if (k < 0.75) oak(g, x, z, (r() * 1000) | 0, 0.3 + r() * 0.6)
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
  for (let z = 70; z < 300; z++) {
    for (let x = 36; x < 220; x++) {
      const c = g.col(x, z)
      if (g.surface[c] !== B.GRASS || g.water[c]) continue
      const y = g.height[c]
      if (g.get(x, y, z) !== B.AIR || g.get(x, y - 1, z) !== B.GRASS) continue
      const meadow = fbm(x * 0.06, z * 0.06, 61, 2)
      if (r() < 0.3 + meadow * 0.5) {
        grassColor(x, z, tint)
        tint.multiplyScalar(0.94 + r() * 0.34)
        put(grass, x + r(), y, z + r(), r() * 6, 0.75 + r() * 0.65 + meadow * 0.3, tint)
      }
      if (r() < smooth(0.5, 0.7, meadow) * 0.2 + 0.02) {
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
      const lvl = g.water[g.col(x, z)]
      if (!lvl) continue
      pos.push(x, lvl, z + 1, x + 1, lvl, z + 1, x + 1, lvl, z, x, lvl, z)
      for (const [dx, dz] of [[0, 1], [1, 1], [1, 0], [0, 0]]) depth.push(depthAt(x + dx - 1, z + dz - 1))
      for (let k = 0; k < 4; k++) flow.push(0)
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
