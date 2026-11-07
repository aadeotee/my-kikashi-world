import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshLambertMaterial, Object3D, Points, ShaderMaterial,
} from 'three'
import { audio } from '../audio'
import { U, propMaterial } from '../materials'
import { P } from '../palette'
import { addRipple, G, useUI } from '../state'
import type { World } from '../world/generate'
import { modelGeometry } from './models'

const dummy = new Object3D()
const hide = new Matrix4().makeScale(0, 0, 0)

interface Grain {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  kind: 0 | 1
  state: 0 | 1 | 2 // 0 free, 1 in the air, 2 floating
  id: number
}

/** Duck food and rice seed: thrown from her hand, landing on water or soil. */
export function Grains({ world }: { world: World }) {
  const mesh = useRef<InstancedMesh>(null)
  const sprouts = useRef<InstancedMesh>(null)
  const pool = useMemo<Grain[]>(
    () => Array.from({ length: 90 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, kind: 0, state: 0, id: 0 })),
    [],
  )
  const geo = useMemo(() => new BoxGeometry(0.09, 0.09, 0.09), [])
  const mat = useMemo(() => new MeshLambertMaterial({ color: P.butter }), [])
  const sproutGeo = useMemo(
    () => modelGeometry((m) => {
      const c = new Color(P.sageLight)
      const o = { wind: 0.5, windTop: true, tex: 0 }
      m.box(-0.03, 0, -0.03, 0.06, 0.34, 0.06, c, o)
      m.box(0.02, 0.18, -0.03, 0.17, 0.05, 0.06, c, { wind: 0.5, tex: 0, grounded: false })
      m.box(-0.17, 0.26, -0.03, 0.15, 0.05, 0.06, c, { wind: 0.5, tex: 0, grounded: false })
    }),
    [],
  )
  const plants = useMemo(() => ({ list: [] as { x: number; y: number; z: number; t: number; s: number }[], next: 0 }), [])
  const nextId = useRef(1)

  /** How far ahead the nearest open water lies, so a throw from anywhere lands in the pond. */
  const reach = () => {
    const grid = world.grid
    for (let d = 3; d < 18; d += 0.5) {
      const x = G.pos.x + Math.sin(G.facing) * d
      const z = G.pos.z + Math.cos(G.facing) * d
      const c = grid.col(Math.floor(x), Math.floor(z))
      if (grid.water[c] > grid.height[c]) return d + 1.5
    }
    return 5
  }

  const launch = (kind: 0 | 1, range: number) => {
    const g = pool.find((p) => p.state === 0)
    if (!g) return
    const f = G.facing + (Math.random() - 0.5) * (kind ? 1.5 : 0.45)
    const power = kind ? 2.2 + Math.random() * 2.4 : (range + (Math.random() - 0.3) * 3) / 0.95
    g.x = G.pos.x + Math.sin(G.facing) * 0.35
    g.y = G.pos.y + 1
    g.z = G.pos.z + Math.cos(G.facing) * 0.35
    g.vx = Math.sin(f) * power
    g.vz = Math.cos(f) * power
    g.vy = kind ? 2.2 + Math.random() : 4.6 + Math.random() * 0.8
    g.kind = kind
    g.state = 1
    g.id = nextId.current++
  }

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    if (G.throwFood > 0) {
      const range = reach()
      for (; G.throwFood > 0; G.throwFood--) launch(0, range)
    }
    for (; G.throwSeed > 0; G.throwSeed--) launch(1, 0)
    const inst = mesh.current!
    const grid = world.grid
    pool.forEach((p, i) => {
      if (p.state === 0) {
        inst.setMatrixAt(i, hide)
        return
      }
      if (p.state === 2) {
        if (!G.food.some((f) => f.id === p.id)) {
          p.state = 0
          inst.setMatrixAt(i, hide)
          return
        }
        dummy.position.set(p.x, p.y + Math.sin(G.time * 2 + i) * 0.015, p.z)
      } else {
        p.vy -= 12 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        const col = grid.col(Math.floor(p.x), Math.floor(p.z))
        const surface = Math.max(grid.height[col], grid.water[col])
        if (p.y <= surface) {
          if (grid.water[col] > grid.height[col] && p.kind === 0) {
            p.state = 2
            p.y = grid.water[col] + 0.02
            G.food.push({ x: p.x, z: p.z, y: p.y, id: p.id })
            addRipple(p.x, p.z)
            audio.splash()
          } else {
            p.state = 0
            if (p.kind === 1) {
              if (grid.water[col] > 0) addRipple(p.x, p.z)
              G.seeds.push({ x: p.x, y: surface, z: p.z, t: G.time })
              if (G.seeds.length > 30) G.seeds.shift()
              const floor = grid.height[col]
              plants.list[plants.next] = { x: p.x, y: floor, z: p.z, t: G.time + 0.9 + Math.random() * 1.6, s: 0.8 + Math.random() * 0.8 }
              plants.next = (plants.next + 1) % 260
            }
          }
        }
        dummy.position.set(p.x, p.y, p.z)
      }
      dummy.rotation.set(p.x * 3, p.z * 3, 0)
      dummy.scale.setScalar(p.kind ? 0.75 : 1.5)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true

    const sp = sprouts.current!
    for (let i = 0; i < 260; i++) {
      const p = plants.list[i]
      if (!p || G.time < p.t) {
        sp.setMatrixAt(i, hide)
        continue
      }
      const grow = Math.min(1, (G.time - p.t) / 2.2)
      const ease = 1 - (1 - grow) ** 3
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(0, p.x * 7, 0)
      dummy.scale.set(p.s * ease, p.s * ease * 1.7, p.s * ease)
      dummy.updateMatrix()
      sp.setMatrixAt(i, dummy.matrix)
    }
    sp.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, pool.length]} frustumCulled={false} />
      <instancedMesh ref={sprouts} args={[sproutGeo, propMaterial, 260]} frustumCulled={false} />
    </>
  )
}

