import { Vector3 } from 'three'
import { create } from 'zustand'
import type { World } from './world/generate'

export type Phase = 'loading' | 'title' | 'intro' | 'play' | 'ending' | 'portfolio'
export type Zone = 'cottage' | 'pond' | 'paddy' | 'gate' | 'garden' | 'maze' | 'clearing'
export type Panel = 'about' | 'works' | 'projects' | 'experiments' | 'play' | 'resume' | 'contact'

interface UIState {
  phase: Phase
  progress: number
  progressLabel: string
  paused: boolean
  muted: boolean
  music: boolean
  prompt: string | null
  zone: Zone
  areaTitle: string | null
  panel: Panel | null
  ending: 0 | 1 | 2
  hint: boolean
  visited: string[]
  completedBefore: boolean
  set: (s: Partial<UIState>) => void
}

const remembered = () => {
  try {
    return localStorage.getItem('little-world-complete') === '1'
  } catch {
    return false
  }
}

export const useUI = create<UIState>((set) => ({
  phase: 'loading',
  progress: 0,
  progressLabel: 'Opening the storybook',
  paused: false,
  muted: false,
  music: true,
  prompt: null,
  zone: 'cottage',
  areaTitle: null,
  panel: null,
  ending: 0,
  hint: false,
  visited: [],
  completedBefore: remembered(),
  set,
}))

export type Action = 'none' | 'feed' | 'scatter' | 'celebrate'

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
  facing: Math.PI,
  speed: 0,
  speedNorm: 0,
  turn: 0,
  grounded: true,
  wading: false,
  action: 'none' as Action,
  actionT: 0,
  /** Camera orbit. */
  yaw: 0.5,
  pitchOffset: 0,
  zoom: 1,
  /** Set by input: desired move in camera space. */
  input: { x: 0, z: 0, run: false, jump: false, interact: false },
  /** Scripted move in world space, used by the opening and ending scenes. */
  script: null as { x: number; z: number; speed: number } | null,
  gateOpen: 0,
  gateOpening: false,
  doorOpen: 0,
  warmth: 0,
  ripples: [] as Ripple[],
  food: [] as { x: number; z: number; y: number; id: number }[],
  seeds: [] as { x: number; y: number; z: number; t: number }[],
  throwFood: 0,
  throwSeed: 0,
  celebrateBurst: 0,
  compass: 0,
  landed: false,
}

export function addRipple(x: number, z: number) {
  G.ripples.push({ x, z, t: G.time })
  if (G.ripples.length > 12) G.ripples.shift()
}
