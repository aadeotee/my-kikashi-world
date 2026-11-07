import { audio } from '../game/audio'
import { useUI } from '../game/state'
import { portfolio } from '../content/portfolio'
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

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" shapeRendering="crispEdges"><path d={d} fill="currentColor" /></svg>
  )
}

const SOUND_ON = 'M2 6h3l4-3v10l-4-3H2zM11 5h1v6h-1zM13 3h1v10h-1z'
const SOUND_OFF = 'M2 6h3l4-3v10l-4-3H2zM11 6h1v1h1V6h1v1h-1v2h1v1h-1V9h-1v1h-1V9h1V7h-1z'

export function Hud() {
  const phase = useUI((s) => s.phase)
  const panel = useUI((s) => s.panel)
  const muted = useUI((s) => s.muted)
  const found = useUI((s) => s.found)
  const mazeBanner = useUI((s) => s.mazeBanner)
  const set = useUI((s) => s.set)

  return (
    <div className="hud">
      {phase === 'loading' && <Loading />}

      {phase === 'intro' && (
        <div className="banner" aria-live="polite">
          <div className="banner-long">
            <h1>{portfolio.welcome.title}</h1>
            <p>{portfolio.welcome.subtitle}</p>
          </div>
        </div>
      )}
      <div className="banner" aria-live="polite">
        <div className={`banner-fade ${mazeBanner ? 'show' : ''}`}><h2>{portfolio.mazePrompt}</h2></div>
      </div>

      {phase !== 'loading' && (
        <div className="corner">
          <button
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            onClick={() => {
              audio.start()
              set({ muted: !muted })
            }}
          >
            <Icon d={muted ? SOUND_OFF : SOUND_ON} />
          </button>
        </div>
      )}

      {phase === 'maze' && (
        <p className="hint">{coarse ? 'Tap anywhere to walk there, or swipe up to head through the maze' : 'Click anywhere to walk there, use the arrow keys, or scroll to head through the maze'}</p>
      )}

      {found && <div className="finale" aria-live="polite"><h2>You found your way!</h2></div>}

      {phase === 'portfolio' && !panel && <p className="hint">Pick anything, or scroll down</p>}

      {panel && <PanelView panel={panel} />}
    </div>
  )
}
