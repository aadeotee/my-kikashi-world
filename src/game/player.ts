import { B } from './blocks'
import { angleDelta, damp } from './rng'
import { G } from './state'
import type { Grid } from './world/grid'

const R = 0.27
const HEIGHT = 1.2
const RUN = 8
const GRAVITY = 26

let velY = 0
let vx = 0
let vz = 0
let stepOffset = 0

function hits(g: Grid, x: number, y: number, z: number) {
  const x0 = Math.floor(x - R), x1 = Math.floor(x + R)
  const z0 = Math.floor(z - R), z1 = Math.floor(z + R)
  const y0 = Math.floor(y + 0.01), y1 = Math.floor(y + HEIGHT)
  for (let yy = y0; yy <= y1; yy++)
    for (let zz = z0; zz <= z1; zz++)
      for (let xx = x0; xx <= x1; xx++) if (g.solid(xx, yy, zz)) return true
  return false
}

function moveAxis(g: Grid, dx: number, dz: number) {
  const p = G.pos
  if (!hits(g, p.x + dx, p.y, p.z + dz)) {
    p.x += dx
    p.z += dz
    return true
  }
  // Step up single blocks without needing to jump.
  if (G.grounded) {
    const up = Math.floor(p.y + 0.01) + 1
    if (!hits(g, p.x + dx, up, p.z + dz) && !hits(g, p.x, up, p.z)) {
      stepOffset -= up - p.y
      p.y = up
      p.x += dx
      p.z += dz
      return true
    }
  }
  return false
}

export function teleport(x: number, y: number, z: number) {
  G.pos.set(x, y, z)
  G.view.set(x, y, z)
  velY = vx = vz = stepOffset = 0
}

export function updatePlayer(g: Grid, dt: number, locked: boolean) {
  const p = G.pos
  let wx = 0
  let wz = 0
  let target = 0

  if (G.script) {
    wx = G.script.x
    wz = G.script.z
    target = G.script.speed
  } else if (!locked) {
    const s = Math.sin(G.yaw)
    const c = Math.cos(G.yaw)
    // Input z is forward-negative; rotate into the page's frame.
    wx = G.input.x * c + G.input.z * s
    wz = -G.input.x * s + G.input.z * c
    if (Math.hypot(wx, wz) > 0.05) target = RUN
  }

  const len = Math.hypot(wx, wz)
  const dirX = len > 0.001 ? wx / len : 0
  const dirZ = len > 0.001 ? wz / len : 0
  const k = damp(target > 0 ? 11 : 9, dt)
  vx += (dirX * target - vx) * k
  vz += (dirZ * target - vz) * k

  const blockedX = !moveAxis(g, vx * dt, 0)
  const blockedZ = !moveAxis(g, 0, vz * dt)
  if (blockedX) vx *= 0.3
  if (blockedZ) vz *= 0.3

  velY -= GRAVITY * dt
  const dy = velY * dt
  if (hits(g, p.x, p.y + dy, p.z)) {
    if (velY < 0) {
      p.y = Math.floor(p.y + dy) + 1
      if (!G.grounded && velY < -5) G.landed = true
      G.grounded = true
    }
    velY = 0
  } else {
    p.y += dy
    if (velY < -3) G.grounded = false
  }

  const speed = Math.hypot(vx, vz)
  G.speed = speed
  G.speedNorm = Math.min(1, speed / RUN)

  if (speed > 0.25) {
    const want = Math.atan2(vx, vz)
    const delta = angleDelta(G.facing, want)
    const turn = delta * damp(13, dt)
    G.facing += turn
    G.turn += (Math.max(-1, Math.min(1, delta * 1.6)) - G.turn) * damp(10, dt)
  } else {
    G.turn += -G.turn * damp(8, dt)
  }

  stepOffset += -stepOffset * damp(16, dt)
  G.view.set(p.x, p.y + stepOffset, p.z)

}

export function groundUnder(g: Grid) {
  const x = Math.floor(G.pos.x)
  const y = Math.floor(G.pos.y - 0.2)
  const z = Math.floor(G.pos.z)
  const b = g.get(x, y, z)
  if (b === B.PLANK) return 'wood'
  if (b === B.COBBLE || b === B.STONE) return 'stone'
  if (b === B.GRAVEL || b === B.DIRT_PATH || b === B.SAND) return 'gravel'
  return 'grass'
}
