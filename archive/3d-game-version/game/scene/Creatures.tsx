import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Group, Mesh } from 'three'
import { audio } from '../audio'
import { G0, POND } from '../constants'
import { P } from '../palette'
import { angleDelta, damp, mulberry32 } from '../rng'
import { addRipple, G } from '../state'
import { inPond } from '../world/generate'
import { model } from './models'

const FLAT = { tex: 0, grounded: false }
const WATER_Y = G0 - 0.28

interface Duck {
  root: Group
  head: Mesh
  wingL: Mesh
  wingR: Mesh
  x: number
  z: number
  yaw: number
  tx: number
  tz: number
  size: number
  wait: number
  ripple: number
  flap: number
  bob: number
  mother: Duck | null
}

function makeDuck(style: number, size: number): Duck {
  const body = style === 0 ? P.cream : style === 1 ? '#a58d6c' : P.butter
  const headColor = style === 1 ? P.forest : body
  const root = new Group()
  root.add(model((m) => {
    m.box(-0.24, 0.02, -0.42, 0.48, 0.34, 0.76, body, FLAT)
    m.box(-0.12, 0.2, -0.56, 0.24, 0.2, 0.2, body, FLAT)
    m.box(-0.08, 0.3, -0.64, 0.16, 0.16, 0.1, body, FLAT)
    m.box(-0.14, 0.32, 0.22, 0.28, 0.14, 0.16, style === 1 ? P.cream : body, FLAT)
  }))
  const head = model((m) => {
    m.box(-0.14, 0, -0.14, 0.28, 0.3, 0.3, headColor, FLAT)
    m.box(-0.09, 0.05, 0.16, 0.18, 0.08, 0.18, P.butterDeep, FLAT)
    m.box(-0.15, 0.15, 0.04, 0.04, 0.06, 0.06, P.ink, FLAT)
    m.box(0.11, 0.15, 0.04, 0.04, 0.06, 0.06, P.ink, FLAT)
  })
  head.position.set(0, 0.36, 0.34)
  root.add(head)
  const wing = (s: number) => {
    const w = model((m) => m.box(s > 0 ? 0 : -0.06, -0.14, -0.3, 0.06, 0.24, 0.5, style === 1 ? '#8e765a' : P.creamDark, FLAT))
    w.position.set(0.24 * s, 0.26, 0)
    root.add(w)
    return w
  }
  root.scale.setScalar(size)
  return {
    root, head, wingL: wing(-1), wingR: wing(1), x: 0, z: 0, yaw: 0, tx: 0, tz: 0, size, wait: 0, ripple: 0, flap: 0, bob: 0, mother: null,
  }
}

