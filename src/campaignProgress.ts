import { defaultDifficulty, difficultyOrder } from "./redteam/difficulty.ts"
import type { Difficulty, Rank } from "./redteam/difficulty.ts"

const storageKey = "worklab.campaign.v1"
const rankWeights = { S: 4, A: 3, B: 2, C: 1 } satisfies Record<Rank, number>
type RedResult = { rank: Rank; score: number }

export type CampaignProgress = {
  version: 1
  blueCompleted: boolean
  red: {
    difficulty: Difficulty
    last: (RedResult & { difficulty: Difficulty }) | null
    best: RedResult | null
  }
}

export const emptyCampaign: CampaignProgress = { version: 1, blueCompleted: false, red: { difficulty: defaultDifficulty, last: null, best: null } }

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isChoice<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.some(choice => choice === value)
}

function decodeResult(rank: unknown, score: unknown): RedResult | null {
  if (typeof rank !== "string" || !Object.hasOwn(rankWeights, rank) || typeof score !== "number" || !Number.isSafeInteger(score) || score < 0) return null
  return { rank: rank as Rank, score }
}

export function decodeCampaign(raw: string | null): CampaignProgress {
  try {
    const data: unknown = JSON.parse(raw ?? "null")
    if (!object(data) || data.version !== 1 || typeof data.blueCompleted !== "boolean" || !object(data.red)) return emptyCampaign
    const { difficulty, lastDifficulty, lastRank, lastScore, bestRank, bestScore, best: legacyBest } = data.red
    const decodedLast = decodeResult(lastRank, lastScore)
    const last = decodedLast && isChoice(lastDifficulty, difficultyOrder) ? { ...decodedLast, difficulty: lastDifficulty } : null
    const best = "bestRank" in data.red || "bestScore" in data.red
      ? decodeResult(bestRank, bestScore)
      : object(legacyBest) ? decodeResult(legacyBest.rank, legacyBest.score) : null
    return { version: 1, blueCompleted: data.blueCompleted, red: { difficulty: isChoice(difficulty, difficultyOrder) ? difficulty : defaultDifficulty, last, best } }
  } catch {
    return emptyCampaign
  }
}

export function readCampaign() {
  try { return decodeCampaign(localStorage.getItem(storageKey)) } catch { return emptyCampaign }
}

export function writeCampaign(progress: CampaignProgress) {
  const { difficulty, last, best } = progress.red
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...progress, red: {
      difficulty,
      lastRank: last?.rank ?? null,
      lastScore: last?.score ?? null,
      lastDifficulty: last?.difficulty ?? null,
      bestRank: best?.rank ?? null,
      bestScore: best?.score ?? null,
    } }))
  } catch {}
}

export function clearCampaign() {
  try {
    localStorage.removeItem(storageKey)
    return true
  } catch { return false }
}

export function recordRedWin(progress: CampaignProgress, result: RedResult): CampaignProgress {
  const previous = progress.red.best
  const best = previous ? {
    score: Math.max(previous.score, result.score),
    rank: rankWeights[previous.rank] >= rankWeights[result.rank] ? previous.rank : result.rank,
  } : { score: result.score, rank: result.rank }
  const last = { rank: result.rank, score: result.score, difficulty: progress.red.difficulty }
  return { ...progress, red: { ...progress.red, last, best } }
}
