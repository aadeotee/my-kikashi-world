import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { DOOR_X, COTTAGE, G0 } from '../constants'
import { P } from '../palette'
import { G } from '../state'
import { model } from './models'

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
