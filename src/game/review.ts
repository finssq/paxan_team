import type { Chapter, ReviewChecks, Ticket } from "../types/game"

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

export function serializeReview(ticket: Ticket, state: ReviewState) {
  return JSON.stringify({
    version: 1,
    ticketId: ticket.id,
    step: state.step,
    evidenceId: state.evidenceId ?? null,
    patchId: state.patchId ?? null,
    tested: Boolean(state.checks),
  })
}

export function restoreReview(ticket: Ticket, saved: string | null): ReviewState {
  if (!saved) return initialReview
  try {
    const snapshot: unknown = JSON.parse(saved)
    if (!snapshot || typeof snapshot !== "object" ||
      !("version" in snapshot) || snapshot.version !== 1 ||
      !("ticketId" in snapshot) || snapshot.ticketId !== ticket.id ||
      !("step" in snapshot) || typeof snapshot.step !== "string" ||
      !("evidenceId" in snapshot) || (snapshot.evidenceId !== null && typeof snapshot.evidenceId !== "string") ||
      !("patchId" in snapshot) || (snapshot.patchId !== null && typeof snapshot.patchId !== "string") ||
      !("tested" in snapshot) || typeof snapshot.tested !== "boolean"
    ) return initialReview

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
      Boolean(state.checks) === snapshot.tested ? state : initialReview
  } catch {
    return initialReview
  }
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
