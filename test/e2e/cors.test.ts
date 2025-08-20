import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Bunner } from "../../src/bunner";
import { HttpMethod } from "../../src/enums";

describe("CORS Tests", () => {
  let app: Bunner;
  const PORT = 3002;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(() => {
    app = new Bunner();

    app.cors({
      origin: ["http://localhost:3000", "https://example.com"],
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.DELETE, HttpMethod.PATCH],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    });

    app.get("/", (req, res) => {
      res.send("Hello from CORS test!");
    });

    app.get("/json", (req, res) => {
      res.send({ message: "JSON response" });
    });

    app.post("/echo", async (req, res) => {
      const body = req.body;
      res.send({ received: body });
    });

    app.patch("/cors-test", (req, res) => {
      res.send("CORS test response");
    });

    app.options("/cors-test", (req, res) => {
      res.send("OPTIONS response");
    });

    app.listen("0.0.0.0", PORT, () => {
      console.log(`CORS test server running on http://localhost:${PORT}`);
    });
  });

  afterAll(async () => {
    await app.close(true);
  });

  describe("Success Cases", () => {
    it("should handle preflight OPTIONS request", async () => {
      const response = await fetch(`${BASE_URL}/cors-test`, {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization"
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(response.headers.get("access-control-allow-methods")).toContain("POST");
      expect(response.headers.get("access-control-allow-headers")).toContain("Content-Type");
      expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");
      expect(response.headers.get("access-control-max-age")).toBe("86400");
    });

    it("should handle actual request with CORS headers", async () => {
      const response = await fetch(`${BASE_URL}/json`, {
        method: "GET",
        headers: {
          "Origin": "http://localhost:3000"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");
      expect(response.headers.get("vary")).toBe("Origin");
    });

    it("should handle request from allowed origin", async () => {
      const response = await fetch(`${BASE_URL}/`, {
        method: "GET",
        headers: {
          "Origin": "https://example.com"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("https://example.com");
    });

    it("should handle POST request with CORS", async () => {
      const testData = { name: "cors test", value: 123 };

      const response = await fetch(`${BASE_URL}/echo`, {
        method: "POST",
        headers: {
          "Origin": "http://localhost:3000",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");

      const data = await response.json();
      expect(data).toEqual({ received: testData });
    });

    it("should handle request without Origin header", async () => {
      const response = await fetch(`${BASE_URL}/`, {
        method: "GET"
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });
  describe("Failure Cases", () => {
    it("should reject request from disallowed origin", async () => {
      const response = await fetch(`${BASE_URL}/`, {
        method: "GET",
        headers: {
          "Origin": "https://malicious-site.com"
        }
      });

      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBe("https://not-allowed.com");
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple allowed headers in preflight", async () => {
      const response = await fetch(`${BASE_URL}/cors-test`, {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization, X-Custom-Header"
        }
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-headers")).toContain("Content-Type");
      expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    });

    it("should handle exposed headers", async () => {
      const response = await fetch(`${BASE_URL}/json`, {
        method: "GET",
        headers: {
          "Origin": "http://localhost:3000"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-expose-headers")).toBeNull();
    });

    it("should handle credentials with wildcard origin", async () => {
      const response = await fetch(`${BASE_URL}/`, {
        method: "GET",
        headers: {
          "Origin": "http://localhost:3000"
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    });
  });
});
