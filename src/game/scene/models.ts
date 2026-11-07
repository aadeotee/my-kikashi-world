import { Mesh } from 'three'
import { propMaterial } from '../materials'
import { MeshBuilder } from '../world/meshBuilder'

export type Paint = (mb: MeshBuilder) => void

/** Builds a small box-model mesh sharing the world's lighting and wind shader. */
export function model(paint: Paint, shadow = true) {
  const mb = new MeshBuilder()
  paint(mb)
  const m = new Mesh(mb.geometry(), propMaterial)
  m.castShadow = shadow
  m.receiveShadow = true
  return m
}

/** Same but returning geometry only, for instancing. */
export function modelGeometry(paint: Paint) {
  const mb = new MeshBuilder()
  paint(mb)
  return mb.geometry()
}
