import assert from "node:assert/strict"
import { test } from "node:test"
import chapter from "../src/data/chapter1.json" with { type: "json" }
import { initialReview, restoreReview, review, serializeReview, validateChapter } from "../src/game/review.ts"
import { readFeedback, recordFeedback } from "../src/game/feedback.ts"

const [ticket] = chapter.tickets
const start = () => review(ticket, initialReview, { type: "check" })
const mark = state => review(ticket, state, { type: "mark", lineId: ticket.evidenceLineId })
const select = (state, patchId) => review(ticket, state, { type: "selectPatch", patchId })
const retest = state => review(ticket, state, { type: "retest" })

test("requires a check and correct evidence before a patch", () => {
  assert.equal(select(initialReview, "server-payment"), initialReview)
  assert.equal(review(ticket, initialReview, { type: "release" }), initialReview)
  const checked = start()
  assert.equal(checked.step, "locate")
  assert.equal(checked.checks.security.ok, false)
  assert.equal(checked.checks.feature.ok, true)
  const incorrect = review(ticket, checked, { type: "mark", lineId: "form" })
  assert.equal(incorrect.step, "locate")
  assert.equal(select(incorrect, "server-payment"), incorrect)
  assert.equal(mark(incorrect).step, "patch")
})

test("failed repairs block release and a new choice requires fresh results", () => {
  let state = mark(start())
  for (const [patchId, security, feature] of [
    ["hide-widget-key", false, true],
    ["pause-payment", true, false],
  ]) {
    state = select(state, patchId)
    assert.equal(state.checks, undefined)
    state = retest(state)
    assert.equal(state.step, "retest")
    assert.equal(state.checks.security.ok, security)
    assert.equal(state.checks.feature.ok, feature)
    assert.equal(review(ticket, state, { type: "release" }), state)
    assert.equal(retest(state), state)
  }
  state = retest(select(state, "server-payment"))
  assert.equal(state.step, "stamp")
  assert.equal(review(ticket, state, { type: "release" }).step, "released")
  state = select(state, "hide-widget-key")
  assert.equal(state.step, "retest")
  assert.equal(state.checks, undefined)
  assert.equal(review(ticket, state, { type: "release" }), state)
})

test("clean checks enable release and replay restores the initial state", () => {
  const clean = {
    ...ticket,
    evidenceLineId: null,
    patches: [],
    initialChecks: { ...ticket.initialChecks, security: { ok: true, detail: "Проверка пройдена." } },
  }
  const checked = review(clean, initialReview, { type: "check" })
  assert.equal(checked.step, "stamp")
  const released = review(clean, checked, { type: "release" })
  assert.equal(released.step, "released")
  assert.deepEqual(review(clean, released, { type: "restart" }), initialReview)
})

test("chapter validation rejects unknown evidence or patch lines", () => {
  assert.doesNotThrow(() => validateChapter(chapter))
  assert.throws(() => validateChapter({ ...chapter, tickets: [{ ...ticket, evidenceLineId: "missing" }] }), /Invalid review data/)
  const invalid = structuredClone(chapter)
  invalid.tickets[0].patches[0].changes[0].id = "missing"
  assert.throws(() => validateChapter(invalid), /Invalid review data/)
})

test("saved review reconstructs each legal checkpoint and rejects forged release", () => {
  const checked = start()
  const located = mark(checked)
  const selected = select(located, "pause-payment")
  const failed = retest(selected)
  const passed = retest(select(failed, "server-payment"))
  const released = review(ticket, passed, { type: "release" })
  for (const state of [initialReview, checked, located, selected, failed, passed, released]) {
    assert.deepEqual(restoreReview(ticket, serializeReview(ticket, state)), state)
  }
  const forged = JSON.parse(serializeReview(ticket, failed))
  forged.step = "released"
  assert.deepEqual(restoreReview(ticket, JSON.stringify(forged)), initialReview)
  assert.deepEqual(restoreReview(ticket, "{"), initialReview)
  assert.deepEqual(restoreReview({ ...ticket, id: "different" }, serializeReview(ticket, passed)), initialReview)
})

test("feedback defaults don't affect the old progression and saved fields are validated", () => {
  const fields = readFeedback(null, [ticket.id], ticket.id, true)
  assert.equal(fields.sound, true)
  assert.equal(fields.tutorialDismissed, false)
  assert.deepEqual(fields.run, { security: 80, stability: 85, hint: false, flawless: true })
  const corrupt = JSON.stringify({ version: 1, task: ticket.id, sound: "yes", earned: ["precise", "precise", "unknown"],
    completed: ["other"], streak: 99, run: { security: -1, stability: 85, hint: true, flawless: true } })
  const restored = readFeedback(corrupt, [ticket.id], ticket.id, true)
  assert.equal(restored.sound, true)
  assert.equal(readFeedback(JSON.stringify({ version: 1, sound: false }), [ticket.id], ticket.id, true).sound, false)
  assert.deepEqual(restored.earned, ["precise"])
  assert.equal(restored.streak, 0)
  assert.deepEqual(restored.run, fields.run)
})

test("tutorial dismissal survives reload and defaults to off for older completed saves", () => {
  const restore = saved => readFeedback(JSON.stringify({ version: 1, ...saved }), [ticket.id], ticket.id, false)
  assert.equal(restore({ tutorialDismissed: true }).tutorialDismissed, true)
  assert.equal(restore({ tutorialDismissed: "true" }).tutorialDismissed, false)
  assert.equal(restore({ completed: [ticket.id] }).tutorialDismissed, true)
  assert.equal(restore({ completed: [ticket.id], tutorialDismissed: false }).tutorialDismissed, false)
})

test("achievements are unique, and a replay does not count as a second task", () => {
  let feedback = readFeedback(null, [ticket.id], ticket.id, false)
  const perform = (event, task = ticket.id) => {
    feedback = recordFeedback(feedback, event, task, 2, true)
  }
  perform("discovery")
  perform("discovery")
  perform("clean")
  perform("release")
  assert.deepEqual(feedback.earned, ["skeptical", "precise", "independent"])
  perform("release")
  assert.equal(feedback.streak, 1)
  perform("restart")
  perform("release", "next")
  assert.deepEqual(feedback.earned, ["skeptical", "precise", "independent", "streak", "shift"])
})

test("the mentor's hint and losing metrics affect feedback but not release rules", () => {
  const initial = readFeedback(null, [ticket.id], ticket.id, false)
  let result = recordFeedback(initial, "hint", ticket.id, 5, false)
  result = recordFeedback(result, "feature", ticket.id, 5, true)
  assert.equal(result.run.stability, 65)
  assert.equal(result.run.flawless, false)
  result = recordFeedback(result, "release", ticket.id, 5, true)
  assert.equal(result.streak, 0)
  assert.ok(!result.earned.includes("independent"))
})
