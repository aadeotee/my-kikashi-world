import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BackSide, BoxGeometry, Color, DirectionalLight, FogExp2, HemisphereLight, InstancedMesh, Matrix4, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three'
import { useThree } from '@react-three/fiber'
import { U } from '../materials'
import { lerp, mulberry32 } from '../rng'
import { G, useUI } from '../state'

const SKY_TOP = new Color('#a9cbdb')
const SKY_TOP_WARM = new Color('#c9c3b4')
const HORIZON = new Color('#efe6cc')
const HORIZON_WARM = new Color('#f6d9a4')
const SUN_COOL = new Color('#ffe9c4')
const SUN_WARM = new Color('#ffcf8a')
const FOG_COOL = new Color('#e4e3cf')
const FOG_WARM = new Color('#f3d9a8')

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`
const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float t = pow(clamp(d.y * 1.5 + 0.02, 0.0, 1.0), 0.62);
  vec3 c = mix(uHorizon, uTop, t);
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.86, 0.6) * (pow(s, 7.0) * 0.14 + pow(s, 90.0) * 0.26 + smoothstep(0.9988, 0.9994, s) * 0.8);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`

export function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uTop: { value: SKY_TOP.clone() },
          uHorizon: { value: HORIZON.clone() },
          uSun: U.uSun,
        },
      }),
    [],
  )
  useFrame(() => {
    material.uniforms.uTop.value.lerpColors(SKY_TOP, SKY_TOP_WARM, G.warmth)
    material.uniforms.uHorizon.value.lerpColors(HORIZON, HORIZON_WARM, G.warmth)
  })
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[10, 24, 16]} />
    </mesh>
  )
}

export function Lights({ shadows }: { shadows: number }) {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const scene = useThree((s) => s.scene)

  useLayoutEffect(() => {
    scene.fog = new FogExp2(FOG_COOL.getHex(), 0.0052)
    const l = sun.current!
    scene.add(l.target)
    return () => {
      scene.remove(l.target)
    }
  }, [scene])

  useFrame(() => {
    const l = sun.current!
    const fog = scene.fog as FogExp2
    const snap = 4
    const cx = Math.round(G.view.x / snap) * snap
    const cz = Math.round(G.view.z / snap) * snap
    const zone = useUI.getState().zone
    const phase = useUI.getState().phase
    const wide = phase === 'title' ? 0 : 0
    l.target.position.set(cx, 12 + wide, cz)
    l.position.copy(U.uSun.value).multiplyScalar(90).add(l.target.position)
    l.color.lerpColors(SUN_COOL, SUN_WARM, G.warmth)
    l.intensity = lerp(2.75, 3.1, G.warmth)
    hemi.current!.intensity = lerp(1.6, 1.75, G.warmth)
    const target = zone === 'maze' ? 0.0098 : 0.0052
    fog.density += (lerp(target, 0.0058, G.warmth) - fog.density) * 0.02
    fog.color.lerpColors(FOG_COOL, FOG_WARM, G.warmth)
    U.uFogColor.value.copy(fog.color)
    U.uFogDensity.value = fog.density
    U.uSky.value.lerpColors(SKY_TOP, HORIZON_WARM, G.warmth * 0.6)
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e6eef0', '#b7ab7c', 1.6]} />
      <directionalLight
        ref={sun}
        castShadow={shadows > 0}
        intensity={2.7}
        shadow-mapSize-width={shadows || 512}
        shadow-mapSize-height={shadows || 512}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={62}
        shadow-camera-bottom={-62}
        shadow-camera-near={10}
        shadow-camera-far={190}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
      />
    </>
  )
}

/** Blocky clouds drifting slowly across the sky. */
export function Clouds() {
  const mesh = useRef<InstancedMesh>(null)
  const data = useMemo(() => {
    const r = mulberry32(99)
    const puffs: { cloud: number; x: number; y: number; z: number; sx: number; sy: number; sz: number }[] = []
    const clouds: { x: number; z: number; y: number }[] = []
    for (let c = 0; c < 18; c++) {
      clouds.push({ x: r() * 560 - 150, z: r() * 560 - 120, y: 74 + r() * 28 })
      const n = 5 + ((r() * 6) | 0)
      for (let i = 0; i < n; i++) {
        puffs.push({
          cloud: c,
          x: (r() - 0.5) * 42,
          y: (r() - 0.5) * 3,
          z: (r() - 0.5) * 22,
          sx: 12 + r() * 16,
          sy: 3 + r() * 4,
          sz: 8 + r() * 12,
        })
      }
    }
    return { puffs, clouds }
  }, [])
  const geo = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#fbf6e8', fog: false, transparent: true, opacity: 0.92 }), [])
  const m = useMemo(() => new Matrix4(), [])
  const v = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const inst = mesh.current!
    data.puffs.forEach((p, i) => {
      const c = data.clouds[p.cloud]
      let x = c.x + G.time * 0.8
      x = ((x + 220) % 640) - 220
      v.set(x + p.x, c.y + p.y, c.z + p.z)
      m.makeScale(p.sx, p.sy, p.sz).setPosition(v)
      inst.setMatrixAt(i, m)
    })
    inst.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, data.puffs.length]} frustumCulled={false} />
}
