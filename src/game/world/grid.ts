import { D, H, W } from '../constants'
import { OPAQUE, SOLID } from '../blocks'

/** The voxel volume plus the 2D maps that sit alongside it. */
export class Grid {
  cells = new Uint8Array(W * D * H)
  /** Top walkable surface per column, before anything is built on it. */
  height = new Int16Array(W * D)
  surface = new Uint8Array(W * D)
  /** Water surface height per column, 0 where dry. */
  water = new Float32Array(W * D)
  waterFlow = new Uint8Array(W * D)
  /** Columns outside the playable world. */
  blocked = new Uint8Array(W * D)
  /** Columns claimed by structures, so scatter passes leave them alone. */
  reserved = new Uint8Array(W * D)

  private idx(x: number, y: number, z: number) {
    return (y * D + z) * W + x
  }
  col(x: number, z: number) {
    return z * W + x
  }
  inside(x: number, y: number, z: number) {
    return x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H
  }
  get(x: number, y: number, z: number) {
    if (x < 0 || z < 0 || y < 0 || x >= W || z >= D || y >= H) return 0
    return this.cells[(y * D + z) * W + x]
  }
  set(x: number, y: number, z: number, b: number) {
    if (this.inside(x, y, z)) this.cells[this.idx(x, y, z)] = b
  }
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: number) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, b)
  }
  opaque(x: number, y: number, z: number) {
    return OPAQUE[this.get(x, y, z)] === 1
  }
  solid(x: number, y: number, z: number) {
    if (x < 0 || z < 0 || x >= W || z >= D) return true
    if (this.blocked[z * W + x]) return true
    return SOLID[this.get(x, y, z)] === 1
  }
  h(x: number, z: number) {
    const cx = Math.min(W - 1, Math.max(0, x | 0))
    const cz = Math.min(D - 1, Math.max(0, z | 0))
    return this.height[cz * W + cx]
  }
  reserve(x0: number, z0: number, x1: number, z1: number) {
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (x >= 0 && z >= 0 && x < W && z < D) this.reserved[z * W + x] = 1
  }
  /** Highest solid-or-leafy block in a column, used to keep the camera above the land. */
  topAt(x: number, z: number) {
    for (let y = H - 1; y > 0; y--) if (this.get(x | 0, y, z | 0) > 1) return y + 1
    return 0
  }
}
