import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Plane, Raycaster, Sphere, Vector2, Vector3 } from 'three'
import { audio } from '../audio'
import { B } from '../blocks'
import { BENCH, COTTAGE, D, DOOR_X, G0, GOLDEN_TREE, MAZE_TOP, PAGE_BOTTOM, PAGE_TOP } from '../constants'
import { attachInput, readInput } from '../input'
import { U } from '../materials'
import { groundUnder, teleport, updatePlayer } from '../player'
import { damp, lerp, smooth } from '../rng'
import { G, Panel, useUI } from '../state'
import { pondField, World } from '../world/generate'
import { MAZE_BLOCKS_H } from '../world/maze'
import { walkPath } from '../world/walk'

const PITCH = 0.78
const CAMERA_DISTANCE = 110
const WALK_SPEED = 9
const FLOOR = new Plane(new Vector3(0, 1, 0), -G0)

const LOOK_SECONDS = 2.4
const GARDEN_GATE_Z = 244
const TREE_FALL_SECONDS = 2.6
const TREE_GROW_SECONDS = 3.5
/** The tree's canopy and trunk, for telling when the cursor is on it. */
const TREE_SHAPE = [
  new Sphere(new Vector3(GOLDEN_TREE.x, G0 + 19, GOLDEN_TREE.z), 16),
  new Sphere(new Vector3(GOLDEN_TREE.x, G0 + 5, GOLDEN_TREE.z), 5),
]

const here = (): [number, number, number] => [Math.floor(G.pos.x), Math.round(G.pos.y), Math.floor(G.pos.z)]

/** Steers towards a point; returns true on arrival. */
function walkTo(x: number, z: number, speed: number) {
  const dx = x - G.pos.x
  const dz = z - G.pos.z
  if (Math.hypot(dx, dz) < 0.35) {
    G.script = null
    return true
  }
  G.script = { x: dx, z: dz, speed }
  return false
}

