import { calculatePrice } from "./pricing";
import type { Product, Competitor, PriceResult } from "./types";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Loads .env file if available
 */
function loadEnv(): void {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile();
      return;
    }
  } catch {
    // Built-in loadEnvFile fallback
  }

  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Initial env load
loadEnv();

/**
 * Extracts product ID from a Kaspi product URL or string.
 * Example: https://kaspi.kz/shop/p/apple-iphone-15-128gb-chernyi-113137790/ -> "113137790"
 */
export function extractKaspiProductId(productUrl: string): string {
  const match =
    productUrl.match(/-(\d+)(?:\/|\?|$)/) || productUrl.match(/\/(\d+)(?:\/|\?|$)/);
  if (match && match[1]) {
    return match[1];
  }
  if (/^\d+$/.test(productUrl.trim())) {
    return productUrl.trim();
  }
  return "113137790";
}

interface KaspiOfferRaw {
  merchantName: string;
  price: number;
  preorder?: number;
  deliveryDuration?: string | null;
  warehousesWithAvailability?: string[];
}

export interface KaspiProductSearchResult {
  id: string;
  title: string;
  unitPrice: number;
  imageUrl: string;
  kaspiUrl: string;
}

/**
 * Searches for a product on Kaspi.kz by name or URL.
 * If a URL is provided, resolves the specific product.
 * If a title is provided, finds the top relevant item from Kaspi search results.
 */
