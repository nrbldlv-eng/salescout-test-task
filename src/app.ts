import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { calculatePrice } from "./pricing";
import type { Product, PriceResult } from "./types";
import {
  fetchKaspiProductWithCompetitors,
  getInitialRealProducts,
} from "./kaspi-apify";
import sampleProducts from "../data/products.json";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Error handler for invalid JSON bodies
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      next: NextFunction
    ) => {
      if (
        err instanceof SyntaxError &&
        "status" in err &&
        (err as { status: number }).status === 400
      ) {
        res.status(400).json({ error: "Invalid JSON format in request body" });
        return;
      }
      next(err);
    }
  );

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Returns list of real Kaspi products
  app.get("/products", (_req: Request, res: Response) => {
    const realProducts = getInitialRealProducts();
    if (realProducts && realProducts.length > 0) {
      res.status(200).json(realProducts);
      return;
    }
    // Fallback to sample dataset if real-products file is missing
    res.status(200).json(sampleProducts);
  });

  // Real-time Kaspi Search & Reprice endpoint
  app.post("/kaspi/search", async (req: Request, res: Response) => {
    const { query } = req.body as { query?: string };

    if (!query || typeof query !== "string" || !query.trim()) {
      res.status(400).json({ error: "Параметр 'query' обязателен для поиска на Kaspi.kz" });
      return;
    }

    try {
      const product = await fetchKaspiProductWithCompetitors(query);
      if (!product) {
        res.status(404).json({ error: `Товар по запросу "${query}" не найден на Kaspi.kz` });
        return;
      }

      const result = calculatePrice(product);
      res.status(200).json({ product, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка при поиске на Kaspi";
      res.status(500).json({ error: message });
    }
  });

  // Reprice endpoint according to task specifications
  app.post("/reprice", (req: Request, res: Response) => {
    const products = req.body;

    if (!Array.isArray(products)) {
      res.status(400).json({
        error: "Invalid input: request body must be an array of products",
      });
      return;
    }

    // Validate that each item has the minimum required structure
    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.sku !== "string" ||
        typeof item.myPrice !== "number" ||
        typeof item.minPrice !== "number" ||
        typeof item.maxPrice !== "number" ||
        typeof item.step !== "number" ||
        !Array.isArray(item.competitors)
      ) {
        res.status(400).json({
          error: `Invalid product at index ${i}: missing required fields`,
        });
        return;
      }
    }

    const results: PriceResult[] = products.map((product: Product) =>
      calculatePrice(product)
    );

    res.status(200).json(results);
  });

  return app;
}
