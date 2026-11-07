import { useUI } from './state'

/** Everything is synthesised, so there are no audio files to load. */
class AudioEngine {
  ctx: AudioContext | null = null
  master!: GainNode
  sfx!: GainNode
  musicBus!: GainNode
  water!: GainNode
  wind!: GainNode
  noise!: AudioBuffer
  private nextNote = 0
  private bar = 0
  private birdAt = 0

  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = (this.ctx = new Ctx())
    this.master = ctx.createGain()
    this.master.gain.value = useUI.getState().muted ? 0 : 0.8
    const comp = ctx.createDynamicsCompressor()
    this.master.connect(comp).connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.sfx.connect(this.master)
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.5
    this.musicBus.connect(this.master)

    const len = ctx.sampleRate * 3
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.03 * w) / 1.03
      d[i] = last * 3.2 + w * 0.12
    }
    this.wind = this.loop(320, 0.1)
    this.water = this.loop(900, 0)
    this.nextNote = ctx.currentTime + 1
    useUI.subscribe((s, prev) => {
      if (s.muted !== prev.muted) this.master.gain.setTargetAtTime(s.muted ? 0 : 0.8, ctx.currentTime, 0.08)
    })
  }

  private loop(freq: number, gain: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(f).connect(g).connect(this.master)
    src.start()
    return g
  }

  /** Called every frame with the world's listening context. */
  update(pondProximity: number, time: number, zone: string) {
    const ctx = this.ctx
    if (!ctx) return
    this.water.gain.setTargetAtTime(pondProximity * 0.3, ctx.currentTime, 0.3)
    if (time > this.birdAt) {
      this.birdAt = time + 2.5 + Math.random() * 6
      this.bird(zone === 'maze' ? 0.4 : 1)
    }
    if (ctx.currentTime + 0.3 > this.nextNote) this.scheduleBar()
  }

  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType, dest: AudioNode, slideTo?: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(gain, at + Math.min(0.012, dur * 0.3))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(dest)
    o.start(at)
    o.stop(at + dur + 0.02)
  }

  private burst(at: number, dur: number, freq: number, gain: number, q = 1, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(f).connect(g).connect(this.sfx)
    src.start(at, Math.random() * 2, dur + 0.05)
  }

  // A soft music-box line over warm held fifths.
  private scheduleBar() {
    const ctx = this.ctx!
    const beat = 0.92
    const roots = [196, 164.81, 130.81, 146.83]
    const scale = [392, 440, 493.88, 587.33, 659.25, 783.99]
    const at = this.nextNote
    const root = roots[this.bar % 4]
    for (const m of [1, 1.5, 2]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = root * m
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.028, at + 1.4)
      g.gain.linearRampToValueAtTime(0, at + beat * 4 + 0.8)
      o.connect(g).connect(this.musicBus)
      o.start(at)
      o.stop(at + beat * 4 + 1)
    }
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.42) continue
      const n = scale[(Math.random() * scale.length) | 0]
      const t = at + i * beat + (Math.random() < 0.3 ? beat / 2 : 0)
      this.tone(n, t, 1.8, 0.05, 'sine', this.musicBus)
      this.tone(n * 3, t, 0.5, 0.008, 'sine', this.musicBus)
    }
    this.bar++
    this.nextNote = at + beat * 4
  }

  bird(level = 1) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const base = 2200 + Math.random() * 1800
    const n = 2 + ((Math.random() * 4) | 0)
    for (let i = 0; i < n; i++) {
      this.tone(base * (1 + Math.random() * 0.2), t + i * 0.13, 0.09, 0.022 * level, 'sine', this.sfx, base * 1.35)
    }
  }

  step(kind: string) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const v = 0.85 + Math.random() * 0.3
    if (kind === 'wood') {
      this.tone(170 * v, t, 0.07, 0.09, 'triangle', this.sfx)
      this.burst(t, 0.04, 900, 0.12)
    } else if (kind === 'stone') this.burst(t, 0.05, 1900 * v, 0.2, 2)
    else if (kind === 'gravel') this.burst(t, 0.08, 2700 * v, 0.2, 0.8)
    else if (kind === 'water') this.burst(t, 0.16, 800 * v, 0.34, 0.8)
    else this.burst(t, 0.09, 1200 * v, 0.14, 0.6)
  }

  quack() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const p = 0.9 + Math.random() * 0.3
    for (let i = 0; i < 2; i++) {
      const at = t + i * 0.16
      const o = ctx.createOscillator()
      const f = ctx.createBiquadFilter()
      const g = ctx.createGain()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(370 * p, at)
      o.frequency.exponentialRampToValueAtTime(230 * p, at + 0.12)
      f.type = 'bandpass'
      f.frequency.value = 1050
      f.Q.value = 3
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.13, at + 0.015)
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.13)
      o.connect(f).connect(g).connect(this.sfx)
      o.start(at)
      o.stop(at + 0.15)
    }
  }

  splash() {
    if (this.ctx) this.burst(this.ctx.currentTime, 0.2, 1400, 0.1, 0.9)
  }

  flap() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (let i = 0; i < 4; i++) this.burst(t + i * 0.08, 0.06, 500, 0.16, 0.7)
  }

  rustle() {
    if (this.ctx) this.burst(this.ctx.currentTime, 0.3, 2400, 0.1, 0.5)
  }

  creak() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.tone(120, t, 1.1, 0.06, 'sawtooth', this.sfx, 210)
    this.tone(180, t + 0.2, 0.9, 0.035, 'triangle', this.sfx, 140)
    this.burst(t + 1.05, 0.14, 300, 0.3, 1)
  }

  /** A curious little "hm?" as she looks around. */
  look() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.tone(520, t, 0.16, 0.05, 'sine', this.sfx, 660)
    this.tone(590, t + 0.95, 0.2, 0.05, 'sine', this.sfx, 820)
  }

  chime(up = true) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const notes = up ? [659.25, 783.99] : [783.99, 659.25]
    notes.forEach((n, i) => this.tone(n, t + i * 0.08, 0.5, 0.05, 'sine', this.sfx))
  }

  fanfare() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    ;[392, 493.88, 587.33, 783.99, 987.77, 1174.66].forEach((n, i) => {
      this.tone(n, t + i * 0.14, 1.6, 0.07, 'sine', this.sfx)
      this.tone(n / 2, t + i * 0.14, 1.4, 0.04, 'triangle', this.sfx)
    })
  }
}

export const audio = new AudioEngine()
