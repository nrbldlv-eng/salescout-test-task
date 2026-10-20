# SaleScout — Прайс-бот для Kaspi.kz

Автоматизированный сервис управления ценами для продавцов на Kaspi.kz. Бот отслеживает цены конкурентов в наличии и выставляет оптимальную цену, чтобы удерживать первое место в выдаче, защищая маржинальность продавца.

Проект выполнен в виде fullstack-приложения:
- **Core-логика:** чистая функция `calculatePrice` в [src/pricing.ts](src/pricing.ts).
- **Backend API:** Express HTTP-сервер с эндпоинтом `POST /reprice` в [src/app.ts](src/app.ts).
- **Frontend UI:** интерактивное SPA на React 19 + Vite с таблицей «Было / Стало» в [src/client/App.tsx](src/client/App.tsx).
- **Тесты:** полный набор модульных и интеграционных тестов на Vitest в [src/pricing.test.ts](src/pricing.test.ts) и [src/app.test.ts](src/app.test.ts).

---

## Быстрый старт

### Требования
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`

### 1. Установка зависимостей
```bash
npm install
```

### 2. Запуск тестов
Запуск всех юнит- и интеграционных тестов:
```bash
npm test
```

Проверка типов TypeScript:
```bash
npm run typecheck
```

### 3. Запуск в режиме разработки
Запуск бэкенда (порт 3000) и фронтенда (порт 5173) одной командой:
```bash
npm run dev
```

После этого откройте в браузере: [http://localhost:5173](http://localhost:5173)

> Также доступны раздельные команды:
> - `npm run dev:server` — запуск только Express API с автоперезагрузкой (`tsx watch`)
> - `npm run dev:client` — запуск только Vite dev-сервера

### 4. Сборка для продакшена
```bash
npm run build
```

---

## Архитектура и структура проекта

```text
├── data/
│   ├── products.json        # Пример входных данных по товарам и конкурентам
│   └── expected.json        # Ожидаемый эталонный результат пересчёта
├── src/
│   ├── client/              # React-приложение (Vite)
│   │   ├── App.tsx          # Основной компонент: таблица Было/Стало, фильтры, карточки
│   │   ├── main.tsx         # Точка монтирования React
│   │   └── styles.css       # Стили интерфейса (темная современная тема)
│   ├── app.ts               # Express-приложение и маршруты API
│   ├── app.test.ts          # Интеграционные тесты API эндпоинтов (Supertest)
│   ├── server.ts            # Точка запуска HTTP-сервера (порт 3000)
│   ├── pricing.ts           # ЧИСТАЯ ФУНКЦИЯ calculatePrice (неизменная сигнатура)
│   ├── pricing.test.ts      # Модульные тесты алгоритма ценообразования
│   └── types.ts             # Интерфейсы Product, Competitor, PriceResult, Reason
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

#### Пример запроса:
```http
POST /reprice HTTP/1.1
Content-Type: application/json

[
  {
    "sku": "IPH15-128-BLK",
    "name": "Apple iPhone 15 128Gb черный",
    "myPrice": 389990,
    "minPrice": 370000,
    "maxPrice": 420000,
    "step": 10,
    "competitors": [
      { "seller": "TechnoMarket", "price": 384990, "inStock": true },
      { "seller": "GadgetKZ", "price": 379990, "inStock": false }
    ]
  }
]
```

#### Пример ответа:
```json
[
  {
    "sku": "IPH15-128-BLK",
    "oldPrice": 389990,
    "newPrice": 384980,
    "reason": "UNDERCUT"
  }
]
```

### Дополнительные эндпоинты
- `GET /health` — проверка работоспособности сервера (`{ "status": "ok" }`).
- `GET /products` — получение демонстрационных данных из `data/products.json`.

---

## Тестирование

Тесты запускаются командой `npm test` с помощью Vitest:
- **`src/pricing.test.ts`**:
  - `NO_COMPETITORS`: пустой список конкурентов и список с только `inStock: false`.
  - `inStock`: игнорирование дешёвых конкурентов, которых нет на складе.
  - `UNDERCUT`: обычное снижение, равенство граничным значениям `minPrice` и `maxPrice`, нулевой шаг (`step: 0`).
  - `AT_MIN`: срабатывание нижнего порога при слишком низких ценах конкурентов.
  - `AT_MAX`: срабатывание верхнего порога, когда конкуренты продают намного дороже `maxPrice`.
  - Дробный `step` и корректное округление `Math.floor`.
  - Полный регрессионный тест: проверка соответствия всего `data/products.json` эталонному `data/expected.json`.
  - Неизменность `oldPrice = myPrice`.
- **`src/app.test.ts`**:
  - Валидация входных данных (возврат HTTP 400 при некорректном JSON или не-массиве).
  - Успешный перерасчёт через HTTP API и сохранение порядка элементов.

---

## Предлагаемая история Git-коммитов

Для сохранения естественной истории разработки в вашем репозитории рекомендуется оформить следующие коммиты:

1. `feat: implement pure calculatePrice function according to business logic`
2. `test: add exhaustive vitest unit tests for calculatePrice and edge cases`
3. `feat: setup express reprice api endpoint with input validation and tests`
4. `feat: build react vite application with before-after comparison table`
5. `docs: update readme with setup, testing and architecture documentation`
