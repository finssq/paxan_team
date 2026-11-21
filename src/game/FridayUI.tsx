import { CircleAlert, Flame, Pause, Play, RotateCcw, ShieldCheck, Snowflake, Timer } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { friday, fridayChapter, incidentPackets, incidentTicket } from "../data/friday"
import { storyCopy, storyForWave } from "../data/story"
import { HighlightedText, Portrait, TrainingTeamCards } from "./FeedbackUI"
import type { WaveRun } from "./incidentWave"

export type WavePhase = "ready" | "live" | "paused" | "won" | "timeout" | "lost"

function formatTime(timeMs: number) {
  const seconds = Math.ceil(timeMs / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function FridayScore({ score, combo }: Pick<WaveRun, "score" | "combo">) {
  const [animation, setAnimation] = useState({ score, combo, gain: 0, comboUp: false })
  useEffect(() => {
    setAnimation(previous => ({
      score, combo,
      gain: score === previous.score ? previous.gain : Math.max(0, score - previous.score),
      comboUp: combo === previous.combo ? previous.comboUp : combo > previous.combo,
    }))
  }, [score, combo])

  const gain = animation.score === score ? animation.gain : 0
  return (
    <div className="friday-score">
      <span>Счёт · Комбо</span>
      <div className="friday-score-values">
        <div className="friday-score-tally" key={score}>
          <strong data-score-up={gain > 0 || undefined}>{score}</strong>
          {gain > 0 && <span className="friday-score-gain" aria-hidden="true">+{gain}</span>}
        </div>
        <div className="friday-combo" key={combo} data-level={Math.min(combo, 3)}
          data-combo-up={animation.combo === combo && animation.comboUp || undefined} aria-label={`Комбо ×${combo}`}>
          <Flame size={15} aria-hidden="true" /><strong>×{combo}</strong>
        </div>
      </div>
    </div>
  )
}

export function FridayHud({ run, phase, security, guide, practice, onPause }: {
  run: WaveRun; phase: WavePhase; security: number; guide?: { step: number; text: string }; practice: boolean
  onPause: () => void
}) {
  const frozen = run.freezeMs > 0
  return (
    <section className="friday-hud" aria-label="Состояние сервиса">
      <div className="friday-map" data-phase={phase}>
        <span className="friday-service"><i aria-hidden="true" /> Сервис · {friday.service}</span>
        {guide ? <div className="friday-step-guide" role="status"><strong>Шаг {guide.step}/3</strong><span>{guide.text}</span></div>
          : <p role="status">{phase === "won" ? "Оплата защищена" : phase === "paused" ? "Смена на паузе" : phase === "ready" ? "Готов к проверке" : "Расследование остановлено"}</p>}
      </div>
      <div className="friday-stats">
        <div className="friday-timer" data-urgent={run.remainingMs <= 10_000 && phase === "live" && !frozen} data-frozen={frozen || undefined}>
          <span>{frozen ? <><Snowflake size={15} aria-hidden="true" /> Деплой заморожен</> : <><Timer size={15} aria-hidden="true" /> {practice ? "Пробная волна" : "До деплоя"}</>}</span>
          <strong>{frozen ? `${Math.ceil(run.freezeMs / 1000)} с` : practice ? "Без лимита" : formatTime(run.remainingMs)}</strong>
          {(frozen || !practice) && <progress className="meter-track" max={frozen ? friday.freezeMs : friday.durationMs}
            value={frozen ? run.freezeMs : run.remainingMs} aria-label={frozen ? "Время заморозки" : "Время до деплоя"} />}
        </div>
        <FridayScore score={run.score} combo={run.combo} />
        <div className="friday-security" data-critical={security <= 35}>
          <span><ShieldCheck size={15} aria-hidden="true" /> Безопасность</span>
          <strong>{security}%</strong>
        </div>
        {!practice && <button type="button" className="os-secondary friday-pause" disabled={phase !== "live"} aria-label="Пауза" onClick={onPause}><Pause size={18} aria-hidden="true" /></button>}
      </div>
    </section>
  )
}

export function AllowedHosts() {
  return (
    <details className="friday-hosts" aria-label="Список банка">
      <summary><Portrait message={{ author: "mentor", mood: "guiding" }} /><strong>Разрешённые адреса банка</strong></summary>
      <ul>{friday.hosts.map(host => <li key={host.name}><code>{host.name}</code><span>{host.purpose}</span></li>)}</ul>
    </details>
  )
}

export function FridayBrief({ phase, run, waveNumber, waveCount, practice, finalReport, highMetrics, onAction, onReset }: {
  phase: Exclude<WavePhase, "live">; run: WaveRun; waveNumber: number; waveCount: number; finalReport: boolean; highMetrics: boolean
  practice: boolean; onAction: () => void; onReset: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal()
    }, phase === "won" ? 550 : 0)
    return () => window.clearTimeout(timer)
  }, [phase])

  const outcome = phase === "won" || phase === "timeout" || phase === "lost"
  const heading = {
    ready: fridayChapter.title, paused: "Пауза", won: "Утечка остановлена", timeout: "Время вышло", lost: "Сервис остановлен",
  }[phase]
  const detail = {
    paused: "Таймер и тестовая отправка приостановлены.", won: incidentTicket.summary,
    timeout: "Смена закончилась до выпуска исправления.", lost: "Безопасность сервиса опустилась до нуля.",
  }
  const Icon = outcome ? (phase === "won" ? ShieldCheck : CircleAlert) : Play
  const scene = storyForWave(waveNumber)

  if (phase === "lost") return (
    <dialog className="os-training-dialog friday-game-over" ref={dialog} aria-labelledby="friday-game-over-title" onCancel={event => event.preventDefault()}>
      <span>{fridayChapter.title} · Срочная новость</span>
      <h2 id="friday-game-over-title">СТАРТАП ВЗЛОМАН</h2>
      <p>В сеть утекли ключи и данные клиентов стартапа прямо перед стримом в 18:00.</p>
      <strong>Счёт · {run.score}</strong>
      <button type="button" className="os-primary os-training-action" onClick={onAction}>Перезапустить задачу · 40% безопасности</button>
      <button type="button" className="os-secondary friday-home" onClick={onReset}>Начать смену заново</button>
    </dialog>
  )

  return (
    <dialog className="os-training-dialog friday-brief" data-phase={phase} ref={dialog} aria-labelledby="friday-brief-title"
      onCancel={event => { event.preventDefault(); if (phase === "paused") onAction() }}>
      {phase !== "paused" && <span className="friday-brief-wave">{fridayChapter.title} · {practice ? "Пробная волна" : `Волна ${waveNumber}/${waveCount} · ${incidentTicket.title}`}</span>}
      {phase !== "ready" && <Icon size={34} aria-hidden="true" />}
      <h2 id="friday-brief-title">{practice ? phase === "won" ? "Вы прошли обучение" : "Познакомься с твоей командой" : phase === "ready" ? scene.title : heading}</h2>
      {phase === "ready" && practice ? <>
        <TrainingTeamCards />
        <p>Ты стажёр по кибербезопасности. До вечернего запуска Денису нужно проверить обновление сервиса оплаты.</p>
        <p>Вместе с Максом проведи учебную покупку, выясни, куда уходят данные, и проверь исправление. В тренировке можно повторять попытки сколько угодно.</p>
      </>
        : phase === "ready" ? <>
        <p className="friday-story-text">{scene.brief}</p>
        <details className="friday-story-guide">
          <summary>Как пройти волну</summary>
          <div className="friday-brief-chat">
          <Portrait message={{ author: "mentor", mood: "guiding" }} />
          <div className="friday-brief-messages">
            <strong>Макс <span>· наставник</span></strong>
            {friday.briefing.map(text => <p key={text}><HighlightedText text={text} /></p>)}
          </div>
          </div>
        </details>
        <p className="friday-brief-time"><Timer size={16} aria-hidden="true" /> На волну {formatTime(friday.durationMs)}. Отсчёт начнётся после старта.</p>
      </> : <p>{detail[phase]}</p>}
      {phase === "won" && !practice && <section className="friday-story-report">
        <h3>{finalReport ? storyCopy.summaryTitle : storyCopy.waveSummaryTitle}</h3>
        <p>{finalReport ? highMetrics ? storyCopy.success : storyCopy.recovery : storyCopy.early}</p>
      </section>}
      {outcome && <dl className="friday-brief-stats">
        <div><dt>Счёт</dt><dd>{run.score}</dd></div>
        <div><dt>Комбо</dt><dd>×{run.combo}</dd></div>
        <div><dt>Перехвачено пакетов</dt><dd>{run.captured.length}/{incidentPackets.length}</dd></div>
        {!practice && <div><dt>Осталось времени</dt><dd>{formatTime(run.remainingMs)}</dd></div>}
      </dl>}
      <button type="button" className="os-primary os-training-action" onClick={onAction}>
        {outcome && <RotateCcw size={17} aria-hidden="true" />}
        {phase === "ready" ? practice ? "Начать тренировку" : storyCopy.continue : phase === "paused" ? "Продолжить волну" : practice ? "Начать смену" : "Переиграть волну"}
      </button>
      {outcome && <a className="os-secondary friday-home" href="./">На главную</a>}
    </dialog>
  )
}

export function PracticeDialog({ title, text, action, onAction }: {
  title: string; text: string; action: string; onAction: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  return (
    <dialog className="os-training-dialog" ref={dialog} aria-labelledby="practice-tip-title" onCancel={event => { event.preventDefault(); onAction() }}>
      <div className="friday-brief-chat"><Portrait message={{ author: "mentor", mood: "guiding" }} /><strong>Макс</strong></div>
      <h2 id="practice-tip-title">{title}</h2><p>{text}</p>
      <button type="button" className="os-primary os-training-action" onClick={onAction}>{action}</button>
    </dialog>
  )
}
