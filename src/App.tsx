import { ArrowRight, CircleAlert, CircleCheck, Code2, Gamepad2, Map, Mouse, Play, RotateCcw, ShieldCheck, Smartphone, Timer, UserRound } from "lucide-react"
import { useEffect, useState } from "react"
import { createSfx } from "./audio/sfx"
import sponsorLogo from "./centr-invest.svg"
import { chapter, paymentPreview } from "./data/paymentPreview"
import { fridayChapter, incidentTicket, practiceTicket } from "./data/friday"
import { trainingTicket } from "./data/training"
import workLabMark from "./favicon.svg"
import { clearShift, initialReview, readShift, saveShift } from "./game/review"
import { readFeedback, readSoundPreference, saveSoundPreference } from "./game/feedback"
import { Card, CodeSource } from "./ui"

const bootDuration = 1400

function readCurrentShift() {
  const saved = readShift(fridayChapter, practiceTicket, ["friday-profile", "friday-transfer", "friday-traffic"])
  if (saved) return saved
  const previous = readShift(chapter, trainingTicket)
  if (previous?.ticket.id === trainingTicket.id) {
    return { ticket: practiceTicket, state: initialReview, feedback: { ...readFeedback(null, [], practiceTicket.id, false), sound: previous.feedback.sound } }
  }
  return previous && {
    ticket: incidentTicket,
    state: initialReview,
    feedback: { ...readFeedback(null, [], incidentTicket.id, false), sound: previous.feedback.sound },
  }
}

