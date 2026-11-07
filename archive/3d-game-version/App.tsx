import { lazy, Suspense, useState } from 'react'
import { Hud } from './ui/Hud'
import { Plain } from './ui/Plain'

const Scene = lazy(() => import('./game/scene/Scene'))

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export default function App() {
  const [ok] = useState(hasWebGL)
  // Without WebGL there is no world to walk through, so the portfolio is shown directly.
  if (!ok) return <Plain />
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Hud />
    </>
  )
}
