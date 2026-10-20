import type { Product, PriceResult } from "./types";

/**
 * Чистая функция: рассчитывает новую цену для одного товара.
 * Правила:
 * 1. Учитываются только конкуренты с inStock: true.
 * 2. Если таких конкурентов нет -> newPrice = maxPrice, reason = "NO_COMPETITORS".
 * 3. Иначе best = минимальная цена среди них.
 * 4. candidate = Math.floor(best - product.step).
 * 5. Диапазон:
 *    - candidate < minPrice -> newPrice = minPrice, reason = "AT_MIN"
 *    - candidate > maxPrice -> newPrice = maxPrice, reason = "AT_MAX"
 *    - minPrice <= candidate <= maxPrice -> newPrice = candidate, reason = "UNDERCUT"
 * 6. oldPrice = product.myPrice.
 */
export function calculatePrice(product: Product): PriceResult {
  const availableCompetitors = product.competitors.filter(
    (competitor) => competitor.inStock
  );

  if (availableCompetitors.length === 0) {
    return {
      sku: product.sku,
      oldPrice: product.myPrice,
      newPrice: product.maxPrice,
      reason: "NO_COMPETITORS",
    };
  }

  let minCompetitorPrice = Infinity;
  for (const competitor of availableCompetitors) {
    if (competitor.price < minCompetitorPrice) {
      minCompetitorPrice = competitor.price;
    }
  }

  const candidate = Math.floor(minCompetitorPrice - product.step);

  if (candidate < product.minPrice) {
    return {
      sku: product.sku,
      oldPrice: product.myPrice,
      newPrice: product.minPrice,
      reason: "AT_MIN",
    };
  }

  if (candidate > product.maxPrice) {
    return {
      sku: product.sku,
      oldPrice: product.myPrice,
      newPrice: product.maxPrice,
      reason: "AT_MAX",
    };
  }

  return {
    sku: product.sku,
    oldPrice: product.myPrice,
    newPrice: candidate,
    reason: "UNDERCUT",
  };
}
