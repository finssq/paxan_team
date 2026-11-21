import { paymentTicket } from "./paymentPreview"
import type { Message } from "../game/feedback"
import type { Ticket } from "../types/game"

export const trainingKey = "demo_key_001"

export const trainingTicket: Ticket = {
  ...paymentTicket,
  id: "training-payment",
  title: "Обучение",
  file: "demo-payment.ts",
  developer: "Подготовил учебный заказ. Можно проверять оплату!",
  hint: "Посмотри, что отправляет учебная форма оплаты.",
  summary: "Ты убрал ключ из браузера и проверил, что оплата всё ещё работает.",
  preview: { title: "Учебная оплата", reference: "Тренировочный заказ № 001", amount: "100 ₽" },
  lines: paymentTicket.lines.map(line => line.id === "key" ? { ...line, text: `const secretKey = "${trainingKey}";` } : line),
}

export const trainingHints = {
  1: "**Отправь заказ** и посмотри, какие данные браузер передаёт серверу.",
  2: "Открой **WorkCode** и отметь строку, которая раскрывает ключ.",
  3: "Открой **сейф** в WorkCode, перенеси в него ключ и **поверни замок**.",
  4: "**Перепроверь оплату** в WorkBrowser. Убедись, что ключа нет, а оплата работает.",
  5: "Ключ защищён, оплата работает. Поставь **штамп**, чтобы подтвердить выпуск обновления.",
}

export const trainingTeam = [
  { author: "developer", mood: "smile", role: "Разработчик", description: "Собрал обновление оплаты с помощью нейросети и хочет показать его на вечернем стриме." },
  { author: "mentor", mood: "calm", role: "Наставник по безопасности", description: "Научит проверять, что происходит с данными покупателей, и поможет разобраться в инструментах." },
] as const

function mentor(text: string): Message {
  return { author: "mentor", mood: "guiding", text }
}

export const trainingLeakExplanation = "В данных оплаты виден **секретный ключ**. Посетитель тоже может увидеть его и воспользоваться им."

export const trainingChat = [
  [
    { author: "developer", mood: "smile", text: "Нейронка собрала мне **оплату**! Скоро демо, глянешь перед выпуском?" },
    mentor("Привет! Это **WorkChat**. Здесь я буду подсказывать по ходу проверки."),
    mentor("Открой подсвеченный **WorkBrowser** в нижней панели. Это песочница для проверки обновлений."),
    mentor("Проведи тестовую оплату и **посмотри данные**, которые браузер передаёт серверу."),
  ],
  [
    { author: "developer", mood: "alarmed", text: "Секретный ключ в браузере? Но оплата же работает!" },
    mentor(trainingLeakExplanation),
    mentor("Открой **WorkCode**. **Наведись** на строку, чтобы узнать, что она делает. Нажми на неё, чтобы отметить улику."),
  ],
  [
    mentor("Ты нашёл утечку. Ключ нужен для оплаты и должен храниться **на сервере**."),
    mentor("Открой **сейф .env** в WorkCode. Перенеси в него ключ и поверни замок."),
  ],
  [mentor("Снова открой **WorkBrowser**. Проверь, что ключ скрыт и заказ всё ещё оплачивается.")],
  [mentor("Обе проверки пройдены. Теперь можешь поставить **штамп выпуска** в WorkBrowser.")],
] as const satisfies readonly (readonly Message[])[]
