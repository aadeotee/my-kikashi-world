import { B } from '../blocks'
import { hash3, mulberry32 } from '../rng'
import type { Grid } from './grid'

function blob(
  g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number,
  block: number, seed: number, holes = 0.02,
) {
  const X = Math.ceil(rx), Y = Math.ceil(ry), Z = Math.ceil(rz)
  for (let dy = -Y; dy <= Y; dy++)
    for (let dz = -Z; dz <= Z; dz++)
      for (let dx = -X; dx <= X; dx++) {
        const d = (dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2
        const rough = hash3(cx + dx + seed, cy + dy, cz + dz) * 0.34
        if (d > 1.02 - rough) continue
        if (hash3(cx + dx, cy + dy + seed, cz + dz) < holes && d > 0.45) continue
        if (g.get(cx + dx, cy + dy, cz + dz) === B.AIR) g.set(cx + dx, cy + dy, cz + dz, block)
      }
}

function trunk(g: Grid, x: number, y0: number, z: number, h: number, block: number) {
  for (let y = y0; y < y0 + h; y++) g.set(x, y, z, block)
}

export function oak(g: Grid, x: number, z: number, seed: number, size = 0.5, leaf: number = B.LEAF_OAK) {
  const y = g.h(x, z)
  const r = mulberry32(seed)
  const t = 4 + Math.round(size * 3)
  trunk(g, x, y, z, t + 1, B.BARK)
  const rad = 3 + size * 2.6
  blob(g, x, y + t + 1, z, rad, 2.4 + size * 1.5, rad, leaf, seed)
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.28
    const ox = Math.round(Math.cos(a) * rad * 0.7)
    const oz = Math.round(Math.sin(a) * rad * 0.7)
    blob(g, x + ox, y + t + Math.round(r() * 2), z + oz, rad * 0.55, 1.9, rad * 0.55, leaf, seed + i)
    g.set(x + Math.sign(ox), y + t - 1, z + Math.sign(oz), B.BARK)
  }
}

export function birch(g: Grid, x: number, z: number, seed: number) {
  const y = g.h(x, z)
  const t = 6 + (seed % 3)
  for (let k = 0; k < t + 2; k++) g.set(x, y + k, z, hash3(x, k, z) < 0.2 ? B.TIMBER : B.BIRCH)
  blob(g, x, y + t + 1, z, 2.6, 3.8, 2.6, B.LEAF_BIRCH, seed, 0.1)
}

export function pine(g: Grid, x: number, z: number, seed: number) {
  const y = g.h(x, z)
  const t = 8 + (seed % 5)
  trunk(g, x, y, z, t, B.BARK)
  for (let k = 0; k < t - 1; k++) {
    const rad = Math.max(0.6, ((t - k) / t) * 3.8 * (k % 2 ? 0.8 : 1))
    const yy = y + 2 + k
    const R = Math.ceil(rad)
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++)
        if (dx * dx + dz * dz <= rad * rad && g.get(x + dx, yy, z + dz) === B.AIR)
          g.set(x + dx, yy, z + dz, B.LEAF_PINE)
  }
  g.set(x, y + t + 1, z, B.LEAF_PINE)
}

export function willow(g: Grid, x: number, z: number, seed: number) {
  const y = g.h(x, z)
  const t = 6
  trunk(g, x, y, z, t + 1, B.BARK)
  g.set(x + 1, y, z, B.BARK)
  g.set(x, y, z + 1, B.BARK)
  blob(g, x, y + t + 1, z, 5.5, 2.6, 5.5, B.LEAF_WILLOW, seed)
  const r = mulberry32(seed)
  for (let i = 0; i < 46; i++) {
    const a = r() * 6.28
    const rad = 3 + r() * 3.2
    const px = x + Math.round(Math.cos(a) * rad)
    const pz = z + Math.round(Math.sin(a) * rad)
    const len = 3 + Math.round(r() * 3)
    for (let k = 0; k < len; k++) {
      const py = y + t - k
      if (g.get(px, py, pz) === B.AIR) g.set(px, py, pz, B.LEAF_WILLOW)
    }
  }
}

export function goldenTree(g: Grid, x: number, z: number) {
  const y = g.h(x, z)
  const t = 13
  g.fill(x - 1, y, z - 1, x + 1, y + t, z + 1, B.BARK)
  for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -1], [2, 1], [-3, 0], [3, 0], [0, 3]])
    trunk(g, x + dx, y, z + dz, dx * dz === 0 && Math.abs(dx + dz) === 3 ? 1 : 3, B.BARK)
  const r = mulberry32(77)
  blob(g, x, y + t + 5, z, 12, 7, 12, B.LEAF_GOLD, 5, 0.03)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28 + r()
    const rad = 7 + r() * 5
    const ox = Math.round(Math.cos(a) * rad)
    const oz = Math.round(Math.sin(a) * rad)
    blob(g, x + ox, y + t + 1 + Math.round(r() * 6), z + oz, 5.5, 3.8, 5.5, B.LEAF_GOLD, i, 0.03)
    for (let k = 1; k <= 5; k++) {
      const px = x + Math.round((ox * k) / 7)
      const pz = z + Math.round((oz * k) / 7)
      g.set(px, y + t - 2 + k, pz, B.BARK)
    }
  }
}

export function rock(g: Grid, x: number, z: number, seed: number) {
  const y = g.h(x, z)
  const r = mulberry32(seed)
  const n = 3 + Math.round(r() * 4)
  for (let i = 0; i < n; i++) {
    const px = x + Math.round(r() * 2 - 1)
    const pz = z + Math.round(r() * 2 - 1)
    const py = y + (i > 3 ? 1 : 0)
    g.set(px, py, pz, r() < 0.3 ? B.MOSSY : B.ROCK)
  }
}
