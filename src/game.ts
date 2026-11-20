import { saveSchema } from "./types/game.ts"
import type { Chapter, CheckMessages, Checks, GameState, RepairOutcome, Update } from "./types/game.ts"

export type GameAction =
  | { type: "start" }
  | { type: "check" }
  | { type: "mark"; id: string }
  | { type: "repair"; id: string }
  | { type: "retest" }
  | { type: "stamp" }

export const saveKey = "cyber-garden:review:v1"

export function startGame(chapter: Chapter): GameState {
  const first = chapter.updates[0]
  if (!first) throw new Error("A chapter needs an update")
  return {
    version: 1,
    chapterId: chapter.id,
    updateId: first.id,
    step: "explore",
    lineId: null,
    repairId: null,
    testedRepairId: null,
    failedRetests: 0,
  }
}

function initialOutcome(update: Update): RepairOutcome {
  return update.repair.kind === "none" ? "fixed" : "still_vulnerable"
}

function describeChecks(outcome: RepairOutcome, messages: CheckMessages): Checks {
  return {
    security: { passed: outcome !== "still_vulnerable", message: messages.security },
    feature: { passed: outcome !== "breaks_feature", message: messages.feature },
  }
}

export function visibleChecks(update: Update, state: GameState): Checks | null {
  if (state.step === "explore") return null
  const tested = update.repair.options.find(option => option.id === state.testedRepairId)
  return tested ? describeChecks(tested.outcome, tested.checks) : describeChecks(initialOutcome(update), update.sandbox.initial)
}

export function reduceGame(chapter: Chapter, state: GameState | null, action: GameAction): GameState | null {
  if (action.type === "start") return startGame(chapter)
  if (!state) return state
  const index = chapter.updates.findIndex(update => update.id === state.updateId)
  const update = chapter.updates[index]
  if (!update) return state

  switch (action.type) {
    case "check":
      return state.step === "explore" ? { ...state, step: initialOutcome(update) === "fixed" ? "stamp" : "locate" } : state
    case "mark": {
      const line = update.code.find(item => item.id === action.id)
      if (state.step !== "locate" || !line) return state
      return { ...state, lineId: line.id, step: line.isVulnerable ? "patch" : "locate" }
    }
    case "repair":
      if (!["patch", "retest"].includes(state.step) || !update.repair.options.some(option => option.id === action.id)) return state
      return { ...state, repairId: action.id, step: "retest" }
    case "retest": {
      const repair = update.repair.options.find(option => option.id === state.repairId)
      if (state.step !== "retest" || !repair) return state
      const approved = repair.outcome === "fixed"
      return {
        ...state,
        testedRepairId: repair.id,
        step: approved ? "stamp" : "patch",
        failedRetests: state.failedRetests + Number(!approved),
      }
    }
    case "stamp": {
      if (state.step !== "stamp") return state
      const next = chapter.updates[index + 1]
      return next
        ? { ...state, updateId: next.id, step: "explore", lineId: null, repairId: null, testedRepairId: null }
        : { ...state, step: "complete" }
    }
  }
}

export function readSnapshot(chapter: Chapter, value: unknown): GameState | null {
  const result = saveSchema.safeParse(value)
  if (!result.success || result.data.chapterId !== chapter.id) return null
  const state = result.data
  const update = chapter.updates.find(item => item.id === state.updateId)
  if (!update) return null
  const line = update.code.find(item => item.id === state.lineId)
  const repair = update.repair.options.find(item => item.id === state.repairId)
  const tested = update.repair.options.find(item => item.id === state.testedRepairId)
  if (state.lineId && !line || state.repairId && !repair || state.testedRepairId && !tested) return null
  if (state.step === "explore") return !line && !repair && !tested ? state : null
  if (state.step === "locate") return initialOutcome(update) !== "fixed" && !line?.isVulnerable && !repair && !tested ? state : null
  if (state.step === "patch") return line?.isVulnerable && (!repair && !tested || tested && tested.id === repair?.id && tested.outcome !== "fixed") ? state : null
  if (state.step === "retest") return line?.isVulnerable && repair && tested?.outcome !== "fixed" ? state : null

  const approved = initialOutcome(update) === "fixed"
    ? !line && !repair && !tested
    : line?.isVulnerable && tested?.outcome === "fixed" && tested.id === repair?.id
  if (!approved) return null
  return state.step === "stamp" || chapter.updates.at(-1)?.id === update.id ? state : null
}
