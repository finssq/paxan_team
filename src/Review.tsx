import { useEffect, useState } from "react"
import {
  AppWindow, Box, Check, CircleAlert, ClipboardCheck, Code2, Fingerprint,
  FlaskConical, MessageSquare, ScanLine, Shield, ShieldCheck, Stamp, Terminal, Vault,
} from "lucide-react"
import type { Dispatch } from "react"
import { visibleChecks } from "./game"
import type { GameAction } from "./game"
import type { Chapter, GameState, Update } from "./types/game"
import { Badge, Card, RestartDialog } from "./ui"

function playStamp() {
  try {
    const audio = new AudioContext()
    const oscillator = audio.createOscillator()
    const volume = audio.createGain()
    const time = audio.currentTime
    oscillator.type = "triangle"
    oscillator.frequency.setValueAtTime(132, time)
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.11)
    volume.gain.setValueAtTime(0.12, time)
    volume.gain.exponentialRampToValueAtTime(0.001, time + 0.16)
    oscillator.connect(volume).connect(audio.destination)
    oscillator.onended = () => { void audio.close().catch(() => undefined) }
    oscillator.start()
    oscillator.stop(time + 0.17)
  } catch {
    return
  }
}

const instructions: Record<GameState["step"], string> = {
  explore: "Запусти проверку в тестовом окне.",
  locate: "Выбери строку, которая объясняет результат.",
  patch: "Выбери исправление и проверь его результат.",
  retest: "Перепроверь защиту и обычную работу функции.",
  stamp: "Обе проверки пройдены. Обновление можно выпускать.",
  complete: "Смена завершена.",
}

const sandboxIcons = {
  inspector: Fingerprint,
  "url-bar": AppWindow,
  "ai-chat": MessageSquare,
  "package-registry": Box,
}

function CodeViewer({ update, state, dispatch }: { update: Update; state: GameState; dispatch: Dispatch<GameAction> }) {
  const [hintId, setHintId] = useState(state.lineId)
  const hint = update.code.find(line => line.id === hintId)?.humanHint

  return (
    <Card className="work-card code-card">
      <h2 className="panel-heading"><Code2 size={20} /> Как это работает</h2>
      <div className="code-lines">
        {update.code.map((line, index) => {
          const [keyword, ...rest] = line.text.split(" ")
          return (
            <button
              type="button"
              key={line.id}
              className={`code-line ${hintId === line.id ? "hinted" : ""}`}
              aria-label={`Строка ${index + 1}. ${line.text}`}
              aria-pressed={state.lineId === line.id}
              onFocus={() => setHintId(line.id)}
              onMouseEnter={() => setHintId(line.id)}
              onClick={() => {
                setHintId(line.id)
                dispatch({ type: "mark", id: line.id })
              }}
            >
              <span className="line-index">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{keyword}</strong> {rest.join(" ")}</span>
            </button>
          )
        })}
      </div>
      <div className="code-hint" role="status">
        {hint ?? "Наведи курсор, нажми или выбери строку клавиатурой, чтобы прочитать пояснение."}
      </div>
      {state.step === "locate" && state.lineId && (
        <p className="line-feedback" role="status">Эта строка не объясняет результат. Проверь соседние правила.</p>
      )}
    </Card>
  )
}

function Sandbox({ update, state, dispatch }: { update: Update; state: GameState; dispatch: Dispatch<GameAction> }) {
  const Icon = sandboxIcons[update.sandbox.kind]
  const checks = visibleChecks(update, state)
  return (
    <Card className="work-card sandbox-card">
      <h2 className="panel-heading"><FlaskConical size={20} /> Тестовое окно</h2>
      <div className={`sandbox-screen sandbox-${update.sandbox.kind}`}>
        <div className="sandbox-app"><span><Icon size={23} /></span><div><strong>{update.sandbox.title}</strong><small>{update.sandbox.detail}</small></div></div>
        <div className="sandbox-results" aria-live="polite">
          {checks ? (
            [{ label: "Безопасность", check: checks.security }, { label: "Обычная работа", check: checks.feature }].map(({ label, check }) => {
              const Status = check.passed ? Check : CircleAlert
              return (
                <div className={`result-row ${check.passed ? "passed" : "failed"}`} key={label}>
                  <Status size={18} />
                  <div><strong>{label}</strong><p>{check.message}</p></div>
                </div>
              )
            })
          ) : <p className="sandbox-empty">Результаты появятся после проверки.</p>}
        </div>
      </div>
      <div className="tool-panel">
        <span>Инструменты проверки</span>
        <button className="button button-secondary" disabled={state.step !== "explore"} onClick={() => dispatch({ type: "check" })}>
          <ScanLine size={18} /> {update.sandbox.tool}
        </button>
      </div>
    </Card>
  )
}

