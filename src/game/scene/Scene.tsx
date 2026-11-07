import { Html, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { audio } from '../audio'
import { G0 } from '../constants'
import { installDebug } from '../debug'
import { G, Panel, useUI } from '../state'
import { buildWorld, World } from '../world/generate'
import { Birds, Butterflies, Ducks } from './Creatures'
import { Director } from './Director'
import { Girl } from './Girl'
import { GoldenCanopy } from './GoldenCanopy'
import { Door } from './Moving'
import { Confetti, FallingLeaves, Motes, Smoke } from './Particles'
import { Lights } from './Sky'
import { Foliage, Terrain } from './Terrain'
import { Water } from './Water'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Each option's name sits on the ground in front of it, as an ordinary focusable button. */
function Labels({ world }: { world: World }) {
  const show = useUI((s) => s.phase === 'portfolio')
  const set = useUI((s) => s.set)
  if (!show) return null
  return (
    <>
      {world.stations.map((st) => (
        <Html key={st.id} position={[st.x + 0.5, G0, st.z - 3.5]} center zIndexRange={[5, 0]}>
          <button
            className="option"
            onClick={() => {
              if (st.id === 'about') {
                G.tree.request = true
                return
              }
              audio.chime()
              set({ panel: st.id as Panel })
            }}
          >
            {st.label}
          </button>
        </Html>
      ))}
    </>
  )
}

export default function Scene() {
  const [world, setWorld] = useState<World | null>(null)
  const [dpr, setDpr] = useState(coarse ? 1.25 : 1.6)
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    let live = true
    buildWorld((progress, progressLabel) => useUI.getState().set({ progress, progressLabel })).then((w) => {
      if (!live) return
      setWorld(w)
      installDebug(w)
      useUI.getState().set({ progress: 1, progressLabel: 'Opening the door' })
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <div ref={setHost} className="stage">
      <Canvas
        shadows
        orthographic
        dpr={dpr}
        camera={{ near: 1, far: 400, zoom: 12, position: [128, 100, 200] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#9db184']} />
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.9, d - 0.25))} />
        <Lights shadows={coarse ? 1024 : 2048} />
        {world && host && (
          <>
            <Director world={world} host={host} />
            <Terrain world={world} />
            <Foliage world={world} density={coarse ? 0.55 : 1} />
            <Water world={world} />
            <Door />
            <GoldenCanopy world={world} />
            <Girl />
            <Ducks />
            <Birds />
            <Butterflies />
            <Smoke world={world} />
            <FallingLeaves />
            <Motes />
            <Confetti />
            <Labels world={world} />
          </>
        )}
      </Canvas>
    </div>
  )
}
