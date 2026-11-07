import { Color } from 'three'
import { B } from '../blocks'
import { COTTAGE, DOOR_X, G0 } from '../constants'
import { P } from '../palette'
import { hash3, mulberry32 } from '../rng'
import type { Grid } from './grid'
import type { BoxFx } from './meshBuilder'

export type AddBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string | Color, o?: BoxFx) => void

const WOOD_FX: BoxFx = { tex: 0.2 }
const BLOOMS = [P.rose, P.butter, P.cream, P.terracottaLight, P.periwinkle, P.plum]

export function flowerBox(add: AddBox, x: number, y: number, z: number, sx: number, sz: number, seed: number) {
  add(x, y, z, sx, 0.4, sz, P.plank, WOOD_FX)
  const r = mulberry32(seed)
  const n = Math.round((sx + sz) * 5)
  for (let i = 0; i < n; i++) {
    const s = 0.14 + r() * 0.14
    const px = x + r() * (sx - s)
    const pz = z + r() * (sz - s)
    add(px, y + 0.4, pz, s, s, s, r() < 0.3 ? P.moss : BLOOMS[(r() * BLOOMS.length) | 0], { wind: 0.2, grounded: false })
  }
  for (let i = 0; i < sx * 3; i++) {
    const px = x + r() * sx
    add(px, y - 0.1 - r() * 0.45, z + (r() < 0.5 ? -0.06 : sz - 0.06), 0.14, 0.5, 0.14, P.moss, { wind: 0.15, grounded: false })
  }
}

export function lantern(add: AddBox, x: number, y: number, z: number) {
  add(x + 0.14, y, z + 0.14, 0.32, 0.08, 0.32, P.timber)
  add(x + 0.18, y + 0.08, z + 0.18, 0.24, 0.32, 0.24, '#f7dc97', { glow: 1.6, tex: 0, grounded: false })
  add(x + 0.1, y + 0.4, z + 0.1, 0.4, 0.1, 0.4, P.timber, { grounded: false })
}

export function lanternPost(g: Grid, add: AddBox, x: number, z: number, y: number) {
  add(x + 0.38, y, z + 0.38, 0.24, 2.3, 0.24, P.timber, WOOD_FX)
  add(x + 0.3, y + 2.3, z + 0.3, 0.4, 0.08, 0.4, P.timber)
  lantern(add, x + 0.2, y + 2.38, z + 0.2)
  g.set(x, y, z, B.BARRIER)
  g.set(x, y + 1, z, B.BARRIER)
}

export function bench(g: Grid, add: AddBox, x: number, y: number, z: number, alongX: boolean) {
  const L = 3
  const sx = alongX ? L : 0.9
  const sz = alongX ? 0.9 : L
  add(x, y + 0.45, z, sx, 0.14, sz, P.plankLight, WOOD_FX)
  for (const t of [0.1, L - 0.3]) {
    if (alongX) {
      add(x + t, y, z + 0.1, 0.2, 0.45, 0.7, P.timber)
    } else {
      add(x + 0.1, y, z + t, 0.7, 0.45, 0.2, P.timber)
    }
  }
  if (alongX) add(x, y + 0.75, z + 0.72, L, 0.4, 0.12, P.plank, WOOD_FX)
  else add(x + 0.72, y + 0.75, z, 0.12, 0.4, L, P.plank, WOOD_FX)
  for (let i = 0; i < L; i++) {
    g.set(alongX ? x + i : x, y, alongX ? z : z + i, B.BARRIER)
    g.set(alongX ? x + i : x, y + 1, alongX ? z : z + i, B.BARRIER)
  }
}

