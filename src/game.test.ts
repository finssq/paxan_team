import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { chapterSchema } from "./types/game.ts"
import type { GameState } from "./types/game.ts"
import { readSnapshot, reduceGame, startGame, visibleChecks } from "./game.ts"
import type { GameAction } from "./game.ts"

const chapter = chapterSchema.parse(JSON.parse(readFileSync(new URL("./data/chapter1.json", import.meta.url), "utf8")))

function advance(state: GameState, ...actions: GameAction[]) {
  for (const action of actions) {
    const next = reduceGame(chapter, state, action)
    assert.ok(next)
    state = next
  }
  return state
}

test("a review requires evidence and both checks before stamping", () => {
  const start = startGame(chapter)
  assert.equal(advance(start, { type: "stamp" }), start)
  const locate = advance(start, { type: "check" }, { type: "mark", id: "line-1" })
  assert.equal(locate.step, "locate")
  assert.equal(advance(locate, { type: "repair", id: "vault" }), locate)

  const patch = advance(locate, { type: "mark", id: "line-4" })
  const unsafe = advance(patch, { type: "repair", id: "rename" }, { type: "retest" })
  assert.equal(unsafe.step, "patch")
  const broken = advance(unsafe, { type: "repair", id: "remove" }, { type: "retest" })
  const update = chapter.updates[0]
  assert.ok(update)
  assert.equal(visibleChecks(update, broken)?.feature.passed, false)
  assert.equal(advance(broken, { type: "stamp" }), broken)

  const ready = advance(broken, { type: "repair", id: "vault" })
  assert.deepEqual(readSnapshot(chapter, JSON.parse(JSON.stringify(ready))), ready)
  assert.equal(readSnapshot(chapter, { ...ready, step: "stamp" }), null)
  assert.equal(readSnapshot(chapter, { ...ready, updateId: "unrecognized" }), null)
  const passed = advance(ready, { type: "retest" })
  assert.equal(passed.step, "stamp")
  assert.equal(passed.failedRetests, 2)
  assert.equal(advance(passed, { type: "stamp" }).updateId, "profile")
})

test("a clean update comes straight to the stamp and finishes the chapter", () => {
  let state = startGame(chapter)
  for (const update of chapter.updates) {
    state = advance(state, { type: "check" })
    const cause = update.code.find(line => line.isVulnerable)
    const fix = update.repair.options.find(option => option.outcome === "fixed")
    if (cause && fix) {
      state = advance(state, { type: "mark", id: cause.id }, { type: "repair", id: fix.id }, { type: "retest" })
    }
    assert.equal(state.step, "stamp")
    state = advance(state, { type: "stamp" })
  }
  assert.equal(state.step, "complete")
  assert.deepEqual(readSnapshot(chapter, state), state)
})
