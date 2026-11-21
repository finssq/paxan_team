import { ArrowRight, CircleAlert, CircleCheck, Code2, Gamepad2, Map, Smartphone, UserRound } from "lucide-react"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { createSfx } from "./audio/sfx"
import { clearCampaign, emptyCampaign, readCampaign, recordRedWin, writeCampaign } from "./campaignProgress"
import type { CampaignProgress } from "./campaignProgress"
import MissionHub from "./components/MissionHub"
import sponsorLogo from "./centr-invest.svg"
import { chapter, paymentPreview } from "./data/paymentPreview"
import { fridayChapter, incidentTicket, practiceTicket } from "./data/friday"
import { trainingTicket } from "./data/training"
import workLabMark from "./favicon.svg"
import { clearShift, initialReview, readShift, saveShift } from "./game/review"
import { readFeedback, readSoundPreference } from "./game/feedback"
import type { Feedback } from "./game/feedback"
import { initialWave } from "./game/incidentWave"
import type { Difficulty, Rank } from "./redteam/difficulty"
import type { Ticket } from "./types/game"
import { Card, CodeSource } from "./ui"

const bootDuration = 1400
const RedTeamGame = lazy(() => import("./redteam/RedTeamGame"))

function readCurrentShift() {
  const saved = readShift(fridayChapter, practiceTicket, ["friday-profile", "friday-transfer", "friday-traffic"])
  if (saved) return saved
  const previous = readShift(chapter, trainingTicket)
  const ticket = previous?.ticket.id === trainingTicket.id ? practiceTicket : incidentTicket
  return previous && {
    ticket,
    state: initialReview,
    feedback: readFeedback(null, [], ticket.id, false),
  }
}

function hasReleasedFinalWave(saved: ReturnType<typeof readCurrentShift>) {
  return saved?.state.step === "released" && saved.ticket.id === fridayChapter.tickets.at(-1)?.id
}

