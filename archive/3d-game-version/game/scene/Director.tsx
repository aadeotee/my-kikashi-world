import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { audio } from '../audio'
import { B } from '../blocks'
import { COTTAGE, D, DOOR_X, G0, GATE_X, GATE_Z, MAZE_SIZE, MAZE_Z0, PADDY, POND } from '../constants'
import { readInput } from '../input'
import { U } from '../materials'
import { groundUnder, teleport, updatePlayer } from '../player'
import { angleDelta, clamp, damp, lerp, smooth } from '../rng'
import { G, Panel, useUI, Zone } from '../state'
import { pondField, World } from '../world/generate'

const AREA_NAMES: Partial<Record<Zone, string>> = {
  pond: 'The Duck Pond',
  paddy: 'The Paddy Fields',
  gate: 'The Cottage Gate',
  garden: 'The Grand Garden',
  maze: 'The Garden Maze',
  clearing: 'The Golden Clearing',
}

const SPAWN = new Vector3(DOOR_X, G0 + 1, COTTAGE.z0 + 3.5)

function zoneAt(x: number, z: number): Zone {
  if (z < MAZE_Z0) return 'clearing'
  if (z < MAZE_Z0 + MAZE_SIZE) return 'maze'
  if (z < GATE_Z - 8) return 'garden'
  if (z < GATE_Z + 14 && Math.abs(x - GATE_X) < 26) return 'gate'
  if (pondField(x, z) < 2.1) return 'pond'
  if (x >= PADDY.x0 - 1 && x <= PADDY.x1 && z >= PADDY.z0 - 2 && z <= PADDY.z1) return 'paddy'
  return 'cottage'
}

