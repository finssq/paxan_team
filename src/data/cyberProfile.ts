import type { Difficulty, Rank } from "../redteam/difficulty"

type RunStats = {
  rank: Rank
  difficulty: Difficulty
  elapsed: number
  trophies: number
  totalTrophies: number
  alerts: number
  puzzleErrors: number
}

const verdicts = {
  S: "Явные склонности к кибербезопасности и пентесту",
  A: "Сильный потенциал в кибербезопасности (Red Team)",
  B: "Хорошая база для старта в кибербезопасности",
  C: "Смелый старт — потенциал есть, стоит прокачать тактику",
} satisfies Record<Rank, string>

const difficultyPoints = { intern: 28, agent: 34, ghost: 40 } satisfies Record<Difficulty, number>

function percent(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)))
}

export function buildCyberProfile({ rank, difficulty, elapsed, trophies, totalTrophies, alerts, puzzleErrors }: RunStats) {
  const seconds = Math.floor(elapsed)
  const stealth = percent(100 - 16 * alerts)
  const attention = percent(65 * trophies / totalTrophies + Math.max(0, 35 - 7 * puzzleErrors))
  const composure = percent(difficultyPoints[difficulty] + Math.min(60, 60 * 45 / Math.max(1, elapsed)))

  const strength = alerts === 0 ? "Ты добрался до Ядра без единой тревоги — это хороший контроль маршрута."
    : trophies >= 2 ? `Ты нашёл ${trophies} из ${totalTrophies} улик, пока продвигался к Ядру.`
    : elapsed < 45 ? `Ты добрался до Ядра за ${seconds} с${difficulty === "ghost" ? " на сложном уровне" : ""} — быстро сориентировался в офисе.`
    : difficulty === "ghost" ? "Ты завершил операцию на сложном уровне, где охрана быстрее обнаруживает игрока."
    : `Ты добрался до Ядра за ${seconds} с и прошёл все три точки проверки.`

  const advice = alerts >= 3 ? `Тревог за забег — ${alerts}. Чаще прячься за стенами и отключай камеры с помощью EMP перед открытыми участками.`
    : trophies === 0 ? `Трофеи — 0/${totalTrophies}. Проверь углы офиса рядом с охраной: там легко пропустить флешки и пропуск.`
    : puzzleErrors > 0 ? `Ошибок в мини-играх — ${puzzleErrors}. Перед ответом ещё раз сверяй его с условиями задачи.`
    : trophies < totalTrophies ? `Улик найдено ${trophies}/${totalTrophies}. Перед входом в серверную проверь боковые комнаты.`
    : alerts > 0 ? "Перед открытым участком дождись, пока камера отвернётся, и попробуй пройти без тревог."
    : difficulty !== "ghost" ? "Попробуй сложный уровень и проверь, удастся ли повторить чистый проход."
    : "Попробуй задания для начинающих на CTF, чтобы развить навыки анализа сетей и поиска уязвимостей."

  const role = stealth >= 80 && composure >= 75 ? "Пентестер (Red Team) · Этичный хакинг"
    : attention >= 75 ? "Специалист по аудиту безопасности · Поиск уязвимостей"
    : "Аналитик безопасности · Старт в ИБ"

  return { verdict: verdicts[rank], strength, advice, role, skills: [
    { label: "Скрытность", value: stealth, tone: "stealth" },
    { label: "Внимательность", value: attention, tone: "attention" },
    { label: "Хладнокровие", value: composure, tone: "composure" },
  ] }
}
