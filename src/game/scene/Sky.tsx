import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Color, DirectionalLight, HemisphereLight } from 'three'
import { useThree } from '@react-three/fiber'
import { U } from '../materials'
import { lerp } from '../rng'
import { G } from '../state'

const SKY = new Color('#bcd7e2')
const SKY_WARM = new Color('#f6d9a4')
const SUN_COOL = new Color('#ffe9c4')
const SUN_WARM = new Color('#ffcf8a')

export function Lights({ shadows }: { shadows: number }) {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const scene = useThree((s) => s.scene)

  useLayoutEffect(() => {
    const l = sun.current!
    scene.add(l.target)
    return () => {
      scene.remove(l.target)
    }
  }, [scene])

  useFrame(() => {
    const l = sun.current!
    const cz = Math.round(G.pageZ / 4) * 4
    l.target.position.set(128, 12, cz)
    l.position.copy(U.uSun.value).multiplyScalar(90).add(l.target.position)
    l.color.lerpColors(SUN_COOL, SUN_WARM, G.warmth)
    l.intensity = lerp(2.75, 3, G.warmth)
    hemi.current!.intensity = lerp(1.6, 1.75, G.warmth)
    U.uSky.value.lerpColors(SKY, SKY_WARM, G.warmth * 0.5)
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e6eef0', '#b7ab7c', 1.6]} />
      <directionalLight
        ref={sun}
        castShadow={shadows > 0}
        intensity={2.75}
        shadow-mapSize-width={shadows || 512}
        shadow-mapSize-height={shadows || 512}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-near={10}
        shadow-camera-far={200}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
      />
    </>
  )
}
