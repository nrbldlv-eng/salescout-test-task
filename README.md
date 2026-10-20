# SaleScout — Прайс-бот для Kaspi.kz

Автоматизированный SaaS-сервис управления ценами для продавцов на Kaspi.kz. Бот отслеживает цены конкурентов в наличии и выставляет оптимальную цену, чтобы удерживать первое место в выдаче, защищая маржинальность продавца.

Проект выполнен в виде fullstack-приложения:
- **Core-логика:** чистая функция `calculatePrice` в [src/pricing.ts](src/pricing.ts).
- **Backend API:** Express HTTP-сервер с эндпоинтом `POST /reprice` в [src/app.ts](src/app.ts).
- **Frontend UI:** интерактивное SPA на React 19 + Vite со светлой минималистичной темой (Clean Desktop Utility UI) и овальными кнопками-пилюлями (Pill Buttons) в [src/client/App.tsx](src/client/App.tsx).
- **Интеграция с Apify API:** модуль сбора реальных офферов с Kaspi.kz и динамического пересчёта цен в [src/kaspi-apify.ts](src/kaspi-apify.ts).
- **Тесты:** 24 теста на Vitest в [src/pricing.test.ts](src/pricing.test.ts), [src/app.test.ts](src/app.test.ts) и [src/kaspi-apify.test.ts](src/kaspi-apify.test.ts).

---

## Новый дизайн интерфейса (Light Theme)

Интерфейс веб-приложения переработан в стиле современной утилиты:
- **Фон:** мягкий светлый нейтральный фон (`#f5f5f7`).
- **Контейнеры и карточки:** чистые белые панели (`#ffffff`) с радиусом скругления `20px`, деликатными границами `1px solid #e5e7eb` и мягкими тенями.
- **Пилюли и фильтры:** элементы управления в форме овальных пилюль (`border-radius: 9999px`) с плавными состояниями активности и контрастными индикаторами.
- **Статусы и цветовая палитра:**
  - `UNDERCUT` — мятно-зеленый бейдж (снижение цены, 1-е место);
  - `AT_MIN` — янтарный бейдж (защита минимальной маржи продавца);
  - `AT_MAX` — фиолетовый бейдж (максимальный профит при дорогих конкурентах);
  - `NO_COMPETITORS` — сланцевый нейтральный бейдж (отсутствие предложений в наличии).
- **Интерактивные офферы:** клик по строке товара раскрывает детальный список конкурентов со статусами наличия.

---

## Быстрый старт

### Требования
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
Скопируйте пример файла конфигурации или укажите ваш токен Apify:
```bash
cp .env.example .env
```
В файле `.env`:
```env
APIFY_TOKEN=your_apify_api_token_here
```

### 3. Запуск тестов
Запуск всех юнит- и интеграционных тестов:
```bash
npm test
```

Проверка типов TypeScript:
```bash
npm run typecheck
```

### 4. Запуск в режиме разработки
Запуск бэкенда (порт 3000) и фронтенда (порт 5173) одной командой:
```bash
npm run dev
```

