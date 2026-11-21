export const difficulties = {
  intern: { label: "Простая", description: "Спокойная охрана", patrol: .75, detection: .7, charges: 3, score: 1 },
  agent: { label: "Средняя", description: "Обычные камеры", patrol: 1, detection: 1, charges: 2, score: 1.25 },
  ghost: { label: "Сложная", description: "Быстрая охрана", patrol: 1.25, detection: 1.35, charges: 1, score: 1.5 },
} as const

export type Difficulty = keyof typeof difficulties
export const difficultyOrder = ["intern", "agent", "ghost"] as const
export const defaultDifficulty: Difficulty = "agent"

export const ranks = ["C", "B", "A", "S"] as const
export type Rank = (typeof ranks)[number]

export function resultFor(difficulty: Difficulty, baseScore: number, time: number, alerts: number) {
  const multiplier = difficulties[difficulty].score
  const score = Math.round(baseScore * multiplier)
  const rank: Rank = alerts === 0 && time <= 65 && baseScore >= 1500 ? "S"
    : alerts <= 2 && time <= 110 ? "A" : alerts <= 4 && time <= 180 ? "B" : "C"
  return { baseScore, multiplier, score, rank }
}