function RepairOptions({ update, state, dispatch }: { update: Update; state: GameState; dispatch: Dispatch<GameAction> }) {
  const canRetest = state.step === "retest"
  const vault = update.repair.kind === "drag-to-vault"
  function choose(id: string) { dispatch({ type: "repair", id }) }

  return (
    <Card className="repair-card">
      <div>
        <h2>Исправление</h2>
        <p>Выбери вариант и сравни результаты в тестовом окне.</p>
      </div>
      <div className={`repair-options repair-${update.repair.kind}`} role="group" aria-label="Варианты исправления">
        {update.repair.options.map(option => (
          <button
            key={option.id}
            type="button"
            className="repair-option"
            aria-pressed={option.id === state.repairId}
            draggable={vault}
            onDragStart={event => {
              if (vault) event.dataTransfer.setData("text/plain", option.id)
            }}
            onClick={() => choose(option.id)}
          >
            <span className="option-indicator">{option.id === state.repairId && <Check size={14} />}</span>
            {option.label}
          </button>
        ))}
      </div>
      {vault && (
        <div className="vault-target" onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault()
          choose(event.dataTransfer.getData("text/plain"))
        }}>
          <Vault size={19} /> Можно перетащить вариант сюда или выбрать его нажатием.
        </div>
      )}
      <div className="actions">
        <button className="button button-primary" disabled={!canRetest} onClick={() => dispatch({ type: "retest" })}>
          <ScanLine size={18} /> Перепроверить атаку
        </button>
      </div>
    </Card>
  )
}

interface ReviewProps {
  chapter: Chapter
  state: GameState
  dispatch: Dispatch<GameAction>
  saveFailed: boolean
  onRestart: () => void
}

export function Review({ chapter, state, dispatch, saveFailed, onRestart }: ReviewProps) {
  const index = chapter.updates.findIndex(item => item.id === state.updateId)
  const update = chapter.updates[index]
  const complete = state.step === "complete"
  const isRepairing = state.step === "patch" || state.step === "retest"
  const lastRetest = state.testedRepairId
  const [approvedTitle, setApprovedTitle] = useState("")

  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById("page-title")?.focus({ preventScroll: true })
  }, [state.updateId, complete])

  useEffect(() => {
    if (state.step === "patch" && !lastRetest) document.getElementById("repair-title")?.scrollIntoView({ block: "nearest" })
    if (!lastRetest || state.step !== "patch" && state.step !== "stamp") return
    document.getElementById("results-anchor")?.scrollIntoView({ block: "nearest" })
  }, [lastRetest, state.step])

  useEffect(() => {
    if (!approvedTitle) return
    const timer = window.setTimeout(() => setApprovedTitle(""), 1100)
    return () => window.clearTimeout(timer)
  }, [approvedTitle])

  const approval = approvedTitle && (
    <div className="approval-toast" role="status" key={approvedTitle}>
      <Stamp size={21} /><span>{approvedTitle}</span><strong>Одобрено</strong>
    </div>
  )

  if (!update) return <main id="main" className="shell chapter-page"><h1 id="page-title" tabIndex={-1}>Не удалось открыть обновление</h1><a href="#/chapters">К смене</a></main>

  if (complete) return (
    <main className="shell ending-page" id="main">
      <Card className="ending-card">
        <div className="ending-icon"><ShieldCheck size={38} /></div>
        <h1 id="page-title" tabIndex={-1}>Смена завершена</h1>
        <p>К показу готовы все {chapter.updates.length} обновлений. Ты проверил, что защита работает и пользователи сохранили доступ к нужным функциям.</p>
        {state.failedRetests > 0 && <Badge><ScanLine size={16} /> {state.failedRetests} повторных проверок с неудачным исправлением</Badge>}
        <div className="ending-note"><strong>Наставник</strong><p>Так работает инженер по безопасности приложений. Он проверяет изменения до выпуска, объясняет риск команде и убеждается, что исправление работает.</p></div>
        <div className="actions"><a className="button button-primary" href="#/chapters">К смене</a><RestartDialog onRestart={onRestart} /></div>
      </Card>
      {approval}
    </main>
  )

  return (
    <main className="shell review-page" id="main">
      <div className="review-heading">
        <div>
          <p className="review-chapter"><Terminal size={17} /> {chapter.title}</p>
          <h1 id="page-title" tabIndex={-1}>{update.title}</h1>
        </div>
        <div className="progress">
          <span>Обновление {index + 1} из {chapter.updates.length}</span>
          <progress value={index + 1} max={chapter.updates.length} aria-label="Текущее обновление" />
        </div>
      </div>
      <div className="briefing">
        <Card className="message"><MessageSquare size={19} /><div><strong>Разработчик</strong><p>{update.developer}</p></div></Card>
        <Card className="message mentor"><Shield size={19} /><div><strong>Наставник</strong><p>{update.mentor}</p></div></Card>
      </div>
      <div className="review-instruction" role="status"><ClipboardCheck size={19} /> {instructions[state.step]}</div>
      {saveFailed && <p className="save-alert" role="status">Браузер не сохранил прогресс. Можно продолжить играть в этой вкладке.</p>}
      <div className="review-grid" id="results-anchor">
        <Sandbox update={update} state={state} dispatch={dispatch} />
        <CodeViewer key={update.id} update={update} state={state} dispatch={dispatch} />
      </div>
      {isRepairing && <div id="repair-title"><RepairOptions update={update} state={state} dispatch={dispatch} /></div>}
      <div className={`stamp-bar ${state.step === "stamp" ? "stamp-ready" : ""}`}>
        <div><strong>Выпуск обновления</strong><small>Защита и обычная работа должны пройти проверку.</small></div>
        <button className="button stamp-button" disabled={state.step !== "stamp"} onClick={() => {
          playStamp()
          setApprovedTitle(update.title)
          dispatch({ type: "stamp" })
        }}><Stamp size={19} /> В ПРОДАКШН</button>
      </div>
      {approval}
    </main>
  )
}
