import { ArrowRight, CircleAlert, CircleCheck, Code2, Flame, Play, RotateCcw, Smartphone, Sprout, UserRound, Zap } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { createSfx } from "./audio/sfx"
import sponsorLogo from "./centr-invest.svg"
import { chapter, paymentPreview, paymentTicket } from "./data/paymentPreview"
import { fridayChapter, incidentTicket } from "./data/friday"
import { trainingTicket } from "./data/training"
import workLabMark from "./favicon.svg"
import { clearShift, initialReview, readShift, saveShift } from "./game/review"
import { readFeedback } from "./game/feedback"
import type { Difficulty } from "./types/game"
import { Card, CodeSource } from "./ui"

const nicknameKey = "worklab.nickname.v1"
const nicknameLimit = 32
const difficultyKey = "worklab.difficulty.v1"
const bootDuration = 1400
const difficultyOptions = {
  intern: { label: "Простой", icon: Sprout },
  medium: { label: "Средний", icon: Zap },
  hard: { label: "Сложный", icon: Flame },
} satisfies Record<Difficulty, { label: string; icon: typeof Sprout }>

function parseDifficulty(value: string | null): Difficulty {
  return value === "medium" || value === "hard" ? value : "intern"
}

function loadDifficulty(): Difficulty {
  try {
    return parseDifficulty(localStorage.getItem(difficultyKey))
  } catch {}
  return "intern"
}

function readCurrentShift(difficulty: Difficulty) {
  const saved = difficulty === "medium"
    ? readShift(fridayChapter, trainingTicket, ["friday-profile", "friday-transfer", "friday-traffic"]) : readShift(chapter, trainingTicket)
  if (saved || difficulty !== "medium") return saved
  const previous = readShift(chapter)
  return previous && {
    ticket: incidentTicket,
    state: initialReview,
    feedback: { ...readFeedback(null, [], incidentTicket.id, false), sound: previous.feedback.sound },
  }
}

