import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import sampleProducts from "../data/products.json";
import expectedResults from "../data/expected.json";

describe("HTTP API", () => {
  const app = createApp();

  describe("GET /health", () => {
    it("returns 200 and ok status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /products", () => {
    it("returns initial sample products", async () => {
      const res = await request(app).get("/products");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleProducts);
    });
  });

  describe("POST /reprice", () => {
    it("returns 400 if request body is not an array", async () => {
      const invalidBodies: Array<string | object> = [
        { sku: "NOT-AN-ARRAY" },
        "some string",
        "123",
        "null",
      ];

      for (const body of invalidBodies) {
        const res = await request(app)
          .post("/reprice")
          .send(body)
          .set("Content-Type", "application/json");

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("error");
      }
    });

    it("returns 400 if any product item in array is malformed", async () => {
      const malformedProducts = [
        {
          sku: "VALID",
          name: "Valid",
          myPrice: 100,
          minPrice: 50,
          maxPrice: 150,
          step: 5,
          competitors: [],
        },
        {
          sku: "INVALID",
          // missing prices and competitors
        },
      ];

      const res = await request(app)
        .post("/reprice")
        .send(malformedProducts);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid product at index 1");
    });

    it("returns 200 and empty array for empty product list", async () => {
      const res = await request(app).post("/reprice").send([]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns 200 and correct results matching expected.json in same order", async () => {
      const res = await request(app).post("/reprice").send(sampleProducts);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedResults);
      expect(res.body.length).toBe(sampleProducts.length);

      // Verify order matches input
      for (let i = 0; i < sampleProducts.length; i++) {
        expect(res.body[i].sku).toBe(sampleProducts[i].sku);
      }
    });
  });
});