export function urn(g: Grid, add: AddBox, x: number, y: number, z: number, seed: number) {
  add(x + 0.3, y, z + 0.3, 0.4, 0.2, 0.4, P.stone)
  add(x + 0.16, y + 0.2, z + 0.16, 0.68, 0.55, 0.68, P.terracotta)
  add(x + 0.08, y + 0.75, z + 0.08, 0.84, 0.14, 0.84, P.terracottaLight)
  const r = mulberry32(seed)
  for (let i = 0; i < 16; i++) {
    const s = 0.14 + r() * 0.16
    add(x + 0.14 + r() * 0.55, y + 0.88 + r() * 0.3, z + 0.14 + r() * 0.55, s, s, s,
      r() < 0.45 ? P.moss : BLOOMS[(r() * 4) | 0], { wind: 0.2, grounded: false })
  }
  g.set(x, y, z, B.BARRIER)
  g.set(x, y + 1, z, B.BARRIER)
}

/** Picket fence between two axis-aligned points; collision is a 2-high invisible row. */
export function fence(g: Grid, add: AddBox, x0: number, z0: number, x1: number, z1: number) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0))
  const dx = Math.sign(x1 - x0)
  const dz = Math.sign(z1 - z0)
  for (let i = 0; i <= n; i++) {
    const x = x0 + dx * i
    const z = z0 + dz * i
    const y = g.h(x, z)
    g.set(x, y, z, B.BARRIER)
    g.set(x, y + 1, z, B.BARRIER)
    g.reserve(x, z, x, z)
    const post = i % 3 === 0
    add(x + 0.4, y, z + 0.4, 0.2, post ? 1.25 : 1.05, 0.2, post ? P.plank : P.cream, WOOD_FX)
    if (i < n) {
      const yn = g.h(x + dx, z + dz)
      const lift = Math.min(y, yn)
      add(x + 0.45 + (dx ? 0 : 0), lift + 0.72, z + 0.45, dx ? 1 : 0.1, 0.1, dz ? 1 : 0.1, P.creamDark, { grounded: false })
      add(x + 0.45, lift + 0.32, z + 0.45, dx ? 1 : 0.1, 0.1, dz ? 1 : 0.1, P.creamDark, { grounded: false })
    }
  }
}

