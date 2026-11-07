import { teleport } from './player'
import { G, useUI } from './state'
import type { World } from './world/generate'
import { walkPath } from './world/walk'

/** Dev-only console helpers, including a bot that walks the maze with the real movement code. */
export function installDebug(world: World) {
  if (!import.meta.env.DEV) return
  const walker = { timer: 0 }
  const api = {
    G,
    world,
    ui: useUI,
    teleport,
    solve() {
      const from: [number, number, number] = [Math.floor(G.pos.x), Math.round(G.pos.y), Math.floor(G.pos.z)]
      const pts = (walkPath(world.grid, from, (_x, _y, z) => z < world.exit.z - 2) ?? []).filter((_, k) => k % 2 === 0)
      let i = 0
      clearInterval(walker.timer)
      walker.timer = window.setInterval(() => {
        const ui = useUI.getState()
        if (ui.phase !== 'play' || i >= pts.length) {
          clearInterval(walker.timer)
          G.script = null
          return
        }
        const [x, z] = pts[i]
        const dx = x - G.pos.x
        const dz = z - G.pos.z
        if (Math.hypot(dx, dz) < 0.9) i++
        else G.script = { x: dx, z: dz, speed: 7 }
      }, 16)
    },
  }
  ;(window as unknown as { __game: typeof api }).__game = api
}
