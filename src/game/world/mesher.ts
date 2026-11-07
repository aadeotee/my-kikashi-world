import { Color } from 'three'
import { B, DEFS } from '../blocks'
import { CHUNK, H } from '../constants'
import { fbm, hash3 } from '../rng'
import { P } from '../palette'
import type { Grid } from './grid'
import type { MeshBuilder } from './meshBuilder'

const AO = [0.6, 0.74, 0.87, 1]

// Per face: normal, the four corners, and the two in-plane axes used to look up occluders.
const FACES = [
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: [1, 0, 0], v: [0, 0, 1], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], u: [1, 0, 0], v: [0, 0, 1], shade: 0.6 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], u: [1, 0, 0], v: [0, 1, 0], shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], u: [1, 0, 0], v: [0, 1, 0], shade: 0.82 },
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], u: [0, 0, 1], v: [0, 1, 0], shade: 0.86 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], u: [0, 0, 1], v: [0, 1, 0], shade: 0.86 },
] as const

const grassA = new Color(P.sage)
const grassB = new Color(P.moss)
const grassC = new Color(P.mossDeep)
const grassD = new Color(P.butter)
const dirt = new Color(P.earth)
const tmp = new Color()

/** Fields are painted with slow colour drift so the meadow reads as brushwork, not tiles. */
export function grassColor(x: number, z: number, out: Color) {
  const a = fbm(x * 0.035, z * 0.035, 3, 3)
  const b = fbm(x * 0.11, z * 0.11, 9, 2)
  out.copy(grassB).lerp(grassA, Math.min(1, Math.max(0, (a - 0.36) * 3.2)))
  out.lerp(grassC, Math.max(0, (0.46 - b) * 2.0))
  out.lerp(grassD, Math.max(0, (b - 0.62) * 1.5))
}

function blockColor(id: number, x: number, y: number, z: number, out: Color) {
  const d = DEFS[id]
  if (id === B.GRASS) grassColor(x, z, out)
  else {
    const pick = hash3(x * 3 + 1, y * 5 + 2, z * 7 + 3)
    // First colour dominates; the rest are accents.
    const i = pick < 0.6 ? 0 : 1 + (((pick - 0.6) / 0.4) * (d.colors.length - 1)) | 0
    out.copy(d.colors[Math.min(i, d.colors.length - 1)])
  }
  const j = 1 + (hash3(x, y, z) - 0.5) * 2 * d.jitter
  out.r *= j
  out.g *= j
  out.b *= j
}

export function meshChunk(grid: Grid, cx: number, cz: number, mb: MeshBuilder) {
  const x0 = cx * CHUNK
  const z0 = cz * CHUNK
  const colors = new Array<number>(12)
  const winds: [number, number, number, number] = [0, 0, 0, 0]
  const ao = [0, 0, 0, 0]

  for (let y = 0; y < H; y++) {
    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const id = grid.get(x, y, z)
        if (id <= B.BARRIER) continue
        const d = DEFS[id]
        let colored = false

        for (const f of FACES) {
          const nx = x + f.n[0]
          const ny = y + f.n[1]
          const nz = z + f.n[2]
          if (ny < 0 || grid.opaque(nx, ny, nz)) continue
          // Nothing ever sees the underside of the land or the outside of the volume.
          if (f.n[1] === -1 && y < 6) continue
          if (!colored) {
            blockColor(id, x, y, z, tmp)
            colored = true
          }

          for (let k = 0; k < 4; k++) {
            const c = f.c[k]
            const su = c[0] * f.u[0] + c[1] * f.u[1] + c[2] * f.u[2] ? 1 : -1
            const sv = c[0] * f.v[0] + c[1] * f.v[1] + c[2] * f.v[2] ? 1 : -1
            const ux = f.u[0] * su, uy = f.u[1] * su, uz = f.u[2] * su
            const vx = f.v[0] * sv, vy = f.v[1] * sv, vz = f.v[2] * sv
            const s1 = grid.opaque(nx + ux, ny + uy, nz + uz) ? 1 : 0
            const s2 = grid.opaque(nx + vx, ny + vy, nz + vz) ? 1 : 0
            const cc = grid.opaque(nx + ux + vx, ny + uy + vy, nz + uz + vz) ? 1 : 0
            const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cc)
            ao[k] = level
            let r = tmp.r, g = tmp.g, b = tmp.b
            if (id === B.GRASS && f.n[1] === 0 && c[1] === 0) {
              r = dirt.r; g = dirt.g; b = dirt.b
            }
            const s = AO[level] * f.shade
            colors[k * 3] = r * s
            colors[k * 3 + 1] = g * s
            colors[k * 3 + 2] = b * s
            winds[k] = d.wind
          }

          const flip = ao[0] + ao[2] < ao[1] + ao[3]
          const a = f.c[0], b2 = f.c[1], c2 = f.c[2], e = f.c[3]
          mb.quad(
            x + a[0], y + a[1], z + a[2],
            x + b2[0], y + b2[1], z + b2[2],
            x + c2[0], y + c2[1], z + c2[2],
            x + e[0], y + e[1], z + e[2],
            f.n[0], f.n[1], f.n[2], colors, winds, d.tex, d.glow, flip,
          )
        }
      }
    }
  }
}
