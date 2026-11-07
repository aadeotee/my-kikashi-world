import { G, useUI } from './state'

const keys = new Set<string>()
const stick = { x: 0, z: 0 }

export function setStick(x: number, z: number) {
  stick.x = x
  stick.z = z
}

/** Folds keyboard and touch into G.input each frame. */
export function readInput() {
  let x = 0
  let z = 0
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1
  const len = Math.hypot(x, z)
  if (len > 1) {
    x /= len
    z /= len
  }
  G.input.x = x + stick.x
  G.input.z = z + stick.z
  G.input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.x, stick.z) > 0.92
}

export function attachInput(canvasHost: HTMLElement) {
  const down = (e: KeyboardEvent) => {
    if (e.repeat) {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
      return
    }
    const ui = useUI.getState()
    if (e.code === 'Escape') {
      if (ui.panel) ui.set({ panel: null })
      else if (ui.phase === 'play' || ui.phase === 'portfolio') ui.set({ paused: !ui.paused })
      return
    }
    if (e.code === 'KeyM') {
      ui.set({ muted: !ui.muted })
      return
    }
    if (ui.panel && e.code === 'KeyE') {
      ui.set({ panel: null })
      return
    }
    if (e.code === 'KeyE') G.input.interact = true
    if (e.code === 'Space') {
      G.input.jump = true
      e.preventDefault()
    }
    if (e.code.startsWith('Arrow')) e.preventDefault()
    keys.add(e.code)
  }
  const up = (e: KeyboardEvent) => keys.delete(e.code)
  const blur = () => keys.clear()

  // Drag anywhere on the world to look around; wheel to step closer or further.
  let drag: { id: number; x: number; y: number } | null = null
  const pdown = (e: PointerEvent) => {
    if (drag) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }
  const pmove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const k = e.pointerType === 'touch' ? 0.0075 : 0.0052
    G.yaw -= (e.clientX - drag.x) * k
    G.pitchOffset = Math.max(-0.5, Math.min(0.42, G.pitchOffset + (e.clientY - drag.y) * k * 0.7))
    drag.x = e.clientX
    drag.y = e.clientY
  }
  const pup = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.id) drag = null
  }
  const wheel = (e: WheelEvent) => {
    G.zoom = Math.max(0.65, Math.min(1.5, G.zoom + e.deltaY * 0.0008))
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  canvasHost.addEventListener('pointerdown', pdown)
  window.addEventListener('pointermove', pmove)
  window.addEventListener('pointerup', pup)
  window.addEventListener('pointercancel', pup)
  canvasHost.addEventListener('wheel', wheel, { passive: true })
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    canvasHost.removeEventListener('pointerdown', pdown)
    window.removeEventListener('pointermove', pmove)
    window.removeEventListener('pointerup', pup)
    window.removeEventListener('pointercancel', pup)
    canvasHost.removeEventListener('wheel', wheel)
  }
}
