import { analysisScenarios } from "../data/redTeamPuzzles"
import { shuffleArray } from "../shuffleArray"
import type { Difficulty } from "./difficulty"
import type { PuzzleKind } from "./mapData"

type Scenario = { id: string; title: string; rule: string; takeaway: string }
type ScenarioPosition = { number: number; total: number }

type BadgeCard = {
  source: string
  status: string
  tone: "secure" | "amber" | "coral" | "closed"
}

export type NetworkCard = { name: string; error?: string } & (BadgeCard | { lines: readonly string[] })
export type FileExtension = "ENV" | "KEY" | "PNG" | "JPG" | "SVG" | "TXT" | "PDF" | "CSV" | "ZIP"
type FileCard = { name: string; size: string; extension: FileExtension | null; error?: string }
type MailCard = { sender: string; subject: string; preview: string; error?: string }
type InspectFile = { name: string; lines: readonly string[]; error?: string; trap?: true }

type NetworkVariant = Scenario & { kind: "sniffer"; cards: readonly NetworkCard[] }
type LaptopVariant = Scenario & { kind: "laptop"; windowTitle: string } & (
  { mode: "files"; files: readonly FileCard[] } | { mode: "mail"; mail: readonly MailCard[] }
  | { mode: "inspector"; files: readonly InspectFile[] }
)
type OsintVariant = Scenario & {
  kind: "osint"
  badge: string
  photo: string
  pictogram: "cat" | "dog" | "cup" | "car"
  role: string
  note: string
  answer: readonly [string, string, string] | readonly [string, string, string, string]
  chips: readonly string[]
  policy?: string
  decoder?: string
}

export type PuzzleVariant = (NetworkVariant | LaptopVariant | OsintVariant) & ScenarioPosition
export type PuzzleVariants = { [Kind in PuzzleKind]: Extract<PuzzleVariant, { kind: Kind }> }
export type PuzzleSet = { difficulty: Difficulty; variants: PuzzleVariants }
export type ScenarioPools = { sniffer: readonly NetworkVariant[]; laptop: readonly LaptopVariant[]; osint: readonly OsintVariant[] }

const guestError = "Это устройство гостя, а не сеть офиса!"
const httpsError = "Зашифровано по HTTPS — перехватить нельзя!"
const securePortError = "Соединение защищено ключом или TLS!"
const closedPortError = "Порт закрыт брандмауэром!"
const tlsError = "Канал защищён TLS — ищи открытый трафик!"
const lockAdvice = "Блокируй экран перед уходом: Win+L на Windows, Ctrl+Cmd+Q на Mac."
const passwordAdvice = "Личные сведения легко угадать. Используй случайные пароли."
const personalFile = "Личные файлы не трогаем!"
const publicFile = "Это публичный файл, не утечка!"
const ordinaryMail = "Это обычное рабочее письмо, не утечка!"

const networkVariants: readonly NetworkVariant[] = [
  {
    id: "office-http", kind: "sniffer", title: "Сниффер сети · Офисный HTTP",
    rule: "Поймай 3 незашифрованных пакета офиса (HTTP или OPEN). Игнорируй гостей и HTTPS.",
    takeaway: "Гостевой Wi-Fi нужно отделять от внутренней сети.",
    cards: [
      { source: "ОФИС", name: "Бухгалтерия · session_token", status: "HTTP", tone: "amber" },
      { source: "ОФИС", name: "Принтер · admin_auth", status: "OPEN", tone: "coral" },
      { source: "ОФИС", name: "Внутренний API · pay_key", status: "HTTP", tone: "amber" },
      { source: "ГОСТЬ", name: "Погода · forecast", status: "HTTP", tone: "amber", error: guestError },
      { source: "ГОСТЬ", name: "Форум · images", status: "OPEN", tone: "coral", error: guestError },
      { source: "ОФИС", name: "Касса банка · transfer", status: "HTTPS", tone: "secure", error: httpsError },
      { source: "ОФИС", name: "Почта · sync", status: "HTTPS", tone: "secure", error: httpsError },
      { source: "ГОСТЬ", name: "YouTube · stream", status: "HTTPS", tone: "secure", error: httpsError },
    ],
  },
  {
    id: "open-ports", kind: "sniffer", title: "Сканер портов · Локальная сеть",
    rule: "Найди 3 незащищённых порта без пароля или шифрования (NO AUTH / OPEN / NO PASS). Игнорируй защищённые и закрытые.",
    takeaway: "Отключай ненужные службы, а доступ к остальным защищай шифрованием и проверкой входа.",
    cards: [
      { source: "СЕРВЕР", name: "FTP :21 · Файловый обмен", status: "NO AUTH", tone: "amber" },
      { source: "ШЛЮЗ", name: "Telnet :23 · Удалённый вход", status: "OPEN", tone: "coral" },
      { source: "БАЗА", name: "PostgreSQL :5432 · Тест-база", status: "NO PASS", tone: "coral" },
      { source: "СЕРВЕР", name: "SSH :22 · Вход по ключу", status: "KEY ONLY", tone: "secure", error: securePortError },
      { source: "ВЕБ", name: "HTTPS :443 · Портал банка", status: "TLS 1.3", tone: "secure", error: securePortError },
      { source: "ПОЧТА", name: "IMAPS :993 · Почтовый сервер", status: "TLS 1.3", tone: "secure", error: securePortError },
      { source: "ОФИС", name: "RDP :3389 · Рабочий стол", status: "CLOSED", tone: "closed", error: closedPortError },
      { source: "СЕТЬ", name: "SMB :445 · Общие папки", status: "CLOSED", tone: "closed", error: closedPortError },
    ],
  },
  {
    id: "office-iot", kind: "sniffer", title: "Сниффер IoT · Устройства офиса",
    rule: "Поймай 3 открытых канала офисных устройств (HTTP или OPEN). Игнорируй защищённый TLS и устройства гостей.",
    takeaway: "Выделяй офисным устройствам отдельную сеть и шифруй их трафик.",
    cards: [
      { source: "УСТРОЙСТВО", name: "Камера холла · stream", status: "OPEN", tone: "coral" },
      { source: "УСТРОЙСТВО", name: "Турникет · card_id", status: "HTTP", tone: "amber" },
      { source: "УСТРОЙСТВО", name: "МФУ-сканер · docs_pdf", status: "HTTP", tone: "amber" },
      { source: "УСТРОЙСТВО", name: "Сейф-контроль · ping", status: "TLS", tone: "secure", error: tlsError },
      { source: "УСТРОЙСТВО", name: "Сигнализация · auth", status: "TLS", tone: "secure", error: tlsError },
      { source: "ГОСТЬ", name: "Смартфон · weather", status: "HTTP", tone: "amber", error: guestError },
      { source: "ГОСТЬ", name: "Планшет · news", status: "OPEN", tone: "coral", error: guestError },
      { source: "ГОСТЬ", name: "Ноутбук · music", status: "TLS", tone: "secure", error: tlsError },
    ],
  },
]

