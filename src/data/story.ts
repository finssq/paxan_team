import type { Message } from "../game/feedback"

type StoryScene = {
  badge: string; tone: "neutral" | "warning" | "danger"; title: string; brief: string; opening: Message
  answers: readonly [{ label: string; reply: Message }, { label: string; reply: Message }]
}

const scenes: readonly [StoryScene, StoryScene, StoryScene] = [
  {
    badge: "Предрелиз", tone: "neutral", title: "Да нейронка всё проверила",
    brief: "Денис говорит, что обновление готово. Давай проверим, куда уходят данные тестового заказа. Начни с оплаты.",
    opening: { author: "developer", mood: "smile", text: "В учебном заказе просто не повезло. Нейронка уже проверила новые фичи!" },
    answers: [
      { label: "Сейчас проверим твою нейронку", reply: { author: "developer", mood: "smile", text: "Давай. Я пока соберу список того, что успел подключить." } },
      { label: "Спокойно, разберёмся по порядку", reply: { author: "mentor", mood: "guiding", text: "Начни с тестовой оплаты. По пакетам увидим, каким адресам ушли данные." } },
    ],
  },
  {
    badge: "Диагностика", tone: "warning", title: "Лишнее в журнале",
    brief: "С оплатой разобрались. Но в журнал поддержки попадает больше данных, чем нужно. Перехвати пакет и посмотри, что Денис туда отправляет.",
    opening: { author: "mentor", mood: "guiding", text: "Адрес журнала наш. Вопрос в том, что именно Денис отправляет туда с каждым платежом." },
    answers: [
      { label: "Проверю поля пакета", reply: { author: "mentor", mood: "guiding", text: "Сверь поля пакета с назначением журнала. Рабочий адрес ещё не гарантирует безопасность." } },
      { label: "Денис, для чего нужен журнал?", reply: { author: "developer", mood: "alarmed", text: "Чтобы поддержка видела, прошла ли оплата. Почта в этой записи ей не нужна." } },
    ],
  },
  {
    badge: "Финальный штурм", tone: "danger", title: "Финальный штурм",
    brief: "До эфира считаные минуты. Тестовый чек дошёл, но его получил другой клиент. Осталось понять, откуда рассылка берёт адрес.",
    opening: { author: "developer", mood: "calm", text: "В тестах письмо отправилось, но дошло не до того клиента. Давай вместе проверим адресата." },
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
  warmup: "Разминка", protected: "Релиз защищён", attackStopped: "АТАКА ОТБИТА", player: "Вы", replies: "Быстрый ответ", replyDelay: 400,
  summaryTitle: "Итог смены", finaleTitle: "Релиз в эфире", waveSummaryTitle: "Итог волны",
  early: "Этот сервис прошёл обе проверки. Макс передаёт следующий сигнал из журналов банка.",
  officeTeaser: "Атака отбита. В понедельник проверим офис и выясним, как «Призрак» узнал внутренние адреса банка.",
}

const mentorFinale: Message = {
  author: "mentor", mood: "approve",
  text: "Три утечки закрыты. Оплата, журнал и рассылка работают. Можно показывать релиз.",
}

const releaseEpilogues = {
  clean: [
    { author: "developer", mood: "smile", text: "Успели до эфира! Первый платёж прошёл, чек у владельца. Вот теперь можно выдохнуть." },
    mentorFinale,
  ],
  recovered: [
    { author: "developer", mood: "calm", text: "Я поторопился с выпуском. Хорошо, что успели поправить. Чек у владельца, мы в эфире." },
    mentorFinale,
  ],
} satisfies Record<string, readonly Message[]>

export function releaseEpilogue(hadAutoDeploy: boolean): readonly Message[] {
  return hadAutoDeploy ? releaseEpilogues.recovered : releaseEpilogues.clean
}

export const releaseFindings = [
  { found: "Данные карты уходили в сторонний отчёт", fixed: "Отключили отправку отчёта" },
  { found: "Почта клиента попадала в журнал", fixed: "Оставили только тип события" },
  { found: "Чек уходил чужому адресату", fixed: "Вернули отправку владельцу заказа" },
]

export type StoryProgress = { startedAt: number; choice?: 0 | 1; answeredAt?: number; replyAt?: number }