export function Director({ world }: { world: World }) {
  const { camera, size } = useThree()
  const s = useMemo(
    () => ({
      target: new Vector3(128, 18, 258),
      yaw: Math.PI - 0.4,
      pitch: 0.34,
      dist: 64,
      introT: 0,
      endT: 0,
      areaTimer: 0,
      seenAreas: new Set<string>(['cottage']),
      stepDist: 0,
      actionLen: 1,
      fired: 0,
      endStage: 0,
      frames: 0,
    }),
    [],
  )

  useEffect(() => {
    teleport(SPAWN.x, SPAWN.y, SPAWN.z)
    G.facing = Math.PI
    G.world = world
  }, [world])

  useFrame((_, raw) => {
    const ui = useUI.getState()
    // Hold the loading screen until the first frames have compiled their shaders.
    if (ui.phase === 'loading' && ++s.frames > 2) ui.set({ phase: 'title' })
    const dt = Math.min(raw, 0.05)
    const frozen = ui.paused || ui.phase === 'loading'
    const simDt = frozen ? 0 : dt
    G.time += simDt
    U.uTime.value = G.time
    const grid = world.grid

    if (!frozen) {
      readInput()
      const locked = ui.phase === 'title' || ui.phase === 'ending' || ui.phase === 'intro' || G.action !== 'none' || ui.panel !== null
      if (ui.phase !== 'title') {
        const wasGrounded = G.grounded
        const ev = updatePlayer(grid, dt, locked)
        if (ev === 'jump') audio.step('grass')
        if (G.landed) {
          G.landed = false
          if (!wasGrounded) audio.step(groundUnder(grid))
        }
        if (G.grounded && G.speed > 0.6) {
          s.stepDist += G.speed * dt
          const stride = lerp(1.15, 1.9, G.speedNorm)
          if (s.stepDist > stride) {
            s.stepDist = 0
            audio.step(groundUnder(grid))
          }
        }
      }

      // Timed actions.
      if (G.action !== 'none') {
        const before = G.actionT
        G.actionT += dt / s.actionLen
        if (G.action === 'feed' && before < 0.48 && G.actionT >= 0.48) {
          G.throwFood = 9
          audio.rustle()
        }
        if (G.action === 'scatter' && G.actionT > 0.1 && G.actionT < 0.88 && Math.random() < dt * 24) {
          G.throwSeed += 1
          if (Math.random() < 0.15) audio.rustle()
        }
        if (G.actionT >= 1) {
          if (G.action === 'celebrate' && ui.phase === 'ending') G.actionT = 0
          else G.action = 'none'
        }
      }

      // Zones and their names.
      const zone = zoneAt(G.pos.x, G.pos.z)
      if (zone !== ui.zone && (ui.phase === 'play' || ui.phase === 'portfolio')) {
        ui.set({ zone })
        if (!s.seenAreas.has(zone) && AREA_NAMES[zone]) {
          s.seenAreas.add(zone)
          ui.set({ areaTitle: AREA_NAMES[zone] })
          s.areaTimer = 3.4
        }
      }
      if (s.areaTimer > 0 && (s.areaTimer -= dt) <= 0) useUI.getState().set({ areaTitle: null })

      // The garden gate swings open as she walks up to it.
      if (!G.gateOpening && Math.abs(G.pos.x - GATE_X) < 8 && G.pos.z < GATE_Z + 11 && G.pos.z > GATE_Z - 8) {
        openGate(world)
      }
      if (G.gateOpening) G.gateOpen = Math.min(1, G.gateOpen + dt * 0.62)

      // Interactions.
      if (ui.phase === 'play' || ui.phase === 'portfolio') {
        const act = findInteraction(world, ui.phase === 'portfolio')
        const prompt = G.action === 'none' && !ui.panel ? act?.prompt ?? null : null
        if (prompt !== ui.prompt) ui.set({ prompt })
        if (G.input.interact && act && G.action === 'none' && !ui.panel) {
          if (act.kind === 'feed') {
            G.action = 'feed'
            G.actionT = 0
            s.actionLen = 1.9
            const tx = G.pos.x < 108 && Math.abs(G.pos.z - 232) < 3 ? 70 : POND.x
            G.facing = Math.atan2(tx - G.pos.x, POND.z - G.pos.z)
            audio.chime()
          } else if (act.kind === 'scatter') {
            G.action = 'scatter'
            G.actionT = 0
            s.actionLen = 1.8
            audio.chime()
          } else {
            const visited = ui.visited.includes(act.kind) ? ui.visited : [...ui.visited, act.kind]
            ui.set({ panel: act.kind as Panel, visited })
            audio.chime()
          }
        }
      }
      G.input.interact = false

      if (ui.phase === 'intro') runIntro(s, dt, world)
      if (ui.phase === 'play' && G.pos.z < world.exit.z + 0.6) {
        ui.set({ phase: 'ending', prompt: null, areaTitle: null, zone: 'clearing' })
        s.endT = 0
        s.endStage = 0
        G.action = 'none'
      }
      if (ui.phase === 'ending') runEnding(s, dt, world)
      if (ui.phase === 'portfolio') G.warmth = Math.min(1, G.warmth + dt * 0.3)
    }

    // Compass needle: direction to the exit relative to where the camera faces.
    const ex = world.exit.x - G.pos.x
    const ez = world.exit.z - G.pos.z
    G.compass = Math.atan2(ex, -ez) + G.yaw

    // Camera.
    const zone = useUI.getState().zone
    const portrait = size.height > size.width ? 1.2 : 1
    const inMaze = zone === 'maze'
    let wantYaw = G.yaw
    let wantPitch = (inMaze ? 1.06 : zone === 'clearing' ? 0.36 : 0.5) + G.pitchOffset
    let wantDist = (inMaze ? 21 : zone === 'clearing' ? 19 : 17) * G.zoom * portrait
    const phase = useUI.getState().phase
    let follow = 6
    let yawRate = 12
    const want = new Vector3(G.view.x, G.view.y + 1.05, G.view.z)

    if (phase === 'title' || phase === 'loading') {
      want.set(124, 15, 244)
      wantYaw = Math.PI - 0.5 + Math.sin(G.time * 0.09) * 0.3
      wantPitch = 0.3
      wantDist = 64 * portrait
      follow = 2
      yawRate = 2
    } else if (phase === 'intro') {
      const t = s.introT
      const reveal = smooth(3.4, 8.5, t)
      wantYaw = lerp(Math.PI - 0.22, Math.PI - 0.22 + angleDelta(Math.PI - 0.22, G.yaw), reveal)
      wantPitch = lerp(0.14, 0.5, reveal)
      wantDist = lerp(9.5, 17, reveal) * portrait
      if (t < 3) want.set(DOOR_X, G0 + 2.4, COTTAGE.z0 - 1)
      follow = 2.4
      yawRate = 3
    } else if (phase === 'ending') {
      // Swing round so the view opens across the clearing to the golden tree.
      wantYaw = 0.6 + s.endT * 0.012
      const lift = s.endStage ? smooth(0, 6, s.endT) : 0
      wantPitch = lerp(0.46, 0.17, lift)
      wantDist = lerp(18, 27, lift) * portrait
      want.y += lerp(0, 7.5, lift)
      follow = 3
      yawRate = 1.6
      G.yaw = s.yaw
    }

    s.target.lerp(want, damp(follow, dt))
    s.yaw += angleDelta(s.yaw, wantYaw) * damp(yawRate, dt)
    s.pitch += (wantPitch - s.pitch) * damp(3.2, dt)
    s.dist += (wantDist - s.dist) * damp(3, dt)

    const cp = Math.cos(s.pitch)
    let cx = s.target.x + Math.sin(s.yaw) * cp * s.dist
    let cy = s.target.y + Math.sin(s.pitch) * s.dist
    let cz = s.target.z + Math.cos(s.yaw) * cp * s.dist
    cx = clamp(cx, 2, 254)
    cz = clamp(cz, 2, D - 2)
    cy = Math.max(cy, grid.h(cx, cz) + 1.2)
    camera.position.set(cx, cy, cz)
    camera.lookAt(s.target)

    // Hedges and roofs between her and the camera dissolve while she is on foot.
    U.uPlayer.value.set(G.view.x, G.view.y + 0.7, G.view.z)
    U.uCutRadius.value = phase === 'play' || phase === 'portfolio' || phase === 'ending' ? 1.9 : 0
    U.uGlow.value = lerp(0.9, 1.5, G.warmth)

    const pond = 1 - smooth(1.2, 3.4, pondField(G.pos.x, G.pos.z))
    audio.update(pond, G.time, zone)
  })

  return null
}