const laptopVariants: readonly LaptopVariant[] = [
  {
    id: "denis-desktop", kind: "laptop", mode: "files",
    title: "Ноутбук Дениса · Открытая сессия", windowTitle: "denis_macbook — Рабочий стол",
    rule: "Найди три утечки и собери улики на игровую флешку.", takeaway: lockAdvice,
    files: [
      { name: "prod_keys.env", size: "1.4 KB", extension: "ENV" },
      { name: "Админка банка", size: "Вкладка", extension: null },
      { name: "ssh_server.key", size: "2.1 KB", extension: "KEY" },
      { name: "memy_2026.png", size: "3.8 MB", extension: "PNG", error: personalFile },
      { name: "sochi_trip.jpg", size: "5.1 MB", extension: "JPG", error: "Личные фото не трогаем!" },
      { name: "bank_logo.svg", size: "48 KB", extension: "SVG", error: publicFile },
      { name: "lunch_menu.txt", size: "0.8 KB", extension: "TXT", error: personalFile },
      { name: "public_promo.pdf", size: "1.9 MB", extension: "PDF", error: publicFile },
    ],
  },
  {
    id: "hr-desktop", kind: "laptop", mode: "files",
    title: "Ноутбук HR и бухгалтерии · Открытая сессия", windowTitle: "hr_office_pc — Рабочий стол",
    rule: "Отметь три находки, которые открывают доступ к закрытым данным или к системе банка.", takeaway: lockAdvice,
    files: [
      { name: "salaries_2026.csv", size: "340 KB", extension: "CSV" },
      { name: "passports_scan.zip", size: "14.2 MB", extension: "ZIP" },
      { name: "Банк-Клиент", size: "Вкладка", extension: null },
      { name: "korporativ_foto.jpg", size: "4.6 MB", extension: "JPG", error: personalFile },
      { name: "office_rules.pdf", size: "1.2 MB", extension: "PDF", error: "Это правила для сотрудников." },
      { name: "birthday_list.txt", size: "1.1 KB", extension: "TXT", error: "В списке только даты для общего календаря поздравлений." },
      { name: "bank_brandbook.svg", size: "820 KB", extension: "SVG", error: publicFile },
      { name: "canteen_menu.png", size: "2.3 MB", extension: "PNG", error: publicFile },
    ],
  },
  {
    id: "workmail", kind: "laptop", mode: "mail", title: "Открытая почта WorkMail · Поиск утечек",
    windowTitle: "WorkMail — Входящие (8)", rule: "Найди три письма с паролями, кодами входа или данными клиентов.",
    takeaway: "Храни пароли и коды восстановления в защищённом хранилище. Доступ к данным клиентов выдавай только тем, кому он нужен.",
    mail: [
      { sender: "Денис К.", subject: "Пароль от тестового сервера", preview: "Скинул сюда на время отпуска: root / Bank…" },
      { sender: "IT-Поддержка", subject: "Резервные коды 2FA админа", preview: "Сохрани эти одноразовые коды для входа в панель…" },
      { sender: "Аналитика", subject: "Выгрузка базы клиентов (.csv)", preview: "Во вложении полная таблица телефонов за квартал…" },
      { sender: "Офис-менеджер", subject: "Пицца в переговорке в 16:00", preview: "Заходите на третий этаж, пока не остыла…", error: ordinaryMail },
      { sender: "Маркетинг", subject: "Новый баннер на главную", preview: "Публичный макет для осенней акции готов…", error: ordinaryMail },
      { sender: "HR-отдел", subject: "График праздничных выходных", preview: "Напоминаем расписание работы офиса в мае…", error: ordinaryMail },
      { sender: "Рассылка", subject: "Скидка 15% на фитнес рядом", preview: "Партнёрское предложение для всех сотрудников…", error: ordinaryMail },
      { sender: "Календарь", subject: "Напоминание: планёрка в 10:00", preview: "Обсудим задачи спринта в общем созвоне…", error: ordinaryMail },
    ],
  },
]

