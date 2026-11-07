import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Group, Object3D } from 'three'
import { P } from '../palette'
import { damp, lerp } from '../rng'
import { G } from '../state'
import { model } from './models'

const SKIN = '#f0cfae'
const HAIR = '#6a4630'
const HAIR_DARK = '#553726'
const SHIRT = P.cream
const OVERALL = '#8aa17a'
const OVERALL_DARK = '#71886a'
const PACK = P.terracotta
const SHOE = '#7a4f35'
const FLAT = { tex: 0, grounded: false }

interface Rig {
  root: Group
  body: Group
  head: Group
  armL: Group
  armR: Group
  legL: Group
  legR: Group
  plaitL: Group
  plaitR: Group
  pack: Group
}

function joint(x: number, y: number, z: number, parent: Object3D) {
  const g = new Group()
  g.position.set(x, y, z)
  parent.add(g)
  return g
}

function buildRig(): Rig {
  const root = new Group()
  const body = joint(0, 0.5, 0, root)

  // Overalls and shirt.
  body.add(model((m) => {
    m.box(-0.2, 0, -0.13, 0.4, 0.26, 0.26, OVERALL, FLAT)
    m.box(-0.19, 0.26, -0.12, 0.38, 0.2, 0.24, SHIRT, FLAT)
    m.box(-0.13, 0.2, 0.115, 0.26, 0.2, 0.02, OVERALL, FLAT)
    m.box(-0.14, 0.2, 0.128, 0.05, 0.27, 0.015, OVERALL_DARK, FLAT)
    m.box(0.09, 0.2, 0.128, 0.05, 0.27, 0.015, OVERALL_DARK, FLAT)
    m.box(-0.14, 0.2, -0.135, 0.05, 0.27, 0.015, OVERALL_DARK, FLAT)
    m.box(0.09, 0.2, -0.135, 0.05, 0.27, 0.015, OVERALL_DARK, FLAT)
    m.box(-0.08, 0.09, 0.13, 0.16, 0.1, 0.012, OVERALL_DARK, FLAT)
    m.box(-0.11, 0.37, 0.133, 0.03, 0.03, 0.01, P.butter, FLAT)
    m.box(0.08, 0.37, 0.133, 0.03, 0.03, 0.01, P.butter, FLAT)
  }))

  const pack = joint(0, 0.26, -0.13, body)
  pack.add(model((m) => {
    m.box(-0.16, -0.14, -0.17, 0.32, 0.34, 0.17, PACK, FLAT)
    m.box(-0.17, 0.12, -0.18, 0.34, 0.1, 0.19, P.terracottaLight, FLAT)
    m.box(-0.12, -0.11, -0.2, 0.24, 0.14, 0.04, P.terracottaDeep, FLAT)
    m.box(-0.03, 0.06, -0.195, 0.06, 0.07, 0.02, P.butter, FLAT)
    m.box(-0.14, -0.2, -0.16, 0.28, 0.08, 0.14, P.creamDark, FLAT)
  }))

  const head = joint(0, 0.48, 0, body)
  head.add(model((m) => {
    m.box(-0.23, 0, -0.21, 0.46, 0.42, 0.42, SKIN, FLAT)
    // Hair: cap, fringe, and sides.
    m.box(-0.25, 0.27, -0.23, 0.5, 0.2, 0.46, HAIR, FLAT)
    m.box(-0.25, 0.05, -0.23, 0.5, 0.25, 0.14, HAIR, FLAT)
    m.box(-0.25, 0.06, -0.15, 0.06, 0.24, 0.22, HAIR, FLAT)
    m.box(0.19, 0.06, -0.15, 0.06, 0.24, 0.22, HAIR, FLAT)
    m.box(-0.25, 0.27, 0.19, 0.5, 0.06, 0.05, HAIR, FLAT)
    m.box(-0.25, 0.2, 0.19, 0.17, 0.08, 0.05, HAIR, FLAT)
    m.box(0.1, 0.2, 0.19, 0.15, 0.1, 0.05, HAIR, FLAT)
    m.box(-0.14, 0.44, -0.12, 0.3, 0.06, 0.28, HAIR_DARK, FLAT)
    // Face.
    m.box(-0.14, 0.12, 0.205, 0.07, 0.1, 0.012, P.ink, FLAT)
    m.box(0.07, 0.12, 0.205, 0.07, 0.1, 0.012, P.ink, FLAT)
    m.box(-0.125, 0.185, 0.214, 0.03, 0.03, 0.006, '#ffffff', FLAT)
    m.box(0.085, 0.185, 0.214, 0.03, 0.03, 0.006, '#ffffff', FLAT)
    m.box(-0.2, 0.06, 0.205, 0.08, 0.05, 0.01, '#e7a795', FLAT)
    m.box(0.12, 0.06, 0.205, 0.08, 0.05, 0.01, '#e7a795', FLAT)
    m.box(-0.04, 0.05, 0.205, 0.08, 0.025, 0.01, '#a86a56', FLAT)
    // Butter-yellow hair ribbon.
    m.box(0.13, 0.42, 0.04, 0.14, 0.08, 0.1, P.butter, FLAT)
  }))

  const plait = (x: number) => {
    const g = joint(x, 0.2, -0.1, head)
    g.add(model((m) => {
      m.box(-0.06, -0.3, -0.06, 0.12, 0.3, 0.12, HAIR, FLAT)
      m.box(-0.07, -0.34, -0.07, 0.14, 0.07, 0.14, P.terracotta, FLAT)
      m.box(-0.05, -0.43, -0.05, 0.1, 0.09, 0.1, HAIR_DARK, FLAT)
    }))
    return g
  }
  const plaitL = plait(-0.28)
  const plaitR = plait(0.28)

  const arm = (x: number) => {
    const g = joint(x, 0.42, 0, body)
    g.add(model((m) => {
      m.box(-0.06, -0.15, -0.065, 0.12, 0.17, 0.13, SHIRT, FLAT)
      m.box(-0.055, -0.33, -0.06, 0.11, 0.18, 0.12, SKIN, FLAT)
    }))
    return g
  }
  const armL = arm(-0.26)
  const armR = arm(0.26)

  const leg = (x: number) => {
    const g = joint(x, 0.5, 0, root)
    g.add(model((m) => {
      m.box(-0.085, -0.28, -0.09, 0.17, 0.28, 0.18, OVERALL, FLAT)
      m.box(-0.08, -0.4, -0.08, 0.16, 0.12, 0.16, SKIN, FLAT)
      m.box(-0.09, -0.5, -0.1, 0.18, 0.11, 0.26, SHOE, FLAT)
      m.box(-0.09, -0.5, 0.1, 0.18, 0.03, 0.06, P.creamDark, FLAT)
    }))
    return g
  }
  const legL = leg(-0.1)
  const legR = leg(0.1)

  return { root, body, head, armL, armR, legL, legR, plaitL, plaitR, pack }
}

