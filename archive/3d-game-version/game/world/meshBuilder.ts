import { BufferAttribute, BufferGeometry, Color } from 'three'

export interface BoxFx {
  wind?: number
  tex?: number
  glow?: number
  /** Darken the lower edge to fake contact shadow. Defaults to on. */
  grounded?: boolean
  /** Wind only moves the top of the box. */
  windTop?: boolean
}

const FACES = [
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.62 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.82 },
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.86 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.86 },
] as const

/** Growing vertex buffer shared by the voxel mesher and every hand-placed prop. */
export class MeshBuilder {
  pos: number[] = []
  nor: number[] = []
  col: number[] = []
  fx: number[] = []
  idx: number[] = []
  count = 0

  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    nx: number, ny: number, nz: number,
    colors: number[],
    wind: [number, number, number, number] | number,
    tex: number,
    glow: number,
    flip = false,
  ) {
    const i = this.count
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz)
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz)
    for (let k = 0; k < 12; k++) this.col.push(colors[k])
    const w = typeof wind === 'number' ? [wind, wind, wind, wind] : wind
    for (let k = 0; k < 4; k++) this.fx.push(w[k], tex, glow)
    if (flip) this.idx.push(i + 1, i + 2, i + 3, i + 1, i + 3, i)
    else this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3)
    this.count += 4
  }

  /** An axis-aligned box from min corner (x, y, z) with size (sx, sy, sz). */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color | string, o: BoxFx = {}) {
    const col = typeof color === 'string' ? new Color(color) : color
    const low = o.grounded === false ? 1 : 0.8
    const wind = o.wind ?? 0
    for (const f of FACES) {
      const cs: number[] = []
      const ws: number[] = []
      const p: number[] = []
      for (const v of f.v) {
        p.push(x + v[0] * sx, y + v[1] * sy, z + v[2] * sz)
        const s = f.shade * (v[1] === 0 ? low : 1)
        cs.push(col.r * s, col.g * s, col.b * s)
        ws.push(o.windTop ? wind * v[1] : wind)
      }
      this.quad(
        p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11],
        f.n[0], f.n[1], f.n[2], cs, ws as [number, number, number, number], o.tex ?? 0.1, o.glow ?? 0,
      )
    }
  }

  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3))
    g.setAttribute('aFx', new BufferAttribute(new Float32Array(this.fx), 3))
    g.setIndex(new BufferAttribute(this.count > 65000 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}