export function Director({ world, host }: { world: World; host: HTMLElement }) {
  const { camera, size, gl } = useThree()
  const s = useMemo(() => ({ t: 0, step: 0, frames: 0, stepDist: 0, stage: 0, sealed: false, crossed: false, bannerT: 0, quacked: false }), [])

  const rayAt = useMemo(() => {
    const ray = new Raycaster()
    const ndc = new Vector2()
    return (px: number, py: number) => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray
    }
  }, [camera, gl])

  useEffect(() => {
    teleport(DOOR_X, G0 + 1, COTTAGE.z0 + 3.5)
    G.facing = Math.PI
    G.world = world
  }, [world])

  useEffect(() => {
    const hit = new Vector3()
    return attachInput(host, (px, py) => {
      const ui = useUI.getState()
      if (ui.panel) return
      const ray = rayAt(px, py)
      if (ui.phase === 'portfolio' && onTree(ray)) {
        G.tree.request = true
        return
      }
      if (!ray.ray.intersectPlane(FLOOR, hit)) return
      if (ui.phase === 'maze') {
        // Clicking a hedge goes to the nearest bit of path beside it.
        const near = (reach: number) => (x: number, _y: number, z: number) => Math.hypot(x + 0.5 - hit.x, z + 0.5 - hit.z) < reach
        // Clicking the pond itself walks her to the nearest shore.
        G.route = walkPath(world.grid, here(), near(2)) ?? walkPath(world.grid, here(), near(9)) ?? []
        G.scrollWalk = 0
      } else if (ui.phase === 'portfolio') {
        const st = world.stations.find((v) => v.id !== 'about' && Math.abs(v.x - hit.x) < 9 && hit.z > v.z - 3 && hit.z < v.z + 11)
        if (st) {
          audio.chime()
          ui.set({ panel: st.id as Panel })
        }
      }
    })
  }, [host, rayAt, world])

  useFrame((_, raw) => {
    const ui = useUI.getState()
    if (ui.phase === 'loading' && ++s.frames > 2) ui.set({ phase: 'intro' })
    const dt = Math.min(raw, 0.05)
    G.time += dt
    U.uTime.value = G.time
    const grid = world.grid
    readInput()

    if (ui.phase === 'intro') runIntro(s, dt, world)
    else if (ui.phase === 'maze') runMaze(s, world, dt)
    else if (ui.phase === 'ending') runEnding(s, dt, world)
    else if (ui.phase === 'portfolio') {
      G.warmth = Math.min(1, G.warmth + dt * 0.3)
      // Checked every frame, so scrolling the tree under a still cursor counts too.
      runTree(!!G.mouse && onTree(rayAt(G.mouse.x, G.mouse.y)), dt)
    }

    if (G.action !== 'sit' && ui.phase !== 'loading') {
      updatePlayer(grid, dt, ui.phase !== 'maze' || ui.panel !== null)
      if (G.grounded && G.speed > 0.6) {
        s.stepDist += G.speed * dt
        if (s.stepDist > 1.5) {
          s.stepDist = 0
          audio.step(groundUnder(grid))
        }
      }
    }
    if (G.action === 'celebrate' && (G.actionT += dt / 1.4) >= 1) G.actionT = 0

    // The page follows her down, then belongs to the reader.
    const phase = useUI.getState().phase
    const aspect = size.width / size.height
    const visibleHeight = Math.max(44, 47 / aspect)
    // While she is in the maze, hold all of it in view if the window is tall enough.
    const mazeMid = MAZE_TOP - MAZE_BLOCKS_H / 2
    const fits = visibleHeight / Math.sin(PITCH) > MAZE_BLOCKS_H + 4
    const inMaze = phase === 'maze' && s.sealed
    const want = phase === 'portfolio' ? G.pageGoal : inMaze && fits ? mazeMid : Math.min(G.view.z, 252)
    G.pageZ += (want - G.pageZ) * damp(phase === 'portfolio' ? 5 : 2.4, dt)
    // Tall phones see further, so stop short of showing past the top edge of the land.
    G.pageZ = Math.min(G.pageZ, D - 4 - visibleHeight / Math.sin(PITCH) / 2)

    const cam = camera as typeof camera & { zoom: number }
    cam.zoom = size.height / visibleHeight
    // Narrow windows slide sideways to keep her in view while she explores.
    const slack = Math.max(0, 50 - (visibleHeight * aspect) / 2)
    const wantX = phase === 'maze' ? 128 + Math.max(-slack, Math.min(slack, G.view.x - 128)) : 128
    G.pageX += (wantX - G.pageX) * damp(2.4, dt)
    camera.position.set(G.pageX, G0 + Math.sin(PITCH) * CAMERA_DISTANCE, G.pageZ - Math.cos(PITCH) * CAMERA_DISTANCE)
    camera.lookAt(G.pageX, G0, G.pageZ)
    camera.updateProjectionMatrix()

    U.uPlayer.value.set(G.view.x, G.view.y + 0.7, G.view.z)
    U.uCutRadius.value = phase === 'maze' ? 1.9 : 0
    U.uGlow.value = lerp(0.9, 1.5, G.warmth)
    audio.update(1 - smooth(1.2, 3.4, pondField(G.pos.x, G.pos.z)), G.time, 'page')
  })

  return null
}

const onTree = (r: Raycaster) => TREE_SHAPE.some((shape) => r.ray.intersectsSphere(shape))

function runTree(over: boolean, dt: number) {
  const tree = G.tree
  const ui = useUI.getState()
  if (!over) tree.armed = true
  const passing = over && tree.armed && tree.mode === 'idle' && !ui.panel
  if ((tree.request || passing) && tree.mode !== 'fall') {
    tree.mode = 'fall'
    tree.opened = false
    tree.armed = false
    G.pageGoal = PAGE_BOTTOM
    audio.rustle()
    audio.chime()
  }
  tree.request = false
  if (tree.mode === 'fall') {
    tree.t = Math.min(1, tree.t + dt / TREE_FALL_SECONDS)
    if (tree.t >= 0.86 && !tree.opened) {
      tree.opened = true
      ui.set({ panel: 'about' })
    } else if (tree.opened && !ui.panel) tree.mode = 'grow'
  } else if (tree.mode === 'grow') {
    tree.t = Math.max(0, tree.t - dt / TREE_GROW_SECONDS)
    if (tree.t === 0) tree.mode = 'idle'
  }
}

type Seq = { t: number; step: number; stage: number; sealed: boolean; crossed: boolean; bannerT: number; quacked: boolean }

