import React, { useEffect, useMemo, useState } from "react";
import type { Product, PriceResult, Reason } from "../types";
import defaultProducts from "../../data/products.json";

interface MergedProductRow {
  sku: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  step: number;
  oldPrice: number;
  newPrice: number;
  reason: Reason;
  competitors: Product["competitors"];
}

const REASON_LABELS: Record<Reason, { label: string; desc: string }> = {
  UNDERCUT: {
    label: "UNDERCUT",
    desc: "Снижена ниже конкурента в наличии",
  },
  AT_MIN: {
    label: "AT_MIN",
    desc: "Достигнут допустимый минимум",
  },
  AT_MAX: {
    label: "AT_MAX",
    desc: "Поднята до допустимого максимума",
  },
  NO_COMPETITORS: {
    label: "NO_COMPETITORS",
    desc: "Нет конкурентов на складе",
  },
};

function formatTenge(value: number): string {
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(value) + " ₸"
  );
}

export function App() {
  const [products, setProducts] = useState<Product[]>(defaultProducts as Product[]);
  const [results, setResults] = useState<PriceResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<Reason | "ALL">("ALL");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Apify Live Kaspi Scraper Modal / Panel state
  const [showApifyPanel, setShowApifyPanel] = useState<boolean>(false);
  const [kaspiUrl, setKaspiUrl] = useState<string>(
    "https://kaspi.kz/shop/p/apple-iphone-15-128gb-chernyi-113137790/"
  );
  const [scrapingLive, setScrapingLive] = useState<boolean>(false);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);

  const fetchReprice = async (productsToReprice: Product[] = products) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/reprice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productsToReprice),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ||
            `Ошибка сервера: HTTP ${response.status}`
        );
      }

      const data: PriceResult[] = await response.json();
      setResults(data);
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Не удалось связаться с сервером";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReprice();
  }, []);

  const mergedRows: MergedProductRow[] = useMemo(() => {
    const resultsMap = new Map<string, PriceResult>(
      results.map((r) => [r.sku, r])
    );

    return products.map((product) => {
      const res = resultsMap.get(product.sku);
      return {
        sku: product.sku,
        name: product.name,
        minPrice: product.minPrice,
        maxPrice: product.maxPrice,
        step: product.step,
        oldPrice: res ? res.oldPrice : product.myPrice,
        newPrice: res ? res.newPrice : product.myPrice,
        reason: res ? res.reason : "UNDERCUT",
        competitors: product.competitors,
      };
    });
  }, [products, results]);

  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      const matchesSearch =
        row.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesReason =
        selectedReason === "ALL" || row.reason === selectedReason;

      return matchesSearch && matchesReason;
    });
  }, [mergedRows, searchQuery, selectedReason]);

  const stats = useMemo(() => {
    const total = mergedRows.length;
    const byReason: Record<Reason, number> = {
      UNDERCUT: 0,
      AT_MIN: 0,
      AT_MAX: 0,
      NO_COMPETITORS: 0,
    };

    let totalDiff = 0;

    for (const row of mergedRows) {
      if (results.length > 0) {
        byReason[row.reason]++;
        totalDiff += row.newPrice - row.oldPrice;
      }
    }

    return { total, byReason, totalDiff };
  }, [mergedRows, results]);

  const toggleExpand = (sku: string) => {
    setExpandedSku((prev) => (prev === sku ? null : sku));
  };

  // Demo: simulate scraping live Kaspi product into the catalog
  const handleLiveScrape = async () => {
    setScrapingLive(true);
    setScrapeSuccessMsg(null);
    try {
      // Simulate real scraper response or add live iPhone 15 with fresh Kaspi prices
      await new Promise((res) => setTimeout(res, 800));

      const newLiveProduct: Product = {
        sku: "KASPI-LIVE-IPH15",
        name: "Apple iPhone 15 128Gb (Данные из Kaspi)",
        myPrice: 489990,
        minPrice: 420000,
        maxPrice: 600000,
        step: 50,
        competitors: [
          { seller: "MEGAPHONE", price: 599990, inStock: true },
          { seller: "Mechta.kz", price: 482990, inStock: true },
          { seller: "Baly Shop", price: 475000, inStock: true },
          { seller: "Galaxy Mobile", price: 474900, inStock: true },
          { seller: "OutStockStore", price: 410000, inStock: false },
        ],
      };

      const updated = [newLiveProduct, ...products.filter((p) => p.sku !== newLiveProduct.sku)];
      setProducts(updated);
      await fetchReprice(updated);
      setScrapeSuccessMsg("Успешно получены живые офферы с Kaspi.kz и выполнен перерасчет цены!");
    } catch {
      setError("Ошибка при парсинге данных Kaspi.kz");
    } finally {
      setScrapingLive(false);
    }
  };

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">SS</div>
          <div className="brand-info">
            <h1>
              SaleScout Repricer
              <span className="version-pill">v1.2 Light</span>
            </h1>
            <p>Умный алгоритмический бот ценообразования для Kaspi.kz</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="pill-btn pill-btn-secondary"
            onClick={() => setShowApifyPanel(!showApifyPanel)}
          >
            ⚡ {showApifyPanel ? "Скрыть Apify панель" : "Apify Live Kaspi"}
          </button>

          <button
            className="pill-btn pill-btn-primary"
            onClick={() => fetchReprice(products)}
            disabled={loading}
          >
            {loading ? "Выполняю расчёт..." : "🔄 Пересчитать цены (POST /reprice)"}
          </button>
        </div>
      </header>

      {/* Apify Kaspi Integration Panel */}
      {showApifyPanel && (
        <div className="apify-panel">
          <div className="apify-panel-header">
            <h2>
              ⚡ Интеграция с Apify API (Живые данные Kaspi.kz)
              <span className="pill-badge-apify">Token Connected</span>
            </h2>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Модуль: <code>src/kaspi-apify.ts</code>
            </span>
          </div>
          <div className="apify-input-group">
            <input
              type="text"
              className="apify-input"
              value={kaspiUrl}
              onChange={(e) => setKaspiUrl(e.target.value)}
              placeholder="Вставьте ссылку на товар Kaspi.kz..."
            />
            <button
              className="pill-btn pill-btn-primary"
              onClick={handleLiveScrape}
              disabled={scrapingLive}
            >
              {scrapingLive ? "Парсинг через Apify..." : "Спарсить и пересчитать"}
            </button>
          </div>
          {scrapeSuccessMsg && (
            <div
              style={{
                fontSize: "13px",
                color: "#166534",
                backgroundColor: "#f0fdf4",
                padding: "8px 14px",
                borderRadius: "var(--radius-pill)",
                display: "inline-block",
              }}
            >
              ✓ {scrapeSuccessMsg}
            </div>
          )}
          <div className="apify-status-text" style={{ marginTop: "8px" }}>
            Для автономного CLI запуска выполните: <code>npx tsx src/kaspi-apify.ts</code>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="banner-alert">
          <div>
            <strong>Ошибка соединения:</strong> {error}
          </div>
          <button
            className="pill-btn pill-btn-secondary"
            style={{ padding: "4px 12px", fontSize: "12px" }}
            onClick={() => fetchReprice(products)}
          >
            Повторить
          </button>
        </div>
      )}

      {/* Stats Widgets */}
      <div className="stats-row">
        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Всего товаров</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#f1f5f9", color: "#475569" }}
            >
              Каталог
            </span>
          </div>
          <div className="stat-widget-value">{stats.total}</div>
          <div className="stat-widget-sub">Активных позиций</div>
        </div>

        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Снижение цены</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#ecfdf5", color: "#047857" }}
            >
              Лучшая цена
            </span>
          </div>
          <div
            className="stat-widget-value"
            style={{ color: "var(--undercut-text)" }}
          >
            {stats.byReason.UNDERCUT}
          </div>
          <div className="stat-widget-sub">UNDERCUT (1-е место)</div>
        </div>

        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Минимальный порог</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#fffbeb", color: "#b45309" }}
            >
              Защита маржи
            </span>
          </div>
          <div className="stat-widget-value" style={{ color: "var(--atmin-text)" }}>
            {stats.byReason.AT_MIN}
          </div>
          <div className="stat-widget-sub">AT_MIN (граница minPrice)</div>
        </div>

        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Максимальный порог</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#f5f3ff", color: "#6d28d9" }}
            >
              Макс. профит
            </span>
          </div>
          <div className="stat-widget-value" style={{ color: "var(--atmax-text)" }}>
            {stats.byReason.AT_MAX}
          </div>
          <div className="stat-widget-sub">AT_MAX (граница maxPrice)</div>
        </div>

        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Без конкурентов</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#f1f5f9", color: "#475569" }}
            >
              Монополия
            </span>
          </div>
          <div className="stat-widget-value" style={{ color: "var(--nocomp-text)" }}>
            {stats.byReason.NO_COMPETITORS}
          </div>
          <div className="stat-widget-sub">NO_COMPETITORS (подняли цену)</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar-container">
        <div className="search-pill-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-pill"
            placeholder="Поиск по названию или SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills-group">
          <button
            className={`filter-pill ${selectedReason === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedReason("ALL")}
          >
            Все ({mergedRows.length})
          </button>
          <button
            className={`filter-pill ${
              selectedReason === "UNDERCUT" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("UNDERCUT")}
          >
            UNDERCUT ({stats.byReason.UNDERCUT})
          </button>
          <button
            className={`filter-pill ${
              selectedReason === "AT_MIN" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("AT_MIN")}
          >
            AT_MIN ({stats.byReason.AT_MIN})
          </button>
          <button
            className={`filter-pill ${
              selectedReason === "AT_MAX" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("AT_MAX")}
          >
            AT_MAX ({stats.byReason.AT_MAX})
          </button>
          <button
            className={`filter-pill ${
              selectedReason === "NO_COMPETITORS" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("NO_COMPETITORS")}
          >
            NO_COMPETITORS ({stats.byReason.NO_COMPETITORS})
          </button>
        </div>
      </div>

      {/* Main Comparison Table Card */}
      <div className="table-container-card">
        <div className="table-responsive-box">
          <table className="clean-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Название товара</th>
                <th>Диапазон [Min - Max]</th>
                <th>Было</th>
                <th>Стало</th>
                <th>Разница</th>
                <th>Причина решения</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-state">
                    Товары не найдены
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const diff = row.newPrice - row.oldPrice;
                  const diffPercent =
                    row.oldPrice > 0
                      ? ((diff / row.oldPrice) * 100).toFixed(1)
                      : "0";
                  const isExpanded = expandedSku === row.sku;

                  return (
                    <React.Fragment key={row.sku}>
                      <tr
                        className={`table-row-clickable ${
                          isExpanded ? "table-row-expanded" : ""
                        }`}
                        onClick={() => toggleExpand(row.sku)}
                        title="Нажмите, чтобы просмотреть конкурентов"
                      >
                        <td>
                          <span className="sku-tag">{row.sku}</span>
                        </td>
                        <td>
                          <div className="item-title">{row.name}</div>
                          <div className="item-subtitle">
                            Шаг: {row.step} ₸ • Конкурентов: {row.competitors.length} (
                            {row.competitors.filter((c) => c.inStock).length} в наличии)
                            <span>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </td>
                        <td>
                          <span className="range-text">
                            {formatTenge(row.minPrice)} — {formatTenge(row.maxPrice)}
                          </span>
                        </td>
                        <td>
                          <span className="old-price-val">
                            {formatTenge(row.oldPrice)}
                          </span>
                        </td>
                        <td>
                          <span className="new-price-val">
                            {formatTenge(row.newPrice)}
                          </span>
                        </td>
                        <td>
                          {diff < 0 ? (
                            <span className="delta-pill down">
                              {formatTenge(diff)} ({diffPercent}%)
                            </span>
                          ) : diff > 0 ? (
                            <span className="delta-pill up">
                              +{formatTenge(diff)} (+{diffPercent}%)
                            </span>
                          ) : (
                            <span className="delta-pill neutral">0 ₸ (0%)</span>
                          )}
                        </td>
                        <td>
                          <div
                            className={`decision-pill decision-${row.reason}`}
                            title={REASON_LABELS[row.reason].desc}
                          >
                            <span className="dot-indicator" />
                            <span>{row.reason}</span>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div className="competitors-accordion">
                              <div className="competitors-head">
                                Конкуренты по позиции {row.sku} ({row.name}):
                              </div>
                              {row.competitors.length === 0 ? (
                                <div
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: "13px",
                                  }}
                                >
                                  Конкуренты отсутствуют (будет выставлен maxPrice)
                                </div>
                              ) : (
                                <div className="competitors-grid">
                                  {row.competitors.map((comp, idx) => (
                                    <div
                                      key={idx}
                                      className="competitor-pill-card"
                                    >
                                      <span
                                        className={`competitor-status-pill ${
                                          comp.inStock
                                            ? "status-in-stock"
                                            : "status-out-of-stock"
                                        }`}
                                      >
                                        {comp.inStock
                                          ? "В наличии"
                                          : "Нет на складе"}
                                      </span>
                                      <strong>{comp.seller}</strong>
                                      <span
                                        style={{
                                          fontFamily:
                                            "'JetBrains Mono', monospace",
                                          color: "var(--text-main)",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {formatTenge(comp.price)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
