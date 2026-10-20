import { describe, it, expect } from "vitest";
import { extractKaspiProductId, runRealReprice } from "./kaspi-apify";
import type { Product } from "./types";

describe("Kaspi Apify Module", () => {
  describe("extractKaspiProductId", () => {
    it("extracts ID from full Kaspi product URL with trailing slash", () => {
      const url =
        "https://kaspi.kz/shop/p/apple-iphone-15-128gb-chernyi-113137790/";
      expect(extractKaspiProductId(url)).toBe("113137790");
    });

    it("extracts ID from Kaspi URL with query parameters", () => {
      const url =
        "https://kaspi.kz/shop/p/samsung-galaxy-a55-256gb-117420239/?c=750000000";
      expect(extractKaspiProductId(url)).toBe("117420239");
    });

    it("accepts a raw numeric product ID", () => {
      expect(extractKaspiProductId("113137790")).toBe("113137790");
    });

    it("returns default demo ID for invalid URL", () => {
      expect(extractKaspiProductId("invalid-url")).toBe("113137790");
    });
  });

  describe("runRealReprice integration with calculatePrice", () => {
    it("calculates price using real or fallback competitors", async () => {
      const config: Omit<Product, "competitors"> = {
        sku: "TEST-LIVE",
        name: "Test Live Product",
        myPrice: 389990,
        minPrice: 350000,
        maxPrice: 420000,
        step: 10,
      };

      const result = await runRealReprice(
        config,
        "https://kaspi.kz/shop/p/apple-iphone-15-128gb-chernyi-113137790/",
        process.env.APIFY_TOKEN || "mock_apify_token"
      );

      expect(result.sku).toBe("TEST-LIVE");
      expect(result.oldPrice).toBe(389990);
      expect(result.newPrice).toBeGreaterThanOrEqual(config.minPrice);
      expect(result.newPrice).toBeLessThanOrEqual(config.maxPrice);
      expect(["UNDERCUT", "AT_MIN", "AT_MAX", "NO_COMPETITORS"]).toContain(
        result.reason
      );
    });
  });
});
