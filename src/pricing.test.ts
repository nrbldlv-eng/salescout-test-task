import { describe, it, expect } from "vitest";
import { calculatePrice } from "./pricing";
import type { Product } from "./types";
import sampleProducts from "../data/products.json";
import expectedResults from "../data/expected.json";

describe("calculatePrice", () => {
  describe("NO_COMPETITORS", () => {
    it("returns maxPrice and NO_COMPETITORS when competitors array is empty", () => {
      const product: Product = {
        sku: "TEST-EMPTY",
        name: "Empty Competitors Item",
        myPrice: 5000,
        minPrice: 3000,
        maxPrice: 6000,
        step: 10,
        competitors: [],
      };

      const result = calculatePrice(product);

      expect(result).toEqual({
        sku: "TEST-EMPTY",
        oldPrice: 5000,
        newPrice: 6000,
        reason: "NO_COMPETITORS",
      });
    });

    it("returns maxPrice and NO_COMPETITORS when all competitors are out of stock", () => {
      const product: Product = {
        sku: "TEST-OUT-OF-STOCK",
        name: "Out of Stock Competitors Item",
        myPrice: 89990,
        minPrice: 80000,
        maxPrice: 99990,
        step: 50,
        competitors: [
          { seller: "ShopA", price: 75000, inStock: false },
          { seller: "ShopB", price: 85000, inStock: false },
        ],
      };

      const result = calculatePrice(product);

      expect(result).toEqual({
        sku: "TEST-OUT-OF-STOCK",
        oldPrice: 89990,
        newPrice: 99990,
        reason: "NO_COMPETITORS",
      });
    });
  });

  describe("Competitor filtering (inStock)", () => {
    it("ignores out-of-stock competitors with lower prices and picks the lowest in-stock competitor", () => {
      const product: Product = {
        sku: "TEST-FILTER",
        name: "Filtering In-Stock Competitor Item",
        myPrice: 389990,
        minPrice: 370000,
        maxPrice: 420000,
        step: 10,
        competitors: [
          { seller: "CheapOutOfStock", price: 350000, inStock: false },
          { seller: "TechnoMarket", price: 384990, inStock: true },
          { seller: "AlmatyPhone", price: 386500, inStock: true },
        ],
      };

      const result = calculatePrice(product);

      expect(result).toEqual({
        sku: "TEST-FILTER",
        oldPrice: 389990,
        newPrice: 384980,
        reason: "UNDERCUT",
      });
    });
  });

  describe("UNDERCUT", () => {
    it("undercuts the lowest in-stock competitor by step", () => {
      const product: Product = {
        sku: "TEST-UNDERCUT",
        name: "Undercut Item",
        myPrice: 10000,
        minPrice: 8000,
        maxPrice: 12000,
        step: 15,
        competitors: [
          { seller: "StoreA", price: 9500, inStock: true },
          { seller: "StoreB", price: 9200, inStock: true },
          { seller: "StoreC", price: 9600, inStock: true },
        ],
      };

      const result = calculatePrice(product);

      // lowest is 9200, candidate = floor(9200 - 15) = 9185
      expect(result).toEqual({
        sku: "TEST-UNDERCUT",
        oldPrice: 10000,
        newPrice: 9185,
        reason: "UNDERCUT",
      });
    });

    it("returns UNDERCUT when candidate is exactly minPrice", () => {
      const product: Product = {
        sku: "TEST-EXACT-MIN",
        name: "Boundary Exact Min Item",
        myPrice: 10000,
        minPrice: 9000,
        maxPrice: 12000,
        step: 100,
        competitors: [{ seller: "StoreA", price: 9100, inStock: true }],
      };

      const result = calculatePrice(product);

      // candidate = 9100 - 100 = 9000 === minPrice
      expect(result).toEqual({
        sku: "TEST-EXACT-MIN",
        oldPrice: 10000,
        newPrice: 9000,
        reason: "UNDERCUT",
      });
    });

    it("returns UNDERCUT when candidate is exactly maxPrice", () => {
      const product: Product = {
        sku: "TEST-EXACT-MAX",
        name: "Boundary Exact Max Item",
        myPrice: 10000,
        minPrice: 8000,
        maxPrice: 12000,
        step: 50,
        competitors: [{ seller: "StoreA", price: 12050, inStock: true }],
      };

      const result = calculatePrice(product);

      // candidate = 12050 - 50 = 12000 === maxPrice
      expect(result).toEqual({
        sku: "TEST-EXACT-MAX",
        oldPrice: 10000,
        newPrice: 12000,
        reason: "UNDERCUT",
      });
    });

    it("handles zero step correctly", () => {
      const product: Product = {
        sku: "TEST-ZERO-STEP",
        name: "Zero Step Item",
        myPrice: 5000,
        minPrice: 4000,
        maxPrice: 6000,
        step: 0,
        competitors: [{ seller: "StoreA", price: 4500, inStock: true }],
      };

      const result = calculatePrice(product);

      expect(result).toEqual({
        sku: "TEST-ZERO-STEP",
        oldPrice: 5000,
        newPrice: 4500,
        reason: "UNDERCUT",
      });
    });
  });

  describe("AT_MIN boundary", () => {
    it("caps price at minPrice with reason AT_MIN when candidate is strictly below minPrice", () => {
      const product: Product = {
        sku: "SAM-A55-256",
        name: "Samsung Galaxy A55 256Gb",
        myPrice: 189000,
        minPrice: 180000,
        maxPrice: 210000,
        step: 100,
        competitors: [{ seller: "MobiStore", price: 175000, inStock: true }],
      };

      const result = calculatePrice(product);

      // candidate = floor(175000 - 100) = 174900 < 180000
      expect(result).toEqual({
        sku: "SAM-A55-256",
        oldPrice: 189000,
        newPrice: 180000,
        reason: "AT_MIN",
      });
    });
  });

  describe("AT_MAX boundary", () => {
    it("caps price at maxPrice with reason AT_MAX when candidate is strictly above maxPrice", () => {
      const product: Product = {
        sku: "AIRPODS-PRO2",
        name: "Apple AirPods Pro 2",
        myPrice: 119990,
        minPrice: 100000,
        maxPrice: 125000,
        step: 1,
        competitors: [{ seller: "EarShop", price: 150000, inStock: true }],
      };

      const result = calculatePrice(product);

      // candidate = floor(150000 - 1) = 149999 > 125000
      expect(result).toEqual({
        sku: "AIRPODS-PRO2",
        oldPrice: 119990,
        newPrice: 125000,
        reason: "AT_MAX",
      });
    });
  });

  describe("Fractional step and rounding", () => {
    it("floors the candidate when best competitor price minus step produces fractional value", () => {
      const product: Product = {
        sku: "DYSON-V15",
        name: "Dyson V15 Detect",
        myPrice: 359000,
        minPrice: 330000,
        maxPrice: 380000,
        step: 0.5,
        competitors: [{ seller: "HomeTech", price: 349999.9, inStock: true }],
      };

      const result = calculatePrice(product);

      // candidate = floor(349999.9 - 0.5) = floor(349999.4) = 349999
      expect(result).toEqual({
        sku: "DYSON-V15",
        oldPrice: 359000,
        newPrice: 349999,
        reason: "UNDERCUT",
      });
    });

    it("correctly floors when result ends in .99", () => {
      const product: Product = {
        sku: "TEST-FLOAT-FLOOR",
        name: "Float Floor Test",
        myPrice: 1000,
        minPrice: 500,
        maxPrice: 1500,
        step: 0.01,
        competitors: [{ seller: "Seller1", price: 999.9, inStock: true }],
      };

      const result = calculatePrice(product);

      // 999.9 - 0.01 = 999.89 -> floor = 999
      expect(result.newPrice).toBe(999);
      expect(result.reason).toBe("UNDERCUT");
    });
  });

  describe("Dataset integration test (data/products.json vs data/expected.json)", () => {
    it("matches data/expected.json for all items in data/products.json", () => {
      const actual = (sampleProducts as Product[]).map(calculatePrice);
      expect(actual).toEqual(expectedResults);
    });
  });

  describe("OldPrice preservation", () => {
    it("always preserves myPrice as oldPrice regardless of min/max boundaries", () => {
      const productBelowMin: Product = {
        sku: "BELOW-MIN",
        name: "Below Min",
        myPrice: 500,
        minPrice: 1000,
        maxPrice: 2000,
        step: 10,
        competitors: [{ seller: "Comp", price: 1500, inStock: true }],
      };

      const productAboveMax: Product = {
        sku: "ABOVE-MAX",
        name: "Above Max",
        myPrice: 5000,
        minPrice: 1000,
        maxPrice: 2000,
        step: 10,
        competitors: [{ seller: "Comp", price: 1500, inStock: true }],
      };

      expect(calculatePrice(productBelowMin).oldPrice).toBe(500);
      expect(calculatePrice(productAboveMax).oldPrice).toBe(5000);
    });
  });
});
