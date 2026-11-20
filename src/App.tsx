import { CircleAlert, Code2, Play } from "lucide-react"
import sponsorLogo from "./centr-invest.svg"
import { Card } from "./ui"

const previewLines = [
  { text: "экран ← создать_виджет(«Оплата»)" },
  { text: "открытые ← читать_настройки(«Магазин»)" },
  { text: "служебные ← подготовить_данные(«Сервис»)" },
  { text: "экран.данные ← объединить(открытые, служебные)", warning: true },
  { text: "форма ← отрисовать(экран)" },
  { text: "статус ← отправить_запрос(форма)" },
  { text: "показать(статус)" },
]

function CodePreview() {
  return (
    <div className="preview-wrap" aria-hidden="true">
      <div className="preview-orbit" />
      <Card className="preview">
        <div className="preview-bar">
          <span className="preview-app"><Code2 size={20} /> Просмотр кода</span>
          <span className="preview-context">Виджет оплаты</span>
        </div>
        <div className="preview-body">
          <div className="preview-code">
            {previewLines.map((line, index) => {
              const [target, expression] = line.text.split(" ← ")
              return (
                <div className={line.warning ? "preview-highlight" : undefined} key={line.text}>
                  <span className="preview-line-number">{String(index + 1).padStart(2, "0")}</span>
                  <code>{expression ? <><strong>{target}</strong> ← {expression}</> : line.text}</code>
                  {line.warning && <CircleAlert size={17} />}
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

export function App() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">К основному содержанию</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a href="./" className="brand">пахан team</a>
          <nav className="main-nav" aria-label="Навигация">
            <button type="button" aria-current="page" disabled>Главная</button>
            <button type="button" disabled>Играть</button>
          </nav>
        </div>
      </header>
      <main className="shell home" id="main" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <img className="sponsor-logo" src={sponsorLogo} alt="Банк «Центр-инвест»" width={256} height={55} />
            <h1>Work<span className="brand-accent">Lab</span></h1>
            <p>Браузерная игра о кибербезопасности. Проведи смену в роли инженера по безопасности приложений.</p>
            <div className="hero-actions">
              <button className="hero-start" type="button" disabled><Play size={19} /> Начать играть</button>
              <span className="guest-access">Без регистрации</span>
            </div>
          </div>
          <CodePreview />
        </section>
      </main>
    </div>
  )
}