const osintDetails = {
  kind: "osint", title: "OSINT-дешифратор",
  rule: "Изучи пропуск, фото и стикер. Собери пароль из трёх частей.", takeaway: passwordAdvice,
} as const

const osintVariants: readonly OsintVariant[] = [
  {
    ...osintDetails, id: "denis-cat", pictogram: "cat", role: "Разработка",
    badge: "Денис К. · Принят: 2024 · ДР: 14.05", photo: "На рамке: «Мой кот Барсик»",
    note: "Пароль = Кот (англ.) + день и месяц ДР + любимый знак #", answer: ["Barsik", "1405", "#"],
    chips: ["Barsik", "Murzik", "Denis", "1405", "2024", "0514", "#", "!", "qwerty"],
  },
  {
    ...osintDetails, id: "artem-dog", pictogram: "dog", role: "IT-отдел",
    badge: "Артём В. · Отдел: IT · Каб. 308 · ДР: 07.11", photo: "Кружка: «Пёс Рекс лучший»",
    note: "Пароль = Пёс (англ.) + номер кабинета + знак @", answer: ["Rex", "308", "@"],
    chips: ["Rex", "Barsik", "Artem", "308", "0711", "2026", "@", "!", "admin"],
  },
  {
    ...osintDetails, id: "elena-coffee", pictogram: "cup", role: "Бухгалтерия",
    badge: "Елена М. · Бухгалтерия · Этаж: 4 · В штате с: 2021", photo: "Стакан кофе: «Только Latte»",
    note: "Пароль = Напиток + год найма + !", answer: ["Latte", "2021", "!"],
    chips: ["Latte", "Espresso", "Elena", "2021", "2026", "404", "!", "#", "bank"],
  },
  {
    ...osintDetails, id: "oleg-car", pictogram: "car", role: "Системный администратор",
    badge: "Олег С. · Серверная · Позывной: Wolf · Стойка: B12", photo: "Парковка: «Моё авто · номер 774»",
    note: "Пароль = Позывной + номер авто + $", answer: ["Wolf", "774", "$"],
    chips: ["Wolf", "Fox", "Oleg", "774", "B12", "1999", "$", "@", "root"],
  },
]

type Bag = { last: string; remaining: string[] }
const bags = new Map<string, Bag>()
const basicScenarios: ScenarioPools = { sniffer: networkVariants, laptop: laptopVariants, osint: osintVariants }

function readBag(key: string, ids: readonly string[]): Bag | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null")
    if (ids.includes(saved?.last) && Array.isArray(saved.remaining) &&
      new Set(saved.remaining).size === saved.remaining.length &&
      saved.remaining.every((id: string) => ids.includes(id) && id !== saved.last)) return saved
  } catch {}
  return bags.get(key)
}

function chooseVariant<T extends Scenario>(difficulty: Difficulty, kind: PuzzleKind, pool: readonly T[]): T & ScenarioPosition {
  const key = `worklab.redteam.puzzles.v1.${difficulty}.${kind}`
  const ids = pool.map(variant => variant.id)
  const bag = readBag(key, ids)
  const remaining = bag?.remaining.length ? [...bag.remaining] : shuffleArray(ids)
  if (!bag?.remaining.length && remaining.length > 1 && remaining[0] === bag?.last) remaining.push(remaining.shift()!)
  const last = remaining.shift()!
  const next = { last, remaining }
  bags.set(key, next)
  try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
  const chosen = pool.find(variant => variant.id === last)!
  return { ...chosen, number: pool.indexOf(chosen) + 1, total: pool.length }
}

export function drawNextVariantSet(difficulty: Difficulty): PuzzleSet {
  const pool = difficulty === "intern" ? basicScenarios : analysisScenarios[difficulty]
  return {
    difficulty,
    variants: {
      sniffer: chooseVariant(difficulty, "sniffer", pool.sniffer),
      laptop: chooseVariant(difficulty, "laptop", pool.laptop),
      osint: chooseVariant(difficulty, "osint", pool.osint),
    },
  }
}
