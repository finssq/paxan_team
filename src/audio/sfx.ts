import type { Rank } from "../redteam/difficulty"

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
  playPacketSniff1: [[390, 0, .08, .045, 670, "triangle"], [860, .04, .11, .027]],
  playPacketSniff2: [[490, 0, .08, .045, 840, "triangle"], [1080, .04, .11, .027]],
  playPacketSniff3: [[640, 0, .08, .045, 1060, "triangle"], [1370, .04, .13, .028]],
  playUsbCopy: [[395, 0, .06, .036, 540, "triangle"], [720, .035, .065, .027], [965, .07, .13, .035]],
  playOsintChip: [[415, 0, .044, .044, 175, "triangle"], [980, .025, .06, .019]],
  playHackSuccess: [[523, 0, .21, .05, undefined, "triangle"], [659, .065, .22, .045], [784, .13, .31, .042]],
  playEmpBlast: [[150, 0, .35, .09, 38, "triangle"], [635, .012, .16, .033, 105, "sawtooth"], [1270, .028, .065, .021, 480, "square"]],
  playGateUnlock: [[920, 0, .25, .039, 128, "triangle"], [510, .12, .16, .029], [765, .21, .28, .031]],
  playAlertTick: [[280, 0, .075, .04, 260, "triangle"], [490, .014, .06, .021]],
  playHackTick: [[510, 0, .065, .034, 315, "triangle"]],
  playMissionVictory: [[262, 0, .41, .04], [392, .09, .48, .036], [523, .18, .48, .036], [659, .27, .50, .035], [784, .36, .58, .045], [1047, .41, .56, .026]],
  rankRevealChord: [[108, 0, .16, .084, 44, "triangle"], [523, .05, .31, .045, undefined, "triangle"], [659, .07, .35, .035], [784, .085, .39, .036], [1047, .135, .38, .024]],
  rankRevealPulse: [[107, 0, .15, .081, 42, "triangle"], [290, .065, .115, .044, 230, "triangle"], [505, .13, .12, .038, 435, "triangle"], [748, .20, .14, .021]],
  officeHackError: [[176, 0, .13, .043, 100, "triangle"], [130, .08, .13, .024]],
  playPhonePop: [[490, 0, .072, .032, 820, "triangle"], [1100, .045, .14, .024, 860]],
  playItemPickup: [[587, 0, .09, .051, 740, "triangle"], [880, .045, .13, .044], [1319, .085, .24, .037], [1760, .11, .18, .017]],
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
        if (context.state !== "running" && context.state !== "closed" && !resuming) {
          const pending = context.resume()
          resuming = pending
          const settled = () => { if (resuming === pending) resuming = undefined }
          void pending.then(settled, settled)
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
    playRankReveal(rank: Rank) {
      play(rank === "S" || rank === "A" ? "rankRevealChord" : "rankRevealPulse")
    },
    close() {
      if (context && context.state !== "closed") void context.close().catch(() => {})
      context = undefined
      output = undefined
      resuming = undefined
    },
  }
}
