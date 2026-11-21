import { Radio, X } from "lucide-react"
import { useEffect, useRef } from "react"
import type { PuzzleKind } from "./mapData"
import { nextObjective } from "./simulation"
import type { OfficeEvent } from "./simulation"

type Sender = "max" | "denis"
type Message = readonly [sender: Sender, message: string]

const base = import.meta.env.BASE_URL
const senders = {
  max: { name: "Макс", role: "Старший специалист по защите приложений", avatar: `${base}icons/mentor.svg` },
  denis: { name: "Денис", role: "Разработчик", avatar: `${base}icons/developer.svg` },
}

const messages: Record<OfficeEvent, readonly Message[]> = {
  briefing: [
    ["max", "После релиза проверяем офис как белые хакеры. В ресепшене тихо, начни с гостевого Wi-Fi."],
    ["denis", "Ставлю кофе, что тебя спалит первая же камера."],
  ],
  frequency: [
    ["max", "Гостевой Wi-Fi связан с сетью банка. Посетители могут добраться до внутренних систем."],
    ["denis", "Ладно, это было легко, но дальше охрана и мой отдел."],
  ],
  circuit: [
    ["denis", "Погоди, это же МОЙ ноутбук?! Я на минуту за кофе отошёл!"],
    ["max", "Вот поэтому экран всегда блокируют, даже если отходишь на минуту."],
  ],
  memory: [
    ["max", "Пароль на бумажке сработал. Этот стикер мог прочитать кто угодно."],
  ],
  gate: [
    ["max", "Шлюз в серверную открыт! Доберись до ядра банка."],
  ],
  camera: [
    ["max", "Красный луч — камера! Прячься за колонной или жми Пробел, чтобы отключить её импульсом EMP."],
  ],
  victory: [
    ["denis", "Всё, сдаюсь! Блокирую ноут и выкидываю стикеры."],
    ["max", "Хорошая работа, стажёр. Теперь банк знает, что исправить."],
  ],
}

const objectives: Record<PuzzleKind | "core", { step: number; desktop: string; touch: string }> = {
  frequency: {
    step: 1,
    desktop: "Подойди на WASD к гостевому Wi-Fi в ресепшене и нажми E.",
    touch: "Подойди к гостевому Wi-Fi в ресепшене и нажми «Взломать».",
  },
  circuit: {
    step: 2,
    desktop: "Проберись мимо камер к ноутбуку в офисе. Прячься за стенами или жми Пробел для EMP.",
    touch: "Проберись мимо камер к ноутбуку в офисе. Прячься за стенами или используй EMP.",
  },
  memory: {
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

export function messageCount(events: readonly OfficeEvent[]) {
  return events.reduce((count, event) => count + messages[event].length, 0)
}

function PhoneScreen({ events, onClose }: { events: readonly OfficeEvent[]; onClose?: () => void }) {
  const feed = useRef<HTMLOListElement>(null)
  const objective = objectives[nextObjective(events) ?? "core"]

  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight
  }, [events])

  return (
    <>
      <div className="rt-phone-top"><span aria-hidden="true" /><Radio size={14} aria-label="Связь установлена" /></div>
      <header className="rt-phone-header">
        <h2>Связь · Штаб</h2>
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
        {events.flatMap(event => messages[event].map(([sender, text], index) => (
          <li className="rt-message" data-sender={sender} key={`${event}-${index}`}>
            <img src={senders[sender].avatar} alt="" width={30} height={30} />
            <div><strong title={senders[sender].role}>{senders[sender].name}</strong><p>{text}</p></div>
          </li>
        )))}
      </ol>
    </>
  )
}

function ChatSheet({ events, onClose }: { events: readonly OfficeEvent[]; onClose: () => void }) {
  const sheet = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = sheet.current
    dialog?.showModal()
    const desktop = window.matchMedia("(min-width: 1024px)")
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
      <PhoneScreen events={events} onClose={onClose} />
    </dialog>
  )
}

export default function AgentPhone({ events, open, onClose }: { events: readonly OfficeEvent[]; open: boolean; onClose: () => void }) {
  return (
    <>
      <aside className="rt-phone rt-phone-desktop" aria-label="Смартфон агента">
        <PhoneScreen events={events} />
      </aside>
      {open && <ChatSheet events={events} onClose={onClose} />}
    </>
  )
}
