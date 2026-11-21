import type { Chapter, Ticket } from "../types/game"

export type Packet = {
  id: string
  channel: string
  route: string
  request: string
  fields: { key: string; value: string; warning?: boolean }[]
  explanation: string
  unsafe?: boolean
}

export const friday = {
  durationMs: 195_000,
  flightMs: 5_000,
  timeoutDamage: 35,
  retryMs: 30_000,
  xrayMs: 5_000,
  xraySweepMs: 400,
  freezeMs: 15_000,
  charges: 2,
  service: "Оплата",
  codeViewHelp: "Переключай вид: «Перевод» объясняет код на русском, «Код» показывает исходник",
  abilities: {
    xray: { label: "X-Ray Импульс", hint: "Сканирует код и на 5 секунд подсвечивает опасную строку с утечкой. Не сбрасывает комбо." },
    freeze: { label: "Заморозка деплоя", hint: "На 15 секунд останавливает таймер автодеплоя Дениса. Даёт время спокойно найти ошибку." },
  },
  hosts: [
    { name: "pay-core.demo", purpose: "Обрабатывает учебную оплату" },
    { name: "metrics.demo", purpose: "Принимает технические счётчики без платёжных данных" },
  ],
  briefing: [
    "Денис добавил модуль к оплате. Запусти **тестовый заказ** в WorkBrowser и посмотри, по каким каналам уходят данные.",
    "Поймай пакет на кабеле или кнопкой **«Заморозить пакет»**. Сверь адрес назначения со списком банка в **WorkChat**.",
    "Найди в **WorkCode**, где собираются данные для этого канала. Отметь строку, выбери исправление и повтори оплату.",
  ],
  traffic: {
    title: "Перехват трафика", send: "Провести тестовую оплату", sending: "Пакеты в пути",
    instruction: "Нажми на пакет, чтобы перехватить!", freeze: "Заморозить пакет", caught: "ПЕРЕХВАЧЕНО",
    inspector: "Инспектор пакета", safe: "ЗАЩИЩЕНО", danger: "УТЕЧКА", release: "Отпустить пакет",
    evidence: "Зафиксировать улику в коде", arrived: "Пакеты дошли до адресатов. Тест можно повторить.",
  },
}

const paymentPacket: Packet = {
  id: "gateway", channel: "Канал A", route: "WorkBrowser → pay-core.demo", request: "POST /sandbox/payment",
  fields: [{ key: "orderId", value: "DEMO-108" }, { key: "paymentToken", value: "demo_token_108" }],
  explanation: "Платёжный шлюз из списка банка получает токен учебного заказа.",
}

const reportPacket: Packet = {
  id: "reports", channel: "Канал B", route: "WorkBrowser → report-sync.demo", request: "POST /sandbox/report",
  fields: [{ key: "orderId", value: "DEMO-108" }, { key: "cardData", value: "DEMO-CARD-108", warning: true }],
  explanation: "В пакете есть учебные карточные данные. Сверь адрес со списком банка и найди, где в коде добавляется поле cardData.", unsafe: true,
}

export const incidentPackets = [paymentPacket, reportPacket]

const securityFails = { ok: false, detail: "Модуль отчётов всё ещё отправляет карточные данные на сторонний адрес." }
const securityPasses = { ok: true, detail: "Карточные данные больше не попадают в канал отчётов." }
const paymentPasses = { ok: true, detail: "Тестовый заказ оплачен через разрешённый шлюз." }