function DeskStartup({ audio, difficulty }: { audio: ReturnType<typeof createSfx>; difficulty: Difficulty }) {
  const [Desk, setDesk] = useState<typeof import("./game/ReviewDesk").default | "failed" | null>(null)
  const [saved, setSaved] = useState(() => readCurrentShift(difficulty))
  const activeChapter = difficulty === "medium" ? fridayChapter : chapter

  useEffect(() => {
    const startedAt = performance.now()
    let active = true
    let timer: number | undefined

    void import("./game/ReviewDesk").then(({ default: ReviewDesk }) => {
      if (!active) return
      const remaining = Math.max(0, bootDuration - (performance.now() - startedAt))
      timer = window.setTimeout(() => setDesk(() => ReviewDesk), remaining)
    }, () => {
      if (active) setDesk("failed")
    })

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  if (Desk && Desk !== "failed") {
    const ticket = saved?.ticket ?? trainingTicket
    const training = ticket.id === trainingTicket.id
    return <Desk key={ticket.id} chapter={activeChapter} ticket={ticket} saved={saved} audio={audio} training={training} difficultyLabel={difficultyOptions[difficulty].label} onStartShift={feedback => {
      const firstTask = difficulty === "medium" ? incidentTicket : paymentTicket
      saveShift(firstTask, initialReview, feedback)
      setSaved({ ticket: firstTask, state: initialReview, feedback })
    }} />
  }

  return (
    <main className="boot-screen">
      <img className="boot-logo" src={workLabMark} width={60} height={60} alt="WorkLab" />
      {Desk === "failed" ? (
        <div className="boot-recovery">
          <p role="alert">Не удалось запустить WorkOS.</p>
          <button type="button" onClick={() => window.location.reload()}>Повторить</button>
        </div>
      ) : (
        <div className="boot-progress" role="progressbar" aria-label="Запуск WorkOS" />
      )}
    </main>
  )
}

function loadNickname() {
  try {
    return window.localStorage.getItem(nicknameKey)?.trim().slice(0, nicknameLimit) ?? ""
  } catch {
    return ""
  }
}

function CodePreview() {
  const [activeHint, setActiveHint] = useState<number | null>(null)
  const [selectedHint, setSelectedHint] = useState<number | null>(null)
  const [repaired, setRepaired] = useState(false)

  const StatusIcon = repaired ? CircleCheck : CircleAlert
  const hintIndex = activeHint ?? selectedHint
  const hintLine = hintIndex === null ? undefined : paymentPreview.lines[hintIndex]
  const hint = (repaired ? hintLine?.repair?.hint : undefined) ?? hintLine?.hint ?? paymentPreview.prompt

  return (
    <section className="preview-wrap" aria-label="Превью проверки обновления">
      <Card className="preview">
        <div className="preview-bar">
          <span className="preview-app"><Code2 size={20} /> Просмотр кода</span>
          <div className="preview-context">
            <code className="preview-file">{paymentPreview.feature}</code>
            <span className="preview-audit">{paymentPreview.audit}</span>
          </div>
        </div>
        <div className="preview-body">
          <div className="preview-code">
            {paymentPreview.lines.map((line, index) => {
              const fix = repaired ? line.repair : undefined
              const number = String(index + 1).padStart(2, "0")
              const hintId = `payment-hint-${number}`
              return (
                <div
                  className="preview-row"
                  key={line.text}
                  style={{ animationDelay: `${130 + index * 45}ms` }}
                  onPointerEnter={event => {
                    if (event.pointerType !== "touch") setActiveHint(index)
                  }}
                  onPointerLeave={event => {
                    if (event.pointerType !== "touch") setActiveHint(value => value === index ? null : value)
                  }}
                  onKeyDown={event => {
                    if (event.key === "Escape") {
                      setActiveHint(null)
                      setSelectedHint(null)
                    }
                  }}
                >
                  <button
                    className="preview-line"
                    type="button"
                    data-tone={line.repair ? (fix ? "safe" : "warning") : undefined}
                    data-active={hintIndex === index}
                    aria-describedby={hintId}
                    onFocus={() => setActiveHint(index)}
                    onBlur={() => setActiveHint(value => value === index ? null : value)}
                    onClick={() => {
                      setActiveHint(index)
                      setSelectedHint(index)
                      if (line.repair) setRepaired(true)
                    }}
                  >
                    <span className="preview-line-number">{number}</span>
                    <span className="preview-source">
                      <CodeSource text={line.text} hidden={Boolean(fix)} />
                      {line.repair && <CodeSource text={line.repair.text} hidden={!fix} />}
                    </span>
                    {line.repair && <StatusIcon className="preview-line-icon" size={17} aria-hidden="true" />}
                  </button>
                  <span className="sr-only" id={hintId}>{fix?.hint ?? line.hint}</span>
                </div>
              )
            })}
          </div>
        </div>
        <p className="preview-hint" data-active={hintIndex !== null}>{hint}</p>
        <div className="preview-footer" data-tone={repaired ? "safe" : "warning"} role="status">
          <StatusIcon size={18} aria-hidden="true" />
          <span className="preview-status-text" data-warning={paymentPreview.warning}>
            <span>{repaired ? paymentPreview.success : paymentPreview.warning}</span>
          </span>
        </div>
      </Card>
    </section>
  )
}

function DifficultySelection({ onStart }: { onStart: (difficulty: Difficulty) => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [nickname, setNickname] = useState(loadNickname)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])

  function startGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const difficulty = parseDifficulty(submitter instanceof HTMLButtonElement ? submitter.value : null)
    const playerName = nickname.trim()
    try {
      if (playerName) window.localStorage.setItem(nicknameKey, playerName)
      else window.localStorage.removeItem(nicknameKey)
    } catch {}
    onStart(difficulty)
  }

  return (
    <main className="shell difficulty" id="main" tabIndex={-1}>
      <h1 tabIndex={-1} ref={heading}>Выбери сложность</h1>
      <form className="difficulty-form" onSubmit={startGame}>
        <label className="difficulty-nickname">
          <span>Никнейм <small>необязательно</small></span>
          <input name="nickname" placeholder="Введи свой никнейм" autoComplete="nickname" maxLength={nicknameLimit} value={nickname}
            onChange={event => setNickname(event.target.value)} />
        </label>
        <div className="difficulty-options">
          {Object.entries(difficultyOptions).map(([level, { label, icon: Icon }]) => (
            <button key={level} className="difficulty-option surface" type="submit" value={level}>
              <span className="difficulty-icon"><Icon size={23} aria-hidden="true" /></span>
              <span className="difficulty-label">{label}</span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          ))}
        </div>
      </form>
    </main>
  )
}

