import { Radio, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { createSfx } from "../audio/sfx"
import type { PuzzleKind } from "./mapData"
import { nextObjective } from "./simulation"
import type { OfficeEvent } from "./simulation"

type Sender = "max" | "denis"
type Message = readonly [sender: Sender, message: string]
type Draft = { id: string; sender: Sender; text: string }
type Delivered = Draft & { time: string }
type Delivery = { attempt: number; delivered: Delivered[]; typing: Sender | null }

const base = import.meta.env.BASE_URL
export const senders = {
  max: { name: "Макс", role: "AppSec", avatar: `${base}icons/mentor.svg` },
  denis: { name: "Денис", role: "Разработчик", avatar: `${base}icons/developer.svg` },
}

const messages: Record<OfficeEvent, readonly Message[]> = {
  briefing: [
    ["max", "После пятничной атаки на релиз нужно понять, откуда «Призрак» узнал внутренние адреса банка. Проверь офис как белый хакер — начни с гостевого Wi-Fi в ресепшене."],
    ["denis", "Эй, код-то я уже починил! Ставлю кофе, что в офисе всё надёжно и тебя спалит первая камера."],
  ],
  sniffer: [
    ["max", "Гостевой Wi-Fi связан с сетью банка. Посетители могут добраться до внутренних систем."],
    ["denis", "Ладно, это было легко, но дальше охрана и мой отдел."],
  ],
  laptop: [
    ["denis", "Погоди, это же МОЙ ноутбук?! Я на минуту за кофе отошёл!"],
    ["max", "Вот поэтому экран всегда блокируют, даже если отходишь на минуту."],
  ],
  osint: [
    ["max", "Пароль сложился из подсказок на столе. Случайную комбинацию так не соберёшь."],
  ],
  gate: [
    ["max", "Шлюз в серверную открыт! Доберись до ядра банка."],
  ],
  camera: [
    ["max", "Красный луч — камера! Прячься за колонной или жми Пробел, чтобы отключить её импульсом EMP."],
  ],
  trophyUsb: [
    ["denis", "Эй, это моя потерянная флешка с бэкапом!"],
  ],
  trophyBadge: [
    ["max", "С чужим пропуском камеры реагируют медленнее — отличный ход!"],
  ],
  victory: [
    ["denis", "Ладно, сдаюсь! Ставлю блокировку экрана и прячу все флешки..."],
    ["max", "Стоп, смотри на логи Ядра! Чужой вход через гостевой Wi-Fi вчера в 23:14 — «Призрак» уже был в офисе. Готовимся к продолжению расследования!"],
  ],
}

const objectives: Record<PuzzleKind | "core", { step: number; desktop: string; touch: string }> = {
  sniffer: {
    step: 1,
    desktop: "Подойди на WASD к гостевому Wi-Fi в ресепшене и нажми E.",
    touch: "Подойди к гостевому Wi-Fi в ресепшене и нажми «Взломать».",
  },
  laptop: {
    step: 2,
    desktop: "Проберись мимо камер к ноутбуку в офисе. Прячься за стенами или жми Пробел для EMP.",
    touch: "Проберись мимо камер к ноутбуку в офисе. Прячься за стенами или используй EMP.",
  },
  osint: {
    step: 3,
    desktop: "Обойди дрон в IT-зоне и взломай точку «Стикер».",
    touch: "Обойди дрон в IT-зоне и взломай точку «Стикер».",
  },
  core: {
    step: 4,
    desktop: "Шлюз в серверную открыт! Доберись до ядра банка.",
    touch: "Шлюз в серверную открыт! Доберись до ядра банка.",
  },
}

const emptyMessages: Delivered[] = []
const formatMessageTime = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" })
export const sidePanelQuery = "(min-width: 1024px) and (min-height: 541px) and (pointer: fine)"

export function useOfficeMessages(events: readonly OfficeEvent[], attempt: number, play: ReturnType<typeof createSfx>["play"]) {
  const queue = useMemo(() => events.flatMap(event => messages[event].map(([sender, text], index): Draft => ({
    id: `${event}-${index}`, sender, text,
  }))), [events])
  const [state, setState] = useState<Delivery>({ attempt, delivered: [], typing: null })
  const delivered = state.attempt === attempt ? state.delivered : emptyMessages
  const typing = state.attempt === attempt ? state.typing : null
  const next = queue[delivered.length]

  useEffect(() => {
    if (!next) return
    const timer = window.setTimeout(() => {
      if (!typing) {
        setState({ attempt, delivered, typing: next.sender })
      } else {
        setState({ attempt, delivered: [...delivered, { ...next, time: formatMessageTime.format(new Date()) }], typing: null })
        play("playPhonePop")
      }
    }, typing ? 720 : delivered.length === 0 ? 400 : delivered.length === 1 ? 780 : 320)
    return () => window.clearTimeout(timer)
  }, [attempt, delivered, next?.id, play, typing])

  return { delivered, typing }
}

function Avatar({ sender }: { sender: Sender }) {
  return <span className="rt-avatar" data-sender={sender}>
    <img src={senders[sender].avatar} alt="" width={44} height={44} />
  </span>
}

function TypingDots() {
  return <span className="rt-typing-dots" aria-hidden="true"><i /><i /><i /></span>
}

type FeedProps = { events: readonly OfficeEvent[]; delivered: Delivered[]; typing: Sender | null }

function PhoneScreen({ events, delivered, typing, onClose }: FeedProps & { onClose?: () => void }) {
  const feed = useRef<HTMLOListElement>(null)
  const objective = objectives[nextObjective(events) ?? "core"]

  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight
  }, [delivered, typing])

  return (
    <>
      <div className="rt-phone-top"><span aria-hidden="true" /><Radio size={14} aria-label="Связь установлена" /></div>
      <header className="rt-phone-header">
        <div><h2>Связь · Штаб</h2>
          <p className="rt-phone-presence">{typing ? <>{senders[typing].name} печатает <TypingDots /></> : "Макс и Денис · в сети"}</p>
        </div>
        {onClose && <button className="rt-button rt-icon" onClick={onClose} type="button" aria-label="Закрыть чат"><X size={18} aria-hidden="true" /></button>}
      </header>
      <div className="rt-objective">
        <div><strong>Текущая цель</strong><span>Шаг {objective.step}/4</span></div>
        {events.includes("victory") ? <p>Все цели выполнены.</p> : (
          <>
            <p className="rt-desktop-help">{objective.desktop}</p>
            <p className="rt-touch-help">{objective.touch}</p>
          </>
        )}
      </div>
      <ol className="rt-phone-feed" aria-label="Сообщения штаба" ref={feed}>
        {delivered.map(({ id, sender, text, time }) => (
          <li className="rt-message" data-sender={sender} key={id}>
            <Avatar sender={sender} />
            <div className="rt-message-body">
              <div className="rt-message-byline"><strong>{senders[sender].name}</strong><span>{senders[sender].role}</span><time>{time}</time></div>
              <p>{text}</p>
            </div>
          </li>
        ))}
        {typing && <li className="rt-message rt-typing" key={`typing-${typing}`} aria-label={`${senders[typing].name} печатает`}>
          <Avatar sender={typing} /><div className="rt-message-body"><TypingDots /></div>
        </li>}
      </ol>
    </>
  )
}