export function buildCottage(g: Grid, add: AddBox) {
  const { x0, x1, z0, z1 } = COTTAGE
  const F = G0 + 1
  g.fill(x0, G0, z0, x1, G0, z1, B.STONE)
  g.fill(x0 + 1, G0, z0 + 1, x1 - 1, G0, z1 - 1, B.PLANK)

  // Walls: cream plaster framed in dark timber.
  for (let y = F; y < F + 5; y++) {
    for (let x = x0; x <= x1; x++) {
      for (const z of [z0, z1]) {
        const frame = x === x0 || x === x1 || (x - x0) % 6 === 0 || y === F + 4
        g.set(x, y, z, y === F ? B.STONE : frame ? B.TIMBER : B.PLASTER)
      }
    }
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) {
        const frame = z === z0 || z === z1 || (z - z0) % 6 === 0 || y === F + 4
        g.set(x, y, z, y === F ? B.STONE : frame ? B.TIMBER : B.PLASTER)
      }
    }
  }

  // Gable roof, ridge running east-west.
  const rows = (z1 - z0 + 2) >> 1
  for (let s = 0; s <= rows; s++) {
    const y = F + 5 + s
    const zN = z0 - 1 + s
    const zS = z1 + 1 - s
    const tile = s % 2 ? B.ROOF_LIGHT : B.ROOF
    for (const z of [zN, zS]) {
      g.fill(x0 - 1, y, z, x1 + 1, y, z, tile)
      g.fill(x0 - 1, y - 1, z, x1 + 1, y - 1, z, B.ROOF)
    }
    for (const x of [x0, x1])
      for (let z = zN + 1; z < zS; z++) g.set(x, y, z, hash3(x, y, z) < 0.15 ? B.TIMBER : B.PLASTER)
  }
  const ridge = F + 5 + rows
  g.fill(x0 - 1, ridge, z0 + rows - 1, x1 + 1, ridge, z0 + rows - 1, B.TIMBER)
  for (const x of [x0, x1]) g.fill(x, ridge - 4, 262, x, ridge - 3, 262, B.GLASS)
  // Moss creeping over the tiles.
  const r = mulberry32(31)
  for (let i = 0; i < 60; i++) {
    const s = (r() * rows) | 0
    const x = x0 - 1 + ((r() * (x1 - x0 + 3)) | 0)
    const z = r() < 0.5 ? z0 - 1 + s : z1 + 1 - s
    if (g.get(x, F + 5 + s, z) !== B.AIR) g.set(x, F + 5 + s, z, r() < 0.5 ? B.LEAF_OAK : B.ROOF)
  }

  // Chimney.
  g.fill(132, F, 263, 133, ridge + 3, 264, B.BRICK)
  g.fill(131, ridge + 3, 262, 134, ridge + 3, 265, B.STONE)
  g.fill(132, ridge + 3, 263, 133, ridge + 3, 264, B.TIMBER)

  // Door opening, closed with an invisible barrier until the opening scene.
  g.fill(DOOR_X - 1, F, z0, DOOR_X, F + 2, z0, B.BARRIER)
  g.fill(DOOR_X - 2, F + 3, z0, DOOR_X + 1, F + 3, z0, B.TIMBER)
  g.fill(DOOR_X - 2, F, z0, DOOR_X - 2, F + 2, z0, B.TIMBER)
  g.fill(DOOR_X + 1, F, z0, DOOR_X + 1, F + 2, z0, B.TIMBER)

  // Windows, each dressed with a flower box.
  const north: [number, number][] = [[121, 2], [132, 2]]
  for (const [x, w] of north) {
    g.fill(x, F + 2, z0, x + w - 1, F + 3, z0, B.GLASS)
    g.fill(x - 1, F + 1, z0, x + w, F + 1, z0, B.TIMBER)
    flowerBox(add, x - 1, F + 1.45, z0 - 0.75, w + 2, 0.72, x)
    add(x + 0.92, F + 2, z0 - 0.06, 0.16, 2, 0.1, P.timber)
    add(x, F + 2.92, z0 - 0.06, 2, 0.16, 0.1, P.timber)
  }
  for (const x of [123, 130]) {
    g.fill(x, F + 2, z1, x + 1, F + 3, z1, B.GLASS)
    flowerBox(add, x - 1, F + 1.45, z1 + 1.03, 4, 0.72, x + 3)
  }
  for (const [x, nx] of [[x0, -0.75], [x1, 1.03]] as const) {
    for (const z of [259, 264]) {
      g.fill(x, F + 2, z, x, F + 3, z + 1, B.GLASS)
      flowerBox(add, x + nx, F + 1.45, z - 1, 0.72, 4, z + x)
    }
  }

  // Ivy up the north-west corner.
  for (let i = 0; i < 40; i++) {
    const x = x0 - 1
    const z = z0 + ((r() * 5) | 0)
    const y = F + ((r() * r() * 7) | 0)
    if (g.get(x, y, z) === B.AIR) g.set(x, y, z, B.LEAF_OAK)
  }

  // Porch.
  g.fill(122, G0, 251, 133, G0, 255, B.PLANK)
  for (const x of [122, 133]) g.fill(x, F, 251, x, F + 3, 251, B.TIMBER)
  for (const x of [122, 133]) g.fill(x, F, 254, x, F + 3, 254, B.TIMBER)
  g.fill(122, F + 3, 251, 133, F + 3, 251, B.TIMBER)
  for (let z = 250; z <= 255; z++) g.fill(121, F + 4 + ((z - 250) >> 1), z, 134, F + 4 + ((z - 250) >> 1), z, z % 2 ? B.ROOF_LIGHT : B.ROOF)
  lantern(add, 124, F + 2.4, 251.2)
  lantern(add, 131, F + 2.4, 251.2)
  add(124.3, F + 2.9, 251.4, 0.08, 0.1, 0.08, P.timber)
  // Railings either side of the steps.
  for (const x of [122, 133]) {
    add(x + 0.4, F + 0.8, 251, 0.14, 0.12, 4, P.plankLight, { grounded: false })
    g.fill(x, F, 252, x, F + 1, 253, B.BARRIER)
  }
  for (const [a, b] of [[122, 125], [130, 133]]) {
    add(a, F + 0.8, 251.4, b - a + 1, 0.12, 0.14, P.plankLight, { grounded: false })
    for (let x = a; x <= b; x++) add(x + 0.44, F, 251.44, 0.1, 0.8, 0.1, P.cream)
    g.fill(a, F, 251, b, F + 1, 251, B.BARRIER)
  }
  g.fill(122, F, 251, 122, F + 3, 251, B.TIMBER)
  g.fill(133, F, 251, 133, F + 3, 251, B.TIMBER)
  // Boots and a watering can left on the porch.
  add(130.4, F, 254.6, 0.3, 0.4, 0.55, P.terracotta)
  add(130.8, F, 254.6, 0.3, 0.4, 0.55, P.terracotta)
  add(125.2, F, 254.5, 0.6, 0.5, 0.45, P.periwinkle)
  add(124.9, F + 0.3, 254.65, 0.36, 0.1, 0.12, P.periwinkle)

  // A glimpse of home inside.
  add(122, F, 263, 4, 0.7, 3, P.cream, { tex: 0.1 })
  add(122, F, 263, 1.2, 0.95, 3, P.plank)
  add(123.4, F + 0.7, 263.3, 2.4, 0.16, 2.4, P.terracottaLight)
  add(128, F + 0.02, 259, 4, 0.05, 4, P.rose, { tex: 0.3 })
  add(129, F, 262, 2, 0.9, 2, P.plank)
  add(129.7, F + 0.9, 262.7, 0.5, 0.4, 0.5, P.butter)
  g.fill(122, F, 263, 125, F + 1, 265, B.BARRIER)
  g.fill(129, F, 262, 130, F + 1, 263, B.BARRIER)
  g.fill(131, F, 263, 134, F + 1, 265, B.BRICK)

  g.reserve(x0 - 2, 250, x1 + 2, z1 + 2)
}

