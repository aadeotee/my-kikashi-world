import { useEffect, useMemo } from 'react'
import { Color, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { CHUNK } from '../constants'
import { propMaterial, worldMaterial } from '../materials'
import type { Instances, World } from '../world/generate'
import { MeshBuilder } from '../world/meshBuilder'

export function Terrain({ world }: { world: World }) {
  return (
    <>
      {world.chunks.map((geo, i) => (
        <mesh key={i} geometry={geo} material={worldMaterial} castShadow receiveShadow />
      ))}
    </>
  )
}

const WHITE = new Color('#ffffff')

/** Plants take their light from above, like the ground they grow from, so they never read as dark sticks. */
function upLit(mb: MeshBuilder) {
  const g = mb.geometry()
  const n = g.getAttribute('normal')
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
  return g
}

function grassGeometry() {
  const mb = new MeshBuilder()
  const o = { wind: 1, windTop: true, tex: 0, grounded: true }
  mb.box(-0.2, 0, -0.04, 0.07, 0.26, 0.07, WHITE, o)
  mb.box(0.03, 0, 0.1, 0.07, 0.36, 0.07, WHITE, o)
  mb.box(0.16, 0, -0.16, 0.07, 0.22, 0.07, WHITE, o)
  mb.box(-0.06, 0, -0.2, 0.07, 0.3, 0.07, WHITE, o)
  mb.box(0.2, 0, 0.14, 0.07, 0.2, 0.07, WHITE, o)
  return upLit(mb)
}

function flowerGeometry() {
  const mb = new MeshBuilder()
  const stem = new Color('#a7c28f')
  mb.box(-0.03, 0, -0.03, 0.06, 0.44, 0.06, stem, { wind: 0.8, windTop: true, tex: 0, grounded: false })
  mb.box(0.03, 0.1, -0.03, 0.14, 0.05, 0.1, stem, { wind: 0.3, tex: 0, grounded: false })
  mb.box(-0.13, 0.44, -0.13, 0.26, 0.09, 0.26, WHITE, { wind: 0.85, tex: 0, grounded: false })
  mb.box(-0.06, 0.53, -0.06, 0.12, 0.05, 0.12, new Color('#fff0b8'), { wind: 0.9, tex: 0, grounded: false })
  return upLit(mb)
}

function riceGeometry() {
  const mb = new MeshBuilder()
  const o = { wind: 0.7, windTop: true, tex: 0, grounded: true }
  mb.box(-0.12, 0, -0.03, 0.06, 0.92, 0.06, WHITE, o)
  mb.box(0.03, 0, -0.1, 0.06, 1, 0.06, WHITE, o)
  mb.box(0.06, 0, 0.07, 0.06, 0.86, 0.06, WHITE, o)
  mb.box(-0.06, 0, 0.09, 0.06, 0.96, 0.06, WHITE, o)
  mb.box(-0.04, 0.94, -0.03, 0.09, 0.18, 0.09, WHITE, { wind: 0.9, tex: 0, grounded: false })
  return upLit(mb)
}

function reedGeometry() {
  const mb = new MeshBuilder()
  const o = { wind: 0.8, windTop: true, tex: 0, grounded: true }
  mb.box(-0.05, 0, -0.05, 0.08, 2, 0.08, WHITE, o)
  mb.box(0.1, 0, 0.06, 0.07, 1.6, 0.07, WHITE, o)
  mb.box(-0.1, 1.5, -0.1, 0.18, 0.42, 0.18, new Color('#7d5c43'), { wind: 0.8, tex: 0, grounded: false })
  return upLit(mb)
}

/** Instances are split into coarse tiles so anything off-screen is culled. */
function Tiled({ data, geometry, tile = CHUNK * 2, density = 1 }: { data: Instances; geometry: ReturnType<typeof grassGeometry>; tile?: number; density?: number }) {
  const meshes = useMemo(() => {
    const tiles = new Map<number, number[]>()
    const stride = 8
    for (let i = 0; i < data.length; i += stride) {
      if (density < 1 && ((i / stride) % 10) / 10 >= density) continue
      const key = ((data[i] / tile) | 0) * 1000 + ((data[i + 2] / tile) | 0)
      let list = tiles.get(key)
      if (!list) tiles.set(key, (list = []))
      list.push(i)
    }
    const m = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const p = new Vector3()
    const s = new Vector3()
    return [...tiles.values()].map((list) => {
      const mesh = new InstancedMesh(geometry, propMaterial, list.length)
      const colors = new Float32Array(list.length * 3)
      list.forEach((i, k) => {
        p.set(data[i], data[i + 1], data[i + 2])
        q.setFromEuler(e.set(0, data[i + 3], 0))
        const sc = data[i + 4]
        s.set(sc, sc, sc)
        m.compose(p, q, s)
        mesh.setMatrixAt(k, m)
        colors[k * 3] = data[i + 5]
        colors[k * 3 + 1] = data[i + 6]
        colors[k * 3 + 2] = data[i + 7]
      })
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3)
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      mesh.receiveShadow = true
      return mesh
    })
  }, [data, geometry, tile, density])

  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  )
}

export function Foliage({ world, density }: { world: World; density: number }) {
  const geos = useMemo(
    () => ({ grass: grassGeometry(), flower: flowerGeometry(), rice: riceGeometry(), reed: reedGeometry() }),
    [],
  )
  return (
    <>
      <Tiled data={world.grass} geometry={geos.grass} density={density} />
      <Tiled data={world.flowers} geometry={geos.flower} />
      <Tiled data={world.rice} geometry={geos.rice} density={density} />
      <Tiled data={world.reeds} geometry={geos.reed} />
    </>
  )
}