function openGate(world: World) {
  G.gateOpening = true
  world.grid.fill(GATE_X - 3, G0, GATE_Z + 1, GATE_X + 3, G0 + 6, GATE_Z + 1, B.AIR)
  audio.creak()
}

type Act = { kind: string; prompt: string } | null

function findInteraction(world: World, unlocked: boolean): Act {
  const { x, z } = G.pos
  if (unlocked) {
    let best: Act = null
    let bd = 3.4
    for (const st of world.stations) {
      const d = Math.hypot(st.x - x, st.z - z)
      if (d < bd) {
        bd = d
        best = { kind: st.id, prompt: st.prompt }
      }
    }
    if (best) return best
  }
  if (pondField(x, z) < 1.34 || (x < 110 && x > 90 && Math.abs(z - 232) < 3)) {
    return { kind: 'feed', prompt: 'Press E to feed the ducks' }
  }
  if (x >= PADDY.x0 && x <= PADDY.x1 && z >= PADDY.z0 && z <= PADDY.z1) {
    return { kind: 'scatter', prompt: 'Press E to scatter seeds' }
  }
  return null
}

type Sequencer = { introT: number; fired: number; endT: number; endStage: number; yaw: number }

function runIntro(s: Sequencer, dt: number, world: World) {
  const t = (s.introT += dt)
  const ui = useUI.getState()
  if (t > 0.9 && s.fired === 0) {
    s.fired = 1
    audio.creak()
    world.grid.fill(DOOR_X - 1, G0 + 1, COTTAGE.z0, DOOR_X, G0 + 3, COTTAGE.z0, B.AIR)
  }
  if (s.fired >= 1) G.doorOpen = Math.min(1, G.doorOpen + dt * 0.8)
  // She walks out of the door and down the porch steps.
  if (t > 1.9) G.script = G.pos.z > 237 ? { x: 0, z: -1, speed: 3.5 } : null
  if (t > 8.8) {
    G.script = null
    ui.set({ phase: 'play', hint: true })
  }
}

function runEnding(s: Sequencer, dt: number, world: World) {
  const t = (s.endT += dt)
  const ui = useUI.getState()
  const goal = world.exit.z - 13
  if (G.pos.z > goal) {
    const dx = world.exit.x - G.pos.x
    G.script = { x: dx * 0.5, z: -1, speed: 3.6 }
  } else if (s.endStage === 0) {
    G.script = null
    s.endStage = 1
    s.endT = 0
    G.action = 'celebrate'
    G.actionT = 0
    G.facing = 0
    G.celebrateBurst = 1
    audio.fanfare()
    ui.set({ ending: 1 })
    return
  }
  if (s.endStage >= 1) {
    G.warmth = Math.min(1, G.warmth + dt * 0.28)
    if (t > 3.6 && s.endStage === 1) {
      s.endStage = 2
      ui.set({ ending: 2 })
      G.celebrateBurst = 1
    }
    if (t > 7.4 && s.endStage === 2) {
      s.endStage = 3
      G.action = 'none'
      ui.set({ phase: 'portfolio', ending: 0, completedBefore: true })
      try {
        localStorage.setItem('little-world-complete', '1')
      } catch {
        /* private windows simply won't remember */
      }
    }
  }
}
