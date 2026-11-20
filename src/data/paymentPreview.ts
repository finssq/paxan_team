import chapterData from "./chapter1.json"
import type { Chapter } from "../types/game"

export const chapter: Chapter = chapterData
const firstTicket = chapter.tickets[0]
if (!firstTicket) throw new Error("The first chapter requires a ticket")

export const paymentTicket = firstTicket

export const paymentPreview = {
  feature: paymentTicket.file,
  audit: "ИИ: угроз не найдено",
  prompt: "Наведите или нажмите на строку, чтобы расшифровать код",
  warning: "Секретный ключ оплаты виден в браузере",
  success: "Данные изолированы • Безопасно",
  lines: paymentTicket.lines.map(line => ({
    ...line,
    repair: line.id === paymentTicket.evidenceLineId
      ? {
        text: "widget.data = { ...shop };",
        hint: "В браузер попадают только открытые данные. Служебные остаются на сервере.",
      }
      : undefined,
  })),
}