function runIntro(s: Seq, dt: number, world: World) {
  s.t += dt
  if (s.t > 0.7 && s.step === 0) {
    s.step = 1
    audio.creak()
    world.grid.fill(DOOR_X - 1, G0 + 1, COTTAGE.z0, DOOR_X, G0 + 3, COTTAGE.z0, B.AIR)
  }
  if (s.step >= 1) G.doorOpen = Math.min(1, G.doorOpen + dt * 0.9)
  if (s.t < 1.6) return
  if (s.step === 1 && walkTo(DOOR_X, 248.5, 3.6)) {
    // She pauses outside and takes it all in; then the walk is the visitor's.
    s.step = 2
    G.action = 'look'
    G.actionT = 0
    audio.look()
  }
  if (s.step === 2 && (G.actionT += dt / LOOK_SECONDS) >= 1) {
    G.action = 'none'
    useUI.getState().set({ phase: 'maze' })
  }
}

function runMaze(s: Seq, world: World, dt: number) {
  const ui = useUI.getState()
  const inside = G.pos.z < MAZE_TOP - 0.5 && Math.abs(G.pos.x - world.exit.x) < 14
  if (inside && !s.sealed) {
    // Once in, the way on is the way out.
    s.sealed = true
    world.grid.fill(127, G0, MAZE_TOP, 129, G0 + 3, MAZE_TOP, B.BARRIER)
  }

  // "Solve the maze" shows from the garden gate until she enters, or wanders off elsewhere.
  if (!s.crossed && G.pos.z < GARDEN_GATE_Z) {
    s.crossed = true
    ui.set({ mazeBanner: true })
  }
  if (ui.mazeBanner && (s.sealed || (s.bannerT += dt) > 5)) ui.set({ mazeBanner: false })

  if (!s.quacked && pondField(G.pos.x, G.pos.z) < 1.8) {
    s.quacked = true
    audio.quack()
  }

  const moving = Math.hypot(G.input.x, G.input.z) > 0.05
  if (moving) {
    G.route = []
    G.scrollWalk = 0
    G.script = null
  }
  // Scrolling takes her into the maze and through it, as far as the scroll carries.
  if (G.scrollWalk > 0 && !G.route.length) {
    const goal = s.sealed
      ? (_x: number, _y: number, z: number) => z < world.exit.z - 1
      : (x: number, _y: number, z: number) => x >= 127 && x <= 129 && z <= MAZE_TOP - 2
    G.route = walkPath(world.grid, here(), goal) ?? []
  }
  if (G.route.length) {
    const [x, z] = G.route[0]
    if (walkTo(x, z, WALK_SPEED) || Math.hypot(x - G.pos.x, z - G.pos.z) < 0.7) G.route.shift()
    if (!G.route.length) G.script = null
  } else if (!moving) G.script = null
  if (G.scrollWalk > 0) {
    G.scrollWalk = Math.max(0, G.scrollWalk - WALK_SPEED * dt)
    if (G.scrollWalk === 0) {
      G.route = []
      G.script = null
    }
  }
  // However she got here, through the maze or round it, the page carries on from the same spot.
  if (G.pos.z < world.exit.z - 0.5) {
    G.route = []
    G.scrollWalk = 0
    ui.set({ phase: 'ending', mazeBanner: false })
  }
}

function runEnding(s: Seq, dt: number, world: World) {
  const ui = useUI.getState()
  if (s.stage === 0 && walkTo(world.exit.x, 191.5, 4.4)) s.stage = 1
  if (s.stage === 1 && walkTo(BENCH.x + 1.5, BENCH.z + 0.4, 3)) {
    s.stage = 2
    s.t = 0
    G.action = 'celebrate'
    G.actionT = 0
    G.facing = Math.PI
    G.celebrateBurst = 1
    audio.fanfare()
    ui.set({ found: true })
  }
  if (s.stage === 2 && (s.t += dt) > 1.6) {
    s.stage = 3
    G.action = 'sit'
    G.facing = Math.PI
    G.speed = 0
    G.view.set(BENCH.x + 1.5, G0, BENCH.z + 0.3)
    s.t = 0
  }
  if (s.stage === 3 && (s.t += dt) > 1.3) {
    G.pageGoal = Math.min(PAGE_TOP, 176)
    ui.set({ phase: 'portfolio', found: false })
  }
}