/** Cream puffs rising from the chimney. */
export function Smoke({ world }: { world: World }) {
  const mesh = useRef<InstancedMesh>(null)
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#f4eee0', transparent: true, opacity: 0.58, depthWrite: false }), [])
  const N = 12
  useFrame(() => {
    const [cx, cy, cz] = world.chimney
    const inst = mesh.current!
    for (let i = 0; i < N; i++) {
      const life = ((G.time * 0.11 + i / N) % 1)
      dummy.position.set(cx + life * life * 7 + Math.sin(i * 3 + G.time * 0.5) * 0.5 * life, cy + life * 13, cz + Math.cos(i * 2 + life * 3) * life * 1.4)
      const s = (0.5 + life * 1.8) * Math.min(1, (1 - life) * 3.2) * Math.min(1, life * 12)
      dummy.scale.setScalar(s)
      dummy.rotation.set(i, life * 2, i * 2)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} renderOrder={3} />
}

/** Leaves drifting down in a box that follows her around. */
export function FallingLeaves() {
  const mesh = useRef<InstancedMesh>(null)
  const N = 42
  const geo = useMemo(() => new BoxGeometry(0.16, 0.02, 0.12), [])
  const mat = useMemo(() => new MeshLambertMaterial({ vertexColors: false }), [])
  const seeds = useMemo(() => Array.from({ length: N }, () => [Math.random() * 44, Math.random() * 44, Math.random(), Math.random() * 6.28]), [])
  const colors = useMemo(() => {
    const palette = [P.butter, P.sageLight, P.terracottaLight, P.moss, P.rose].map((h) => new Color(h))
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) palette[i % 5].toArray(a, i * 3)
    return new InstancedBufferAttribute(a, 3)
  }, [])
  useFrame(() => {
    const inst = mesh.current!
    if (!inst.instanceColor) inst.instanceColor = colors
    const px = G.view.x, py = G.view.y, pz = G.view.z
    for (let i = 0; i < N; i++) {
      const [ox, oz, ph, spin] = seeds[i]
      const t = G.time * (0.05 + ph * 0.035) + ph
      const fall = t % 1
      const x = px + ((ox + Math.sin(t * 6) * 2 + G.time * 0.5 - px) % 44 + 44) % 44 - 22
      const z = pz + ((oz + Math.cos(t * 5) * 2 - pz) % 44 + 44) % 44 - 22
      dummy.position.set(x, py + 13 * (1 - fall) + 0.1, z)
      dummy.rotation.set(Math.sin(G.time * 1.6 + spin) * 0.8, G.time * 0.8 + spin, Math.cos(G.time * 1.3 + spin) * 0.8)
      dummy.scale.setScalar(1.3)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}

/** Dust motes in the sunlight; after the maze they become fireflies and a burst of sparks. */
export function Motes() {
  const ref = useRef<Points>(null)
  const N = 150
  const { geo, mat } = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = Math.random()
      pos[i * 3 + 1] = Math.random()
      pos[i * 3 + 2] = Math.random()
      seed[i] = Math.random()
    }
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: U.uTime, uCenter: { value: G.view }, uWarm: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform vec3 uCenter; uniform float uWarm; uniform float uPx;
        varying float vA;
        void main() {
          vec3 box = vec3(40.0, 11.0, 40.0);
          vec3 p = position * box;
          p.x += sin(uTime * 0.2 + aSeed * 30.0) * 2.0 + uTime * 0.14;
          p.y += sin(uTime * 0.31 + aSeed * 19.0) * 1.2 + uTime * 0.09 * aSeed;
          p.z += cos(uTime * 0.17 + aSeed * 23.0) * 2.0;
          vec3 rel = mod(p - uCenter + box * 0.5, box) - box * 0.5;
          vec3 w = uCenter + rel + vec3(0.0, 4.0, 0.0);
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);
          vA = mix(0.2 + tw * 0.3, 0.3 + tw * 0.7, uWarm);
          gl_PointSize = mix(2.6, 6.0, uWarm) * uPx * (22.0 / max(-mv.z, 4.0)) + 1.0;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 d = abs(gl_PointCoord - 0.5);
          if (max(d.x, d.y) > 0.5) discard;
          gl_FragColor = vec4(1.0, 0.92, 0.66, vA);
        }`,
    })
    return { geo: g, mat: m }
  }, [])
  useFrame(({ gl }) => {
    mat.uniforms.uWarm.value = G.warmth
    mat.uniforms.uPx.value = gl.getPixelRatio()
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />
}

/** Petals she leaves behind in the maze, so explored paths stay recognisable, plus the finale's confetti. */
export function PetalTrail() {
  const mesh = useRef<InstancedMesh>(null)
  const N = 420
  const geo = useMemo(() => new BoxGeometry(0.2, 0.02, 0.15), [])
  const mat = useMemo(() => new MeshLambertMaterial({ color: '#e6b7a8' }), [])
  const state = useMemo(() => ({ next: 0, lx: 0, lz: 0, count: 0 }), [])
  useFrame(() => {
    const inst = mesh.current!
    if (state.count === 0) {
      for (let i = 0; i < N; i++) inst.setMatrixAt(i, hide)
      state.count = 1
      inst.instanceMatrix.needsUpdate = true
    }
    if (useUI.getState().zone !== 'maze' || !G.grounded) return
    if (Math.hypot(G.pos.x - state.lx, G.pos.z - state.lz) < 1.5) return
    state.lx = G.pos.x
    state.lz = G.pos.z
    dummy.position.set(G.pos.x + (Math.random() - 0.5) * 0.5, G.pos.y + 0.02, G.pos.z + (Math.random() - 0.5) * 0.5)
    dummy.rotation.set(0, Math.random() * 6.28, 0)
    dummy.scale.setScalar(0.85 + Math.random() * 0.6)
    dummy.updateMatrix()
    inst.setMatrixAt(state.next, dummy.matrix)
    state.next = (state.next + 1) % N
    inst.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} receiveShadow />
}

export function Confetti() {
  const mesh = useRef<InstancedMesh>(null)
  const N = 140
  const geo = useMemo(() => new BoxGeometry(0.14, 0.14, 0.03), [])
  const mat = useMemo(() => new MeshBasicMaterial(), [])
  const parts = useMemo(
    () => Array.from({ length: N }, () => ({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, s: Math.random() * 6 })),
    [],
  )
  const colors = useMemo(() => {
    const palette = [P.butter, P.rose, P.cream, P.terracottaLight, P.periwinkle, P.sageLight].map((h) => new Color(h))
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) palette[i % 6].toArray(a, i * 3)
    return new InstancedBufferAttribute(a, 3)
  }, [])
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    const inst = mesh.current!
    if (!inst.instanceColor) inst.instanceColor = colors
    if (G.celebrateBurst > 0) {
      G.celebrateBurst = 0
      for (const p of parts) {
        const a = Math.random() * 6.28
        const sp = 1 + Math.random() * 5
        p.x = G.pos.x
        p.y = G.pos.y + 1.2
        p.z = G.pos.z
        p.vx = Math.cos(a) * sp
        p.vz = Math.sin(a) * sp
        p.vy = 7 + Math.random() * 7
      }
    }
    parts.forEach((p, i) => {
      if (p.y > -40) {
        p.vy = Math.max(p.vy - 11 * dt, -1.6)
        p.vx *= 1 - dt * 0.9
        p.vz *= 1 - dt * 0.9
        p.x += (p.vx + Math.sin(G.time * 2 + p.s) * 0.5) * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        if (p.y < G.pos.y - 0.4) p.y = -50
      }
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(G.time * 3 + p.s, G.time * 2 + p.s, 0)
      dummy.scale.setScalar(p.y < -40 ? 0 : 1)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}