function ChatSheet({ onClose, ...feed }: FeedProps & { onClose: () => void }) {
  const sheet = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = sheet.current
    dialog?.showModal()
    const desktop = window.matchMedia(sidePanelQuery)
    function closeOnDesktop() {
      if (desktop.matches) onClose()
    }
    desktop.addEventListener("change", closeOnDesktop)
    return () => {
      dialog?.close()
      desktop.removeEventListener("change", closeOnDesktop)
    }
  }, [onClose])

  return (
    <dialog className="rt-phone rt-chat-sheet" aria-label="Связь со штабом" ref={sheet} onCancel={event => {
      event.preventDefault()
      onClose()
    }}>
      <PhoneScreen {...feed} onClose={onClose} />
    </dialog>
  )
}

export function MessagePush({ message, onOpen }: { message: Delivered; onOpen: () => void }) {
  return <button className="rt-phone-push" type="button" onClick={onOpen}>
    <Avatar sender={message.sender} />
    <span><strong>{senders[message.sender].name}</strong><span>{message.text}</span></span>
  </button>
}

export default function AgentPhone({ open, onClose, ...feed }: FeedProps & { open: boolean; onClose: () => void }) {
  return (
    <>
      <aside className="rt-phone rt-phone-desktop" aria-label="Смартфон агента">
        <PhoneScreen {...feed} />
      </aside>
      {open && <ChatSheet {...feed} onClose={onClose} />}
    </>
  )
}