export const incidentTicket = {
  id: "friday-traffic-review",
  title: "Куда ушли данные?",
  time: "18:00",
  file: "payment-modules.ts",
  developer: "Подключил отчёты к оплате. На демо всё проходит, выпускаем?",
  hint: "Сверь адрес назначения в инспекторе со списком разрешённых адресов в чате.",
  summary: "Утечка остановлена. Платёжный шлюз по-прежнему принимает оплату.",
  preview: { title: "Учебный заказ", reference: "DEMO-108", amount: "1 240 ₽" },
  evidenceLineId: "report-fields",
  initialChecks: { security: securityFails, feature: paymentPasses },
  lines: [
    { id: "type", text: "type Checkout = { orderId: string; paymentToken: string; cardTag: string };", hint: "Данные учебного заказа: номер, токен оплаты и тестовое поле карты." },
    { id: "start", text: "const channels = {", hint: "Короткие имена каналов связаны с адресами назначения." },
    { id: "gateway", text: '  gateway: "pay-core.demo",', hint: "Адрес получает данные из канала gateway." },
    { id: "metrics", text: '  metrics: "metrics.demo",', hint: "Адрес получает данные из канала metrics." },
    { id: "reports", text: '  reports: "report-sync.demo",', hint: "Адрес получает данные из канала reports. Здесь определено назначение пакета." },
    { id: "end-settings", text: "} as const;", hint: "Конец списка адресов." },
    { id: "switches", text: "const enabled = { checkout: true, metrics: true, reports: true };", hint: "Переключатели определяют, какие части оплаты работают." },
    { id: "entry", text: "export function buildDemoPackets(order: Checkout) {", hint: "Собираем пакеты для тестового заказа." },
    { id: "release", text: "  if (!enabled.checkout) return [];", hint: "Выключенная оплата не создаёт пакеты." },
    { id: "common", text: "  const base = { orderId: order.orderId };", hint: "Номер заказа может использоваться в нескольких пакетах." },
    { id: "pay-fields", text: "  const payment = { ...base, paymentToken: order.paymentToken };", hint: "Для платежа нужен токен заказа." },
    { id: "metrics-fields", text: '  const counters = { event: "checkout_started", count: 1 };', hint: "Техническое событие и счётчик для метрик." },
    { id: "report-fields", text: "  const snapshot = { ...base, cardData: order.cardTag };", hint: "Эта строка добавляет в снимок поле cardData из учебного заказа. Проследи, куда ниже попадает snapshot." },
    { id: "start-packets", text: "  return [", hint: "Возвращаем список учебных пакетов." },
    { id: "pay-packet", text: "    { target: channels.gateway, body: payment },", hint: "Платёжный шлюз получает объект payment." },
    { id: "metrics-packet", text: "    ...(enabled.metrics ? [{ target: channels.metrics, body: counters }] : []),", hint: "Канал metrics получает объект counters, когда включён сбор счётчиков." },
    { id: "report-packet", text: "    ...(enabled.reports ? [{ target: channels.reports, body: snapshot }] : []),", hint: "Канал reports получает объект snapshot, если включены отчёты. Проверь, где этот объект собирается." },
    { id: "end-packets", text: "  ];", hint: "Конец списка пакетов." },
    { id: "end", text: "}", hint: "Конец функции." },
  ],
  patches: [
    {
      id: "disable-reports", title: "Отключить отправку отчётов", detail: "После покупки данные заказа больше не будут уходить по адресу report-sync.demo. Покупатель всё ещё сможет оплатить заказ, а счётчик покупок продолжит работать.",
      changes: [{ id: "switches", text: "const enabled = { checkout: true, metrics: true, reports: false };", hint: "Оплата продолжает работать без стороннего модуля отчётов." }],
      checks: { security: securityPasses, feature: paymentPasses },
    },
    {
      id: "disable-metrics", title: "Отключить счётчик покупок", detail: "Сервис перестанет сообщать на metrics.demo, сколько раз покупатели открыли оплату. Покупки и отправка отчётов на report-sync.demo продолжатся.",
      changes: [{ id: "switches", text: "const enabled = { checkout: true, metrics: false, reports: true };", hint: "Технические счётчики исчезли, модуль отчётов всё ещё подключён." }],
      checks: { security: securityFails, feature: paymentPasses },
    },
    {
      id: "pause-release", title: "Остановить оплату целиком", detail: "Сервис перестанет принимать платежи, отправлять отчёты и считать покупки. Обычный покупатель тоже не сможет оплатить заказ.",
      changes: [{ id: "switches", text: "const enabled = { checkout: false, metrics: true, reports: true };", hint: "Оплата и её дополнительные модули остановлены." }],
      checks: { security: securityPasses, feature: { ok: false, detail: "Заказ не оплачен. Выпуск оплаты приостановлен." } },
    },
  ],
} satisfies Ticket

const pausedPacket: Packet = {
  ...paymentPacket, id: "paused", route: "WorkBrowser → тестовый стенд", request: "GET /sandbox/payment-status",
  fields: [{ key: "status", value: "paused" }], explanation: "Проверка статуса доступна, но оплата и отчёты приостановлены.",
}

export const packetRuns: Record<string, Packet[]> = {
  "disable-reports": [{ ...paymentPacket, explanation: "Канал отчётов отключён. Разрешённый шлюз получает только токен, оплата работает." }],
  "pause-release": [pausedPacket],
}

export const fridayChapter: Chapter = {
  title: "Перехват кода", tickets: [incidentTicket], upcoming: ["Двойное списание", "Поддельный платёжный модуль"],
}

export const practiceTicket: Ticket = { ...incidentTicket, id: "friday-practice", title: "Пробная волна" }

export const practiceTips = [
  { title: "1/4 · Перехват", text: "Проведи тестовую оплату в WorkBrowser. На каждый пакет есть 5 секунд. Нажми на капсулу или «Заморозить пакет». Инспектор покажет адрес и данные. Отпусти пакет A, чтобы запустить B. Тест можно повторять сколько угодно." },
  { title: "2/4 · Расследование", text: "Сверь адрес из инспектора со списком Макса в WorkChat. Если застрянешь, спроси Макса. В WorkCode режим «Перевод» объясняет строки. X-Ray на 5 секунд подсвечивает улику. Отметь строку, где появляются данные из пакета." },
  { title: "3/4 · Исправление", text: "Варианты исправления открываются в WorkCode. После выбора вернись в WorkBrowser и повтори тестовую оплату. Безопасность и работа оплаты проверяются отдельно. Если тест не пройдёт, выбери другое исправление." },
  { title: "4/4 · Выпуск", text: "Обе проверки прошли. Поставь штамп «В ПРОДАКШН». Перехваты и выпуск дают очки. Чистое прохождение повышает комбо, а ошибки и полная подсказка Макса его сбрасывают." },
]
