import React, { useEffect, useMemo, useState } from "react";
import type { Product, PriceResult, Reason } from "../types";
import defaultRealProducts from "../../data/real-kaspi-products.json";

interface MergedProductRow {
  sku: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  step: number;
  oldPrice: number;
  newPrice: number;
  reason: Reason;
  imageUrl?: string;
  kaspiUrl?: string;
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
  const [products, setProducts] = useState<Product[]>(
    defaultRealProducts as Product[]
  );
  const [results, setResults] = useState<PriceResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search/Add Kaspi item
  const [searchOrUrlInput, setSearchOrUrlInput] = useState<string>("");
  const [isSearchingKaspi, setIsSearchingKaspi] = useState<boolean>(false);

  // In-table search & filters
  const [tableSearchQuery, setTableSearchQuery] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<Reason | "ALL">("ALL");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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

  // Initial load: fetch real products from API or use real-kaspi-products.json
  useEffect(() => {
    async function loadInitial() {
      try {
        const res = await fetch("/products");
        if (res.ok) {
          const data: Product[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setProducts(data);
            fetchReprice(data);
            return;
          }
        }
      } catch {
        // Fallback to loaded defaultRealProducts
      }
      fetchReprice(products);
    }

    loadInitial();
  }, []);

  // Handler to search and add a product directly from Kaspi.kz
  const handleAddKaspiProduct = async (queryToAdd?: string) => {
    const query = (queryToAdd || searchOrUrlInput).trim();
    if (!query) return;

    setIsSearchingKaspi(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/kaspi/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          (errJson as { error?: string }).error ||
            `Товар "${query}" не найден на Kaspi.kz`
        );
      }

      const data = (await res.json()) as {
        product: Product;
        result: PriceResult;
      };

      // Add to product list (or replace if existing SKU)
      const filtered = products.filter((p) => p.sku !== data.product.sku);
      const updatedProducts = [data.product, ...filtered];

      setProducts(updatedProducts);
      setSearchOrUrlInput("");
      setSuccessMsg(`Товар "${data.product.name}" успешно добавлен с Kaspi.kz!`);

