import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh,
  MeshBasicMaterial, MeshLambertMaterial, Object3D, Points, ShaderMaterial,
} from 'three'
import { U } from '../materials'
import { P } from '../palette'
import { G } from '../state'
import type { World } from '../world/generate'

const dummy = new Object3D()

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
          gl_PointSize = mix(2.6, 6.0, uWarm) * uPx * 0.6 + 1.0;
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
