export type Point = { x: number; y: number }
export type Rect = Point & { w: number; h: number }

export const mapSize = { width: 960, height: 540 }
export const spawn: Point = { x: 59, y: 474 }
export const gate: Rect = { x: 728, y: 316, w: 12, h: 92 }
export const gateApproach: Point = { x: 712, y: 362 }
export const core: Point = { x: 864, y: 360 }

export const walls: Rect[] = [
  { x: 16, y: 16, w: 928, h: 10 },
  { x: 16, y: 514, w: 928, h: 10 },
  { x: 16, y: 26, w: 10, h: 488 },
  { x: 934, y: 26, w: 10, h: 488 },
  { x: 26, y: 325, w: 180, h: 10 },
  { x: 292, y: 26, w: 10, h: 147 },
  { x: 292, y: 244, w: 10, h: 125 },
  { x: 292, y: 460, w: 10, h: 54 },
  { x: 728, y: 26, w: 12, h: 290 },
  { x: 728, y: 408, w: 12, h: 106 },
  { x: 119, y: 145, w: 37, h: 55 },
  { x: 216, y: 259, w: 32, h: 35 },
  { x: 435, y: 115, w: 86, h: 16 },
  { x: 363, y: 263, w: 38, h: 56 },
  { x: 548, y: 308, w: 74, h: 22 },
  { x: 644, y: 419, w: 36, h: 54 },
  { x: 780, y: 258, w: 78, h: 15 },
  { x: 793, y: 428, w: 56, h: 27 },
]

export const sealedWalls = [...walls, gate]

export const rooms = [
  { x: 43, y: 359, name: "РЕСЕПШЕН" },
  { x: 43, y: 61, name: "ОФИС" },
  { x: 324, y: 61, name: "IT-ЗОНА" },
  { x: 762, y: 61, name: "СЕРВЕРНАЯ" },
]

export const desks: Rect[] = [
  { x: 50, y: 95, w: 62, h: 30 },
  { x: 183, y: 89, w: 66, h: 29 },
  { x: 50, y: 221, w: 63, h: 34 },
  { x: 167, y: 205, w: 60, h: 39 },
  { x: 48, y: 381, w: 54, h: 49 },
  { x: 187, y: 456, w: 65, h: 27 },
  { x: 328, y: 90, w: 66, h: 32 },
  { x: 539, y: 99, w: 65, h: 37 },
  { x: 604, y: 201, w: 68, h: 35 },
  { x: 423, y: 359, w: 61, h: 43 },
  { x: 556, y: 435, w: 50, h: 38 },
]

export const racks: Rect[] = [
  { x: 785, y: 86, w: 30, h: 140 },
  { x: 844, y: 86, w: 30, h: 140 },
  { x: 894, y: 86, w: 22, h: 140 },
  { x: 879, y: 443, w: 24, h: 49 },
]

export const cableRuns: [Point, ...Point[]][] = [
  [{ x: 47, y: 311 }, { x: 268, y: 311 }, { x: 268, y: 105 }],
  [{ x: 323, y: 145 }, { x: 688, y: 145 }, { x: 688, y: 288 }, { x: 567, y: 288 }],
  [{ x: 323, y: 489 }, { x: 706, y: 489 }, { x: 706, y: 414 }],
  [{ x: 765, y: 77 }, { x: 922, y: 77 }, { x: 922, y: 413 }, { x: 874, y: 413 }],
]

export const findings = [
  {
    x: 161, y: 242, label: "Ноутбук без блокировки",
    detail: "Сотрудник ушёл за кофе и оставил активную сессию банка открытой.",
    advice: "Включите автоблокировку и блокируйте экран, когда уходите.",
    short: "Ноутбук",
    puzzle: "circuit",
  },
  {
    x: 580, y: 366, label: "Пароль на стикере",
    detail: "Логин и пароль от админки приклеены прямо к краю монитора.",
    advice: "Уберите стикер, смените пароль и храните учётные данные в менеджере паролей.",
    short: "Стикер",
    puzzle: "memory",
  },
  {
    x: 148, y: 437, label: "Открытый гостевой Wi-Fi",
    detail: "Гостевая сеть не отделена от внутренней инфраструктуры офиса.",
    advice: "Изолируйте гостевую сеть от внутренних систем банка.",
    short: "Гостевой Wi-Fi",
    puzzle: "frequency",
  },
] as const

export type PuzzleKind = (typeof findings)[number]["puzzle"]
export const objectiveOrder: readonly PuzzleKind[] = ["frequency", "circuit", "memory"]

export const cameras = [
  { x: 74, y: 78, angle: .87, swing: .57, speed: 1.48, range: 174, halfAngle: .35, phase: .45 },
  { x: 268, y: 215, angle: 2.69, swing: .69, speed: 1.62, range: 142, halfAngle: .28, phase: -1.2 },
  { x: 699, y: 283, angle: 2.36, swing: .90, speed: 1.27, range: 191, halfAngle: .35, phase: .5 },
  { x: 913, y: 477, angle: -2.15, swing: .73, speed: 1.42, range: 156, halfAngle: .32, phase: 2.1 },
]

export const drones = [
  { route: [{ x: 175, y: 134 }, { x: 234, y: 149 }, { x: 225, y: 210 }, { x: 176, y: 195 }], period: 8, range: 43 },
  { route: [{ x: 376, y: 208 }, { x: 511, y: 170 }, { x: 573, y: 250 }, { x: 465, y: 284 }], period: 11, range: 61 },
] as const