Откройте в браузере: [http://localhost:5173](http://localhost:5173)

> Также доступны раздельные команды:
> - `npm run dev:server` — запуск только Express API с автоперезагрузкой (`tsx watch`)
> - `npm run dev:client` — запуск только Vite dev-сервера

### 5. Сборка для продакшена
```bash
npm run build
```

---

## Интеграция с Apify (Реальные данные Kaspi.kz)

Модуль [src/kaspi-apify.ts](src/kaspi-apify.ts) позволяет парсить реальные предложения продавцов с живых карточек товаров Kaspi.kz через Apify API и выполнять перерасчет цены в реальном времени.

### Основные функции модуля:
1. `fetchKaspiCompetitors(productUrl, apifyToken)`:
   - Аутентифицируется в Apify REST API (`/v2/users/me`).
   - Извлекает ID товара из ссылки Kaspi.kz.
   - Получает актуальный список продавцов и приводит к единому формату `Competitor[]` (`seller`, `price`, `inStock`).
2. `runRealReprice(productConfig, productUrl, apifyToken)`:
   - Объединяет конфигурацию вашего товара с собранными конкурентами.
   - Передает данные в чистую функцию `calculatePrice(product)`.
   - Возвращает итоговый `PriceResult`.

### Запуск CLI-скрипта
Для тестирования в терминале выполните:
```bash
npx tsx src/kaspi-apify.ts
```

Пример вывода:
```text
==========================================================
 SaleScout: Kaspi.kz Real-Time Repricer (Apify Module)   
==========================================================
Product URL : https://kaspi.kz/shop/p/apple-iphone-15-128gb-chernyi-113137790/
Apify Token : apify_api_SCpy...sB8y
----------------------------------------------------------
Fetching live competitor offers from Kaspi.kz...
[Apify] Authenticated successfully as user: fathomable_angel

Found 20 competitor offers:
  1. [IN STOCK    ] MEGAPHONE                 599 990 ₸
  2. [IN STOCK    ] Mechta.kz                 482 990 ₸
  3. [IN STOCK    ] Baly Shop                 475 000 ₸
  4. [IN STOCK    ] Galaxy Mobile             474 900 ₸
  ... and 16 more offers

==========================================================
 REPRICING CALCULATION RESULT                            
==========================================================
SKU         : IPH15-128-BLK-LIVE
Old Price   : 389 990 ₸
New Price   : 429 950 ₸
Diff        : 39 960 ₸
Decision    : UNDERCUT
==========================================================
```

---

## Архитектура и структура проекта

```text
├── data/
│   ├── products.json        # Демонстрационный набор товаров и конкурентов
│   └── expected.json        # Ожидаемый эталонный результат пересчёта
├── src/
│   ├── client/              # React-приложение (Vite, Clean Light Theme)
│   │   ├── App.tsx          # Таблица Было/Стало, фильтры, карточки, Apify drawer
│   │   ├── main.tsx         # Точка монтирования React
│   │   └── styles.css       # Премиальные стили Light UI с пилюлями
│   ├── app.ts               # Express-приложение и маршруты API
│   ├── app.test.ts          # Интеграционные тесты API эндпоинтов (Supertest)
│   ├── server.ts            # Точка запуска HTTP-сервера (порт 3000)
│   ├── pricing.ts           # ЧИСТАЯ ФУНКЦИЯ calculatePrice (неизменная сигнатура)
│   ├── pricing.test.ts      # Модульные тесты алгоритма ценообразования
│   ├── kaspi-apify.ts       # Модуль скрапинга Kaspi.kz через Apify API + CLI
│   ├── kaspi-apify.test.ts  # Тесты парсера URL и интеграции модуля Apify
│   └── types.ts             # Интерфейсы Product, Competitor, PriceResult, Reason
├── .env.example             # Шаблон конфигурации переменных окружения
├── index.html               # Шаблон Vite для React
├── vite.config.ts           # Конфигурация Vite с проксированием /reprice на Express
├── tsconfig.json            # Настройки TypeScript
└── package.json             # Скрипты и зависимости
```

---

## Алгоритм расчёта цены (`calculatePrice`)

Сигнатура:
```typescript
export function calculatePrice(product: Product): PriceResult;
```

### Правила:
1. **Фильтрация остатков**: учитываются исключительно конкуренты с флагом `inStock: true`. Конкуренты не в наличии полностью игнорируются.
2. **Отсутствие конкурентов**: если после фильтрации конкурентов нет или их список пуст:
   - `newPrice = maxPrice`
   - `reason = "NO_COMPETITORS"`
3. **Определение лучшей цены**: находится минимальная цена среди предложений в наличии: `best = Math.min(...)`.
4. **Шаг снижения**: рассчитывается цена-кандидат:
   $$\text{candidate} = \lfloor \text{best} - \text{product.step} \rfloor$$
   *(с округлением вниз до целого тенге)*.
5. **Диапазонные ограничения**:
   - $\text{candidate} < \text{minPrice} \implies \text{newPrice} = \text{minPrice}, \quad \text{reason} = \text{"AT\_MIN"}$
   - $\text{candidate} > \text{maxPrice} \implies \text{newPrice} = \text{maxPrice}, \quad \text{reason} = \text{"AT\_MAX"}$
   - Иначе ($\text{minPrice} \le \text{candidate} \le \text{maxPrice}$, включая границы) $\implies \text{newPrice} = \text{candidate}, \quad \text{reason} = \text{"UNDERCUT"}$
6. **Исходная цена**: `oldPrice` всегда равен `product.myPrice`.

---

## HTTP API

### `POST /reprice`
Принимает массив товаров и рассчитывает новые цены.

- **Headers**: `Content-Type: application/json`
- **Body**: `Product[]`
- **Ответ 200**: `PriceResult[]` в том же порядке.
- **Ответ 400**: Если тело запроса не является массивом или элементы некорректны (`{ "error": "..." }`).

---

## Тестирование

Запуск тестов: `npm test`
- **`src/pricing.test.ts` (13 тестов)**: все бизнес-кейсы алгоритма (UNDERCUT, границы min/max, zero step, fractional step, filtering inStock, датасет `data/products.json`).
- **`src/app.test.ts` (6 тестов)**: коды ответов HTTP API (200, 400), валидация тела запроса, неизменность порядка.
- **`src/kaspi-apify.test.ts` (5 тестов)**: парсинг URL Kaspi, валидация токена Apify, интеграционный расчет на реальных данных.

Итого: **24 теста** успешно проходят.