function DeskStartup({ audio, onComplete }: { audio: ReturnType<typeof createSfx>; onComplete: () => void }) {
  const [Desk, setDesk] = useState<typeof import("./game/ReviewDesk").default | "failed" | null>(null)
  const [saved, setSaved] = useState(readCurrentShift)
  const [shift, setShift] = useState(0)

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

  function enterWave(ticket: Ticket, feedback: Feedback) {
    saveShift(ticket, initialReview, feedback)
    setSaved({ ticket, state: initialReview, feedback })
  }

  if (Desk && Desk !== "failed") {
    const ticket = saved?.ticket ?? practiceTicket
    return <Desk key={`${shift}:${ticket.id}`} chapter={fridayChapter} ticket={ticket} saved={saved} audio={audio} training={false} onAdvanceWave={enterWave} onComplete={onComplete} onStartShift={(feedback, startImmediately) => {
      const firstTask = incidentTicket
      const wave = startImmediately ? { ...initialWave, started: true } : undefined
      const next = { ...feedback, wave, story: undefined, hadAutoDeploy: false, completed: [], streak: 0, run: readFeedback(null, [], firstTask.id, false).run }
      setShift(value => value + 1)
      enterWave(firstTask, next)
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

function OfficeMap() {
  return (
    <svg className="game-office" viewBox="0 0 360 115" aria-hidden="true">
      <path className="game-office-walls" d="M25 12H335V105H25ZM112 12V48M112 72V105M25 66H73M137 65H224M164 12V38M224 12V74M224 96V105M283 64H335" />
      <path className="game-office-furniture" d="M40 29h38v18H40zM43 80h24v14H43zM121 28h26v17h-26zM177 26h27v20h-27zM238 79h22v15h-22zM298 75h26v6h-26zM298 87h26v6h-26z" />
      <path className="game-office-cone" d="M286 37l-51 60a79 79 0 0 0 77 15Z" />
      <circle cx="286" cy="37" r="3.5" fill="#f87171" />
      <circle className="game-office-ring" cx="198" cy="84" r="10" />
      <circle cx="198" cy="84" r="3" fill="#ff8d8d" />
      <circle className="game-office-agent" cx="92" cy="84" r="4" />
    </svg>
  )
}

function HeroPreview() {
  const [office, setOffice] = useState(false)

  return (
    <div className="hero-previews">
      <div className="hero-preview-switch" role="group" aria-label="Превью игр">
        <button type="button" aria-pressed={!office} onClick={() => setOffice(false)}>Blue Team · Код</button>
        <button type="button" aria-pressed={office} onClick={() => setOffice(true)}>Red Team · Офис</button>
      </div>
      <div className="hero-preview-panels" data-office={office}>
        <div className="hero-code-panel" inert={office}><CodePreview /></div>
        <section className="hero-office-panel" inert={!office} aria-label="Превью проникновения в офис">
          <Card className="preview hero-office-card">
            <div className="preview-bar"><span className="preview-app"><Map size={20} aria-hidden="true" /> План офиса</span></div>
            <div className="game-preview-office hero-office-map"><OfficeMap /></div>
            <div className="preview-footer" data-tone="warning">
              <CircleAlert size={18} aria-hidden="true" /> Найдены уязвимости: незаблокированный ноутбук и открытый Wi-Fi
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}

function getRoute() {
  const hash = window.location.hash
  if (hash === "#desk") return "desk"
  if (hash === "#redteam") return "redteam"
  if (hash === "#game" || hash === "#worklab") return "modules"
  return "home"
}

export function App() {
  const [route, setRoute] = useState(getRoute)
  const [audio] = useState(() => createSfx(readSoundPreference()))
  const [campaign, setCampaign] = useState(() => {
    const saved = readCampaign()
    return !saved.blueCompleted && hasReleasedFinalWave(readCurrentShift()) ? { ...saved, blueCompleted: true } : saved
  })
  const campaignRef = useRef(campaign)

  function saveCampaign(next: CampaignProgress) {
    campaignRef.current = next
    setCampaign(next)
    writeCampaign(next)
  }

  function completeBlueChapter() {
    if (!campaignRef.current.blueCompleted) saveCampaign({ ...campaignRef.current, blueCompleted: true })
  }

  function selectDifficulty(difficulty: Difficulty) {
    const current = campaignRef.current
    if (current.red.difficulty !== difficulty) saveCampaign({ ...current, red: { ...current.red, difficulty } })
  }

  function completeRedChapter(result: { rank: Rank; score: number }) {
    saveCampaign(recordRedWin(campaignRef.current, result))
  }

  function resetCampaign() {
    const blueCleared = clearShift()
    const campaignCleared = clearCampaign()
    campaignRef.current = emptyCampaign
    setCampaign(emptyCampaign)
    return blueCleared && campaignCleared
  }

  useEffect(() => {
    const current = campaignRef.current
    if (current.blueCompleted && !readCampaign().blueCompleted) writeCampaign(current)
  }, [])

  useEffect(() => {
    const events = ["pointerdown", "click", "keydown"] as const
    events.forEach(event => window.addEventListener(event, audio.unlock, true))
    return () => {
      events.forEach(event => window.removeEventListener(event, audio.unlock, true))
      audio.close()
    }
  }, [audio])
  useEffect(() => {
    document.title = route === "desk" ? `${fridayChapter.title} · WorkLab` : route === "redteam" ? "Проникновение в офис · WorkLab" : "WorkLab"
  }, [route])

  useEffect(() => {
    function followRoute() {
      setRoute(getRoute())
      if (window.location.hash !== "#main") window.scrollTo(0, 0)
    }

    window.addEventListener("hashchange", followRoute)
    return () => window.removeEventListener("hashchange", followRoute)
  }, [])

  if (route === "desk") return <DeskStartup audio={audio} onComplete={completeBlueChapter} />
  if (route === "redteam") {
    return <Suspense fallback={<main className="boot-screen" role="status">Загружаем офис…</main>}>
      <RedTeamGame audio={audio} difficulty={campaign.red.difficulty} onDifficulty={selectDifficulty} onComplete={completeRedChapter} />
    </Suspense>
  }

  const choosingGame = route === "modules"

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
      {choosingGame ? <MissionHub canResume={Boolean(readCurrentShift())} campaign={campaign} officePreview={<OfficeMap />} onReset={resetCampaign} /> : <main className="shell home" id="main" tabIndex={-1}>
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
            <p>Испытай себя в кибербезопасности с обеих сторон. Останови утечку кода до релиза — или прокрадись в офис банка и вскрой его слабые места.</p>
            <div className="hero-actions">
              <a className="hero-start" href="#game">Выбрать игру <ArrowRight size={19} aria-hidden="true" /></a>
            </div>
            <ul className="hero-meta" aria-label="Об играх" role="list">
              <li><Gamepad2 size={14} aria-hidden="true" /> 2 игры</li>
              <li><UserRound size={14} aria-hidden="true" /> Без регистрации</li>
              <li><Smartphone size={14} aria-hidden="true" /> ПК и телефон</li>
            </ul>
          </div>
          <HeroPreview />
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
