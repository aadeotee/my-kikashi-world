import { PAGE_BOTTOM, PAGE_TOP } from './constants'
import { G, useUI } from './state'

const keys = new Set<string>()

export function readInput() {
  let x = 0
  let z = 0
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1
  const len = Math.hypot(x, z) || 1
  G.input.x = x / len
  G.input.z = z / len
}

const clampPage = (z: number) => Math.min(PAGE_TOP, Math.max(PAGE_BOTTOM, z))

/** Scrolling is the page's own gesture: in the maze it walks her onward, afterwards it moves the page. */
function scroll(pixels: number) {
  const phase = useUI.getState().phase
  if (phase === 'maze' && pixels > 0) G.scrollWalk = Math.min(10, G.scrollWalk + pixels * 0.03)
  if (phase === 'portfolio') G.pageGoal = clampPage(G.pageGoal - pixels * 0.05)
}

export function attachInput(host: HTMLElement, onTap: (x: number, y: number) => void) {
  const down = (e: KeyboardEvent) => {
    const ui = useUI.getState()
    if (e.code === 'Escape' && ui.panel) ui.set({ panel: null })
    if (e.code === 'KeyM' && !e.repeat) ui.set({ muted: !ui.muted })
    if (ui.panel) return
    if (e.code.startsWith('Arrow')) e.preventDefault()
    if (ui.phase === 'portfolio') {
      if (e.code === 'ArrowDown') G.pageGoal = clampPage(G.pageGoal - 10)
      if (e.code === 'ArrowUp') G.pageGoal = clampPage(G.pageGoal + 10)
      return
    }
    keys.add(e.code)
  }
  const up = (e: KeyboardEvent) => keys.delete(e.code)
  const blur = () => keys.clear()
  const wheel = (e: WheelEvent) => {
    if (!useUI.getState().panel) scroll(e.deltaY)
  }

  // A touch that barely moves is a tap; one that drags is a scroll.
  let drag: { id: number; x: number; y: number; moved: number } | null = null
  const pdown = (e: PointerEvent) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
  }
  const pmove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') G.mouse = { x: e.clientX, y: e.clientY }
    if (!drag || e.pointerId !== drag.id) return
    const dy = e.clientY - drag.y
    drag.moved += Math.abs(dy) + Math.abs(e.clientX - drag.x)
    drag.x = e.clientX
    drag.y = e.clientY
    if (e.pointerType === 'touch') scroll(-dy * 2.2)
  }
  const pup = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id && drag.moved < 10) onTap(e.clientX, e.clientY)
    drag = null
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  host.addEventListener('wheel', wheel, { passive: true })
  host.addEventListener('pointerdown', pdown)
  window.addEventListener('pointermove', pmove)
  window.addEventListener('pointerup', pup)
  window.addEventListener('pointercancel', pup)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    host.removeEventListener('wheel', wheel)
    host.removeEventListener('pointerdown', pdown)
    window.removeEventListener('pointermove', pmove)
    window.removeEventListener('pointerup', pup)
    window.removeEventListener('pointercancel', pup)
  }
}
