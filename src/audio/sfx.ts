const effects = {
  click: [[470, 0, .045, .025]],
  message: [[550, 0, .12, .035], [740, .07, .15, .03]],
  warning: [[240, 0, .16, .045], [178, .11, .19, .04]],
  patch: [[330, 0, .06, .045], [510, .025, .07, .04]],
  success: [[392, 0, .24, .033], [494, .035, .24, .03], [587, .075, .24, .025]],
  stamp: [[96, 0, .19, .09], [142, .009, .07, .035]],
} as const

export function createSfx() {
  let context: AudioContext | undefined

  return {
    unlock() {
      try {
        context ??= new AudioContext()
        if (context.state === "suspended") void context.resume().catch(() => {})
      } catch {
        return
      }
    },
    play(effect: keyof typeof effects) {
      const audio = context
      if (!audio || audio.state !== "running") return
      try {
        for (const [frequency, delay, length, peak] of effects[effect]) {
          const start = audio.currentTime + delay
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = effect === "stamp" ? "triangle" : "sine"
          oscillator.frequency.value = frequency
          gain.gain.setValueAtTime(.001, start)
          gain.gain.exponentialRampToValueAtTime(peak, start + .01)
          gain.gain.exponentialRampToValueAtTime(.001, start + length)
          oscillator.connect(gain).connect(audio.destination)
          oscillator.start(start)
          oscillator.stop(start + length)
        }
      } catch {
        return
      }
    },
    close() {
      if (context && context.state !== "closed") void context.close().catch(() => {})
      context = undefined
    },
  }
}
