import { ArrowRight, Gamepad2, Map, Mouse, ShieldCheck, Timer } from "lucide-react"
import type { ReactNode } from "react"

export default function MissionHub({ canResume, officePreview }: { canResume: boolean; officePreview: ReactNode }) {
  return (
    <main className="shell game-selection" id="main" tabIndex={-1}>
      <header>
        <h1>Выбор миссии</h1>
        <p>Защити релиз банка или проверь безопасность его офиса.</p>
      </header>
      <div className="game-options">
        <article className="game-option" aria-labelledby="blue-game-title">
          <div className="game-preview">
            <span className="game-team">Миссия 01 · Blue Team</span>
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
            <p>Перехвати трафик и найди утечки в коде до релиза банка.</p>
            <ul className="game-tags" role="list">
              <li><ShieldCheck size={14} aria-hidden="true" /> Проверка кода</li>
              <li><Mouse size={14} aria-hidden="true" /> Мышь / сенсорный экран</li>
              <li><Timer size={14} aria-hidden="true" /> 5–7 мин</li>
            </ul>
            <div className="game-option-footer"><a className="game-action" href="#desk">{canResume ? "Продолжить" : "Начать миссию"} <ArrowRight size={18} aria-hidden="true" /></a></div>
          </div>
        </article>
        <article className="game-option" aria-labelledby="red-game-title">
          <div className="game-preview game-preview-office">
            <span className="game-team">Миссия 02 · Red Team</span>
            {officePreview}
          </div>
          <div className="game-option-body">
            <h2 id="red-game-title">Проникновение в офис</h2>
            <p>В роли белого хакера обойди охрану, реши три головоломки и доберись до ядра банка.</p>
            <ul className="game-tags" role="list">
              <li><Map size={14} aria-hidden="true" /> 2D-стелс</li>
              <li><Gamepad2 size={14} aria-hidden="true" /> WASD / джойстик</li>
              <li><Timer size={14} aria-hidden="true" /> 1–2 мин</li>
            </ul>
            <div className="game-option-footer"><a className="game-action" href="#redteam">В офис <ArrowRight size={18} aria-hidden="true" /></a></div>
          </div>
        </article>
      </div>
    </main>
  )
}
