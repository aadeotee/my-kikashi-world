export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647 - 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

export function valueNoise(x: number, z: number, seed = 0) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(z - zi)
  const a = hash3(xi, seed, zi)
  const b = hash3(xi + 1, seed, zi)
  const c = hash3(xi, seed, zi + 1)
  const d = hash3(xi + 1, seed, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function fbm(x: number, z: number, seed = 0, octaves = 3) {
  let amp = 0.5
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, z, seed + i * 17) * amp
    norm += amp
    amp *= 0.5
    x *= 2.03
    z *= 2.03
  }
  return sum / norm
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Frame-rate independent damping factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)
export function angleDelta(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
