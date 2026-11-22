import { ArrowRight, BookOpen, Gamepad2, Mouse, Radio, RotateCcw, ScanLine, ShieldCheck, Video, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { CampaignProgress } from "../campaignProgress"
import { fridayChapter } from "../data/friday"
import { readShift } from "../game/review"
import { getPlayerNickname } from "../utils/playerProfile"

const statusClass = "w-fit rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-[#D3DDD5]"
const completeClass = "w-fit rounded-lg border border-[#8EE872]/30 bg-[#8EE872]/12 px-2 py-1 text-xs font-bold text-[#8EE872]"
const redRankPoints = { S: 96, A: 85, B: 72, C: 58 }

function calculateProfileScores(campaign: CampaignProgress, shift: ReturnType<typeof readShift>) {
  const finalWave = shift?.state.step === "released" && shift.ticket.id === fridayChapter.tickets.at(-1)?.id
    ? shift.feedback.wave : undefined
  const blueScore = campaign.blueCompleted
    ? finalWave && shift
      ? Math.round(55 + .3 * shift.feedback.run.security + 13 * Math.min(1, finalWave.score / 3500))
      : 82
    : null
  const result = campaign.red.best ?? campaign.red.last
  const redScore = result ? redRankPoints[result.rank] + Math.min(4, Math.floor(result.score / 600)) : null
  return { blueScore, redScore, redRank: result?.rank }
}

function getProfileVerdict(blueScore: number | null, redScore: number | null) {
  if (blueScore !== null && (redScore === null || blueScore >= redScore + 7)) {
    return {
      title: "Склонность к защите систем (Blue Team)",
      description: redScore === null
        ? "Ты уверенно разбираешь код и останавливаешь утечки. Пройди Главу 2, чтобы сравнить себя в роли Red Team."
        : "Анализ кода, перехват трафика и защита релиза даются тебе сильнее всего — тебе близка оборона систем.",
      role: redScore === null ? "AppSec-инженер · Защита приложений" : "AppSec-инженер / Аналитик SOC",
    }
  }
  if (redScore !== null && (blueScore === null || redScore >= blueScore + 7)) {
    return {
      title: "Склонность к пентесту (Red Team)",
      description: blueScore === null
        ? "Тебе хорошо даётся поиск слабых мест и обход защиты. Пройди Главу 1, чтобы сравнить себя в роли Blue Team."
        : "Обход охраны, OSINT и поиск уязвимостей в поле — твоя сильная сторона.",
      role: "Пентестер (Red Team) · Этичный хакинг",
    }
  }
  return {
    title: "Универсальный профиль: Purple Team",
    description: "Ты одинаково уверенно и защищаешь код, и находишь лазейки в защите — редкое сочетание для ИБ.",
    role: "Инженер ИБ (Blue + Red Team)",
  }
}

function ProfileMeter({ label, score, rank, fill }: {
  label: string; score: number | null; rank?: string; fill: string
}) {
  const value = score === null ? "Не пройдено" : `${score}%${rank ? ` · ранг ${rank}` : ""}`
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-[#D3DDD5]">{label}</span>
        <span className="font-medium text-white/65 tabular-nums">{value}</span>
      </div>
      {score === null ? <div className="h-1.5 rounded-full bg-white/8" aria-hidden="true" /> : (
        <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-valuetext={value}
          className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className={`h-full rounded-full ${fill}`} style={{ width: `${score}%` }} />
        </div>
      )}
    </div>
  )
}

function CareerProfile({ campaign }: { campaign: CampaignProgress }) {
  const { blueScore, redScore, redRank } = calculateProfileScores(campaign, campaign.blueCompleted ? readShift(fridayChapter) : null)
  if (blueScore === null && redScore === null) return null
  const { title, description, role } = getProfileVerdict(blueScore, redScore)
  const nickname = getPlayerNickname()

  return (
    <section aria-labelledby="career-profile-title" className="mt-5 flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#0F1512] p-4 sm:p-5 md:flex-row md:items-center">
      <div className="min-w-0">
        <div className="wrap-anywhere text-[11px] font-bold tracking-wide text-[#8EE872] uppercase">
          Твой профиль · Blue Team vs Red Team{nickname && <span className="normal-case"> · {nickname}</span>}
        </div>
        <h2 id="career-profile-title" className="mt-1 text-base leading-snug font-bold text-white sm:text-lg">{title}</h2>
        <p className="mt-1 text-xs leading-snug text-white/65 sm:text-sm">{description}</p>
        <span className="mt-2 inline-flex max-w-full rounded-full border border-[#8EE872]/30 bg-[#8EE872]/12 px-2.5 py-1 text-xs font-medium text-[#8EE872]">{role}</span>
      </div>
      <div className="grid min-w-0 shrink-0 gap-3 md:w-72">
        <ProfileMeter label="Blue Team · Защита" score={blueScore} fill="bg-[#34D399]" />
        <ProfileMeter label="Red Team · Пентест" score={redScore} rank={redRank} fill="bg-[#F59E0B]" />
      </div>
    </section>
  )
}

export default function MissionHub({ canResume, campaign, officePreview, onReset }: {
  canResume: boolean
  campaign: CampaignProgress
  officePreview: ReactNode
  onReset: () => boolean
}) {
  const [expires, setExpires] = useState(0)
  const [notice, setNotice] = useState("")
  const chapterDialog = useRef<HTMLDialogElement>(null)
  const { last, best } = campaign.red
  const { blueCompleted } = campaign
  const sameRank = last && best && last.rank === best.rank

  useEffect(() => {
    if (!expires) return
    const timer = window.setTimeout(() => setExpires(0), Math.max(0, expires - Date.now()))
    return () => window.clearTimeout(timer)
  }, [expires])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(""), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  function reset() {
    if (Date.now() >= expires) {
      setNotice("")
      setExpires(Date.now() + 4000)
      return
    }
    setExpires(0)
    const success = onReset()
    setNotice(success ? "Прогресс сброшен" : "Не удалось сбросить прогресс")
  }

  return (
    <main className="shell game-selection" id="main" tabIndex={-1}>
      <header className="relative">
        <span className="block pb-1 text-xs font-extrabold tracking-widest text-[#8EE872]">КАМПАНИЯ · ДЕЛО «ПРИЗРАКА»</span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1>Выбор игры</h1>
          <button type="button" onClick={reset} data-confirm={expires > 0}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-3.5 py-2 text-xs font-medium text-white/75 transition-colors hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200 focus-visible:outline-2 data-[confirm=true]:border-red-400/50 data-[confirm=true]:bg-red-500/20 data-[confirm=true]:text-red-100">
            <RotateCcw size={15} aria-hidden="true" /> {expires > 0 ? "Точно сбросить всё?" : "Сбросить прогресс"}
          </button>
        </div>
        <p>Пройди расследование с обеих сторон: защити пятничный релиз банка, а затем найди физическую утечку в офисе.</p>
        <div role="status" className="pointer-events-none fixed right-4 bottom-4 z-10 empty:hidden rounded-xl border border-white/15 bg-[#101b14] px-4 py-3 text-sm font-bold text-white shadow-xl">{notice}</div>
      </header>
      <div className="game-options">
        <article className="game-option flex! flex-col" aria-labelledby="blue-game-title">
          <div className="game-preview relative">
            <span className="game-team">Глава 1 · Blue Team</span>
            <span className="absolute top-3 right-3 z-10 rounded-lg border border-[#8EE872]/40 bg-[#8EE872]/15 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-[#8EE872] sm:top-4 sm:right-4 sm:text-xs">
              {blueCompleted ? "✓ Пройдена" : "Начни отсюда"}
            </span>
            <div className="game-editor" aria-hidden="true">
              <div className="game-editor-bar"><i /><i /><i /><span>WorkCode</span></div>
              <code>const order = getOrder();</code>
              <code>if (!order) return;</code>
              <code data-warning>sendReport(order);</code>
              <code>return confirm(order);</code>
            </div>
            <div className="game-traffic" aria-hidden="true"><span>Перехват трафика</span><i /></div>
          </div>
          <div className="game-option-body flex! flex-1 flex-col">
            <h2 id="blue-game-title">Перехват кода</h2>
            <p>Пятница, 17:10. Денис торопит релиз, а в коде всплывают утечки. Останови атаку и выясни, кто прощупывает банк снаружи.</p>
            {!blueCompleted && <span className={statusClass}>{canResume ? "В процессе" : "Готова к старту"}</span>}
            <ul className="game-tags" role="list">
              <li><ShieldCheck size={14} aria-hidden="true" /> Проверка кода</li>
              <li><Radio size={14} aria-hidden="true" /> Перехват трафика</li>
              <li><Mouse size={14} aria-hidden="true" /> Мышь / Тач</li>
            </ul>
            <div className="game-option-footer mt-auto!"><a className="game-action" href="#desk">{canResume ? "Продолжить игру" : "Начать игру"} <ArrowRight size={18} aria-hidden="true" /></a></div>
          </div>
        </article>
        <article className="game-option relative flex! flex-col" aria-labelledby="red-game-title">
          <div className="game-preview game-preview-office">
            <span className="game-team">Глава 2 · Red Team</span>
            {officePreview}
          </div>
          <div className="game-option-body flex! flex-1 flex-col">
            <h2 id="red-game-title">Проникновение в офис</h2>
            <p>Понедельник. Макс отправляет тебя в офис как белого хакера: найди, как «Призрак» узнал внутренние адреса банка.</p>
            <div className="flex flex-wrap items-center gap-2">
              {sameRank && <span className={completeClass}>Ранг {last.rank} · Рекорд {best.score.toLocaleString("ru-RU")}</span>}
              {!sameRank && last && <span className={completeClass}>Последний: Ранг {last.rank}</span>}
              {!sameRank && best && <span className="text-xs font-bold text-[#DFE8DF]">Лучший: {best.rank} · {best.score.toLocaleString("ru-RU")}</span>}
              {!last && !best && <span className={statusClass}>Готова к старту</span>}
            </div>
            <ul className="game-tags" role="list">
              <li><Video size={14} aria-hidden="true" /> Обход камер</li>
              <li><ScanLine size={14} aria-hidden="true" /> 3 мини-взлома</li>
              <li><Gamepad2 size={14} aria-hidden="true" /> WASD</li>
            </ul>
            <div className="game-option-footer mt-auto!">
              <a className="game-action static! after:absolute after:inset-0" href="#redteam"
                aria-haspopup={blueCompleted ? undefined : "dialog"} onClick={event => {
                  if (blueCompleted || !chapterDialog.current) return
                  event.preventDefault()
                  chapterDialog.current.showModal()
                }}>В офис <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </div>
        </article>
      </div>
      <CareerProfile campaign={campaign} />
      <dialog ref={chapterDialog} aria-labelledby="chapter-order-title" aria-describedby="chapter-order-description"
        className="fixed inset-0 z-50 m-auto h-fit max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[440px] overflow-hidden rounded-2xl border border-white/12 bg-[#0F1512] p-0 text-white shadow-[0_28px_80px_rgba(0,0,0,0.8)] backdrop:bg-black/75 backdrop:backdrop-blur-sm"
        onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
        <div className="h-1 w-full bg-linear-to-r from-[#8EE872] via-[#34D399] to-transparent" aria-hidden="true" />
        <div className="max-h-[calc(100dvh_-_2.375rem)] overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8EE872]/30 bg-[#8EE872]/12 px-2.5 py-1 text-[11px] leading-tight font-semibold tracking-wider text-[#8EE872] uppercase">
              <BookOpen size={13} className="shrink-0" aria-hidden="true" /> Единый сюжет · Дело «Призрака»
            </span>
            <button type="button" aria-label="Закрыть" onClick={() => chapterDialog.current?.close()}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-[#8EE872]">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <h2 id="chapter-order-title" className="mt-4 text-xl font-bold text-white">Лучше начать с Главы 1</h2>
          <p id="chapter-order-description" className="mt-1.5 text-sm leading-relaxed text-white/65">В «Перехвате кода» ты отражаешь пятничную атаку на релиз, а «Проникновение в офис» продолжает это расследование.</p>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 text-xs">
            <span className="font-semibold text-[#8EE872]">1 · Перехват кода</span>
            <ArrowRight size={15} className="shrink-0 text-white/30" aria-hidden="true" />
            <span className="text-white/60">2 · Проникновение в офис</span>
          </div>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <a href="#desk" onClick={() => chapterDialog.current?.close()}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#8EE872] px-4 text-center text-sm font-bold text-[#08120B]! transition-colors hover:bg-[#9CF082] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8EE872]">{canResume ? "Продолжить Главу 1 →" : "Начать с Главы 1 →"}</a>
            <a href="#redteam" onClick={() => chapterDialog.current?.close()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] px-4 text-center text-sm font-medium text-white/80! transition-colors hover:bg-white/[0.11] hover:text-white! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8EE872]">Всё равно в Главу 2</a>
          </div>
        </div>
      </dialog>
    </main>
  )
}
