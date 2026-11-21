import assert from "node:assert/strict"
import { test } from "node:test"
import { decodeCampaign, emptyCampaign, recordRedWin } from "../src/campaignProgress.ts"
import { difficulties, resultFor } from "../src/redteam/difficulty.ts"
import { cameras } from "../src/redteam/mapData.ts"
import { createRun, stepRun } from "../src/redteam/simulation.ts"

test("campaign storage migrates a legacy record and validates both results independently", () => {
  const best = { score: 2700, rank: "A" }
  const legacy = { version: 1, blueCompleted: true, red: { difficulty: "ghost", best } }
  assert.deepEqual(decodeCampaign(JSON.stringify(legacy)), { ...legacy, red: { ...legacy.red, last: null } })

  const last = { score: 1875, rank: "C", difficulty: "ghost" }
  const saved = { version: 1, blueCompleted: true, red: {
    difficulty: "agent", bestScore: best.score, bestRank: best.rank, lastScore: last.score, lastRank: last.rank, lastDifficulty: last.difficulty,
  } }
  const decoded = { ...saved, red: { difficulty: "agent", best, last } }
  assert.deepEqual(decodeCampaign(JSON.stringify(saved)), decoded)

  for (const invalid of [
    { ...saved, version: 2 },
    { ...saved, blueCompleted: "true" },
  ]) assert.deepEqual(decodeCampaign(JSON.stringify(invalid)), emptyCampaign)
  assert.deepEqual(decodeCampaign("{"), emptyCampaign)
  for (const patch of [{ lastScore: -1 }, { lastRank: "X" }, { lastDifficulty: "hard" }]) {
    assert.deepEqual(decodeCampaign(JSON.stringify({ ...saved, red: { ...saved.red, ...patch } })), { ...decoded, red: { ...decoded.red, last: null } })
  }
  for (const patch of [{ bestScore: 1.5 }, { bestRank: "X" }]) {
    assert.deepEqual(decodeCampaign(JSON.stringify({ ...saved, red: { ...saved.red, ...patch } })), { ...decoded, red: { ...decoded.red, best: null } })
  }
})

test("best rank and score can come from different runs", () => {
  const bestScore = recordRedWin(emptyCampaign, { score: 3100, rank: "B" })
  const bestRank = recordRedWin(bestScore, { score: 2300, rank: "S" })
  const { best, last } = recordRedWin(bestRank, { score: 1900, rank: "C" }).red
  assert.deepEqual(best, { score: 3100, rank: "S" })
  assert.deepEqual(last, { score: 1900, rank: "C", difficulty: "agent" })
  assert.equal(emptyCampaign.red.best, null)
})

test("difficulty scales score independently of rank and keeps all four ranks attainable", () => {
  assert.deepEqual(resultFor("agent", 1502, 65, 0), { baseScore: 1502, multiplier: 1.25, score: 1878, rank: "S" })
  assert.equal(resultFor("ghost", 1499, 65, 0).rank, "A")
  assert.equal(resultFor("intern", 1000, 180, 4).rank, "B")
  assert.equal(resultFor("intern", 1000, 181, 4).rank, "C")
})

test("difficulty changes patrol speeds, detection and charges while preserving the badge bonus", () => {
  for (const id of ["intern", "agent", "ghost"]) {
    const run = createRun("playing", id)
    const camera = cameras[0]
    assert.equal(run.charges, difficulties[id].charges)
    run.agent = { x: camera.x, y: camera.y, angle: 0 }
    run.collected.push("staff_badge")
    stepRun(run, .02, { x: 0, y: 0 }, () => {})
    const angle = camera.angle + Math.sin(.02 * difficulties[id].patrol * camera.speed + camera.phase) * camera.swing
    assert.equal(run.threats[0].angle, angle)
    assert.ok(Math.abs(run.alert - .02 / .85 * difficulties[id].detection * .65) < 1e-10)
  }
})

test("briefing, terminal, loss and victory freeze position, patrol, clock and alert", () => {
  for (const phase of ["briefing", "hacking", "caught", "complete"]) {
    const run = createRun(phase, "ghost")
    run.time = 12
    run.clock = 7
    run.alert = .45
    const start = structuredClone({ agent: run.agent, threats: run.threats })
    stepRun(run, .03, { x: 1, y: 1 }, () => assert.fail("paused gameplay played a sound"))
    assert.deepEqual({ agent: run.agent, threats: run.threats }, start)
    assert.deepEqual([run.time, run.clock, run.alert], [12, 7, .45])
  }
})
