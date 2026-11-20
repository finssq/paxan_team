import { CircleAlert, CircleCheck, Clock3, Code2, Play, Save, UserRound } from "lucide-react"
import { useState } from "react"
import sponsorLogo from "./centr-invest.svg"
import { paymentPreview } from "./data/paymentPreview"
import workLabMark from "./favicon.svg"
import { Card } from "./ui"

function PreviewSource({ text, hidden }: { text: string; hidden?: boolean }) {
  const parts = text.split(/("(?:[^"\\]|\\.)*"|\b(?:const|await)\b|\b[A-Za-z_$][\w$]*(?=\())/)
  return (
    <code aria-hidden={hidden}>
      {parts.map((part, index) => {
        if (index % 2 === 0) return part
        const kind = part.startsWith('"') ? "string" : part === "const" || part === "await" ? "keyword" : "call"
        return <span className={`preview-token-${kind}`} key={index}>{part}</span>
      })}
    </code>
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
                      <PreviewSource text={line.text} hidden={Boolean(fix)} />
                      {line.repair && <PreviewSource text={line.repair.text} hidden={!fix} />}
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

export function App() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">К основному содержанию</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="header-brand" href="./" aria-label="WorkLab — главная">
            <img src={workLabMark} alt="" width={22} height={22} /> WorkLab
          </a>
          <nav className="main-nav" aria-label="Навигация">
            <button type="button" aria-current="page" disabled>Главная</button>
            <button className="nav-play" type="button" disabled>Играть</button>
          </nav>
        </div>
      </header>
      <main className="shell home" id="main" tabIndex={-1}>
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
              <button className="hero-start" type="button" disabled><Play size={19} /> Начать играть</button>
            </div>
            <ul className="hero-meta" aria-label="О смене" role="list">
              <li><UserRound size={14} aria-hidden="true" /> Без регистрации</li>
              <li><Clock3 size={14} aria-hidden="true" /> 5–7 минут</li>
              <li><Save size={14} aria-hidden="true" /> Прогресс сохраняется</li>
            </ul>
          </div>
          <CodePreview />
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <span className="footer-brand">WorkLab <span aria-hidden="true">•</span> пахан team</span>
          <span>Cyber Garden School <span aria-hidden="true">•</span> 2026</span>
        </div>
      </footer>
    </div>
  )
}
