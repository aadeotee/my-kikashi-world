import { useEffect, useRef } from 'react'
import { portfolio, Item } from '../content/portfolio'
import { P } from '../game/palette'
import { Panel, useUI } from '../game/state'

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
      return <Cards items={portfolio.explore} />
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
  const t = portfolio.sections[panel]
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
