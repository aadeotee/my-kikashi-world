import { useEffect, useRef } from 'react'
import { portfolio, Item } from '../content/portfolio'
import { audio } from '../game/audio'
import { B } from '../game/blocks'
import { D, G0, GATE_X, GATE_Z, W } from '../game/constants'
import { P } from '../game/palette'
import { teleport } from '../game/player'
import { G, Panel, useUI } from '../game/state'

const TITLES: Record<Panel, { title: string; kicker: string }> = {
  about: { title: portfolio.about.title, kicker: 'Pinned to the noticeboard' },
  works: { title: 'Selected Works', kicker: 'Hanging in the gallery' },
  projects: { title: 'Projects', kicker: 'On the workbench' },
  experiments: { title: 'Creative Experiments', kicker: 'From the bookshelf' },
  play: { title: 'Play & Explore', kicker: 'Unrolled on the map table' },
  resume: { title: 'Resume', kicker: 'In the frame' },
  contact: { title: 'Contact', kicker: 'In the letterbox' },
}

function Cards({ items, swatch }: { items: Item[]; swatch?: boolean }) {
  return (
    <ul className={swatch ? 'cards cards-grid' : 'cards'}>
      {items.map((it) => (
        <li key={it.title}>
          {swatch && (
            <div className="swatch" style={{ background: it.tint ?? P.sage }}>
              {it.image && <img src={it.image} alt="" loading="lazy" />}
            </div>
          )}
          <h3>{it.link ? <a href={it.link} target={it.link === '#' ? undefined : '_blank'} rel="noreferrer">{it.title}</a> : it.title}</h3>
          {it.meta && <p className="meta">{it.meta}</p>}
          <p>{it.body}</p>
        </li>
      ))}
    </ul>
  )
}

const PLACES: { label: string; x: number; z: number; y: number; yaw: number }[] = [
  { label: 'Cottage', x: 128, z: 247, y: G0, yaw: 0.5 },
  { label: 'Duck pond', x: 100, z: 232, y: G0, yaw: 1.2 },
  { label: 'Paddy fields', x: 148, z: 218, y: G0, yaw: -1.2 },
  { label: 'Cottage gate', x: GATE_X, z: GATE_Z + 8, y: G0, yaw: 0 },
  { label: 'Maze entrance', x: 128.5, z: 150, y: G0, yaw: 0 },
  { label: 'Clearing', x: 128, z: 47, y: G0, yaw: 0 },
]

/** The map is painted straight from the voxel world, so it's always accurate. */
function WorldMap({ onTravel }: { onTravel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const world = G.world
    const canvas = ref.current
    if (!world || !canvas) return
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(W, D)
    const g = world.grid
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const tone: Record<number, number[]> = {
      [B.HEDGE]: hex(P.forest), [B.HEDGE_BLOOM]: hex(P.forest), [B.COBBLE]: hex(P.stoneLight), [B.GRAVEL]: hex(P.gravel),
      [B.DIRT_PATH]: hex(P.gravel), [B.ROOF]: hex(P.terracotta), [B.ROOF_LIGHT]: hex(P.terracotta), [B.PLANK]: hex(P.plank),
      [B.LEAF_GOLD]: hex(P.butter), [B.SAND]: hex(P.sand), [B.MUD]: hex(P.earth), [B.STONE]: hex(P.stone),
    }
    const leaf = hex(P.mossDeep)
    const grass = hex(P.sageLight)
    const out = hex('#dcd6bd')
    const water = hex(P.water)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const c = g.col(x, z)
        let px = g.blocked[c] ? out : grass
        if (g.water[c]) px = water
        else {
          const top = g.topAt(x, z)
          const b = g.get(x, top - 1, z)
          if (b >= B.LEAF_OAK && b <= B.LEAF_PINE && b !== B.LEAF_GOLD) px = g.blocked[c] ? out : leaf
          else if (tone[b]) px = tone[b]
        }
        const i = c * 4
        img.data[i] = px[0]
        img.data[i + 1] = px[1]
        img.data[i + 2] = px[2]
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    ctx.fillStyle = P.terracotta
    ctx.fillRect(G.pos.x - 3, G.pos.z - 3, 6, 6)
  }, [])

  const travel = (p: (typeof PLACES)[number]) => {
    teleport(p.x, p.y + 1, p.z)
    G.yaw = p.yaw
    useUI.getState().set({ panel: null, zone: p.z < 60 ? 'clearing' : 'cottage' })
    audio.chime()
    onTravel()
  }

  return (
    <div className="map">
      <canvas ref={ref} width={W} height={D} aria-label="Map of the little world" />
      <div>
        <p>The whole world is open now. Pick a spot and she'll be there.</p>
        <div className="map-places">
          {PLACES.map((p) => (
            <button key={p.label} onClick={() => travel(p)}>{p.label}</button>
          ))}
        </div>
        <Cards items={portfolio.explore} />
      </div>
    </div>
  )
}

export function PanelBody({ panel }: { panel: Panel }) {
  const r = portfolio.resume
  switch (panel) {
    case 'about':
      return (
        <>
          {portfolio.about.paragraphs.map((p) => <p key={p}>{p}</p>)}
          <dl className="facts">
            {portfolio.about.facts.map((f) => (
              <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
            ))}
          </dl>
        </>
      )
    case 'works':
      return <Cards items={portfolio.works} swatch />
    case 'projects':
      return <Cards items={portfolio.projects} />
    case 'experiments':
      return <Cards items={portfolio.experiments} swatch />
    case 'play':
      return <WorldMap onTravel={() => undefined} />
    case 'resume':
      return (
        <>
          <p>{r.summary}</p>
          <h3>Experience</h3>
          <ul className="timeline">
            {r.experience.map((e) => <li key={e.role}><b>{e.role}</b><span>{e.place}</span><em>{e.years}</em></li>)}
          </ul>
          <h3>Education</h3>
          <ul className="timeline">
            {r.education.map((e) => <li key={e.role}><b>{e.role}</b><span>{e.place}</span><em>{e.years}</em></li>)}
          </ul>
          <h3>Skills</h3>
          <p className="tags">{r.skills.map((s) => <span key={s}>{s}</span>)}</p>
          {r.file && <p><a className="link-button" href={r.file} download>Download PDF</a></p>}
        </>
      )
    case 'contact':
      return (
        <>
          <p>{portfolio.contact.note}</p>
          <ul className="timeline">
            {portfolio.contact.links.map((l) => (
              <li key={l.label}><b>{l.label}</b><a href={l.href}>{l.text}</a></li>
            ))}
          </ul>
        </>
      )
  }
}

export function PanelView({ panel }: { panel: Panel }) {
  const set = useUI((s) => s.set)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => close.current?.focus(), [panel])
  const t = TITLES[panel]
  return (
    <div className="panel-scrim" onPointerDown={(e) => e.target === e.currentTarget && set({ panel: null })}>
      <article className="panel" role="dialog" aria-modal="true" aria-label={t.title}>
        <header>
          <p className="kicker">{t.kicker}</p>
          <h2>{t.title}</h2>
          <button ref={close} className="panel-close" onClick={() => set({ panel: null })} aria-label="Close">×</button>
        </header>
        <div className="panel-body"><PanelBody panel={panel} /></div>
      </article>
    </div>
  )
}