function DeskStartup({ audio }: { audio: ReturnType<typeof createSfx> }) {
  const [Desk, setDesk] = useState<typeof import("./game/ReviewDesk").default | "failed" | null>(null)
  const [saved, setSaved] = useState(readCurrentShift)

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
    const ticket = saved?.ticket ?? practiceTicket
    return <Desk key={ticket.id} chapter={fridayChapter} ticket={ticket} saved={saved} audio={audio} training={false} onStartShift={feedback => {
      const firstTask = incidentTicket
      const next = { ...feedback, wave: undefined, completed: [], streak: 0, run: readFeedback(null, [], firstTask.id, false).run }
      saveShift(firstTask, initialReview, next)
      setSaved({ ticket: firstTask, state: initialReview, feedback: next })
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

function GameSelection({ onStart }: { onStart: () => void }) {
  return (
    <main className="shell game-selection" id="main" tabIndex={-1}>
      <header>
        <h1>Выбери игру</h1>
        <p>Две стороны кибербезопасности: защита кода за рабочим столом и полевой аудит офиса.</p>
      </header>
      <div className="game-options">
        <article className="game-option" aria-labelledby="blue-game-title">
          <div className="game-preview">
            <span className="game-team">01 · Blue Team</span>
            <div className="game-editor" aria-hidden="true">
              <div className="game-editor-bar"><i /><i /><i /><span>WorkCode</span></div>
              <code>const order = getOrder();</code>
              <code>if (!order) return;</code>
              <code data-warning>sendReport(order);</code>
              <code>return confirm(order);</code>
            </div>
            <div className="game-traffic" aria-hidden="true"><span>Перехват трафика</span><i /></div>
          </div>
          <div className="game-option-body">
            <h2 id="blue-game-title">{fridayChapter.title}</h2>
            <p>Перехватывай трафик, находи утечки в коде Дениса и спаси релиз банка до 18:00.</p>
            <ul className="game-tags" role="list">
              <li><ShieldCheck size={14} aria-hidden="true" /> Аудит кода</li>
              <li><Mouse size={14} aria-hidden="true" /> Мышь / Тач</li>
              <li><Timer size={14} aria-hidden="true" /> 5–7 мин</li>
            </ul>
            <div className="game-option-footer"><button className="game-action" type="button" onClick={onStart}>Начать игру <ArrowRight size={18} aria-hidden="true" /></button></div>
          </div>
        </article>
        <article className="game-option" aria-labelledby="red-game-title">
          <div className="game-preview game-preview-office">
            <span className="game-team">02 · Red Team</span>
            <svg className="game-office" viewBox="0 0 360 115" aria-hidden="true">
              <path className="game-office-walls" d="M25 12H335V105H25ZM112 12V48M112 72V105M25 66H73M137 65H224M164 12V38M224 12V74M224 96V105M283 64H335" />
              <path className="game-office-furniture" d="M40 29h38v18H40zM43 80h24v14H43zM121 28h26v17h-26zM177 26h27v20h-27zM238 79h22v15h-22zM298 75h26v6h-26zM298 87h26v6h-26z" />
              <path className="game-office-cone" d="M286 37l-51 60a79 79 0 0 0 77 15Z" />
              <circle cx="286" cy="37" r="3.5" fill="#f87171" />
              <circle className="game-office-ring" cx="198" cy="84" r="10" />
              <circle cx="198" cy="84" r="3" fill="#ff8d8d" />
              <circle className="game-office-agent" cx="92" cy="84" r="4" />
            </svg>
          </div>
          <div className="game-option-body">
            <h2 id="red-game-title">Аудит офиса</h2>
            <p>Проберись через камеры и дронов охраны, найди 3 дыры в офисе и дойди до ядра серверной.</p>
            <ul className="game-tags" role="list">
              <li><Map size={14} aria-hidden="true" /> 2D-стелс</li>
              <li><Gamepad2 size={14} aria-hidden="true" /> WASD / Джойстик</li>
              <li><Code2 size={14} aria-hidden="true" /> Без кода</li>
            </ul>
            <div className="game-option-footer"><span className="game-status">Скоро</span></div>
          </div>
        </article>
      </div>
    </main>
  )
}

function getRoute() {
  const hash = window.location.hash
  if (hash === "#desk") return "desk"
  if (hash === "#game" || hash === "#worklab") return "modules"
  return "home"
}

export function App() {
  const [route, setRoute] = useState(getRoute)
  const [audio] = useState(() => createSfx(readSoundPreference(readCurrentShift()?.feedback.sound)))

  useEffect(() => {
    const events = ["pointerdown", "click", "keydown"] as const
    events.forEach(event => window.addEventListener(event, audio.unlock, true))
    return () => {
      events.forEach(event => window.removeEventListener(event, audio.unlock, true))
      audio.close()
    }
  }, [audio])
  useEffect(() => {
    document.title = route === "desk" ? `${fridayChapter.title} · WorkLab` : "WorkLab"
  }, [route])

  useEffect(() => {
    function followRoute() {
      setRoute(getRoute())
      if (window.location.hash !== "#main") window.scrollTo(0, 0)
    }

    window.addEventListener("hashchange", followRoute)
    return () => window.removeEventListener("hashchange", followRoute)
  }, [])

  function startDesk() {
    saveSoundPreference(readSoundPreference(readCurrentShift()?.feedback.sound))
    clearShift()
    window.location.hash = "#desk"
  }

  if (route === "desk") return <DeskStartup audio={audio} />

  const choosingGame = route === "modules"
  const saved = choosingGame ? null : readCurrentShift()

  return (
    <div className="site">
      <a className="skip-link" href="#main">К основному содержанию</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="header-brand" href="./" aria-label="WorkLab — главная">
            <img src={workLabMark} alt="" width={22} height={22} /> WorkLab
          </a>
          <nav className="main-nav" aria-label="Навигация">
            <a href="#home" aria-current={!choosingGame ? "page" : undefined}>Главная</a>
            <a href="#game" aria-current={choosingGame ? "page" : undefined}>Играть</a>
          </nav>
        </div>
      </header>
      {choosingGame ? <GameSelection onStart={startDesk} /> : <main className="shell home" id="main" tabIndex={-1}>
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
                <a className="hero-start" href="#desk" onClick={audio.unlock}><Play size={19} aria-hidden="true" /> <span>Продолжить играть <small>{fridayChapter.title}</small></span></a>
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
