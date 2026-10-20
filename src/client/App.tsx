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
    desc: "Снижена ниже конкурента",
  },
  AT_MIN: {
    label: "AT_MIN",
    desc: "Достигнут минимум",
  },
  AT_MAX: {
    label: "AT_MAX",
    desc: "Поднята до максимума",
  },
  NO_COMPETITORS: {
    label: "NO_COMPETITORS",
    desc: "Нет конкурентов в наличии",
  },
};

function formatTenge(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value) + " ₸";
}

export function App() {
  const [products] = useState<Product[]>(defaultProducts as Product[]);
  const [results, setResults] = useState<PriceResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<Reason | "ALL">("ALL");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchReprice = async () => {
    setLoading(true);
    setError(null);

    try {
      // Calls POST /reprice (routed to Express backend via Vite proxy or direct)
      const response = await fetch("/reprice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(products),
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
    // Initial fetch on mount
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

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">SS</div>
          <div className="logo-text">
            <h1>SaleScout Repricer</h1>
            <p>Автоматическое управление ценами на Kaspi.kz</p>
          </div>
        </div>

        <div className="header-actions">
          {lastUpdated && (
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Обновлено в {lastUpdated}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={fetchReprice}
            disabled={loading}
          >
            {loading ? "Расчёт..." : "🔄 Пересчитать цены (POST /reprice)"}
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div className="alert alert-error">
          <div>
            <strong>Ошибка соединения:</strong> {error}
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={fetchReprice}
          >
            Повторить
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Всего товаров</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-desc">Позиций в каталоге</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Снижение цены</div>
          <div
            className="stat-value"
            style={{ color: "var(--badge-undercut-text)" }}
          >
            {stats.byReason.UNDERCUT}
          </div>
          <div className="stat-desc">UNDERCUT (лучшая цена)</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Нижний порог</div>
          <div
            className="stat-value"
            style={{ color: "var(--badge-atmin-text)" }}
          >
            {stats.byReason.AT_MIN}
          </div>
          <div className="stat-desc">AT_MIN (защита маржи)</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Верхний порог</div>
          <div
            className="stat-value"
            style={{ color: "var(--badge-atmax-text)" }}
          >
            {stats.byReason.AT_MAX}
          </div>
          <div className="stat-desc">AT_MAX (макс. маржа)</div>
        </div>

        <div className="stat-card">
          <div className="stat-title">Без конкурентов</div>
          <div
            className="stat-value"
            style={{ color: "var(--badge-nocomp-text)" }}
          >
            {stats.byReason.NO_COMPETITORS}
          </div>
          <div className="stat-desc">NO_COMPETITORS (подняли цену)</div>
        </div>
      </div>

      {/* Toolbar: Search and Filters */}
      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Поиск по названию или SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="filter-group">
          <button
            className={`filter-btn ${selectedReason === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedReason("ALL")}
          >
            Все ({mergedRows.length})
          </button>
          <button
            className={`filter-btn ${
              selectedReason === "UNDERCUT" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("UNDERCUT")}
          >
            UNDERCUT ({stats.byReason.UNDERCUT})
          </button>
          <button
            className={`filter-btn ${
              selectedReason === "AT_MIN" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("AT_MIN")}
          >
            AT_MIN ({stats.byReason.AT_MIN})
          </button>
          <button
            className={`filter-btn ${
              selectedReason === "AT_MAX" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("AT_MAX")}
          >
            AT_MAX ({stats.byReason.AT_MAX})
          </button>
          <button
            className={`filter-btn ${
              selectedReason === "NO_COMPETITORS" ? "active" : ""
            }`}
            onClick={() => setSelectedReason("NO_COMPETITORS")}
          >
            NO_COMPETITORS ({stats.byReason.NO_COMPETITORS})
          </button>
        </div>
      </div>

      {/* Main Table Card: Было / Стало */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="price-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Название товара</th>
                <th>Диапазон [Min - Max]</th>
                <th>Было (Старая цена)</th>
                <th>Стало (Новая цена)</th>
                <th>Разница</th>
                <th>Причина решения</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
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
                        className="clickable-row"
                        onClick={() => toggleExpand(row.sku)}
                        title="Нажмите, чтобы просмотреть конкурентов"
                      >
                        <td>
                          <span className="sku-badge">{row.sku}</span>
                        </td>
                        <td>
                          <div className="product-name">{row.name}</div>
                          <div className="product-meta">
                            Шаг: {row.step} ₸ • Конкурентов:{" "}
                            {row.competitors.length} (
                            {row.competitors.filter((c) => c.inStock).length} в
                            наличии)
                          </div>
                        </td>
                        <td>
                          <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                            {formatTenge(row.minPrice)} — {formatTenge(row.maxPrice)}
                          </span>
                        </td>
                        <td>
                          <span className="price-old">
                            {formatTenge(row.oldPrice)}
                          </span>
                        </td>
                        <td>
                          <div className="price-new-container">
                            <span className="price-new">
                              {formatTenge(row.newPrice)}
                            </span>
                          </div>
                        </td>
                        <td>
                          {diff < 0 ? (
                            <span className="price-diff down">
                              {formatTenge(diff)} ({diffPercent}%)
                            </span>
                          ) : diff > 0 ? (
                            <span className="price-diff up">
                              +{formatTenge(diff)} (+{diffPercent}%)
                            </span>
                          ) : (
                            <span className="price-diff equal">0 ₸ (0%)</span>
                          )}
                        </td>
                        <td>
                          <div
                            className={`reason-badge reason-${row.reason}`}
                            title={REASON_LABELS[row.reason].desc}
                          >
                            <span>●</span>
                            <span>{row.reason}</span>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div className="competitors-drawer">
                              <div className="competitors-title">
                                Конкуренты по товару {row.sku}:
                              </div>
                              {row.competitors.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                  Нет данных о конкурентах
                                </div>
                              ) : (
                                <div className="competitors-list">
                                  {row.competitors.map((comp, idx) => (
                                    <div key={idx} className="competitor-chip">
                                      <span
                                        className={`competitor-stock stock-${comp.inStock}`}
                                        title={
                                          comp.inStock
                                            ? "В наличии"
                                            : "Нет в наличии"
                                        }
                                      />
                                      <strong>{comp.seller}</strong>
                                      <span>{formatTenge(comp.price)}</span>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          color: comp.inStock
                                            ? "#10b981"
                                            : "#ef4444",
                                        }}
                                      >
                                        {comp.inStock
                                          ? "В наличии"
                                          : "Нет на складе"}
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
