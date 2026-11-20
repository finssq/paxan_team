import { useEffect, useReducer, useState, useSyncExternalStore } from "react"
import { CircleAlert, ClipboardCheck, Code2, Play, ShieldCheck } from "lucide-react"
import sponsorLogo from "./centr-invest.svg"
import chapterData from "./data/chapter1.json"
import { Review } from "./Review"
import { readSnapshot, reduceGame, saveKey } from "./game"
import type { GameAction } from "./game"
import type { Chapter, GameState } from "./types/game"
import { Badge, Card, RestartDialog } from "./ui"

const chapter = chapterData as Chapter
const title = "Игра о кибербезопасности"

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback)
  return () => window.removeEventListener("hashchange", callback)
}

function currentRoute() {
  return window.location.hash
}

function loadGame(data: Chapter) {
  try {
    const saved = window.localStorage.getItem(saveKey)
    return saved ? readSnapshot(data, JSON.parse(saved)) : null
  } catch {
    return null
  }
}

function useGameStore(data: Chapter) {
  const [state, dispatch] = useReducer(
    (current: GameState | null, action: GameAction) => reduceGame(data, current, action),
    data,
    loadGame,
  )
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (!state) return
    try {
      window.localStorage.setItem(saveKey, JSON.stringify(state))
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [state])

  return { state, dispatch, saveFailed }
}

function CodePreview() {
  const sample = chapter.updates[0]
  if (!sample) return null

  return (
    <div className="preview-wrap" aria-hidden="true">
      <div className="preview-orbit" />
      <Card className="preview">
        <div className="preview-bar">
          <span className="preview-app"><Code2 size={20} /> Просмотр кода</span>
          <span className="preview-context">{sample.sandbox.title}</span>
        </div>
        <div className="preview-body">
          <div className="preview-code">
            {sample.code.map((line, index) => {
              const [target, expression] = line.text.split(" ← ")
              return (
                <div className={line.isVulnerable ? "preview-highlight" : undefined} key={line.id}>
                  <span className="preview-line-number">{String(index + 1).padStart(2, "0")}</span>
                  <code>{expression ? <><strong>{target}</strong> ← {expression}</> : line.text}</code>
                  {line.isVulnerable && <CircleAlert size={17} />}
                </div>
              )
            })}
          </div>
        </div>
        <div className="preview-footer"><CircleAlert size={18} /> Служебные данные видны в браузере</div>
      </Card>
    </div>
  )
}

function Home() {
  return (
    <main className="shell home" id="main">
      <section className="hero">
        <div className="hero-copy">
          <img className="sponsor-logo" src={sponsorLogo} alt="Банк «Центр-инвест»" width={256} height={55} />
          <h1 id="page-title" tabIndex={-1}>Игра о<br /> <em>кибербезопасности</em></h1>
          <p>Пройди смену инженера по безопасности приложений и познакомься с его работой.</p>
          <div className="actions hero-actions">
            <a className="button button-primary hero-start prompt-action" href="#/chapters"><Play size={19} /> Начать играть</a>
            <span className="guest-access">Без регистрации</span>
          </div>
        </div>
        <CodePreview />
      </section>
    </main>
  )
}

function ShiftOverview({ state, onStart }: { state: GameState | null; onStart: () => void }) {
  const index = chapter.updates.findIndex(update => update.id === state?.updateId)
  return (
    <main className="shell chapter-page" id="main">
      <Card className="chapter-card">
        <div className="chapter-art" aria-hidden="true">
          <div className="chapter-ring"><ShieldCheck size={72} strokeWidth={1.25} /></div>
        </div>
        <div className="chapter-content">
          <Badge><ClipboardCheck size={15} /> {chapter.updates.length} обновлений</Badge>
          <h1 id="page-title" tabIndex={-1}>{chapter.title}</h1>
          <p>{chapter.description}</p>
          {state && <p className="save-caption">{state.step === "complete" ? "Смена завершена" : `Сохранено: обновление ${index + 1} из ${chapter.updates.length}`}</p>}
          <div className="actions">
            {state ? (
              <>
                <a className="button button-primary prompt-action" href="#/play">{state.step === "complete" ? "Посмотреть итог" : "Продолжить"}</a>
                <RestartDialog onRestart={onStart} />
              </>
            ) : <button className="button button-primary prompt-action" onClick={onStart}>Начать смену</button>}
          </div>
        </div>
      </Card>
    </main>
  )
}

export function App() {
  const route = useSyncExternalStore(subscribe, currentRoute)
  const { state, dispatch, saveFailed } = useGameStore(chapter)
  const view = route === "#/play" && state ? "play" : route === "#/chapters" || route === "#/play" ? "chapters" : "home"

  useEffect(() => {
    document.title = view === "home" ? title : chapter.title
    window.scrollTo(0, 0)
    if (view !== "home") document.getElementById("page-title")?.focus({ preventScroll: true })
  }, [view])

  function start() {
    dispatch({ type: "start" })
    window.location.hash = "/play"
  }

  return (
    <div className={`site site-${view}`}>
      <a className="skip-link" href="#main" onClick={event => {
        event.preventDefault()
        document.getElementById("page-title")?.focus()
      }}>К основному содержанию</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a href="#/" className="brand">пахан team</a>
          <nav className="main-nav" aria-label="Навигация">
            <a href="#/" aria-current={view === "home" ? "page" : undefined}>Главная</a>
            <a href="#/chapters" aria-current={view === "chapters" ? "page" : view === "play" ? "location" : undefined}>Играть</a>
          </nav>
        </div>
      </header>
      {view === "home" ? <Home /> : view === "play" && state
        ? <Review chapter={chapter} state={state} dispatch={dispatch} saveFailed={saveFailed} onRestart={start} />
        : <ShiftOverview state={state} onStart={start} />}
    </div>
  )
}
