import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group } from 'three'
import { DOOR_X, COTTAGE, G0, GATE_X, GATE_Z } from '../constants'
import { P } from '../palette'
import { G, useUI } from '../state'
import type { World } from '../world/generate'
import { model } from './models'

/** The cottage door and the two leaves of the garden gate. */
export function Door() {
  const mesh = useMemo(
    () =>
      model((m) => {
        m.box(0, 0, 0, 2, 3, 0.16, P.plank, { tex: 0.2, grounded: false })
        for (const x of [0.48, 0.98, 1.48]) m.box(x, 0, -0.01, 0.04, 3, 0.18, P.timber, { grounded: false })
        m.box(0.1, 0.5, -0.03, 1.8, 0.16, 0.22, P.timber, { grounded: false })
        m.box(0.1, 2.3, -0.03, 1.8, 0.16, 0.22, P.timber, { grounded: false })
        m.box(0.6, 1.6, -0.03, 0.8, 0.7, 0.2, '#f2d9a0', { glow: 0.6, tex: 0, grounded: false })
        m.box(1.68, 1.25, -0.08, 0.14, 0.14, 0.3, P.butterDeep, { grounded: false })
      }),
    [],
  )
  useFrame(() => {
    mesh.position.set(DOOR_X - 1, G0 + 1, COTTAGE.z0 + 0.4)
    mesh.rotation.y = G.doorOpen * 1.95
  })
  return <primitive object={mesh} />
}

function leaf(flip: boolean) {
  const w = 3.5
  return model((m) => {
    const x0 = flip ? -w : 0
    for (let i = 0; i < 7; i++) {
      const px = x0 + i * 0.5
      const fromHinge = flip ? 6 - i : i
      const h = 6.1 + fromHinge * 0.1
      m.box(px, 0.1, -0.1, 0.46, h, 0.2, i % 2 ? P.plank : P.plankLight, { tex: 0.22, grounded: false })
    }
    for (const y of [0.9, 3.2, 5.5]) m.box(x0, y, -0.18, w, 0.3, 0.36, P.timber, { tex: 0.2, grounded: false })
    m.box(x0 + 0.1, 0.9, 0.2, 0.2, 4.8, 0.06, P.stoneDark, { grounded: false })
    const ring = flip ? -w + 0.3 : w - 0.5
    m.box(ring, 2.6, 0.18, 0.22, 0.34, 0.1, P.butterDeep, { grounded: false })
  })
}

export function Gate() {
  const left = useMemo(() => leaf(false), [])
  const right = useMemo(() => leaf(true), [])
  useFrame(() => {
    left.position.set(GATE_X - 3, G0, GATE_Z + 1.5)
    right.position.set(GATE_X + 4, G0, GATE_Z + 1.5)
    left.rotation.y = G.gateOpen * 1.72
    right.rotation.y = -G.gateOpen * 1.72
  })
  return (
    <>
      <primitive object={left} />
      <primitive object={right} />
    </>
  )
}

/** Little floating diamonds that mark what can be opened in the clearing once it's unlocked. */
export function StationMarkers({ world }: { world: World }) {
  const marks = useMemo(
    () =>
      world.stations.map((st) => {
        const m = model((b) => {
          b.box(-0.2, -0.2, -0.2, 0.4, 0.4, 0.4, P.butter, { glow: 1.1, tex: 0, grounded: false })
        }, false)
        m.position.set(st.x, G0 + 3, st.z)
        m.rotation.z = Math.PI / 4
        return { m, id: st.id, x: st.x, z: st.z }
      }),
    [world],
  )
  const group = useRef<Group>(null)
  useFrame(() => {
    const ui = useUI.getState()
    group.current!.visible = ui.phase === 'portfolio'
    marks.forEach((k, i) => {
      const seen = ui.visited.includes(k.id)
      k.m.position.y = G0 + 2.6 + Math.sin(G.time * 1.8 + i) * 0.14
      k.m.rotation.y = G.time * 1.1 + i
      k.m.scale.setScalar(seen ? 0.55 : 1)
    })
  })
  return <group ref={group}>{marks.map((k) => <primitive key={k.id} object={k.m} />)}</group>
}
