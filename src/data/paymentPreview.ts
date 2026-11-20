type PreviewLine = {
  text: string
  hint: string
  repair?: { text: string; hint: string }
}

export const paymentPreview = {
  feature: "payment-widget.ts",
  audit: "ИИ: угроз не найдено",
  prompt: "Наведите или нажмите на строку, чтобы расшифровать код",
  warning: "Секретный ключ оплаты виден в браузере",
  success: "Данные изолированы • Безопасно",
  lines: [
    { text: 'const widget = createWidget("payment");', hint: "Создаём платёжный виджет для страницы оплаты" },
    { text: 'const shop = getPublicConfig("store");', hint: "Загружаем открытые настройки магазина" },
    { text: 'const secretKey = "sk_live_94f2a8c1...";', hint: "Секретный ключ оплаты — он должен храниться только на сервере" },
    {
      text: "widget.data = { ...shop, secretKey };",
      hint: "Секретный ключ попал в открытые данные виджета — его увидит любой пользователь",
      repair: {
        text: "widget.data = { ...shop };",
        hint: "В браузер попадают только открытые данные. Служебные остаются на сервере.",
      },
    },
    { text: "renderForm(widget);", hint: "Отрисовываем форму оплаты в браузере" },
    { text: "const status = await sendPayment(widget);", hint: "Отправляем платёжный запрос на сервер" },
    { text: "showReceipt(status);", hint: "Показываем пользователю чек и статус оплаты" },
  ] satisfies PreviewLine[],
}
