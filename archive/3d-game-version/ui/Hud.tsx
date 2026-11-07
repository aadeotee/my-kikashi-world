import { useEffect, useRef, useState } from 'react'
import { audio } from '../game/audio'
import { G0 } from '../game/constants'
import { setStick } from '../game/input'
import { teleport } from '../game/player'
import { G, useUI } from '../game/state'
import { PanelView } from './Panels'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function Loading() {
  const progress = useUI((s) => s.progress)
  const label = useUI((s) => s.progressLabel)
  return (
    <div className="veil">
      <div className="loader">
        <p>{label}</p>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function Title() {
  const set = useUI((s) => s.set)
  const begin = () => {
    audio.start()
    audio.chime()
    set({ phase: 'intro' })
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter') begin()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  return (
    <div className="title">
      <h1>A Little World<br /><em>of Her Own</em></h1>
      <p>Help her find the way through the garden.</p>
      <button className="begin" onClick={begin}>Step outside</button>
    </div>
  )
}

function objectiveFor(zone: string, phase: string, visited: number) {
  if (phase === 'portfolio') return visited >= 7 ? 'You have seen everything. Stay as long as you like.' : `Explore the clearing · ${visited} of 7 found`
  if (zone === 'maze') return 'Find the way out of the maze'
  if (zone === 'garden') return 'Enter the maze to the north'
  if (zone === 'gate') return 'Walk through the gate'
  return 'Follow the path north to the garden gate'
}

function Compass() {
  const needle = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const spin = () => {
      if (needle.current) needle.current.style.transform = `rotate(${G.compass}rad)`
      raf = requestAnimationFrame(spin)
    }
    spin()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="compass" title="Points towards the exit, not the route">
      <div ref={needle} className="needle"><i /></div>
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" shapeRendering="crispEdges"><path d={d} fill="currentColor" /></svg>
  )
}

const SOUND_ON = 'M2 6h3l4-3v10l-4-3H2zM11 5h1v6h-1zM13 3h1v10h-1z'
const SOUND_OFF = 'M2 6h3l4-3v10l-4-3H2zM11 6h1v1h1V6h1v1h-1v2h1v1h-1V9h-1v1h-1V9h1V7h-1z'
const PAUSE = 'M4 3h3v10H4zM9 3h3v10H9z'

function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const nub = useRef<HTMLDivElement>(null)
  const id = useRef<number | null>(null)
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== id.current) return
    const r = base.current!.getBoundingClientRect()
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    const l = Math.hypot(x, y)
    if (l > 1) {
      x /= l
      y /= l
    }
    setStick(x, y)
    nub.current!.style.transform = `translate(${x * 34}px, ${y * 34}px)`
  }
  const end = () => {
    id.current = null
    setStick(0, 0)
    nub.current!.style.transform = ''
  }
  return (
    <div
      ref={base}
      className="stick"
      onPointerDown={(e) => {
        id.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div ref={nub} className="nub" />
    </div>
  )
}

function Pause() {
  const set = useUI((s) => s.set)
  const music = useUI((s) => s.music)
  const done = useUI((s) => s.completedBefore)
  const phase = useUI((s) => s.phase)
  const home = () => {
    teleport(128, G0, 246)
    G.yaw = 0.5
    set({ paused: false, zone: 'cottage' })
  }
  const clearing = () => {
    teleport(128, G0, 47)
    G.yaw = 0
    set({ paused: false, zone: 'clearing', phase: 'portfolio', ending: 0 })
  }
  return (
    <div className="panel-scrim">
      <div className="pause" role="dialog" aria-modal="true" aria-label="Paused">
        <h2>Paused</h2>
        <button onClick={() => set({ paused: false })} autoFocus>Keep exploring</button>
        <button onClick={home}>Back to the cottage</button>
        {done && phase !== 'portfolio' && <button onClick={clearing}>Return to the clearing</button>}
        <button onClick={() => set({ music: !music })}>Music: {music ? 'on' : 'off'}</button>
        <dl className="keys">
          <div><dt>WASD / arrows</dt><dd>Walk, then run</dd></div>
          <div><dt>Drag</dt><dd>Look around</dd></div>
          <div><dt>E</dt><dd>Interact</dd></div>
          <div><dt>Space</dt><dd>Hop</dd></div>
          <div><dt>M</dt><dd>Mute</dd></div>
        </dl>
      </div>
    </div>
  )
}

export function Hud() {
  const phase = useUI((s) => s.phase)
  const zone = useUI((s) => s.zone)
  const prompt = useUI((s) => s.prompt)
  const area = useUI((s) => s.areaTitle)
  const panel = useUI((s) => s.panel)
  const paused = useUI((s) => s.paused)
  const muted = useUI((s) => s.muted)
  const ending = useUI((s) => s.ending)
  const hint = useUI((s) => s.hint)
  const visited = useUI((s) => s.visited.length)
  const set = useUI((s) => s.set)
  const [hintOut, setHintOut] = useState(false)

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHintOut(true), 9000)
    return () => clearTimeout(t)
  }, [hint])

  const playing = phase === 'play' || phase === 'portfolio'
  const promptText = prompt && coarse ? prompt.replace('Press E to ', '').replace(/^./, (c) => c.toUpperCase()) : prompt

  return (
    <div className="hud">
      <div className="vignette" />
      {phase === 'loading' && <Loading />}
      {phase === 'title' && <Title />}

      {playing && (
        <div className="objective">
          <span>{objectiveFor(zone, phase, visited)}</span>
          {zone === 'maze' && phase === 'play' && <Compass />}
        </div>
      )}

      {phase !== 'loading' && (
        <div className="corner">
          <button
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              audio.start()
              set({ muted: !muted })
            }}
          >
            <Icon d={muted ? SOUND_OFF : SOUND_ON} />
          </button>
          {playing && <button aria-label="Pause" onClick={() => set({ paused: true })}><Icon d={PAUSE} /></button>}
        </div>
      )}

      <div className={`area ${area ? 'show' : ''}`} aria-live="polite">{area}</div>

      {promptText && !coarse && (
        <div className="prompt">Press <kbd>E</kbd> to {prompt!.replace('Press E to ', '')}</div>
      )}

      {hint && !hintOut && phase === 'play' && !coarse && (
        <div className="hint">WASD to walk · drag to look · E to interact · Space to hop</div>
      )}

      {ending > 0 && (
        <div className="finale" aria-live="assertive">
          <h2 key={ending}>{ending === 1 ? 'You found your way!' : 'Welcome to my little world.'}</h2>
        </div>
      )}

      {coarse && playing && !panel && (
        <>
          <Joystick />
          <div className="touch-actions">
            <button className="hop" aria-label="Hop" onPointerDown={() => (G.input.jump = true)}>↑</button>
            <button
              className={`act ${prompt ? 'ready' : ''}`}
              aria-label={promptText ?? 'Interact'}
              onPointerDown={() => (G.input.interact = true)}
            >
              {promptText ?? 'E'}
            </button>
          </div>
        </>
      )}

      {panel && <PanelView panel={panel} />}
      {paused && <Pause />}
    </div>
  )
}