export function Ducks() {
  const ducks = useMemo(() => {
    const r = mulberry32(8)
    const list: Duck[] = []
    const spot = () => {
      for (;;) {
        // They like to gather on the dock side of the pond, where food tends to appear.
        const x = POND.x + 2 + r() * POND.rx * 0.6
        const z = POND.z + (r() - 0.5) * POND.rz * 1.1
        if (inPond(x, z) && inPond(x + 2, z) && inPond(x - 2, z) && !(x > 88 && Math.abs(z - 232) < 4)) return [x, z]
      }
    }
    for (let i = 0; i < 6; i++) {
      const d = makeDuck(i % 3 === 2 ? 1 : 0, 1.3)
      ;[d.x, d.z] = spot()
      d.tx = d.x
      d.tz = d.z
      d.bob = r() * 6
      list.push(d)
    }
    for (let i = 0; i < 4; i++) {
      const d = makeDuck(2, 0.72)
      d.mother = i < 2 ? list[0] : list[1]
      d.x = d.mother.x + i
      d.z = d.mother.z + 1 + i
      d.bob = r() * 6
      list.push(d)
    }
    return list
  }, [])
  const rnd = useMemo(() => mulberry32(91), [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    for (const d of ducks) {
      let speed = 0.55
      if (d.mother) {
        // Ducklings paddle along behind their mother.
        d.tx = d.mother.x - Math.sin(d.mother.yaw) * 1.3 + Math.sin(d.bob) * 0.5
        d.tz = d.mother.z - Math.cos(d.mother.yaw) * 1.3 + Math.cos(d.bob) * 0.5
        speed = 1.3
      } else if (G.food.length > 0) {
        let best = G.food[0]
        let bd = Infinity
        for (const f of G.food) {
          const q = (f.x - d.x) ** 2 + (f.z - d.z) ** 2
          if (q < bd) {
            bd = q
            best = f
          }
        }
        d.tx = best.x
        d.tz = best.z
        speed = 3.4
        if (bd < 0.6) {
          G.food.splice(G.food.indexOf(best), 1)
          d.flap = 1
          addRipple(d.x, d.z)
          if (rnd() < 0.7) audio.quack()
          if (rnd() < 0.3) audio.flap()
        }
      } else {
        d.wait -= dt
        if (d.wait < 0 || Math.hypot(d.tx - d.x, d.tz - d.z) < 0.4) {
          d.wait = 4 + rnd() * 7
          for (let k = 0; k < 8; k++) {
            // Wander, with a pull back towards the dock.
            const x = d.x + (rnd() - 0.5) * 16 + (82 - d.x) * 0.15
            const z = d.z + (rnd() - 0.5) * 16 + (232 - d.z) * 0.15
            if (inPond(x, z) && inPond(x + 1.5, z) && inPond(x - 1.5, z) && inPond(x, z + 1.5) && inPond(x, z - 1.5) && !(x > 90 && z > 228 && z < 236)) {
              d.tx = x
              d.tz = z
              break
            }
          }
          if (rnd() < 0.08) audio.quack()
        }
      }

      const dx = d.tx - d.x
      const dz = d.tz - d.z
      const dist = Math.hypot(dx, dz)
      const moving = dist > 0.25
      if (moving) {
        const want = Math.atan2(dx, dz)
        d.yaw += angleDelta(d.yaw, want) * damp(3.5, dt)
        const nx = d.x + Math.sin(d.yaw) * speed * dt
        const nz = d.z + Math.cos(d.yaw) * speed * dt
        if (inPond(nx, nz)) {
          d.x = nx
          d.z = nz
        } else d.tx = d.x
        d.ripple -= dt
        if (d.ripple < 0 && !d.mother) {
          d.ripple = 0.9 + rnd() * 0.8
          addRipple(d.x, d.z)
        }
      }

      d.bob += dt * 2.2
      d.flap = Math.max(0, d.flap - dt * 1.1)
      const flap = d.flap > 0 ? Math.sin(G.time * 34) * 0.9 * d.flap + 0.8 * d.flap : 0
      d.root.position.set(d.x, WATER_Y - 0.06 + Math.sin(d.bob) * 0.022 + d.flap * 0.1, d.z)
      d.root.rotation.y = d.yaw
      d.root.rotation.x = Math.sin(d.bob * 0.7) * 0.03 - d.flap * 0.2
      d.head.rotation.x = d.flap > 0.4 ? -0.5 : Math.max(0, Math.sin(d.bob * 0.23) - 0.9) * 6
      d.wingL.rotation.z = -flap
      d.wingR.rotation.z = flap
    }
  })

  return <>{ducks.map((d, i) => <primitive key={i} object={d.root} />)}</>
}