/** Local-to-world mapper so stations can be authored facing +Z, then turned in 90° steps. */
export function placer(g: Grid, add: AddBox, ox: number, oz: number, rot: 0 | 1 | 2 | 3) {
  const tx = (x: number, z: number): [number, number] => {
    switch (rot) {
      case 0: return [x, z]
      case 1: return [z, -x]
      case 2: return [-x, -z]
      default: return [-z, x]
    }
  }
  return {
    box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string | Color, o?: BoxFx) {
      const [ax, az] = tx(x, z)
      const [bx, bz] = tx(x + sx, z + sz)
      add(ox + Math.min(ax, bx), y, oz + Math.min(az, bz), Math.abs(bx - ax), sy, Math.abs(bz - az), c, o)
    },
    fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: number) {
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          for (let x = x0; x <= x1; x++) {
            // Cell (x, z) spans to x+1, z+1, so rotate its centre and floor back onto the grid.
            const [wx, wz] = tx(x + 0.5, z + 0.5)
            g.set(Math.floor(ox + wx), y, Math.floor(oz + wz), b)
          }
    },
  }
}

export type Placer = ReturnType<typeof placer>

export function gallery(p: Placer, y: number) {
  const w = 8
  p.fill(-w, y - 1, -9, w, y - 1, 0, B.COBBLE)
  for (let k = 0; k < 6; k++) {
    for (let x = -w; x <= w; x++) {
      for (const z of [-9, 0]) {
        const col = (x + w) % 4 === 0
        const open = z === 0 && Math.abs(x) <= 2 && k < 4
        if (!open) p.fill(x, y + k, z, x, y + k, z, col ? B.TIMBER : B.PLASTER)
      }
    }
    for (let z = -9; z <= 0; z++) for (const x of [-w, w]) p.fill(x, y + k, z, x, y + k, z, z % 3 === 0 ? B.TIMBER : B.PLASTER)
  }
  for (let s = 0; s < 6; s++) {
    p.fill(-w - 1, y + 6 + s, -10 + s, w + 1, y + 6 + s, -10 + s, s % 2 ? B.ROOF_LIGHT : B.ROOF)
    p.fill(-w - 1, y + 6 + s, 1 - s, w + 1, y + 6 + s, 1 - s, s % 2 ? B.ROOF_LIGHT : B.ROOF)
    p.fill(-w, y + 6 + s, -9 + s, -w, y + 6 + s, -s, B.PLASTER)
    p.fill(w, y + 6 + s, -9 + s, w, y + 6 + s, -s, B.PLASTER)
  }
  // Framed pieces on the facade and inside.
  const art = [P.terracottaLight, P.periwinkle, P.butter, P.moss]
  ;[-6.5, 4].forEach((x, i) => {
    p.box(x, y + 2, 1, 2.4, 2.4, 0.1, P.timber, { grounded: false })
    p.box(x + 0.2, y + 2.2, 1.04, 2, 2, 0.1, art[i], { tex: 0.3, grounded: false })
  })
  ;[-5, -1.5, 2].forEach((x, i) => {
    p.box(x, y + 1.6, -8, 2.6, 2.4, 0.1, P.timber, { grounded: false })
    p.box(x + 0.2, y + 1.8, -7.96, 2.2, 2, 0.1, art[(i + 1) % 4], { tex: 0.3, glow: 0.3, grounded: false })
  })
}

