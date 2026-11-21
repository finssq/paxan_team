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
  officeScan: [[440, 0, .1, .033, 660, "triangle"], [990, .075, .19, .027]],
  officeEmp: [[122, 0, .32, .066, 38, "triangle"], [635, .012, .16, .029, 105, "sawtooth"]],
  officeGate: [[170, 0, .18, .033, 90, "triangle"], [510, .11, .16, .023], [765, .17, .24, .027]],
  officeAlert: [[235, 0, .09, .035, 185, "triangle"]],
  officeWin: [[262, 0, .37, .041], [392, .09, .45, .038], [494, .18, .43, .032], [784, .32, .58, .028]],
  officeRotate: [[470, 0, .05, .032, 230, "triangle"]],
  officeNote1: [[392, 0, .22, .04, undefined, "triangle"]],
  officeNote2: [[440, 0, .22, .04, undefined, "triangle"]],
  officeNote3: [[523, 0, .22, .04, undefined, "triangle"]],
  officeNote4: [[587, 0, .22, .04, undefined, "triangle"]],
  officeNote5: [[659, 0, .22, .04, undefined, "triangle"]],
  officeFrequency: [[640, 0, .065, .039, 920], [1220, .043, .11, .025]],
  officeHackError: [[176, 0, .13, .043, 100, "triangle"], [130, .08, .13, .024]],
  officeMessage: [[740, 0, .08, .022], [988, .05, .14, .024]],
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
