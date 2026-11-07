import { PanelBody } from './Panels'
import type { Panel } from '../game/state'
import { portfolio } from '../content/portfolio'

const ORDER: [Panel, string][] = [
  ['about', 'About Me'],
  ['works', 'Selected Works'],
  ['projects', 'Projects'],
  ['experiments', 'Creative Experiments'],
  ['resume', 'Resume'],
  ['contact', 'Contact'],
]

export function Plain() {
  return (
    <main className="plain">
      <h1>{portfolio.name}</h1>
      <p className="plain-note">This browser can't draw the little world, so here is everything in it.</p>
      {ORDER.map(([id, title]) => (
        <section key={id}>
          <h2>{title}</h2>
          <PanelBody panel={id} />
        </section>
      ))}
    </main>
  )
}