      // Update reprice for whole list
      await fetchReprice(updatedProducts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка при поиске на Kaspi";
      setError(msg);
    } finally {
      setIsSearchingKaspi(false);
    }
  };

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
        imageUrl: product.imageUrl,
        kaspiUrl: product.kaspiUrl,
        competitors: product.competitors,
      };
    });
  }, [products, results]);

  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      const matchesSearch =
        row.sku.toLowerCase().includes(tableSearchQuery.toLowerCase()) ||
        row.name.toLowerCase().includes(tableSearchQuery.toLowerCase());

      const matchesReason =
        selectedReason === "ALL" || row.reason === selectedReason;

      return matchesSearch && matchesReason;
    });
  }, [mergedRows, tableSearchQuery, selectedReason]);

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

  const quickQueries = [
    "iPhone 15 128Gb",
    "AirPods Pro 2",
    "Samsung Galaxy A55",
    "Dyson V15",
    "Sony PlayStation 5",
  ];

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">SS</div>
          <div className="brand-info">
            <h1>
              SaleScout Repricer
              <span className="live-pill">
                <span className="live-indicator-dot" />
                Live Kaspi
              </span>
            </h1>
            <p>Динамический перерасчёт цен на реальных данных Kaspi.kz</p>
          </div>
        </div>

        <div className="header-actions">
          {lastUpdated && (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Обновлено в {lastUpdated}
            </span>
          )}
          <button
            className="pill-btn pill-btn-primary"
            onClick={() => fetchReprice(products)}
            disabled={loading}
          >
            {loading ? "Выполняю расчёт..." : "🔄 Пересчитать цены (POST /reprice)"}
          </button>
        </div>
      </header>

      {/* Kaspi Live Search & Add Card */}
      <div className="search-add-card">
        <div className="search-add-title">
          <h2>
            <span className="kaspi-badge-icon">KASPI</span>
            Поиск и добавление реального товара
          </h2>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Парсинг карточки, продавцов и остатков в реальном времени
          </span>
        </div>

        <form
          className="search-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddKaspiProduct();
          }}
        >
          <div className="search-add-input-wrapper">
            <span className="search-add-icon">🔎</span>
            <input
              type="text"
              className="search-add-input"
              value={searchOrUrlInput}
              onChange={(e) => setSearchOrUrlInput(e.target.value)}
              placeholder="Вставьте ссылку на товар Kaspi.kz или введите название (например: iPhone 15 128Gb)..."
              disabled={isSearchingKaspi}
            />
          </div>
          <button
            type="submit"
            className="pill-btn pill-btn-primary"
            disabled={isSearchingKaspi || !searchOrUrlInput.trim()}
          >
            {isSearchingKaspi ? "Поиск и парсинг..." : "⚡ Добавить с Kaspi"}
          </button>
        </form>

        <div className="quick-search-chips">
          <span className="quick-chips-label">Быстрый поиск:</span>
          {quickQueries.map((q) => (
            <button
              key={q}
              type="button"
              className="quick-chip-btn"
              onClick={() => handleAddKaspiProduct(q)}
              disabled={isSearchingKaspi}
            >
              + {q}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="banner-success">
          <span>✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#166534",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="banner-alert">
          <div>
            <strong>Ошибка:</strong> {error}
          </div>
          <button
            className="pill-btn pill-btn-secondary"
            style={{ padding: "4px 12px", fontSize: "12px" }}
            onClick={() => setError(null)}
          >
            Закрыть
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
          <div className="stat-widget-sub">Реальных позиций Kaspi</div>
        </div>

        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Снижение цены</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#ecfdf5", color: "#047857" }}
            >
              1-е место
            </span>
          </div>
          <div
            className="stat-widget-value"
            style={{ color: "var(--undercut-text)" }}
          >
            {stats.byReason.UNDERCUT}
          </div>
          <div className="stat-widget-sub">UNDERCUT (лучшая цена)</div>
        </div>

        <div className="stat-widget">
          <div className="stat-widget-top">
            <span className="stat-widget-label">Минимальный порог</span>
            <span
              className="stat-widget-pill"
              style={{ backgroundColor: "#fffbeb", color: "#b45309" }}
            >
              Защита
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
              Профит
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

      {/* Toolbar: Search in Table and Filters */}
      <div className="toolbar-container">
        <div style={{ position: "relative", width: "320px" }}>
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-light)",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            className="search-add-input"
            style={{ paddingLeft: "38px" }}
            placeholder="Фильтр таблицы по названию или SKU..."
            value={tableSearchQuery}
            onChange={(e) => setTableSearchQuery(e.target.value)}
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
                <th>Товар (Фото и Название на Kaspi.kz)</th>
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
                  <td colSpan={6} className="empty-table-state">
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
                        title="Нажмите, чтобы просмотреть реальных продавцов Kaspi"
                      >
                        <td>
                          <div className="product-cell">
                            {row.imageUrl ? (
                              <img
                                src={row.imageUrl}
                                alt={row.name}
                                className="product-thumb"
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback to placeholder on error
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="product-thumb-placeholder">📦</div>
                            )}

                            <div className="product-info-box">
                              {row.kaspiUrl ? (
                                <a
                                  href={row.kaspiUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="product-kaspi-link"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Открыть карточку товара на Kaspi.kz"
                                >
                                  {row.name}
                                  <span className="external-icon">↗</span>
                                </a>
                              ) : (
                                <span style={{ fontWeight: 600 }}>{row.name}</span>
                              )}

                              <div className="item-meta">
                                <span className="sku-tag">{row.sku}</span>
                                <span>Шаг: {row.step} ₸</span>
                                <span>•</span>
                                <span>
                                  Продавцов: {row.competitors.length} (
                                  {
                                    row.competitors.filter((c) => c.inStock).length
                                  }{" "}
                                  в наличии)
                                </span>
                                <span>{isExpanded ? "▲" : "▼"}</span>
                              </div>
                            </div>
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
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div className="competitors-accordion">
                              <div className="competitors-head">
                                Продавцы на Kaspi.kz по позиции {row.name}:
                              </div>
                              {row.competitors.length === 0 ? (
                                <div
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: "13px",
                                  }}
                                >
                                  Конкуренты отсутствуют (выставлен максимум maxPrice)
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