/** Two loose flocks wheeling high over the land. */
export function Birds() {
  const birds = useMemo(() => {
    const out: { root: Group; l: Mesh; r: Mesh; flock: number; off: [number, number]; ph: number }[] = []
    for (let f = 0; f < 3; f++) {
      for (let i = 0; i < 5; i++) {
        const root = new Group()
        root.add(model((m) => {
          m.box(-0.1, -0.08, -0.34, 0.2, 0.16, 0.7, P.earthDeep, FLAT)
          m.box(-0.06, -0.02, 0.36, 0.12, 0.05, 0.12, P.butterDeep, FLAT)
        }, false))
        const wing = (s: number) => {
          const w = model((m) => m.box(s > 0 ? 0 : -0.62, -0.02, -0.14, 0.62, 0.03, 0.34, P.earth, FLAT), false)
          w.position.x = 0.09 * s
          root.add(w)
          return w
        }
        const row = Math.ceil(i / 2)
        const side = i % 2 ? 1 : -1
        out.push({ root, l: wing(-1), r: wing(1), flock: f, off: [row * 2.2 * side, -row * 2.4], ph: i * 1.3 + f })
      }
    }
    return out
  }, [])

  useFrame(() => {
    const t = G.time
    const centers = [[110, 235, 46, 0.05], [190, 215, 54, -0.042], [128, 110, 62, 0.036]]
    for (const b of birds) {
      const [cx, cz, rad, sp] = centers[b.flock]
      const a = t * sp + b.flock * 2
      const heading = a + (sp > 0 ? Math.PI / 2 : -Math.PI / 2)
      const x = cx + Math.cos(a) * rad
      const z = cz + Math.sin(a) * rad * 0.75
      const yaw = Math.PI / 2 - heading
      b.root.position.set(
        x + b.off[0] * Math.cos(yaw) + b.off[1] * Math.sin(yaw),
        31 + Math.sin(t * 0.3 + b.flock) * 2.5 + Math.sin(b.ph) * 0.8,
        z - b.off[0] * Math.sin(yaw) + b.off[1] * Math.cos(yaw),
      )
      b.root.rotation.y = yaw
      const glide = Math.sin(t * 0.7 + b.ph) > 0.2 ? 0.12 : Math.sin(t * 9 + b.ph) * 0.6
      b.l.rotation.z = -glide
      b.r.rotation.z = glide
    }
  })
  return <>{birds.map((b, i) => <primitive key={i} object={b.root} />)}</>
}

type SparrowState = 'perch' | 'fly' | 'peck' | 'home'

