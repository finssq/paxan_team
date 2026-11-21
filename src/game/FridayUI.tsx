import { ArrowRight, Check, CircleAlert, Flame, Pause, Play, RotateCcw, ShieldCheck, Snowflake, Timer } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { friday, fridayChapter } from "../data/friday"
import type { WaveScenario } from "../data/friday"
import { releaseFindings, storyCopy, storyForWave } from "../data/story"
import { characters } from "./feedback"
import type { Message } from "./feedback"
import { Portrait, TrainingTeamCards } from "./FeedbackUI"
import type { WaveRun } from "./incidentWave"

export type WavePhase = "ready" | "live" | "paused" | "won" | "timeout" | "lost"

function formatTime(timeMs: number) {
  const seconds = Math.ceil(timeMs / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function FridayScore({ score, combo }: Pick<WaveRun, "score" | "combo">) {
  const [animation, setAnimation] = useState({ score, combo, gain: 0, comboUp: false })
  const [tipOpen, setTipOpen] = useState(false)
  const tipId = useId()
  useEffect(() => {
    setAnimation(previous => ({
      score, combo,
      gain: score === previous.score ? previous.gain : Math.max(0, score - previous.score),
      comboUp: combo === previous.combo ? previous.comboUp : combo > previous.combo,
    }))
  }, [score, combo])

  const gain = animation.score === score ? animation.gain : 0
  return (
    <div className="friday-score" data-tip-open={tipOpen || undefined}>
      <button className="friday-score-trigger" type="button" aria-describedby={tipId} aria-expanded={tipOpen}
        onClick={() => setTipOpen(open => !open)} onBlur={() => setTipOpen(false)}
        onKeyDown={event => { if (event.key === "Escape") setTipOpen(false) }}>
        <span>Счёт · Комбо</span>
        <span className="friday-score-values">
          <span className="friday-score-tally" key={score}>
            <strong data-score-up={gain > 0 || undefined}>{score}</strong>
            {gain > 0 && <span className="friday-score-gain" aria-hidden="true">+{gain}</span>}
          </span>
          <span className="friday-combo" key={combo} data-level={Math.min(combo, 3)}
            data-combo-up={animation.combo === combo && animation.comboUp || undefined}>
            <Flame size={16} fill="currentColor" aria-hidden="true" /><strong>×{combo}</strong>
          </span>
        </span>
      </button>
      <div id={tipId} className="friday-combo-tip" role="tooltip">
        <strong>🔥 Серия комбо</strong>
        <ul role="list">
          <li><b>+1 к множителю</b> — за волну без ошибок и подсказок Макса.</li>
          <li><b>Бонус к очкам</b> — комбо повышает награду за волну, а скорость даёт отдельный бонус.</li>
          <li><b>Сброс до ×1</b> — при ошибке, автодеплое или подсказке Макса. X-Ray комбо не сбрасывает.</li>
        </ul>
      </div>
    </div>
  )
}

export function FridayHud({ service, finalReport, run, phase, security, guide, practice, onPause, onSkip }: {
  service: string; finalReport: boolean; run: WaveRun; phase: WavePhase; security: number; guide?: { step: number; text: string }; practice: boolean
  onPause: () => void; onSkip?: () => void
}) {
  const frozen = run.freezeMs > 0
  return (
    <section className="friday-hud" aria-label="Состояние сервиса">
      <div className="friday-map" data-phase={phase}>
        <span className="friday-service"><i aria-hidden="true" /> Сервис · {service}</span>
        {guide ? <div className="friday-step-guide" role="status"><strong>Шаг {guide.step}/3</strong><span>{guide.text}</span></div>
          : <p role="status">{phase === "won" ? "Проверки пройдены" : phase === "paused" ? "Смена на паузе" : phase === "ready" ? "Готов к проверке" : "Расследование остановлено"}</p>}
      </div>
      <div className="friday-stats">
        <div className="friday-timer" data-urgent={run.remainingMs <= 10_000 && phase === "live" && !frozen} data-frozen={frozen && phase !== "won" || undefined}>
          <span>{phase === "won" ? <><Check size={15} aria-hidden="true" /> {practice ? "Тренировка завершена" : finalReport ? storyCopy.protected : "Волна закрыта"}</> :
            frozen ? <><Snowflake size={15} aria-hidden="true" /> Деплой заморожен</> : <><Timer size={15} aria-hidden="true" /> {practice ? "Пробная волна" : "До деплоя"}</>}</span>
          {phase !== "won" && <strong>{frozen ? `${Math.ceil(run.freezeMs / 1000)} с` : practice ? "Без лимита" : formatTime(run.remainingMs)}</strong>}
          {phase !== "won" && (frozen || !practice) && <progress className="meter-track" max={frozen ? friday.freezeMs : friday.durationMs}
            value={frozen ? run.freezeMs : run.remainingMs} aria-label={frozen ? "Время заморозки" : "Время до деплоя"} />}
        </div>
        <FridayScore score={run.score} combo={run.combo} />
        <div className="friday-security" data-level={security > 60 ? "healthy" : security >= 30 ? "warning" : "danger"}>
          <span><ShieldCheck size={15} aria-hidden="true" /> Безопасность</span>
          <div className="friday-health">
            <progress className="meter-track" max={100} value={security} aria-label="Безопасность" />
            <strong>{security}%</strong>
          </div>
        </div>
        {!practice && <button type="button" className="os-secondary friday-pause" disabled={phase !== "live"} aria-label="Пауза" onClick={onPause}><Pause size={18} aria-hidden="true" /></button>}
        {onSkip && <button type="button" className="friday-skip" data-event-sound onClick={onSkip}>Пропустить обучение <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
    </section>
  )
}

export function AllowedHosts({ hosts }: Pick<WaveScenario, "hosts">) {
  return (
    <details className="friday-hosts" aria-label="Список банка">
      <summary><Portrait message={{ author: "mentor", mood: "guiding" }} /><strong>Разрешённые адреса банка</strong></summary>
      <ul>{hosts.map(host => <li key={host.name}><code>{host.name}</code><span>{host.purpose}</span></li>)}</ul>
    </details>
  )
}

export function FridayBrief({ phase, run, waveNumber, waveCount, practice, scenario, finalReport, epilogue, onAction, onReset, onSkip }: {
  phase: Exclude<WavePhase, "live">; run: WaveRun; waveNumber: number; waveCount: number; finalReport: boolean
  practice: boolean; scenario: WaveScenario; epilogue: readonly Message[]
  onAction: () => void; onReset: () => void; onSkip?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (dialog.current && !dialog.current.open) dialog.current.showModal()
    }, finalReport ? 2200 : phase === "won" ? 550 : 0)
    return () => window.clearTimeout(timer)
  }, [phase, finalReport])

  const outcome = phase === "won" || phase === "timeout" || phase === "lost"
  const heading = {
    ready: fridayChapter.title, paused: "Пауза", won: "Утечка остановлена", timeout: "Время вышло", lost: "Сервис остановлен",
  }[phase]
  const detail = {
    paused: "Таймер и тестовая отправка приостановлены.", won: scenario.ticket.summary,
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
    <dialog className="os-training-dialog friday-brief" data-phase={phase} data-final={finalReport || undefined} ref={dialog} aria-labelledby="friday-brief-title"
      onCancel={event => { event.preventDefault(); if (phase === "paused") onAction() }}>
      {phase !== "paused" && <span className="friday-brief-wave">{fridayChapter.title} · {finalReport ? storyCopy.summaryTitle :
        practice ? "Пробная волна" : `Волна ${waveNumber}/${waveCount} · ${scenario.ticket.title}`}</span>}
      {phase !== "ready" && !finalReport && <Icon size={34} aria-hidden="true" />}
      <h2 id="friday-brief-title">{finalReport ? storyCopy.finaleTitle : practice ? phase === "won" ? "Вы прошли обучение" : "Познакомься с твоей командой" : phase === "ready" ? scene.title : heading}</h2>
      {phase === "ready" && practice ? <>
        <TrainingTeamCards />
        <p>Ты стажёр по кибербезопасности. До вечернего запуска Денису нужно проверить обновление сервиса оплаты.</p>
        <p>Вместе с Максом проведи учебную покупку, выясни, куда уходят данные, и проверь исправление. В тренировке можно повторять попытки сколько угодно.</p>
      </>
        : phase === "ready" ? <>
        <div className="friday-brief-chat">
          <Portrait message={{ author: "mentor", mood: "guiding" }} />
          <div className="friday-brief-messages">
            <strong>Макс <span>· наставник</span></strong>
            <p>{scene.brief}</p>
          </div>
        </div>
        <p className="friday-brief-time"><Timer size={16} aria-hidden="true" /> На волну {formatTime(friday.durationMs)}. Отсчёт начнётся после старта.</p>
      </> : !finalReport && <p>{detail[phase]}</p>}
      {finalReport && <>
        <strong className="os-release-stamp"><ShieldCheck size={17} aria-hidden="true" /> {storyCopy.attackStopped}</strong>
        <div className="friday-epilogue">
          {epilogue.map(message => (
            <div className="friday-brief-chat" key={message.author}>
              <Portrait message={message} />
              <div className="friday-brief-messages">
                <strong>{characters[message.author].name}</strong>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
        </div>
        <ol className="friday-release-findings" aria-label="Что нашли и что исправили" role="list">
          {releaseFindings.map(({ found, fixed }) => (
            <li key={found}><span>{found}</span><ArrowRight size={15} aria-hidden="true" />
              <strong><span className="sr-only">Исправление. </span>{fixed}</strong>
            </li>
          ))}
        </ol>
      </>}
      {phase === "won" && !practice && !finalReport && <section className="friday-story-report">
        <h3>{storyCopy.waveSummaryTitle}</h3>
        <p>{storyCopy.early}</p>
      </section>}
      {outcome && <dl className="friday-brief-stats">
        <div><dt>Счёт</dt><dd>{run.score}</dd></div>
        <div><dt>Комбо</dt><dd>×{run.combo}</dd></div>
        {!finalReport && <div><dt>Перехвачено пакетов</dt><dd>{run.captured.length}/{scenario.packets.length}</dd></div>}
        {!practice && !finalReport && <div><dt>Осталось времени</dt><dd>{formatTime(run.remainingMs)}</dd></div>}
      </dl>}
      {finalReport && <div className="friday-brief-chat friday-office-teaser">
        <Portrait message={{ author: "mentor", mood: "approve" }} />
        <div className="friday-brief-messages"><strong>Макс</strong><p>{storyCopy.officeTeaser}</p></div>
      </div>}
      <div className="friday-brief-actions">
        <button type="button" className="os-primary os-training-action" onClick={onAction}>
          {outcome && <RotateCcw size={17} aria-hidden="true" />}
          {finalReport ? "Переиграть" : phase === "ready" ? practice ? "Начать тренировку" : "Начать волну" :
            phase === "paused" ? "Продолжить волну" : phase === "won" ? practice ? "Начать смену" : `К волне ${waveNumber + 1}` : "Переиграть волну"}
        </button>
        {onSkip && <button type="button" className="friday-skip-link" data-event-sound onClick={onSkip}>Пропустить обучение</button>}
      </div>
      {outcome && <a className="os-secondary friday-home" href={finalReport ? "#game" : "./"}>{finalReport ? "К выбору игр" : "На главную"}</a>}
    </dialog>
  )
}

export function PracticeDialog({ title, text, action, onAction, onSkip }: {
  title: string; text: string; action: string; onAction: () => void; onSkip: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  return (
    <dialog className="os-training-dialog" ref={dialog} aria-labelledby="practice-tip-title" onCancel={event => { event.preventDefault(); onAction() }}>
      <div className="friday-brief-chat"><Portrait message={{ author: "mentor", mood: "guiding" }} /><strong>Макс</strong></div>
      <h2 id="practice-tip-title">{title}</h2><p>{text}</p>
      <div className="friday-brief-actions">
        <button type="button" className="os-primary os-training-action" onClick={onAction}>{action}</button>
        <button type="button" className="friday-skip-link" data-event-sound onClick={onSkip}>Пропустить обучение</button>
      </div>
    </dialog>
  )
}
