// casino-sounds.ts — procedural Web Audio API sound effects
// No external files or API keys required.

let _ctx: AudioContext | null = null
let _master: GainNode | null = null
let _muted = false
let _tension = false

function getCtx(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      _master = _ctx.createGain()
      _master.connect(_ctx.destination)
      // Read persisted mute state
      try {
        _muted = localStorage.getItem('casinoMuted') === '1'
      } catch { /* ignore */ }
      _master.gain.value = _muted ? 0 : 1
    }
    return { ctx: _ctx, master: _master! }
  } catch {
    return null
  }
}

export function isMuted(): boolean {
  return _muted
}

export function setMuted(m: boolean): void {
  _muted = m
  try { localStorage.setItem('casinoMuted', m ? '1' : '0') } catch { /* ignore */ }
  const r = getCtx()
  if (r) r.master.gain.value = m ? 0 : 1
}

// ─── playDeal: card swish + thud ────────────────────────────────────────────
export function playDeal(): void {
  try {
    const r = getCtx()
    if (!r) return
    const { ctx, master } = r
    const now = ctx.currentTime

    // Swish: noise through bandpass sweeping 3500→700Hz
    const bufLen = Math.floor(ctx.sampleRate * 0.15)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = buf

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(3500, now)
    bp.frequency.exponentialRampToValueAtTime(700, now + 0.15)
    bp.Q.value = 1.5

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.35, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

    noiseSource.connect(bp)
    bp.connect(noiseGain)
    noiseGain.connect(master)
    noiseSource.start(now)
    noiseSource.stop(now + 0.15)

    // Thud: sine 200→50Hz starting 140ms in
    const thudOsc = ctx.createOscillator()
    thudOsc.type = 'sine'
    thudOsc.frequency.setValueAtTime(200, now + 0.14)
    thudOsc.frequency.exponentialRampToValueAtTime(50, now + 0.28)

    const thudGain = ctx.createGain()
    thudGain.gain.setValueAtTime(0.5, now + 0.14)
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    thudOsc.connect(thudGain)
    thudGain.connect(master)
    thudOsc.start(now + 0.14)
    thudOsc.stop(now + 0.28)
  } catch { /* ignore */ }
}

// ─── playChip: metallic clink ────────────────────────────────────────────────
export function playChip(): void {
  try {
    const r = getCtx()
    if (!r) return
    const { ctx, master } = r
    const now = ctx.currentTime

    // 4 sine oscillators for metallic ring
    const freqs = [950, 1320, 1900, 2700]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const g = ctx.createGain()
      g.gain.setValueAtTime(0.12, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

      osc.connect(g)
      g.connect(master)
      osc.start(now + i * 0.004)
      osc.stop(now + 0.3)
    })

    // Small noise pop for attack texture
    const popLen = Math.floor(ctx.sampleRate * 0.01)
    const popBuf = ctx.createBuffer(1, popLen, ctx.sampleRate)
    const popData = popBuf.getChannelData(0)
    for (let i = 0; i < popLen; i++) popData[i] = (Math.random() * 2 - 1) * (1 - i / popLen)

    const popSrc = ctx.createBufferSource()
    popSrc.buffer = popBuf

    const popGain = ctx.createGain()
    popGain.gain.value = 0.25

    popSrc.connect(popGain)
    popGain.connect(master)
    popSrc.start(now)
    popSrc.stop(now + 0.01)
  } catch { /* ignore */ }
}

// ─── playWin: ascending major arpeggio + sparkles ────────────────────────────
export function playWin(): void {
  try {
    const r = getCtx()
    if (!r) return
    const { ctx, master } = r
    const now = ctx.currentTime

    // C5 E5 G5 C6 E6
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq

      const g = ctx.createGain()
      const t = now + i * 0.12
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.22, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)

      osc.connect(g)
      g.connect(master)
      osc.start(t)
      osc.stop(t + 0.4)
    })

    // 8–10 random sparkle notes from t+0.5 to t+1.0
    const sparkleCount = 8 + Math.floor(Math.random() * 3)
    for (let i = 0; i < sparkleCount; i++) {
      const sparkFreq = 2000 + Math.random() * 3000
      const sparkTime = now + 0.5 + Math.random() * 0.5

      const sparkOsc = ctx.createOscillator()
      sparkOsc.type = 'sine'
      sparkOsc.frequency.value = sparkFreq

      const sparkGain = ctx.createGain()
      sparkGain.gain.setValueAtTime(0.08, sparkTime)
      sparkGain.gain.exponentialRampToValueAtTime(0.001, sparkTime + 0.12)

      sparkOsc.connect(sparkGain)
      sparkGain.connect(master)
      sparkOsc.start(sparkTime)
      sparkOsc.stop(sparkTime + 0.12)
    }
  } catch { /* ignore */ }
}

