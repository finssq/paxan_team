import type { ScenarioPools } from "../redteam/puzzleVariants"

const network = {
  kind: "sniffer",
  rule: "Отметь три пакета, в которых видны открытые секретные данные.",
  takeaway: "Шифруй трафик и не передавай секреты в URL и открытых заголовках.",
} as const

const encrypted = "Содержимое пакета зашифровано."
const denied = "Запрос отклонён. В пакете нет открытого секрета."
const dnsOnly = "Здесь только запрос адреса сайта."
const masked = "Значение скрыто звёздочками. Токен не виден."

const laptop = {
  kind: "laptop",
  mode: "inspector",
  rule: "Открой файлы и скопируй на игровую флешку только три файла с утечками.",
  takeaway: "Блокируй рабочий ноутбук и храни секреты в защищённом хранилище.",
} as const

const ordinary = "В файле нет секретных данных."

const sticker = {
  kind: "osint",
  rule: "Собери четыре фрагмента пароля по пропуску, заметке и политике ИБ.",
  takeaway: "Используй уникальные случайные пароли без личных сведений.",
} as const

export const honeytokenAlert = "СРАБОТАЛА ЛОВУШКА СБ (HONEYTOKEN)!"

export const analysisScenarios = {
  agent: {
    sniffer: [
      {
        ...network, id: "payments-dpi", title: "Анализ трафика · Платёжный отдел",
        cards: [
          { name: "Оплата", lines: ["GET /api/pay?key=demo_pay_94f"] },
          { name: "Портал", lines: ["Cookie: admin_sid=demo_88a1", "HTTP/1.1"] },
          { name: "Принтер", lines: ["POST /print/auth", "user=demo pass=Office26-demo"] },
          { name: "Почта", lines: ["TLS 1.3 · [зашифровано]"], error: encrypted },
          { name: "Кабинет", lines: ["HTTPS 200 OK · HSTS"], error: encrypted },
          { name: "Архив", lines: ["403 Forbidden · закрыто"], error: denied },
          { name: "Видео", lines: ["DNS · video.example"], error: dnsOnly },
          { name: "Мониторинг", lines: ["TLS 1.2 · AES-256"], error: encrypted },
        ],
      },
      {
        ...network, id: "support-dpi", title: "Анализ трафика · Служба поддержки",
        cards: [
          { name: "Заявки", lines: ["POST /ticket/auth · HTTP", "pin=DEMO-3824"] },
          { name: "Склад", lines: ["GET /stock?token=demo_stock_52"] },
          { name: "Синхронизация", lines: ["HTTP/1.1 200 OK", "X-Session-Key: demo_09c2"] },
          { name: "Рассылки", lines: ["HTTPS 200 OK · HSTS"], error: encrypted },
          { name: "Переговорная", lines: ["DNS · calendar.example"], error: dnsOnly },
          { name: "Документы", lines: ["TLS 1.3 · [зашифровано]"], error: encrypted },
          { name: "Реестр", lines: ["403 Forbidden · закрыто"], error: denied },
          { name: "Закупки", lines: ["TLS 1.2 · AES-256"], error: encrypted },
        ],
      },
    ],
    laptop: [
      {
        ...laptop, id: "payment-inspector", title: "Ноутбук · Платёжный отдел", windowTitle: "Рабочие файлы",
        files: [
          { name: "notes.txt", lines: ["Конфигурация на четверг", "DB_USER=demo_reader", "DB_PASS=demo_bank_26"] },
          { name: "config_old.json", lines: ["{", '  "apiToken": "demo_token_77c9"', "}"] },
          { name: "vpn_setup.txt", lines: ["Учебный контур", "Код доступа: DEMO-7319", "Профиль: office-demo"] },
          { name: "meeting_q1.md", lines: ["# Итоги квартала", "Сверить сроки на встрече.", "Обновить протокол."], error: ordinary },
          { name: "deploy.log", lines: ["10:12 Сборка начата", "10:13 Проверки пройдены", "10:14 Сборка готова"], error: ordinary },
          { name: "contacts.csv", lines: ["отдел,добавочный", "поддержка,104", "ресепшен,101"], error: ordinary },
          { name: "checklist.txt", lines: ["✓ Сверить версию", "✓ Собрать отчёт", "□ Уведомить команду"], error: ordinary },
          { name: "draft_mail.txt", lines: ["Тема: Демонстрация", "Встречаемся в 15:00.", "Принесите протокол."], error: ordinary },
        ],
      },
      {
        ...laptop, id: "support-inspector", title: "Ноутбук · Служба поддержки", windowTitle: "Документы смены",
        files: [
          { name: "shift_log.txt", lines: ["Передача смены", "Панель: demo-support", "Пароль входа: Help88-demo"] },
          { name: "archive_info.md", lines: ["Архив заявок", "Шифрование включено.", "Ключ архива: DEMO-1956"] },
          { name: "app_profile.json", lines: ["{", '  "sessionKey": "demo_session_c813"', "}"] },
          { name: "schedule.csv", lines: ["день,смена", "понедельник,утро", "вторник,вечер"], error: ordinary },
          { name: "release_notes.txt", lines: ["Версия 2.4", "Обновлены подсказки.", "Улучшен поиск."], error: ordinary },
          { name: "inventory.txt", lines: ["Гарнитуры: 8", "Мониторы: 4", "Док-станции: 2"], error: ordinary },
          { name: "review.log", lines: ["09:15 Файл принят", "09:18 Проверка выполнена", "09:20 Отчёт готов"], error: ordinary },
          { name: "guide.md", lines: ["# Новая заявка", "Выбрать категорию.", "Добавить описание."], error: ordinary },
        ],
      },
    ],
    osint: [
      {
        ...sticker, id: "artem-policy", title: "Стикер · Привычки сотрудника", pictogram: "dog", role: "IT-отдел",
        badge: "Артём В. · Каб. 308 · ДР 07.11",
        photo: "Артём в чате: «Рекса (Rex) пишу с большой, потом кабинет и ДР как в пропуске».",
        note: "«Знак опять забыл. Какой у нашего отдела?»",
        policy: "Заглавная буква, цифры и знак @ в конце. Даты в формате ДДММ.",
        answer: ["Rex", "308", "0711", "@"],
        chips: ["Rex", "rex", "REX", "308", "803", "380", "0711", "1107", "7110", "@", "!", "#"],
      },
      {
        ...sticker, id: "elena-policy", title: "Стикер · Бухгалтерия", pictogram: "cup", role: "Бухгалтерия",
        badge: "Елена М. · Каб. 214 · В штате с 2021",
        photo: "Елена в чате: «Начинаю с Latte. После кабинета ставлю год, когда пришла в банк».",
        note: "«Последний символ беру из памятки отдела».",
        policy: "Заглавная буква, цифры и знак ! в конце.",
        answer: ["Latte", "214", "2021", "!"],
        chips: ["Latte", "latte", "LATTE", "214", "241", "412", "2021", "2012", "2026", "!", "@", "#"],
      },
    ],
  },
  ghost: {
    sniffer: [
      {
        ...network, id: "office-decoys", title: "Анализ трафика · Офис и шлюз",
        cards: [
          { name: "Сверка", lines: ["GET /ledger?pin=DEMO-4220"] },
          { name: "Доступ", lines: ["HTTP/1.1", "Authorization: Bearer demo_26ab"] },
          { name: "Печать", lines: ["POST /jobs/auth · HTTP", "pass=Print-demo26"] },
          { name: "Профиль", lines: ["Authorization: Bearer ********"], error: masked },
          { name: "Сессия", lines: ["HTTPS · Set-Cookie: sid=…", "Secure; HttpOnly"], error: encrypted },
          { name: "Вход", lines: ["POST /login → 401 Unauthorized"], error: denied },
          { name: "Отчёты", lines: ["TLS 1.3 · [зашифровано]"], error: encrypted },
          { name: "Каталог", lines: ["DNS · directory.example"], error: dnsOnly },
        ],
      },
      {
        ...network, id: "branch-decoys", title: "Анализ трафика · Филиал",
        cards: [
          { name: "Пропуска", lines: ["GET /badge?code=DEMO-A529"] },
          { name: "Документы", lines: ["HTTP/1.1 · Cookie:", "office_sid=demo_32fd"] },
          { name: "Заявки", lines: ["POST /queue/auth · HTTP", "token=demo_queue_6e"] },
          { name: "Резерв", lines: ["X-Api-Key: [скрыто]"], error: masked },
          { name: "Расписание", lines: ["HTTPS · Set-Cookie: cal=…", "Secure; HttpOnly"], error: encrypted },
          { name: "Служба входа", lines: ["POST /session → 401 Unauthorized"], error: denied },
          { name: "Реестр", lines: ["TLS 1.2 · [зашифровано]"], error: encrypted },
          { name: "Обновления", lines: ["DNS · packages.example"], error: dnsOnly },
        ],
      },
    ],
    laptop: [
      {
        ...laptop, id: "operations-canary", title: "Ноутбук · Системные файлы", windowTitle: "Рабочая папка",
        rule: "Найди три утечки в содержимом файлов. Следи за метками службы безопасности.",
        files: [
          { name: "debug.log", lines: ["08:42 Подключение к базе", "DB_PASS=Ops26-demo", "08:43 Запрос завершён"] },
          { name: "git_diff.patch", lines: ["--- a/demo/config", "+++ b/demo/config", "+ API_TOKEN=demo_api_d17"] },
          { name: "temp_backup.bak", lines: ["Профиль: склад", "Резервный код: DEMO-1947", "Запись сохранена"] },
          { name: "passwords_FINAL.txt", lines: ["Реестр паролей", "X-Sec-Canary: HONEYTOKEN-ALERT", "Пароль: Canary26-demo"], trap: true },
          { name: "bank_admin_keys.txt", lines: ["# TRAP FILE · SOC ALERT", "Учётка: admin-demo", "Ключ: demo_canary_b9"], trap: true },
          { name: "install.log", lines: ["12:10 Установка начата", "12:11 Профиль прочитан", "12:12 Установка завершена"], error: ordinary },
          { name: "metrics.csv", lines: ["время,очередь", "12:00,8", "12:01,6"], error: ordinary },
          { name: "service_notes.md", lines: ["# План обслуживания", "Проверить диск.", "Обновить журнал."], error: ordinary },
        ],
      },
      {
        ...laptop, id: "branch-canary", title: "Ноутбук · Файлы филиала", windowTitle: "Локальные документы",
        rule: "Найди три утечки в содержимом файлов. Следи за метками службы безопасности.",
        files: [
          { name: "worker_trace.log", lines: ["09:30 Запущена синхронизация", "SYNC_TOKEN=demo_sync_58d", "09:31 Очередь обработана"] },
          { name: "settings_diff.patch", lines: ["--- a/demo/tenant", "+++ b/demo/tenant", "+ ACCESS_PIN=DEMO-9041"] },
          { name: "rotation_old.bak", lines: ["Резервная запись", "DB_PASS=Branch26-demo", "Группа: отчёты"] },
          { name: "master_passwords.txt", lines: ["Полный доступ", "X-Sec-Canary: HONEYTOKEN-ALERT", "Пароль: BranchCanary-demo"], trap: true },
          { name: "events.log", lines: ["15:00 Сверка начата", "15:04 Записей: 17", "15:05 Сверка завершена"], error: ordinary },
          { name: "roles.csv", lines: ["отдел,роль", "офис,чтение", "кадры,согласование"], error: ordinary },
          { name: "printer.ini", lines: ["profile=office", "duplex=true", "paper=A4"], error: ordinary },
          { name: "readme.md", lines: ["# Архив", "По одной папке на смену.", "Сверять даты выгрузки."], error: ordinary },
        ],
      },
    ],
    osint: [
      {
        ...sticker, id: "denis-leet", title: "Стикер · Замена букв", pictogram: "cat", role: "Разработка",
        badge: "Денис К. · Каб. 405 · ДР 14.05",
        photo: "Денис в чате: «Barsik пишу с заменами. За ним — кабинет и день рождения».",
        note: "«Замены: e→3, a→4, i→1».",
        policy: "Начни с заглавной. Дата в формате ДДММ. В конце поставь #.",
        decoder: "Замени e на 3, a на 4, i на 1. Остальные буквы и их регистр сохрани.",
        answer: ["B4rs1k", "405", "1405", "#"],
        chips: ["B4rs1k", "Barsik", "b4rs1k", "B4rsik", "405", "504", "1405", "0514", "1540", "#", "@", "!"],
      },
      {
        ...sticker, id: "artem-shift", title: "Стикер · Сдвиг на одну букву", pictogram: "dog", role: "IT-отдел",
        badge: "Артём В. · Каб. 308 · ДР 07.11",
        photo: "Артём в чате: «Начинаю с клички пса. Дальше кабинет и ДР».",
        note: "«Кличка на стикере: Sfy. Записал со сдвигом +1».",
        policy: "Заглавная буква, дата ДДММ и знак @ в конце.",
        decoder: "Чтобы прочитать кличку, верни каждую букву на одну позицию назад: B → A, b → a.",
        answer: ["Rex", "308", "0711", "@"],
        chips: ["Rex", "rex", "Sfy", "R3x", "308", "803", "0711", "1107", "1701", "@", "!", "#"],
      },
    ],
  },
} satisfies Record<"agent" | "ghost", ScenarioPools>