export function workshop(p: Placer, y: number) {
  const w = 6
  for (let k = 0; k < 5; k++) {
    for (let x = -w; x <= w; x++) {
      p.fill(x, y + k, -7, x, y + k, -7, B.PLANK)
      if (Math.abs(x) >= 4) p.fill(x, y + k, 0, x, y + k, 0, x % 2 ? B.PLANK : B.TIMBER)
    }
    for (let z = -7; z <= 0; z++) for (const x of [-w, w]) p.fill(x, y + k, z, x, y + k, z, B.PLANK)
  }
  p.fill(-3, y + 4, 0, 3, y + 4, 0, B.TIMBER)
  for (let s = 0; s < 5; s++) {
    p.fill(-w - 1, y + 5 + s, -8 + s, w + 1, y + 5 + s, -8 + s, s % 2 ? B.ROOF : B.ROOF_LIGHT)
    p.fill(-w - 1, y + 5 + s, 1 - s, w + 1, y + 5 + s, 1 - s, s % 2 ? B.ROOF : B.ROOF_LIGHT)
    p.fill(-w, y + 5 + s, -7 + s, -w, y + 5 + s, -s, B.PLANK)
    p.fill(w, y + 5 + s, -7 + s, w, y + 5 + s, -s, B.PLANK)
  }
  // Workbench and tools out front.
  p.box(-3, y + 0.9, 1.6, 6, 0.22, 1.4, P.plankLight, { tex: 0.2 })
  for (const x of [-2.9, 2.6]) for (const z of [1.7, 2.7]) p.box(x, y, z, 0.24, 0.9, 0.24, P.timber)
  p.box(-2.2, y + 1.12, 1.9, 0.9, 0.55, 0.8, P.terracotta)
  p.box(-0.8, y + 1.12, 2, 0.7, 0.3, 0.7, P.butter)
  p.box(0.4, y + 1.12, 1.8, 1.5, 0.12, 0.9, P.periwinkle)
  p.box(0.6, y + 1.24, 2, 0.4, 0.4, 0.4, P.cream)
  p.fill(-3, y, 1, 2, y + 1, 2, B.BARRIER)
}

