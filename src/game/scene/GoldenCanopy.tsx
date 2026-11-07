import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import { G0, GOLDEN_TREE } from '../constants'
import { propMaterial } from '../materials'
import { P } from '../palette'
import { hash3, smooth } from '../rng'
import { G } from '../state'
import type { World } from '../world/generate'
import { modelGeometry } from './models'

const dummy = new Object3D()
const DRIFTERS = 60

interface Leaf {
  x: number; y: number; z: number
  /** Where it comes to rest on the ground. */
  gx: number; gz: number
  /** Share of the fall that passes before it lets go. */
  delay: number
  spin: number
}

const LEAF_TIME = 0.42

/** The tree's canopy, one instance per leaf block, so it can come down a leaf at a time and grow back. */
export function GoldenCanopy({ world }: { world: World }) {
  const mesh = useRef<InstancedMesh>(null)
  const drift = useRef<InstancedMesh>(null)
  const shown = useRef(-1)

  const { leaves, colors } = useMemo(() => {
    const data = world.goldLeaves
    const palette = [P.butterDeep, P.butter, '#cfa94e'].map((h) => new Color(h))
    const out: Leaf[] = []
    const rgb = new Float32Array((data.length / 4) * 3)
    const c = new Color()
    let top = 0
    for (let i = 1; i < data.length; i += 4) top = Math.max(top, data[i])
    for (let i = 0; i < data.length; i += 4) {
      const [x, y, z, shade] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      const h = hash3(x, y, z)
      const a = hash3(z, x, y) * 6.283
      const rad = 3 + hash3(y, z, x) * 15
      out.push({
        x, y, z,
        gx: GOLDEN_TREE.x + Math.cos(a) * rad,
        gz: GOLDEN_TREE.z + Math.sin(a) * rad * 0.8,
        // Outer and upper leaves go first, so the branches are revealed gradually.
        delay: (1 - LEAF_TIME) * (0.75 * h + 0.25 * (1 - (y - G0) / (top - G0))),
        spin: h * 6.283,
      })
      c.copy(palette[(h * 3) | 0]).multiplyScalar(shade * (0.94 + hash3(y, x, z) * 0.12))
      c.toArray(rgb, (i / 4) * 3)
    }
    return { leaves: out, colors: new InstancedBufferAttribute(rgb, 3) }
  }, [world])

  const geo = useMemo(
    () => modelGeometry((m) => m.box(0, 0, 0, 1, 1, 1, new Color('#ffffff'), { wind: 0.25, tex: 0.26, glow: 0.05, grounded: false })),
    [],
  )
  const driftGeo = useMemo(() => new BoxGeometry(0.34, 0.05, 0.26), [])
  const driftMat = useMemo(() => new MeshLambertMaterial({ color: P.butter }), [])

  useLayoutEffect(() => {
    mesh.current!.instanceColor = colors
  }, [colors])

  useFrame(() => {
    // Only touch every leaf while the tree is actually changing.
    const T = G.tree.t
    if (T !== shown.current) {
      shown.current = T
      const inst = mesh.current!
      leaves.forEach((l, i) => {
        const p = Math.min(1, Math.max(0, (T - l.delay) / LEAF_TIME))
        if (p === 0) {
          dummy.position.set(l.x, l.y, l.z)
          dummy.rotation.set(0, 0, 0)
          dummy.scale.setScalar(1)
        } else {
          const drop = p * p
          const sway = Math.sin(p * 9 + l.spin) * 1.5 * (1 - p)
          dummy.position.set(
            l.x + (l.gx - l.x) * p + sway,
            l.y + (G0 + 0.02 - l.y) * drop,
            l.z + (l.gz - l.z) * p + Math.cos(p * 7 + l.spin) * (1 - p),
          )
          const tumble = p < 1 ? p * 7 + l.spin : 0
          dummy.rotation.set(tumble, l.spin, tumble * 0.6)
          const s = 1 - smooth(0, 0.35, p) * 0.62
          dummy.scale.set(s, p === 1 ? 0.12 : s * (1 - p * 0.7), s)
        }
        dummy.updateMatrix()
        inst.setMatrixAt(i, dummy.matrix)
      })
      inst.instanceMatrix.needsUpdate = true
    }

    // A steady trickle of leaves blowing off on the breeze while the tree is full.
    const d = drift.current!
    const live = 1 - smooth(0, 0.3, T)
    for (let i = 0; i < DRIFTERS; i++) {
      const life = (G.time * 0.075 + i / DRIFTERS) % 1
      const cycle = Math.floor(G.time * 0.075 + i / DRIFTERS)
      const from = leaves[Math.floor(hash3(i, cycle, 3) * leaves.length)]
      const gust = hash3(i, 5, cycle)
      dummy.position.set(
        from.x - life * (12 + gust * 16) + Math.sin(life * 11 + i) * 1.3,
        from.y + (G0 - from.y) * life ** 1.5,
        from.z - life * (2 + gust * 7) + Math.cos(life * 8 + i) * 1.1,
      )
      dummy.rotation.set(life * 9 + i, life * 5, life * 7)
      dummy.scale.setScalar(live * Math.min(1, life * 12, (1 - life) * 8) * 1.5)
      dummy.updateMatrix()
      d.setMatrixAt(i, dummy.matrix)
    }
    d.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, propMaterial, leaves.length]} frustumCulled={false} castShadow receiveShadow />
      <instancedMesh ref={drift} args={[driftGeo, driftMat, DRIFTERS]} frustumCulled={false} />
    </>
  )
}
