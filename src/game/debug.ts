import { G, useUI } from './state'
import type { World } from './world/generate'

/** Dev-only console access. */
export function installDebug(world: World) {
  if (!import.meta.env.DEV) return
  ;(window as unknown as { __game: unknown }).__game = { G, world, ui: useUI }
}