export function bookshelf(p: Placer, y: number) {
  p.fill(-3, y, 0, 3, y + 4, 0, B.PLANK)
  p.fill(-4, y, 0, -4, y + 5, 1, B.TIMBER)
  p.fill(4, y, 0, 4, y + 5, 1, B.TIMBER)
  p.fill(-5, y + 5, -1, 5, y + 5, 2, B.ROOF)
  p.fill(-4, y + 6, 0, 4, y + 6, 1, B.ROOF_LIGHT)
  const r = mulberry32(404)
  const spine = [P.terracotta, P.butter, P.periwinkle, P.moss, P.plum, P.cream, P.rose]
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = y + 0.25 + shelf * 1.6
    p.box(-3.2, sy - 0.12, 1, 7, 0.12, 0.7, P.plankLight, { grounded: false })
    let x = -3.1
    while (x < 3.3) {
      const w = 0.22 + r() * 0.2
      if (r() > 0.12) p.box(x, sy, 1.02, w, 0.8 + r() * 0.5, 0.55, spine[(r() * spine.length) | 0], { tex: 0.1 })
      x += w + 0.03
    }
  }
  p.fill(-3, y, 1, 3, y + 1, 1, B.BARRIER)
}

export function mapTable(p: Placer, y: number) {
  p.box(-2.3, y + 1, -1.6, 4.6, 0.2, 3.2, P.plank, { tex: 0.2 })
  for (const x of [-2, 1.7]) for (const z of [-1.3, 1]) p.box(x, y, z, 0.3, 1, 0.3, P.timber)
  p.box(-2, y + 1.2, -1.3, 4, 0.05, 2.6, P.cream, { tex: 0.2, grounded: false })
  p.box(-1.5, y + 1.25, -0.9, 1.2, 0.03, 0.8, P.sage, { grounded: false })
  p.box(0.1, y + 1.25, -0.2, 1.3, 0.03, 0.9, P.water, { grounded: false })
  p.box(-0.4, y + 1.25, 0.5, 0.5, 0.03, 0.5, P.terracottaLight, { grounded: false })
  p.box(0.9, y + 1.25, -1, 0.3, 0.2, 0.3, P.terracotta, { grounded: false })
  p.fill(-3, y, -2, 2, y + 1, 1, B.BARRIER)
}

export function easel(p: Placer, y: number) {
  p.box(-1.2, y, -0.2, 0.2, 3.4, 0.2, P.timber)
  p.box(1, y, -0.2, 0.2, 3.4, 0.2, P.timber)
  p.box(-0.1, y, -1, 0.2, 3.2, 0.2, P.timber)
  p.box(-1.4, y + 1, 0, 2.8, 0.14, 0.3, P.plank)
  p.box(-1.2, y + 1.14, 0, 2.4, 2.8, 0.14, P.timber, { grounded: false })
  p.box(-1.05, y + 1.3, 0.12, 2.1, 2.5, 0.05, P.cream, { tex: 0.1, grounded: false })
  for (let i = 0; i < 6; i++) p.box(-0.75, y + 3.3 - i * 0.3, 0.17, i === 0 ? 1 : 1.5 - (i % 2) * 0.3, 0.1, 0.02, i === 0 ? P.terracotta : P.stoneDark, { grounded: false })
  p.fill(-2, y, -1, 1, y + 1, 0, B.BARRIER)
}

export function postbox(p: Placer, y: number) {
  p.box(-0.15, y, -0.15, 0.3, 1.5, 0.3, P.timber)
  p.box(-0.6, y + 1.5, -0.9, 1.2, 0.85, 1.8, P.terracotta, { tex: 0.12 })
  p.box(-0.6, y + 2.35, -0.9, 1.2, 0.18, 1.8, P.terracottaLight, { grounded: false })
  p.box(0.6, y + 2.05, 0.1, 0.08, 0.5, 0.1, P.butter, { grounded: false })
  p.box(0.6, y + 2.4, 0.1, 0.08, 0.2, 0.5, P.butter, { grounded: false })
  p.box(-0.4, y + 1.75, 0.9, 0.8, 0.5, 0.04, P.cream, { grounded: false })
  p.box(-0.5, y + 2.35, -0.4, 1, 0.08, 0.7, P.cream, { grounded: false })
  p.box(-0.1, y + 2.43, -0.15, 0.2, 0.05, 0.2, P.terracottaDeep, { grounded: false })
  p.fill(-1, y, -1, 0, y + 1, 0, B.BARRIER)
}
