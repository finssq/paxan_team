import type { Packet, WaveScenario } from "./friday"

const metric: Packet = {
  id: "diagnostic-counter", channel: "Канал A", route: "WorkBrowser → metrics.demo", request: "POST /sandbox/counter",
  fields: [{ key: "event", value: "payment_ok" }, { key: "count", value: "1" }],
  explanation: "Счётчик сообщает об успешной оплате и не передаёт данные клиента.",
}
const receiptStatus: Packet = {
  id: "diagnostic-status", channel: "Канал B", route: "WorkBrowser → pay-core.demo", request: "GET /sandbox/status",
  fields: [{ key: "orderId", value: "DEMO-216" }, { key: "status", value: "paid" }],
  explanation: "Платёжный шлюз подтвердил оплату тестового заказа.",
}
const diagnostic: Packet = {
  id: "diagnostic-log", channel: "Канал C", route: "WorkBrowser → bank-logs.demo", request: "POST /sandbox/diagnostics",
  fields: [{ key: "event", value: "payment_ok" }, { key: "customerEmail", value: "guest-216@example.invalid", warning: true }],
  explanation: "Адрес сервиса разрешён, но рабочему журналу нужен только тип события. Здесь в него попала учебная почта клиента.", unsafe: true,
}
const safeLog = { ok: true, detail: "Журнал получает тип события без данных клиента." }
const unsafeLog = { ok: false, detail: "Почта клиента всё ещё попадает в журнал." }
const workingLog = { ok: true, detail: "Событие об оплате видно в журнале поддержки." }

export const diagnosticWave = {
  service: "Диагностика",
  action: "Проверить журнал",
  featureLabel: "Запись события",
  hosts: [
    { name: "metrics.demo", purpose: "Считает события оплаты" },
    { name: "pay-core.demo", purpose: "Хранит статус заказа" },
    { name: "bank-logs.demo", purpose: "Принимает тип события. Почта клиента не нужна." },
  ],
  briefing: [
    "В этой волне адрес может быть правильным. Сравни, какие поля действительно нужны каждому сервису.",
    "Перехвати пакет диагностики, найди причину в WorkCode и оставь поддержке полезный журнал.",
  ],
  packets: [metric, receiptStatus, diagnostic],
  patchPackets: {
    "log-event-only": [metric, receiptStatus, { ...diagnostic, fields: [{ key: "event", value: "payment_ok" }], unsafe: false, explanation: "Поддержка видит событие без персональных данных." }],
    "log-no-counter": [receiptStatus, diagnostic],
    "log-off": [metric, receiptStatus],
  },
  ticket: {
    id: "friday-diagnostics-review", title: "Лишнее в журнале", time: "18:00", file: "payment-diagnostics.ts",
    developer: "Поддержка попросила журнал ошибок. Я добавил туда все данные события.",
    hint: "bank-logs.demo может принимать события. Найди строку, которая добавляет в запись почту клиента.",
    summary: "Почта клиента исключена из журнала. Поддержка по-прежнему видит события оплаты.",
    preview: { title: "Журнал диагностики", reference: "DEMO-216", amount: "640 ₽" },
    evidenceLineId: "log-body",
    initialChecks: { security: unsafeLog, feature: workingLog },
    lines: [
      { id: "input", text: "type PaymentEvent = { kind: string; customerEmail: string };", hint: "Событие оплаты содержит тип и учебную почту." },
      { id: "enabled", text: "const enabled = { counter: true, log: true };", hint: "Счётчик и журнал можно включать отдельно." },
      { id: "target", text: 'const logTarget = "bank-logs.demo";', hint: "Рабочий журнал получает записи на разрешённом адресе." },
      { id: "function", text: "function collect(event: PaymentEvent) {", hint: "Функция готовит запись для журнала поддержки." },
      { id: "counter", text: "  if (enabled.counter) count(event.kind);", hint: "Счётчику достаточно типа события." },
      { id: "log-body", text: "  const entry = { event: event.kind, customerEmail: event.customerEmail };", hint: "Помимо типа события строка добавляет в журнал почту клиента." },
      { id: "send", text: "  if (enabled.log) writeLog(logTarget, entry);", hint: "Журнал получает уже собранную запись." },
      { id: "end", text: "}", hint: "Конец функции." },
    ],
    patches: [
      { id: "log-no-counter", title: "Отключить счётчик", detail: "Сервис перестанет считать события. Записи в журнал будут отправляться в прежнем виде.",
        changes: [{ id: "enabled", text: "const enabled = { counter: false, log: true };", hint: "Счётчик отключён, журнал включён." }], checks: { security: unsafeLog, feature: workingLog } },
      { id: "log-event-only", title: "Оставить только тип события", detail: "В журнал будет попадать тип события, по которому поддержка сможет найти запись.",
        changes: [{ id: "log-body", text: "  const entry = { event: event.kind };", hint: "Из записи убрана почта клиента." }], checks: { security: safeLog, feature: workingLog } },
      { id: "log-off", title: "Отключить журнал", detail: "Поддержка перестанет получать записи о платежах через bank-logs.demo.",
        changes: [{ id: "enabled", text: "const enabled = { counter: true, log: false };", hint: "Журнал поддержки отключён." }], checks: { security: safeLog, feature: { ok: false, detail: "Поддержка не видит событие об оплате." } } },
    ],
  },
} satisfies WaveScenario

