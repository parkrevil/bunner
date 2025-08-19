import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Bunner } from "../src/bunner";
import { HttpMethod } from "../src/enums";

describe("Bunner E2E Tests", () => {
  let app: Bunner;
  const PORT = 3001;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(() => {
    app = new Bunner();

    // CORS 설정
    app.cors({
      origin: ["http://localhost:3000", "https://example.com"],
      methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.DELETE, HttpMethod.PATCH],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    });

    // send 방식 사용
    app.get("/", (req, res) => {
      res.send("Hello from Bunner!");
    });

    app.get("/json", (req, res) => {
      res.send({ message: "Hello JSON", status: "success" });
    });

    app.post("/echo", async (req, res) => {
      const body = req.body;
      res.send({ received: body });
    });

    // return Response 방식 사용
    app.get("/return-text", (req, res) => {
      return new Response("Returned text response", { status: 200 });
    });

    app.get("/return-json", (req, res) => {
      return new Response(JSON.stringify({ message: "Returned JSON" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    app.post("/return-echo", async (req, res) => {
      const body = req.body;
      return new Response(JSON.stringify({ returned: body }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    // return value 방식 사용
    app.get("/return-value-text", (req, res) => {
      return "Returned value text";
    });

    app.get("/return-value-json", (req, res) => {
      return { message: "Returned value JSON", type: "object" };
    });

    app.post("/return-value-echo", async (req, res) => {
      const body = req.body;
      return { returned: body, method: "return value" };
    });

    app.get("/return-value-status", (req, res) => {
      res.setStatus(201);
      return { message: "Created with return value" };
    });

    // 파라미터 라우트 - send 방식
    app.get("/users/:id", (req, res) => {
      const userId = (req as any).params.id;
      res.send({ userId, name: `User ${userId}` });
    });

    app.put("/users/:id", async (req, res) => {
      const userId = (req as any).params.id;
      const body = req.body;
      res.send({ userId, updated: body });
    });

    app.delete("/users/:id", (req, res) => {
      const userId = (req as any).params.id;
      res.send({ deleted: userId });
    });

    // 파라미터 라우트 - return Response 방식
    app.get("/posts/:id", (req, res) => {
      const postId = (req as any).params.id;
      return new Response(JSON.stringify({ postId, title: `Post ${postId}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    app.patch("/posts/:id", async (req, res) => {
      const postId = (req as any).params.id;
      const body = req.body;
      return new Response(JSON.stringify({ postId, patched: body }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    // 파라미터 라우트 - return value 방식
    app.get("/comments/:id", (req, res) => {
      const commentId = (req as any).params.id;
      return { commentId, content: `Comment ${commentId}` };
    });

    app.put("/comments/:id", async (req, res) => {
      const commentId = (req as any).params.id;
      const body = req.body;
      return { commentId, updated: body, method: "return value" };
    });

    // 상태 코드 테스트
    app.get("/not-found", (req, res) => {
      res.setStatus(404);
      res.send({ error: "Not found" });
    });

    app.get("/server-error", (req, res) => {
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    });

    app.get("/server-error-value", (req, res) => {
      res.setStatus(500);
      return { error: "Internal server error with return value" };
    });

    // 헤더 테스트
    app.get("/custom-headers", (req, res) => {
      res.setHeader("X-Custom-Header", "test-value");
      res.setHeader("X-Another-Header", "another-value");
      res.send({ message: "Custom headers set" });
    });

    app.get("/redirect", (req, res) => {
      res.redirect("/");
    });

    app.listen("0.0.0.0", PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  });

  afterAll(async () => {
    await app.close(true);
  });

  describe("GET /", () => {
    it("should return hello message", async () => {
      const response = await fetch(`${BASE_URL}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Hello from Bunner!");
    });
  });

  describe("GET /json", () => {
    it("should return JSON response", async () => {
      const response = await fetch(`${BASE_URL}/json`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const data = await response.json();
      expect(data).toEqual({
        message: "Hello JSON",
        status: "success"
      });
    });
  });
  describe("POST /echo", () => {
    it("should echo request body", async () => {
      const testData = { name: "test", value: 123 };

      const response = await fetch(`${BASE_URL}/echo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const data = await response.json();
      expect(data).toEqual({ received: testData });
    });
  });
  describe("GET /users/:id", () => {
    it("should return user by id", async () => {
      const userId = "123";
      const response = await fetch(`${BASE_URL}/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const data = await response.json();
      expect(data).toEqual({
        userId: "123",
        name: "User 123"
      });
    });

    it("should handle different user ids", async () => {
      const userId = "456";
      const response = await fetch(`${BASE_URL}/users/${userId}`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        userId: "456",
        name: "User 456"
      });
    });
  });

  describe("PUT /users/:id", () => {
    it("should update user", async () => {
      const userId = "789";
      const updateData = { name: "Updated User", email: "test@example.com" };

      const response = await fetch(`${BASE_URL}/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const data = await response.json();
      expect(data).toEqual({
        userId: "789",
        updated: updateData
      });
    });
  });

  describe("DELETE /users/:id", () => {
    it("should delete user", async () => {
      const userId = "999";
      const response = await fetch(`${BASE_URL}/users/${userId}`, {
        method: "DELETE"
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const data = await response.json();
      expect(data).toEqual({
        deleted: "999"
      });
    });
  });

  describe("Error handling", () => {
    it("should return 404 for non-existent routes", async () => {
      const response = await fetch(`${BASE_URL}/non-existent`);
      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent HTTP methods", async () => {
      const response = await fetch(`${BASE_URL}/`, {
        method: "PATCH"
      });
      expect(response.status).toBe(404);
    });
  });

  describe("Headers", () => {
    it("should set content-type for JSON responses", async () => {
      const response = await fetch(`${BASE_URL}/json`);
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    it("should set content-type for text responses", async () => {
      const response = await fetch(`${BASE_URL}/`);
      expect(response.headers.get("content-type")).toBe("text/plain");
    });
  });

  describe("Return Response Tests", () => {
    it("should handle returned text response", async () => {
      const response = await fetch(`${BASE_URL}/return-text`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Returned text response");
    });

    it("should handle returned JSON response", async () => {
      const response = await fetch(`${BASE_URL}/return-json`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ message: "Returned JSON" });
    });

    it("should handle returned POST response", async () => {
      const testData = { name: "return test", value: 456 };

      const response = await fetch(`${BASE_URL}/return-echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ returned: testData });
    });
  });

  describe("Return Value Tests", () => {
    it("should handle returned text value", async () => {
      const response = await fetch(`${BASE_URL}/return-value-text`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Returned value text");
    });

    it("should handle returned JSON value", async () => {
      const response = await fetch(`${BASE_URL}/return-value-json`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ message: "Returned value JSON", type: "object" });
    });

    it("should handle returned POST value", async () => {
      const testData = { name: "return value test", value: 789 };

      const response = await fetch(`${BASE_URL}/return-value-echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ returned: testData, method: "return value" });
    });

    it("should handle returned value with status", async () => {
      const response = await fetch(`${BASE_URL}/return-value-status`);
      expect(response.status).toBe(201);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ message: "Created with return value" });
    });
  });

  describe("Parameter Routes - Return Response Style", () => {
    it("should handle GET posts with return Response", async () => {
      const postId = "123";
      const response = await fetch(`${BASE_URL}/posts/${postId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({
        postId: "123",
        title: "Post 123"
      });
    });

    it("should handle PATCH posts with return Response", async () => {
      const postId = "456";
      const patchData = { title: "Updated Post", content: "New content" };

      const response = await fetch(`${BASE_URL}/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({
        postId: "456",
        patched: patchData
      });
    });
  });

  describe("Parameter Routes - Return Value Style", () => {
    it("should handle GET comments with return value", async () => {
      const commentId = "123";
      const response = await fetch(`${BASE_URL}/comments/${commentId}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({
        commentId: "123",
        content: "Comment 123"
      });
    });

    it("should handle PUT comments with return value", async () => {
      const commentId = "456";
      const updateData = { content: "Updated comment", author: "test" };

      const response = await fetch(`${BASE_URL}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({
        commentId: "456",
        updated: updateData,
        method: "return value"
      });
    });
  });

  describe("Status Codes", () => {
    it("should handle 404 status with send", async () => {
      const response = await fetch(`${BASE_URL}/not-found`);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ error: "Not found" });
    });

    it("should handle 500 status with return Response", async () => {
      const response = await fetch(`${BASE_URL}/server-error`);
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ error: "Internal server error" });
    });

    it("should handle 500 status with return value", async () => {
      const response = await fetch(`${BASE_URL}/server-error-value`);
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ error: "Internal server error with return value" });
    });
  });

  describe("Headers", () => {
    it("should set custom headers with send", async () => {
      const response = await fetch(`${BASE_URL}/custom-headers`);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Custom-Header")).toBe("test-value");
      expect(response.headers.get("X-Another-Header")).toBe("another-value");
      expect(response.headers.get("content-type")).toBe("application/json");

      const data = await response.json();
      expect(data).toEqual({ message: "Custom headers set" });
    });
  });
  describe("Redirects", () => {
    it("should handle redirects", async () => {
      const response = await fetch(`${BASE_URL}/redirect`, {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/");
    });
  });
  describe("Mixed Response Styles", () => {
    it("should handle all three response styles correctly", async () => {
      // send style
      const sendResponse = await fetch(`${BASE_URL}/`);
      expect(sendResponse.status).toBe(200);
      expect(await sendResponse.text()).toBe("Hello from Bunner!");

      // return Response style
      const returnResponseResponse = await fetch(`${BASE_URL}/return-text`);
      expect(returnResponseResponse.status).toBe(200);
      expect(await returnResponseResponse.text()).toBe("Returned text response");

      // return value style
      const returnValueResponse = await fetch(`${BASE_URL}/return-value-text`);
      expect(returnValueResponse.status).toBe(200);
      expect(await returnValueResponse.text()).toBe("Returned value text");
    });

    it("should handle mixed JSON responses", async () => {
      // send style JSON
      const sendJsonResponse = await fetch(`${BASE_URL}/json`);
      expect(sendJsonResponse.status).toBe(200);
      expect(sendJsonResponse.headers.get("content-type")).toBe("application/json");
      const sendData = await sendJsonResponse.json();
      expect(sendData).toEqual({ message: "Hello JSON", status: "success" });

      // return Response style JSON
      const returnResponseJsonResponse = await fetch(`${BASE_URL}/return-json`);
      expect(returnResponseJsonResponse.status).toBe(200);
      expect(returnResponseJsonResponse.headers.get("content-type")).toBe("application/json");
      const returnResponseData = await returnResponseJsonResponse.json();
      expect(returnResponseData).toEqual({ message: "Returned JSON" });

      // return value style JSON
      const returnValueJsonResponse = await fetch(`${BASE_URL}/return-value-json`);
      expect(returnValueJsonResponse.status).toBe(200);
      expect(returnValueJsonResponse.headers.get("content-type")).toBe("application/json");
      const returnValueData = await returnValueJsonResponse.json();
      expect(returnValueData).toEqual({ message: "Returned value JSON", type: "object" });
    });
  });

  describe("CORS", () => {
    it("should handle preflight OPTIONS request", async () => {
      const response = await fetch(`${BASE_URL}/`, {
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

    it("should handle request from disallowed origin", async () => {
      const response = await fetch(`${BASE_URL}/`, {
        method: "GET",
        headers: {
          "Origin": "https://malicious-site.com"
        }
      });

      const corsOrigin = response.headers.get("access-control-allow-origin");
      expect(response.status).toBe(403);
      expect(corsOrigin === null || corsOrigin === "https://not-allowed.com").toBe(true);
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
  });
});