/** Small birds that wait along the fields and drop in when seed is thrown. */
export function Sparrows() {
  const birds = useMemo(() => {
    const homes: [number, number, number][] = [
      [152, 15.5, 194], [160, 15.5, 268], [176, 15.5, 216], [176, 15.5, 240], [150, 15.5, 244], [204, 16.5, 216], [150, 15.5, 219], [204, 16.5, 240],
    ]
    return homes.map((home, i) => {
      const root = new Group()
      const wings: Mesh[] = []
      root.add(model((m) => {
        m.box(-0.1, 0, -0.16, 0.2, 0.18, 0.32, i % 2 ? P.earth : P.plank, FLAT)
        m.box(-0.08, 0.1, 0.12, 0.16, 0.14, 0.14, i % 2 ? P.earthDeep : P.earth, FLAT)
        m.box(-0.03, 0.14, 0.26, 0.06, 0.04, 0.08, P.butterDeep, FLAT)
        m.box(-0.04, 0.04, -0.34, 0.08, 0.04, 0.2, P.earthDeep, FLAT)
      }, false))
      for (const s of [-1, 1]) {
        const w = model((m) => m.box(s > 0 ? 0 : -0.26, 0, -0.1, 0.26, 0.02, 0.2, P.earthDeep, FLAT), false)
        w.position.set(0.09 * s, 0.14, 0)
        root.add(w)
        wings.push(w)
      }
      root.position.set(...home)
      return { root, wings, home, state: 'perch' as SparrowState, tx: 0, ty: 0, tz: 0, timer: 0, seed: -1, ph: i }
    })
  }, [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    for (const b of birds) {
      const p = b.root.position
      if (b.state === 'perch') {
        b.root.rotation.y += Math.sin(G.time * 1.3 + b.ph) * 0.004
        const seed = G.seeds.find((s) => G.time - s.t < 9 && Math.hypot(s.x - p.x, s.z - p.z) < 70)
        if (seed && (b.timer -= dt) < 0) {
          b.state = 'fly'
          b.tx = seed.x + (Math.random() - 0.5) * 1.6
          b.ty = seed.y
          b.tz = seed.z + (Math.random() - 0.5) * 1.6
          audio.bird(0.7)
        }
      } else {
        const flying = b.state !== 'peck'
        if (flying) {
          const dx = b.tx - p.x, dy = b.ty - p.y, dz = b.tz - p.z
          const d = Math.hypot(dx, dy, dz)
          const step = Math.min(d, 8 * dt)
          const arc = Math.min(1, d / 8) * 1.2
          p.x += (dx / d) * step
          p.z += (dz / d) * step
          p.y += (dy / d) * step + arc * dt
          b.root.rotation.y = Math.atan2(dx, dz)
          if (d < 0.2) {
            if (b.state === 'fly') {
              b.state = 'peck'
              b.timer = 3 + Math.random() * 3.5
            } else {
              b.state = 'perch'
              b.timer = Math.random()
              p.set(...b.home)
            }
          }
        } else {
          b.timer -= dt
          const hop = Math.abs(Math.sin(G.time * 7 + b.ph))
          p.y = b.ty + (hop > 0.92 ? 0.08 : 0)
          b.root.rotation.x = Math.sin(G.time * 11 + b.ph) > 0.4 ? 0.6 : 0
          if (Math.random() < dt * 0.9) {
            b.root.rotation.y = Math.random() * 6.28
            p.x += Math.sin(b.root.rotation.y) * 0.25
            p.z += Math.cos(b.root.rotation.y) * 0.25
          }
          if (b.timer < 0) {
            b.state = 'home'
            b.root.rotation.x = 0
            ;[b.tx, b.ty, b.tz] = b.home
          }
        }
      }
      const beat = b.state === 'fly' || b.state === 'home' ? Math.sin(G.time * 40 + b.ph) * 0.9 : 0.1
      b.wings[0].rotation.z = -beat
      b.wings[1].rotation.z = beat
    }
  })
  return <>{birds.map((b, i) => <primitive key={i} object={b.root} />)}</>
}

/** A few butterflies flitting around the flower beds. */
export function Butterflies() {
  const flies = useMemo(() => {
    const spots = [[123, 247], [133, 247], [115, 247], [141, 247], [111, 168], [145, 168], [118, 50], [150, 40], [100, 38], [160, 46], [66, 212], [140, 262]]
    const colors = [P.butter, P.rose, P.periwinkle, P.cream]
    return spots.map(([x, z], i) => {
      const root = new Group()
      const wing = (s: number) => {
        const w = model((m) => m.box(s > 0 ? 0 : -0.2, 0, -0.1, 0.2, 0.012, 0.2, colors[i % 4], FLAT), false)
        root.add(w)
        return w
      }
      return { root, l: wing(-1), r: wing(1), x, z, ph: i * 1.7 }
    })
  }, [])
  useFrame(() => {
    const t = G.time
    for (const f of flies) {
      const a = t * 0.35 + f.ph
      const x = f.x + Math.sin(a) * 3.4 + Math.sin(a * 2.3) * 1.2
      const z = f.z + Math.cos(a * 0.8) * 3 + Math.cos(a * 1.9) * 1.1
      f.root.position.set(x, G0 + 1 + Math.sin(a * 3.1) * 0.5, z)
      f.root.rotation.y = a
      const beat = 0.2 + Math.abs(Math.sin(t * 15 + f.ph)) * 1.05
      f.l.rotation.z = -beat
      f.r.rotation.z = beat
    }
  })
  return <>{flies.map((f, i) => <primitive key={i} object={f.root} />)}</>
}
