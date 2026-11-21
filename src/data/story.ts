import type { Message } from "../game/feedback"

type StoryScene = {
  badge: string; tone: "neutral" | "warning" | "danger"; title: string; brief: string; opening: Message
  answers: readonly [{ label: string; reply: Message }, { label: string; reply: Message }]
}

const scenes: readonly [StoryScene, StoryScene, StoryScene] = [
  {
    badge: "Предрелиз", tone: "neutral", title: "Да нейронка всё проверила",
    brief: "Денис считает утечку с учебной оплаты случайностью и приносит новые фичи перед релизом. Макс просит проверить, куда уходят данные.",
    opening: { author: "developer", mood: "smile", text: "В учебном заказе просто не повезло. Нейронка уже проверила новые фичи!" },
    answers: [
      { label: "Сейчас проверим твою нейронку", reply: { author: "developer", mood: "smile", text: "Давай. Я пока соберу список того, что успел подключить." } },
      { label: "Спокойно, разберёмся по порядку", reply: { author: "mentor", mood: "guiding", text: "Начни с тестовой оплаты. По пакетам увидим, каким адресам ушли данные." } },
    ],
  },
  {
    badge: "Атака на сервис", tone: "warning", title: "Это не случайность",
    brief: "Макс видит в логах, что кто-то целенаправленно проверяет сервис и пытается увести данные. Денис впервые допускает, что релиз под угрозой.",
    opening: { author: "mentor", mood: "guiding", text: "В логах повторяются подозрительные запросы. Кто-то проверяет, какие данные отдаёт сервис." },
    answers: [
      { label: "Значит, нас реально атакуют?", reply: { author: "mentor", mood: "guiding", text: "Да. Зафиксируй подозрительную операцию, пока мы ещё можем остановить ущерб." } },
      { label: "Держим оборону, Денис, не паникуй", reply: { author: "developer", mood: "alarmed", text: "Хорошо. Буду смотреть логи и сообщать, если что-то повторится." } },
    ],
  },
  {
    badge: "Финальный штурм", tone: "danger", title: "Финальный штурм",
    brief: "До запуска считанные минуты. Денис признаёт, что зря доверял ИИ вслепую, и просит проверить код вместе.",
    opening: { author: "developer", mood: "calm", text: "Я поспешил с доверием к ИИ. Давай разберём последний модуль вместе?" },
    answers: [
      { label: "Наконец-то работаем командой", reply: { author: "developer", mood: "smile", text: "Договорились. Я объясню, что поменял, а решение о выпуске примем вместе." } },
      { label: "Закроем всё до запуска", reply: { author: "mentor", mood: "approve", text: "Сначала проверяем исправление. Если оба теста пройдут, ставим штамп." } },
    ],
  },
]

export function storyForWave(waveNumber: number) {
  return waveNumber === 1 ? scenes[0] : waveNumber === 2 ? scenes[1] : scenes[2]
}

export const storyCopy = {
  warmup: "Разминка", protected: "Релиз защищён", continue: "К волне", player: "Вы", replies: "Быстрый ответ", replyDelay: 400,
  summaryTitle: "Итог смены", waveSummaryTitle: "Итог волны",
  early: "Денис впервые увидел утечку сам и согласился проверять новые модули до выпуска. Макс передаёт тебе логи для следующей волны.",
  success: "Релиз прошёл чисто, атаку сорвали. Денис извинился за спешку и пообещал звать AppSec до выпуска. Макс предлагает остаться в команде. Следующая история ждёт в Главе 2.",
  recovery: "Релиз удалось спасти в последний момент. Макс благодарит тебя за выдержку и предлагает повторить смену, чтобы закрепить результат.",
}

export type StoryProgress = { startedAt: number; choice?: 0 | 1; answeredAt?: number; replyAt?: number }
