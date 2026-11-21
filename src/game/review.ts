import type { Chapter, ReviewChecks, Ticket } from "../types/game"
import { readFeedback } from "./feedback.ts"
import type { Feedback } from "./feedback.ts"

export type ReviewStep = "explore" | "locate" | "patch" | "retest" | "stamp" | "released"

export type ReviewState = {
  step: ReviewStep
  evidenceId?: string
  patchId?: string
  checks?: ReviewChecks
}

export type ReviewAction =
  | { type: "check" | "retest" | "release" | "restart" }
  | { type: "mark"; lineId: string }
  | { type: "selectPatch"; patchId: string }

export const initialReview: ReviewState = { step: "explore" }

const saveKey = "worklab.review.v1"
const legacyFeedbackKey = "worklab.feedback.v1"

export function serializeReview(ticket: Ticket, state: ReviewState, feedback?: Feedback) {
  return JSON.stringify({
    version: 1,
    ticketId: ticket.id,
    step: state.step,
    evidenceId: state.evidenceId ?? null,
    patchId: state.patchId ?? null,
    tested: Boolean(state.checks),
    feedback: feedback && { ...feedback, version: 1, task: ticket.id },
  })
}

export function restoreReview(ticket: Ticket, saved: string | null): ReviewState {
  try {
    return decodeReview(ticket, JSON.parse(saved ?? "null")) ?? initialReview
  } catch {
    return initialReview
  }
}

function decodeReview(ticket: Ticket, snapshot: unknown): ReviewState | null {
  if (!snapshot || typeof snapshot !== "object" ||
    !("version" in snapshot) || snapshot.version !== 1 ||
    !("ticketId" in snapshot) || snapshot.ticketId !== ticket.id ||
    !("step" in snapshot) || typeof snapshot.step !== "string" ||
    !("evidenceId" in snapshot) || (snapshot.evidenceId !== null && typeof snapshot.evidenceId !== "string") ||
    !("patchId" in snapshot) || (snapshot.patchId !== null && typeof snapshot.patchId !== "string") ||
    !("tested" in snapshot) || typeof snapshot.tested !== "boolean"
  ) return null

  let state = initialReview
  if (snapshot.step !== "explore") state = review(ticket, state, { type: "check" })
  if (snapshot.evidenceId !== null) state = review(ticket, state, { type: "mark", lineId: snapshot.evidenceId })
  if (snapshot.patchId !== null) {
    state = review(ticket, state, { type: "selectPatch", patchId: snapshot.patchId })
    if (snapshot.tested) state = review(ticket, state, { type: "retest" })
  }
  if (snapshot.step === "released") state = review(ticket, state, { type: "release" })
  return state.step === snapshot.step &&
    (state.evidenceId ?? null) === snapshot.evidenceId &&
    (state.patchId ?? null) === snapshot.patchId &&
    Boolean(state.checks) === snapshot.tested ? state : null
}

export function readShift(chapter: Chapter, training?: Ticket, previousFirstTasks: readonly string[] = []) {
  try {
    const raw = localStorage.getItem(saveKey)
    const snapshot = JSON.parse(raw ?? "null")
    const firstTask = chapter.tickets[0]
    if (firstTask && snapshot?.version === 1 && previousFirstTasks.includes(snapshot.ticketId)) {
      const feedback = readFeedback(JSON.stringify(snapshot.feedback), [], firstTask.id, false)
      return { ticket: firstTask, state: initialReview, feedback: { ...feedback, wave: undefined } }
    }
    const ticket = training && training.id === snapshot?.ticketId ? training : chapter.tickets.find(item => item.id === snapshot?.ticketId)
    if (!ticket) return null
    const state = decodeReview(ticket, snapshot)
    if (!state) return null
    const feedback = readFeedback(
      Object.hasOwn(snapshot, "feedback") ? JSON.stringify(snapshot.feedback) : localStorage.getItem(legacyFeedbackKey),
      chapter.tickets.map(item => item.id), ticket.id, true,
    )
    return { ticket, state, feedback }
  } catch {
    return null
  }
}

export function saveShift(ticket: Ticket, state: ReviewState, feedback: Feedback) {
  try { localStorage.setItem(saveKey, serializeReview(ticket, state, feedback)) } catch {}
}

export function clearShift() {
  try {
    localStorage.removeItem(saveKey)
    localStorage.removeItem(legacyFeedbackKey)
  } catch {}
}

function canRelease(checks: ReviewChecks | undefined) {
  return Boolean(checks?.security.ok && checks.feature.ok)
}

export function review(ticket: Ticket, state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "restart":
      return initialReview
    case "check":
      if (state.step !== "explore") return state
      return { step: canRelease(ticket.initialChecks) ? "stamp" : "locate", checks: ticket.initialChecks }
    case "mark":
      if (state.step !== "locate" || !ticket.lines.some(line => line.id === action.lineId)) return state
      return {
        ...state,
        evidenceId: action.lineId,
        step: action.lineId === ticket.evidenceLineId ? "patch" : "locate",
      }
    case "selectPatch":
      if (
        state.evidenceId !== ticket.evidenceLineId ||
        !["patch", "retest", "stamp"].includes(state.step) ||
        state.patchId === action.patchId ||
        !ticket.patches.some(patch => patch.id === action.patchId)
      ) return state
      return { step: "retest", evidenceId: state.evidenceId, patchId: action.patchId }
    case "retest": {
      if (state.step !== "retest" || state.checks) return state
      const patch = ticket.patches.find(option => option.id === state.patchId)
      if (!patch) return state
      return { ...state, step: canRelease(patch.checks) ? "stamp" : "retest", checks: patch.checks }
    }
    case "release":
      return state.step === "stamp" && canRelease(state.checks) ? { ...state, step: "released" } : state
  }
}

function uniqueIds(items: { id: string }[]) {
  return items.every(item => item.id.trim()) && new Set(items.map(item => item.id)).size === items.length
}

export function validateChapter(chapter: Chapter) {
  if (!chapter.title.trim() || !chapter.tickets.length || !uniqueIds(chapter.tickets)) {
    throw new Error("Chapter requires a title and distinct ticket IDs")
  }

  for (const ticket of chapter.tickets) {
    const clean = canRelease(ticket.initialChecks)
    const secure = ticket.patches.filter(patch => patch.checks.security.ok)
    const working = ticket.patches.filter(patch => patch.checks.feature.ok)
    const validPatches = clean
      ? ticket.evidenceLineId === null && ticket.patches.length === 0
      : ticket.lines.some(line => line.id === ticket.evidenceLineId) &&
        ticket.patches.length === 3 && secure.length === 2 && working.length === 2 &&
        ticket.patches.filter(patch => canRelease(patch.checks)).length === 1
    const validChanges = ticket.patches.every(patch =>
      patch.changes.length > 0 && uniqueIds(patch.changes) &&
      patch.changes.every(change => ticket.lines.some(line => line.id === change.id)),
    )
    if (!ticket.lines.length || !uniqueIds(ticket.lines) || !uniqueIds(ticket.patches) || !validPatches || !validChanges) {
      throw new Error(`Invalid review data for ticket "${ticket.id}"`)
    }
  }
}
