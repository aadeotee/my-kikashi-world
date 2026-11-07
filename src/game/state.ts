import { Vector3 } from 'three'
import { create } from 'zustand'
import type { World } from './world/generate'

export type Phase = 'loading' | 'intro' | 'maze' | 'ending' | 'portfolio'
export type Panel = 'about' | 'works' | 'projects' | 'experiments' | 'play' | 'resume' | 'contact'

interface UIState {
  phase: Phase
  progress: number
  progressLabel: string
  muted: boolean
  panel: Panel | null
  found: boolean
  mazeBanner: boolean
  set: (s: Partial<UIState>) => void
}

export const useUI = create<UIState>((set) => ({
  phase: 'loading',
  progress: 0,
  progressLabel: 'Opening the storybook',
  muted: true,
  panel: null,
  found: false,
  mazeBanner: false,
  set,
}))

export type Action = 'none' | 'look' | 'celebrate' | 'sit'

export interface Ripple {
  x: number
  z: number
  t: number
}

/** Mutable per-frame state, read directly by the simulation so nothing re-renders. */
export const G = {
  world: null as World | null,
  time: 0,
  pos: new Vector3(128, 13, 259.5),
  /** Rendered position: pos with step-ups smoothed out. */
  view: new Vector3(128, 13, 259.5),
  facing: 0,
  speed: 0,
  speedNorm: 0,
  turn: 0,
  grounded: true,
  landed: false,
  action: 'none' as Action,
  actionT: 0,
  /** Fixed: the page is always seen from the same side. */
  yaw: Math.PI,
  input: { x: 0, z: 0 },
  /** Scripted move in world space, used for every walk she takes on her own. */
  script: null as { x: number; z: number; speed: number } | null,
  /** Waypoints she is walking through, from a click or from scrolling. */
  route: [] as [number, number][],
  /** Distance scrolling has paid for along the way out of the maze. */
  scrollWalk: 0,
  /** Where the page is centred. */
  pageZ: 252,
  pageX: 128,
  pageGoal: 172,
  doorOpen: 0,
  warmth: 0,
  ripples: [] as Ripple[],
  food: [] as { x: number; z: number; y: number; id: number }[],
  celebrateBurst: 0,
  /** Where a mouse is, in page pixels; null for touch or before it has moved. */
  mouse: null as { x: number; y: number } | null,
  /** The golden tree: t runs from full canopy (0) to bare (1). */
  tree: { t: 0, mode: 'idle' as 'idle' | 'fall' | 'grow', armed: true, opened: false, request: false },
}

export function addRipple(x: number, z: number) {
  G.ripples.push({ x, z, t: G.time })
  if (G.ripples.length > 12) G.ripples.shift()
}
