import { ArrowRight, CircleAlert, CircleCheck, Code2, LockKeyhole, Play, Smartphone, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { createSfx } from "./audio/sfx"
import sponsorLogo from "./centr-invest.svg"
import { chapter, paymentPreview, paymentTicket } from "./data/paymentPreview"
import workLabMark from "./favicon.svg"
import type { Difficulty } from "./types/game"
import { Card, CodeSource } from "./ui"

const nicknameKey = "worklab.nickname.v1"
const nicknameLimit = 32
const difficultyKey = "worklab.difficulty.v1"
const bootDuration = 1400

function DeskStartup({ audio, difficulty }: { audio: ReturnType<typeof createSfx>; difficulty: Difficulty }) {
  const [Desk, setDesk] = useState<typeof import("./game/ReviewDesk").default | "failed" | null>(null)

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

  if (Desk && Desk !== "failed") return <Desk chapter={chapter} ticket={paymentTicket} audio={audio} difficulty={difficulty} />

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
    const playerName = nickname.trim()
    try {
      if (playerName) window.localStorage.setItem(nicknameKey, playerName)
      else window.localStorage.removeItem(nicknameKey)
    } catch {}
    onStart("intern")
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
          <button className="difficulty-option surface" type="submit" aria-labelledby="easy-title" aria-describedby="easy-description">
            <span>
              <span id="easy-title" className="difficulty-label">Простой</span>
              <span id="easy-description" className="difficulty-description">Макс поможет разобраться с задачами первой смены.</span>
            </span>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
          {["Средний", "Сложный"].map(label => (
            <button key={label} className="difficulty-option surface" type="button" disabled>
              <span>
                <span className="difficulty-label">{label}</span>
                <span className="difficulty-status" aria-hidden="true">Пока недоступен</span>
              </span>
              <LockKeyhole size={20} aria-hidden="true" />
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
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    try {
      const saved = window.localStorage.getItem(difficultyKey)
      if (saved === "medium" || saved === "hard") return saved
    } catch {}
    return "intern"
  })

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
    setDifficulty(level)
    try { window.localStorage.setItem(difficultyKey, level) } catch {}
    window.location.hash = "#desk"
  }

  if (route === "desk") return <DeskStartup audio={audio} difficulty={difficulty} />

  const choosingDifficulty = route === "difficulty"

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
            <a href="#game" aria-current={choosingDifficulty ? "page" : undefined}>Играть</a>
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
              <a className="hero-start" href="#game"><Play size={19} aria-hidden="true" /> Начать играть</a>
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