const wrongReceipt: Packet = {
  id: "receipt-delivery", channel: "Канал A", route: "WorkBrowser → bank-mail.demo", request: "POST /sandbox/receipt",
  fields: [{ key: "orderId", value: "DEMO-309" }, { key: "recipient", value: "guest-test@example.invalid", warning: true }],
  explanation: "Сервис рассылки разрешён, но чек с номером заказа уйдёт на учебный адрес гостя вместо адреса владельца.", unsafe: true,
}
const receiptQueue: Packet = {
  id: "receipt-queue", channel: "Канал B", route: "WorkBrowser → queue.demo", request: "POST /sandbox/queue",
  fields: [{ key: "event", value: "receipt_ready" }, { key: "job", value: "JOB-309" }],
  explanation: "Очередь видит идентификатор задачи рассылки без письма и адреса клиента.",
}
const receiptAudit: Packet = {
  id: "receipt-counter", channel: "Канал C", route: "WorkBrowser → metrics.demo", request: "POST /sandbox/counter",
  fields: [{ key: "event", value: "receipt_queued" }, { key: "count", value: "1" }],
  explanation: "В мониторинг передаётся только количество поставленных в очередь чеков.",
}
const safeReceipt = { ok: true, detail: "Чек не уходит на адрес постороннего получателя." }
const unsafeReceipt = { ok: false, detail: "Вместо адреса владельца выбран учебный адрес гостя." }
const workingReceipt = { ok: true, detail: "Сервис принимает запрос на отправку чека." }

export const receiptWave = {
  service: "Чеки",
  action: "Отправить тестовый чек",
  featureLabel: "Отправка чека",
  hosts: [
    { name: "bank-mail.demo", purpose: "Доставляет чек владельцу заказа" },
    { name: "queue.demo", purpose: "Хранит задачи отправки по их идентификаторам" },
    { name: "metrics.demo", purpose: "Считает поставленные в очередь задачи" },
  ],
  briefing: [
    "На этот раз проверь не только сервис, но и получателя внутри пакета.",
    "Учебный чек должен попасть владельцу заказа. Повтори отправку после исправления.",
  ],
  packets: [wrongReceipt, receiptQueue, receiptAudit],
  patchPackets: {
    "receipt-off": [receiptQueue, receiptAudit],
    "receipt-no-counter": [wrongReceipt, receiptQueue],
    "receipt-owner": [{ ...wrongReceipt, fields: [{ key: "orderId", value: "DEMO-309" }, { key: "recipient", value: "owner-309@example.invalid" }], unsafe: false, explanation: "Чек направлен владельцу учебного заказа." }, receiptQueue, receiptAudit],
  },
  ticket: {
    id: "friday-receipt-review", title: "Чек не тому адресату", time: "18:00", file: "receipt-delivery.ts",
    developer: "Отправка работает. Один чек почему-то оказался у другого тестового клиента.",
    hint: "Найди, откуда берётся recipient. Сервис рассылки отправляет чек на тот адрес, который ему дали.",
    summary: "Чеки снова уходят владельцам заказов. Ошибочный адрес исключён из рассылки.",
    preview: { title: "Тестовый чек", reference: "DEMO-309", amount: "890 ₽" },
    evidenceLineId: "recipient",
    initialChecks: { security: unsafeReceipt, feature: workingReceipt },
    lines: [
      { id: "source", text: "type Receipt = { orderId: string; ownerEmail: string };", hint: "В чеке есть номер заказа и подтверждённая почта его владельца." },
      { id: "settings", text: "const enabled = { delivery: true, metrics: true };", hint: "Доставка и счётчик настроены отдельно." },
      { id: "function", text: "function sendReceipt(receipt: Receipt) {", hint: "Готовим письмо для этого заказа." },
      { id: "recipient", text: '  const recipient = "guest-test@example.invalid";', hint: "Для всех чеков подставляется один учебный адрес гостя." },
      { id: "body", text: "  const letter = { orderId: receipt.orderId, recipient };", hint: "В письме есть номер заказа и выбранный получатель." },
      { id: "queue", text: "  enqueue(receipt.orderId);", hint: "Очередь создаёт задачу на отправку чека." },
      { id: "mail", text: '  if (enabled.delivery) deliver("bank-mail.demo", letter);', hint: "Сервис отправляет письмо указанному получателю." },
      { id: "metrics", text: '  if (enabled.metrics) count("receipt_queued");', hint: "Счётчик отмечает заказ на отправку." },
      { id: "end", text: "}", hint: "Конец функции." },
    ],
    patches: [
      { id: "receipt-off", title: "Приостановить рассылку", detail: "bank-mail.demo перестанет получать письма. Очередь и счётчик останутся включены.",
        changes: [{ id: "settings", text: "const enabled = { delivery: false, metrics: true };", hint: "Отправка писем отключена." }], checks: { security: safeReceipt, feature: { ok: false, detail: "Сервис больше не отправляет чеки." } } },
      { id: "receipt-no-counter", title: "Не считать чеки", detail: "Мониторинг перестанет считать письма, но адресаты будут выбираться прежним способом.",
        changes: [{ id: "settings", text: "const enabled = { delivery: true, metrics: false };", hint: "Доставка активна, отключён только счётчик." }], checks: { security: unsafeReceipt, feature: workingReceipt } },
      { id: "receipt-owner", title: "Брать адрес владельца", detail: "Для каждого чека будет использована подтверждённая почта его владельца.",
        changes: [{ id: "recipient", text: "  const recipient = receipt.ownerEmail;", hint: "В каждом письме указан владелец заказа." }], checks: { security: safeReceipt, feature: workingReceipt } },
    ],
  },
} satisfies WaveScenario