// ─── playLose: descending wah-wah ────────────────────────────────────────────
export function playLose(): void {
  try {
    const r = getCtx()
    if (!r) return
    const { ctx, master } = r
    const now = ctx.currentTime

    const voices = [
      { freq: [280, 95], start: 0 },
      { freq: [190, 65], start: 0.38 },
    ]

    voices.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const t = now + start
      osc.frequency.setValueAtTime(freq[0], t)
      osc.frequency.exponentialRampToValueAtTime(freq[1], t + 0.55)

      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = 7
      lp.frequency.setValueAtTime(1600, t)
      lp.frequency.exponentialRampToValueAtTime(180, t + 0.55)

      const g = ctx.createGain()
      g.gain.setValueAtTime(0.3, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)

      osc.connect(lp)
      lp.connect(g)
      g.connect(master)
      osc.start(t)
      osc.stop(t + 0.6)
    })
  } catch { /* ignore */ }
}

// ─── startTension / stopTension: looping heartbeat ──────────────────────────
export function startTension(): void {
  if (_tension) return
  _tension = true
  scheduleBeat()
}

export function stopTension(): void {
  _tension = false
}

function scheduleBeat(): void {
  if (!_tension) return
  try {
    const r = getCtx()
    if (!r) return
    const { ctx, master } = r
    const now = ctx.currentTime

    // Lub: sine kick 120→40Hz at t+0
    const lub = ctx.createOscillator()
    lub.type = 'sine'
    lub.frequency.setValueAtTime(120, now)
    lub.frequency.exponentialRampToValueAtTime(40, now + 0.1)

    const lubGain = ctx.createGain()
    lubGain.gain.setValueAtTime(0.5, now)
    lubGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    lub.connect(lubGain)
    lubGain.connect(master)
    lub.start(now)
    lub.stop(now + 0.1)

    // Dub: sine kick 90→35Hz at t+80ms
    const dub = ctx.createOscillator()
    dub.type = 'sine'
    dub.frequency.setValueAtTime(90, now + 0.08)
    dub.frequency.exponentialRampToValueAtTime(35, now + 0.18)

    const dubGain = ctx.createGain()
    dubGain.gain.setValueAtTime(0.35, now + 0.08)
    dubGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

    dub.connect(dubGain)
    dubGain.connect(master)
    dub.start(now + 0.08)
    dub.stop(now + 0.18)

    // Low sawtooth drone at 55Hz through lowpass 200Hz
    const drone = ctx.createOscillator()
    drone.type = 'sawtooth'
    drone.frequency.value = 55

    const droneLp = ctx.createBiquadFilter()
    droneLp.type = 'lowpass'
    droneLp.frequency.value = 200

    const droneGain = ctx.createGain()
    const droneStart = now + 0.22
    const droneEnd = now + 0.50
    droneGain.gain.setValueAtTime(0, droneStart)
    droneGain.gain.linearRampToValueAtTime(0.18, droneStart + 0.05)
    droneGain.gain.linearRampToValueAtTime(0.18, droneEnd - 0.05)
    droneGain.gain.linearRampToValueAtTime(0, droneEnd)

    drone.connect(droneLp)
    droneLp.connect(droneGain)
    droneGain.connect(master)
    drone.start(droneStart)
    drone.stop(droneEnd)

    // Schedule next beat 50ms before it's due (beat interval = 520ms)
    setTimeout(() => {
      if (_tension) scheduleBeat()
    }, 520 - 50)
  } catch { /* ignore */ }
}
