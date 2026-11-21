type Tone = readonly [frequency: number, delay: number, length: number, peak: number, end?: number, shape?: OscillatorType]

const effects = {
  uiClick: [[580, 0, .035, .022, 250, "triangle"]],
  packetLaunch: [[280, 0, .15, .037, 1160], [1380, .09, .11, .014, 1540]],
  packetCatch: [[960, 0, .055, .05, 420, "triangle"], [155, .027, .12, .064, 90, "triangle"]],
  xrayScan: [[180, 0, .34, .034, 1330, "triangle"], [1720, .4, .16, .042], [860, .45, .22, .017]],
  freezeCast: [[2160, 0, .18, .035], [2880, .04, .19, .022], [1720, .08, .28, .034], [550, .07, .4, .03, 130, "triangle"]],
  chatPing: [[555, 0, .075, .03, 695], [890, .05, .11, .022]],
  fixApply: [[200, 0, .08, .046, 135, "triangle"], [820, .03, .04, .026, 400, "triangle"]],
  errorAlarm: [[285, 0, .13, .044, 225, "triangle"], [195, .13, .19, .04, 120]],
  timerTick: [[155, 0, .045, .022, 90, "triangle"]],
  comboUp: [[523, 0, .10, .029], [659, .065, .12, .029], [784, .13, .17, .025]],
  success: [[392, 0, .24, .033], [494, .035, .24, .03], [587, .075, .24, .025]],
  achievement: [[155, 0, .08, .034, 100, "triangle"], [784, .065, .18, .032], [988, .10, .23, .027], [1175, .14, .28, .024]],
  waveWin: [[96, 0, .19, .085, 60, "triangle"], [142, .009, .07, .038, 82, "triangle"], [392, 0.45, .32, .037], [494, .49, .35, .034], [587, .53, .39, .031]],
} as const satisfies Record<string, readonly Tone[]>

export function createSfx(enabled = true) {
  let context: AudioContext | undefined
  let output: GainNode | undefined
  let resuming: Promise<void> | undefined

  function play(effect: keyof typeof effects, retryOnResume = true) {
    const audio = context
    if (!enabled || !output || !audio) return
    if (audio.state !== "running") {
      const requestedAt = performance.now()
      if (retryOnResume) void resuming?.then(() => {
        if (context === audio && performance.now() - requestedAt < 350) play(effect, false)
      }).catch(() => {})
      return
    }
    try {
      for (const tone of effects[effect]) {
        const [frequency, delay, length, peak, end, shape = "sine"]: Tone = tone
        const start = audio.currentTime + delay
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = shape
        oscillator.frequency.setValueAtTime(frequency, start)
        if (end) oscillator.frequency.exponentialRampToValueAtTime(end, start + length)
        gain.gain.setValueAtTime(.001, start)
        gain.gain.exponentialRampToValueAtTime(peak, start + .01)
        gain.gain.exponentialRampToValueAtTime(.001, start + length)
        oscillator.connect(gain).connect(output)
        oscillator.start(start)
        oscillator.stop(start + length)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      }
    } catch {}
  }

  return {
    unlock() {
      try {
        if (!context) {
          const audio = new AudioContext()
          output = audio.createGain()
          output.gain.value = enabled ? 1 : 0
          output.connect(audio.destination)
          context = audio
        }
        if (context.state !== "running" && context.state !== "closed") {
          resuming = context.resume()
          void resuming.catch(() => {})
        }
      } catch {
        return
      }
    },
    setEnabled(value: boolean) {
      enabled = value
      if (output) output.gain.value = value ? 1 : 0
    },
    play,
    close() {
      if (context && context.state !== "closed") void context.close().catch(() => {})
      context = undefined
      output = undefined
      resuming = undefined
    },
  }
}