function getRoute() {
  const hash = window.location.hash
  if (hash === "#desk") return "desk"
  if (hash === "#game") return "difficulty"
  return "home"
}

export function App() {
  const [route, setRoute] = useState(getRoute)
  const [audio] = useState(createSfx)
  const [difficulty, setDifficulty] = useState(loadDifficulty)

  useEffect(() => () => audio.close(), [audio])

  useEffect(() => {
    function followRoute() {
      setRoute(getRoute())
      if (window.location.hash !== "#main") window.scrollTo(0, 0)
    }

    window.addEventListener("hashchange", followRoute)
    return () => window.removeEventListener("hashchange", followRoute)
  }, [])

  function startDesk(level: Difficulty) {
    audio.unlock()
    clearShift()
    setDifficulty(level)
    try { window.localStorage.setItem(difficultyKey, level) } catch {}
    window.location.hash = "#desk"
  }

  if (route === "desk") return <DeskStartup audio={audio} difficulty={difficulty} />

  const choosingDifficulty = route === "difficulty"
  const saved = choosingDifficulty ? null : readCurrentShift(difficulty)
  const activeChapter = difficulty === "medium" ? fridayChapter : chapter

  return (
    <div className="site">
      <a className="skip-link" href="#main">К основному содержанию</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="header-brand" href="./" aria-label="WorkLab — главная">
            <img src={workLabMark} alt="" width={22} height={22} /> WorkLab
          </a>
          <nav className="main-nav" aria-label="Навигация">
            <a href="#home" aria-current={choosingDifficulty ? undefined : "page"}>Главная</a>
            <a href={saved ? "#desk" : "#game"} aria-current={choosingDifficulty ? "page" : undefined}>Играть</a>
          </nav>
        </div>
      </header>
      {choosingDifficulty ? <DifficultySelection onStart={startDesk} /> : <main className="shell home" id="main" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <div className="sponsor-badge">
              <img className="sponsor-logo" src={sponsorLogo} alt="Банк «Центр-инвест»" width={256} height={55} />
              <span className="sponsor-caption">Партнёрский кейс</span>
            </div>
            <h1>
              Work<span className="brand-accent">Lab</span>
              <span className="brand-sheen" aria-hidden="true">WorkLab</span>
            </h1>
            <p>Браузерная игра о кибербезопасности. Проведи смену в роли инженера по безопасности приложений.</p>
            <div className="hero-actions">
              {saved ? <>
                <a className="hero-start" href="#desk" onClick={audio.unlock}><Play size={19} aria-hidden="true" /> <span>Продолжить играть <small>{saved.ticket.id === trainingTicket.id ? "Задача 0 · Обучение" : `${difficulty === "medium" ? "Волна" : "Задача"} ${activeChapter.tickets.indexOf(saved.ticket) + 1}/${activeChapter.tickets.length + activeChapter.upcoming.length}`}</small></span></a>
                <a className="hero-restart" href="#game"><RotateCcw size={17} aria-hidden="true" /> Начать заново</a>
              </> : <a className="hero-start" href="#game"><Play size={19} aria-hidden="true" /> Начать играть</a>}
            </div>
            <ul className="hero-meta" aria-label="О смене" role="list">
              <li><UserRound size={14} aria-hidden="true" /> Без регистрации</li>
              <li><Smartphone size={14} aria-hidden="true" /> ПК и телефон</li>
            </ul>
          </div>
          <CodePreview />
        </section>
      </main>}
      <footer className="site-footer">
        <div className="shell footer-inner">
          <span className="footer-brand">WorkLab <span aria-hidden="true">•</span> пахан team</span>
          <span>Cyber Garden School <span aria-hidden="true">•</span> 2026</span>
        </div>
      </footer>
    </div>
  )
}