/** Animated joints, blended towards each frame's target pose. */
const POSE = {
  armLx: 0, armRx: 0, armLz: 0, armRz: 0, legL: 0, legR: 0, bodyX: 0, bodyZ: 0, headX: 0, headY: 0, bob: 0, plait: 0,
}

export function Girl() {
  const rig = useMemo(buildRig, [])
  const cur = useMemo(() => ({ ...POSE }), [])
  const anim = useMemo(() => ({ phase: 0, stop: 0, wasMoving: false, blink: 0 }), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const speed = G.speed
    const n = G.speedNorm
    const moving = speed > 0.35
    const t = G.time
    anim.phase += dt * (5.2 + speed * 1.55)
    const s = Math.sin(anim.phase)
    const c2 = Math.sin(anim.phase * 2)

    // A little settle when she comes to a stop.
    if (anim.wasMoving && !moving && n > 0.02) anim.stop = 1
    anim.wasMoving = moving
    anim.stop = Math.max(0, anim.stop - dt * 2.6)
    const settle = Math.sin(anim.stop * Math.PI) * anim.stop

    const p = { ...POSE }
    if (G.action === 'feed') {
      const a = G.actionT
      const wind = a < 0.45 ? a / 0.45 : a < 0.7 ? 1 - (a - 0.45) / 0.25 : 0
      p.armRx = -0.5 - wind * 2.2 + (a > 0.45 ? 1.5 * Math.sin(Math.min(1, (a - 0.45) / 0.3) * Math.PI) * -1 : 0)
      p.armLx = -0.8
      p.armLz = 0.2
      p.bodyX = a > 0.45 && a < 0.9 ? 0.25 : -0.08 * wind
      p.headX = 0.2
    } else if (G.action === 'scatter') {
      const a = G.actionT
      const sweep = Math.sin(a * 11)
      p.armRx = -1.25 + sweep * 0.25
      p.armRz = -0.55 + sweep * 0.7
      p.armLx = -0.9
      p.armLz = 0.25
      p.bodyX = 0.12
      p.bodyZ = sweep * 0.08
      p.headX = 0.2
      p.headY = sweep * 0.2
      p.bob = Math.abs(sweep) * 0.012
    } else if (G.action === 'celebrate') {
      const a = G.actionT
      const hop = Math.abs(Math.sin(a * 9))
      p.armRx = -3 + Math.sin(a * 18) * 0.2
      p.armLx = -3 - Math.sin(a * 18) * 0.2
      p.armRz = -0.25
      p.armLz = 0.25
      p.legL = -0.22 * hop
      p.legR = 0.22 * hop
      p.bob = hop * 0.42
      p.headX = -0.2
      p.plait = hop * 0.5
    } else if (moving || !G.grounded) {
      const stride = lerp(0.55, 1.05, n)
      p.legL = s * stride
      p.legR = -s * stride
      p.armLx = -s * stride * 0.8
      p.armRx = s * stride * 0.8
      p.armLz = 0.08 + n * 0.1
      p.armRz = -0.08 - n * 0.1
      p.bodyX = 0.05 + n * 0.2
      p.bodyZ = -G.turn * 0.17 * (0.4 + n)
      p.headY = G.turn * 0.42
      p.headX = -n * 0.1
      p.bob = Math.abs(c2) * lerp(0.02, 0.055, n)
      p.plait = 0.2 + n * 0.75 + s * 0.14
      if (!G.grounded) {
        p.legL = 0.75
        p.legR = -0.35
        p.armLx = -2.3
        p.armRx = -2.3
        p.armLz = 0.32
        p.armRz = -0.32
        p.plait = 0.9
      }
    } else {
      // Idle: breathing, a look around now and then.
      const breathe = Math.sin(t * 2.1)
      p.bob = breathe * 0.008
      p.armLz = 0.07 + breathe * 0.015
      p.armRz = -0.07 - breathe * 0.015
      p.headY = Math.sin(t * 0.43) * Math.sin(t * 0.17) * 0.5
      p.headX = Math.sin(t * 0.31) * 0.06
      p.bodyX = -settle * 0.2
      p.plait = settle * 0.5
    }

    const k = damp(G.action === 'none' ? 16 : 20, dt)
    for (const key of Object.keys(POSE) as (keyof typeof POSE)[]) cur[key] += (p[key] - cur[key]) * k

    rig.root.position.set(G.view.x, G.view.y + cur.bob, G.view.z)
    rig.root.rotation.y = G.facing
    rig.armL.rotation.set(cur.armLx, 0, cur.armLz)
    rig.armR.rotation.set(cur.armRx, 0, cur.armRz)
    rig.legL.rotation.x = cur.legL
    rig.legR.rotation.x = cur.legR
    rig.body.rotation.set(cur.bodyX, 0, cur.bodyZ)
    rig.head.rotation.set(cur.headX, cur.headY, 0)
    rig.plaitL.rotation.x = cur.plait + Math.sin(t * 2.2) * 0.03
    rig.plaitR.rotation.x = cur.plait + Math.sin(t * 2.2 + 1) * 0.03
    rig.plaitL.rotation.z = -0.1 - Math.abs(cur.bob) * 2
    rig.plaitR.rotation.z = 0.1 + Math.abs(cur.bob) * 2
    rig.pack.rotation.x = -cur.bodyX * 0.3 + Math.sin(anim.phase * 2) * 0.03 * n
  })

  return <primitive object={rig.root} />
}
