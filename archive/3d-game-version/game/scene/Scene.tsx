import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { attachInput } from '../input'
import { useUI } from '../state'
import { buildWorld, World } from '../world/generate'
import { Birds, Butterflies, Ducks, Sparrows } from './Creatures'
import { Director } from './Director'
import { Girl } from './Girl'
import { Door, Gate, StationMarkers } from './Moving'
import { Confetti, FallingLeaves, Grains, Motes, PetalTrail, Smoke } from './Particles'
import { Clouds, Lights, Sky } from './Sky'
import { Foliage, Terrain } from './Terrain'
import { Water } from './Water'
import { installDebug } from '../debug'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export default function Scene() {
  const [world, setWorld] = useState<World | null>(null)
  const [dpr, setDpr] = useState(coarse ? 1.25 : 1.6)
  const host = useRef<HTMLDivElement>(null)

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

  useEffect(() => attachInput(host.current!), [])

  return (
    <div ref={host} className="stage">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ fov: 38, near: 0.4, far: 460, position: [128, 40, 220] }}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV }}
      >
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.9, d - 0.25))} />
        <Sky />
        <Lights shadows={coarse ? 1024 : 2048} />
        <Clouds />
        {world && (
          <>
            <Director world={world} />
            <Terrain world={world} />
            <Foliage world={world} density={coarse ? 0.55 : 1} />
            <Water world={world} />
            <Door />
            <Gate />
            <StationMarkers world={world} />
            <Girl />
            <Ducks />
            <Birds />
            <Sparrows />
            <Butterflies />
            <Grains world={world} />
            <Smoke world={world} />
            <FallingLeaves />
            <Motes />
            <PetalTrail />
            <Confetti />
          </>
        )}
      </Canvas>
    </div>
  )
}