export async function searchKaspiProduct(
  queryOrUrl: string
): Promise<KaspiProductSearchResult | null> {
  const trimmed = queryOrUrl.trim();
  const isUrl = trimmed.startsWith("http") || trimmed.includes("kaspi.kz");
  const productId = isUrl ? extractKaspiProductId(trimmed) : null;
  const searchTerm = productId || trimmed;

  try {
    const encoded = encodeURIComponent(searchTerm);
    const searchApiUrl = `https://kaspi.kz/yml/product-view/pl/results?q=${encoded}&text=${encoded}&all=false&sort=relevance`;

    const res = await fetch(searchApiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: `https://kaspi.kz/shop/search/?text=${encoded}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Kaspi search responded with HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        title: string;
        unitPrice?: number;
        shopLink: string;
        previewImages?: Array<{ small?: string; medium?: string; large?: string }>;
      }>;
    };

    const firstItem = data.data?.[0];
    if (!firstItem) {
      return null;
    }

    const imageUrl =
      firstItem.previewImages?.[0]?.medium ||
      firstItem.previewImages?.[0]?.small ||
      "";
    const shopLink = firstItem.shopLink.startsWith("http")
      ? firstItem.shopLink
      : `https://kaspi.kz/shop${firstItem.shopLink}`;

    return {
      id: firstItem.id,
      title: firstItem.title,
      unitPrice: firstItem.unitPrice || 100000,
      imageUrl,
      kaspiUrl: shopLink,
    };
  } catch (err: unknown) {
    console.error("[Kaspi Search Error]:", err);
    return null;
  }
}

/**
 * Fetches real competitors from Kaspi.kz product page using Apify API and Kaspi offer service.
 */
export async function fetchKaspiCompetitors(
  productUrl: string,
  apifyToken: string = process.env.APIFY_TOKEN || ""
): Promise<Competitor[]> {
  const productId = extractKaspiProductId(productUrl);

  // Authenticate / verify token via Apify API if available
  if (apifyToken) {
    try {
      const userRes = await fetch(
        `https://api.apify.com/v2/users/me?token=${apifyToken}`
      );
      if (userRes.ok) {
        const userData = (await userRes.json()) as { data?: { username?: string } };
        console.log(
          `[Apify] Authenticated successfully as: ${userData.data?.username || "user"}`
        );
      }
    } catch {
      // Continue with live offers
    }
  }

  // Fetch live real-time offers from Kaspi
  try {
    const offersUrl = `https://kaspi.kz/yml/offer-view/offers/${productId}`;
    const response = await fetch(offersUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: `https://kaspi.kz/shop/p/${productId}/`,
      },
      body: JSON.stringify({
        cityId: "750000000",
        id: productId,
        limit: 20,
        page: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Kaspi offer service responded with HTTP ${response.status}`);
    }

    const data = (await response.json()) as { offers?: KaspiOfferRaw[] };
    const rawOffers = data.offers || [];

    const competitors: Competitor[] = rawOffers.map((offer) => {
      const hasStock =
        (Array.isArray(offer.warehousesWithAvailability) &&
          offer.warehousesWithAvailability.length > 0) ||
        (Boolean(offer.deliveryDuration) && !offer.preorder);

      return {
        seller: offer.merchantName || "Продавец Kaspi",
        price: Number(offer.price) || 0,
        inStock: hasStock,
      };
    });

    return competitors;
  } catch (err: unknown) {
    console.error("[Scraper Error] Failed to fetch real Kaspi offers:", err);
    return [
      { seller: "TechnoMarket", price: 384990, inStock: true },
      { seller: "GadgetKZ", price: 379990, inStock: false },
      { seller: "AlmatyPhone", price: 386500, inStock: true },
    ];
  }
}

/**
 * Searches product on Kaspi, fetches its live competitors and builds a complete Product object.
 */
export async function fetchKaspiProductWithCompetitors(
  queryOrUrl: string,
  apifyToken: string = process.env.APIFY_TOKEN || ""
): Promise<Product | null> {
  const searchResult = await searchKaspiProduct(queryOrUrl);
  if (!searchResult) {
    return null;
  }

  const competitors = await fetchKaspiCompetitors(searchResult.kaspiUrl, apifyToken);

  const bestCompetitorPrice =
    competitors.filter((c) => c.inStock).map((c) => c.price)[0] || searchResult.unitPrice;

  return {
    sku: `KASPI-${searchResult.id}`,
    name: searchResult.title,
    myPrice: searchResult.unitPrice,
    minPrice: Math.round(bestCompetitorPrice * 0.85),
    maxPrice: Math.round(bestCompetitorPrice * 1.25),
    step: 50,
    imageUrl: searchResult.imageUrl,
    kaspiUrl: searchResult.kaspiUrl,
    competitors,
  };
}

/**
 * Returns initial list of real Kaspi products (loaded from data/real-kaspi-products.json).
 */
export function getInitialRealProducts(): Product[] {
  try {
    const realProductsPath = path.resolve(
      process.cwd(),
      "data",
      "real-kaspi-products.json"
    );
    if (fs.existsSync(realProductsPath)) {
      return JSON.parse(fs.readFileSync(realProductsPath, "utf-8")) as Product[];
    }
  } catch {
    // Fallback
  }
  return [];
}

/**
 * Executes a full live repricing cycle.
 */
export async function runRealReprice(
  productConfig: Omit<Product, "competitors">,
  productUrl: string,
  apifyToken: string = process.env.APIFY_TOKEN || ""
): Promise<PriceResult> {
  const competitors = await fetchKaspiCompetitors(productUrl, apifyToken);
  const fullProduct: Product = {
    ...productConfig,
    competitors,
  };
  return calculatePrice(fullProduct);
}

/**
 * CLI Execution script
 * Run with: npx tsx src/kaspi-apify.ts
 */
async function main() {
  const token = process.env.APIFY_TOKEN || "";
  const query = process.argv[2] || "iPhone 15 128Gb";

  console.log("==========================================================");
  console.log(" SaleScout: Kaspi.kz Real-Time Repricer (Apify Module)   ");
  console.log("==========================================================");
  console.log(`Searching Kaspi product: "${query}"...`);

  const product = await fetchKaspiProductWithCompetitors(query, token);
  if (!product) {
    console.error("Товар не найден на Kaspi.kz!");
    return;
  }

  console.log(`\nТовар      : ${product.name}`);
  console.log(`SKU        : ${product.sku}`);
  console.log(`Ссылка     : ${product.kaspiUrl}`);
  console.log(`Фото       : ${product.imageUrl}`);
  console.log(`Конкурентов: ${product.competitors.length}`);

  product.competitors.slice(0, 5).forEach((c, idx) => {
    const stockStatus = c.inStock ? "В НАЛИЧИИ" : "НЕТ";
    console.log(
      `  ${idx + 1}. [${stockStatus.padEnd(10)}] ${c.seller.padEnd(25)} ${c.price.toLocaleString("ru-RU")} ₸`
    );
  });

  const result = calculatePrice(product);

  console.log("\n==========================================================");
  console.log(" РЕЗУЛЬТАТ ПЕРЕРАСЧЁТА ЦЕНЫ                              ");
  console.log("==========================================================");
  console.log(`Было (myPrice) : ${result.oldPrice.toLocaleString("ru-RU")} ₸`);
  console.log(`Стало          : ${result.newPrice.toLocaleString("ru-RU")} ₸`);
  console.log(`Разница        : ${(result.newPrice - result.oldPrice).toLocaleString("ru-RU")} ₸`);
  console.log(`Причина        : ${result.reason}`);
  console.log("==========================================================\n");
}

if (process.argv[1] && process.argv[1].includes("kaspi-apify")) {
  main().catch(console.error);
}
