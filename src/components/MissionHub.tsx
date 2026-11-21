import { ArrowRight, Gamepad2, Mouse, Radio, RotateCcw, ScanLine, ShieldCheck, Video } from "lucide-react"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { CampaignProgress } from "../campaignProgress"

const statusClass = "w-fit rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-[#D3DDD5]"
const completeClass = "w-fit rounded-lg border border-[#8EE872]/30 bg-[#8EE872]/12 px-2 py-1 text-xs font-bold text-[#8EE872]"

export default function MissionHub({ canResume, campaign, officePreview, onReset }: {
  canResume: boolean
  campaign: CampaignProgress
  officePreview: ReactNode
  onReset: () => boolean
}) {
  const [expires, setExpires] = useState(0)
  const [notice, setNotice] = useState("")
  const { last, best } = campaign.red
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
        <article className="game-option" aria-labelledby="blue-game-title">
          <div className="game-preview">
            <span className="game-team">Глава 1 · Blue Team</span>
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
            <h2 id="blue-game-title">Перехват кода</h2>
            <p>Пятница, 17:10. Денис торопит релиз, а в коде всплывают утечки. Останови атаку и выясни, кто прощупывает банк снаружи.</p>
            <span className={campaign.blueCompleted ? completeClass : statusClass}>
              {campaign.blueCompleted ? "Пройдено" : canResume ? "В процессе" : "Готова к старту"}
            </span>
            <ul className="game-tags" role="list">
              <li><ShieldCheck size={14} aria-hidden="true" /> Проверка кода</li>
              <li><Radio size={14} aria-hidden="true" /> Перехват трафика</li>
              <li><Mouse size={14} aria-hidden="true" /> Мышь / Тач</li>
            </ul>
            <div className="game-option-footer"><a className="game-action" href="#desk">{canResume ? "Продолжить игру" : "Начать игру"} <ArrowRight size={18} aria-hidden="true" /></a></div>
          </div>
        </article>
        <article className="game-option" aria-labelledby="red-game-title">
          <div className="game-preview game-preview-office">
            <span className="game-team">Глава 2 · Red Team</span>
            {officePreview}
          </div>
          <div className="game-option-body">
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
            <div className="game-option-footer"><a className="game-action" href="#redteam">В офис <ArrowRight size={18} aria-hidden="true" /></a></div>
          </div>
        </article>
      </div>
    </main>
  )
}
