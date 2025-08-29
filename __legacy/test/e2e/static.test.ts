import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "path";
import { Bunner } from "../../src/web-application/bunner-web-application";

describe("Static File Serving Tests", () => {
  let app: Bunner;
  const PORT = 3003;
  const BASE_URL = `http://localhost:${PORT}`;
  const TEST_DIR = "./test/assets";

  beforeAll(async () => {
    app = new Bunner();

    // 기본 static 설정
    await app.static("/public", TEST_DIR);

    // 커스텀 index 파일 설정
    await app.static("/custom", join(TEST_DIR, "subdir"), { index: "page.html" });

    // 다중 index 파일 설정
    await app.static("/multi", TEST_DIR, { index: ["index.html", "default.html"] });

    // index 비활성화 설정
    await app.static("/no-index", TEST_DIR, { index: false });

    app.listen("0.0.0.0", PORT, () => {
      console.log(`Static test server running on http://localhost:${PORT}`);
    });
  });

  afterAll(async () => {
    await app.close(true);
  });

  describe("Basic Static File Serving", () => {
    it("should serve index.html for directory requests", async () => {
      const response = await fetch(`${BASE_URL}/public/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Index Page</body></html>");
    });

    it("should serve index.html for directory requests without trailing slash", async () => {
      const response = await fetch(`${BASE_URL}/public`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Index Page</body></html>");
    });

    it("should serve CSS files", async () => {
      const response = await fetch(`${BASE_URL}/public/style.css`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("body { color: red; }");
    });

    it("should serve JavaScript files", async () => {
      const response = await fetch(`${BASE_URL}/public/script.js`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("console.log('Hello');");
    });

    it("should serve image files", async () => {
      const response = await fetch(`${BASE_URL}/public/image.jpg`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("fake-image-data");
    });

    it("should serve files from subdirectories", async () => {
      const response = await fetch(`${BASE_URL}/public/css/main.css`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("body { background: blue; }");
    });

    it("should serve index.html from subdirectories", async () => {
      const response = await fetch(`${BASE_URL}/public/subdir/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Subdir Index</body></html>");
    });
  });

  describe("Custom Index Configuration", () => {
    it("should serve custom index file", async () => {
      const response = await fetch(`${BASE_URL}/custom/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Subdir Page</body></html>");
    });

    it("should serve custom index file without trailing slash", async () => {
      const response = await fetch(`${BASE_URL}/custom`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Subdir Page</body></html>");
    });
  });

  describe("Multiple Index Files", () => {
    it("should serve first available index file from array", async () => {
      const response = await fetch(`${BASE_URL}/multi/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Index Page</body></html>");
    });

    it("should serve first available index file without trailing slash", async () => {
      const response = await fetch(`${BASE_URL}/multi`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Index Page</body></html>");
    });
  });

  describe("Disabled Index Files", () => {
    it("should return 403 when index is disabled and requesting directory", async () => {
      const response = await fetch(`${BASE_URL}/no-index/`);
      expect(response.status).toBe(403);
    });

    it("should return 403 when index is disabled and requesting directory without trailing slash", async () => {
      const response = await fetch(`${BASE_URL}/no-index`);
      expect(response.status).toBe(403);
    });

    it("should still serve individual files when index is disabled", async () => {
      const response = await fetch(`${BASE_URL}/no-index/style.css`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("body { color: red; }");
    });
  });

  describe("Error Cases", () => {
    it("should return 404 for non-existent files", async () => {
      const response = await fetch(`${BASE_URL}/public/nonexistent.html`);
      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent directories", async () => {
      const response = await fetch(`${BASE_URL}/public/nonexistent/`);
      expect(response.status).toBe(404);
    });

    it("should return 404 for non-existent static routes", async () => {
      const response = await fetch(`${BASE_URL}/nonexistent/style.css`);
      expect(response.status).toBe(404);
    });

    it("should return 403 for directory without index file when index is disabled", async () => {
      const response = await fetch(`${BASE_URL}/no-index/subdir/`);
      expect(response.status).toBe(403);
    });
  });

  describe("Content Type Detection", () => {
    it("should set correct content type for HTML files", async () => {
      const response = await fetch(`${BASE_URL}/public/index.html`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("should set correct content type for CSS files", async () => {
      const response = await fetch(`${BASE_URL}/public/style.css`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/css");
    });

    it("should set correct content type for JavaScript files", async () => {
      const response = await fetch(`${BASE_URL}/public/script.js`);
      console.log(response.headers);
      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type") || "";
      expect(
        contentType.includes("application/javascript") || contentType.includes("text/javascript")
      ).toBe(true);
    });

    it("should set correct content type for image files", async () => {
      const response = await fetch(`${BASE_URL}/public/image.jpg`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/jpeg");
    });
  });

  describe("Path Handling", () => {
    it("should handle paths with multiple slashes", async () => {
      const response = await fetch(`${BASE_URL}/public///style.css`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("body { color: red; }");
    });

    it("should handle paths with encoded characters", async () => {
      const response = await fetch(`${BASE_URL}/public/css/main.css`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("body { background: blue; }");
    });

    it("should handle root path correctly", async () => {
      const response = await fetch(`${BASE_URL}/public`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("<html><body>Index Page</body></html>");
    });
  });

  describe("HTTP Methods", () => {
    it("should only respond to GET requests", async () => {
      const response = await fetch(`${BASE_URL}/public/style.css`, {
        method: "POST"
      });
      expect(response.status).toBe(404);
    });

    it("should only respond to GET requests for directories", async () => {
      const response = await fetch(`${BASE_URL}/public/`, {
        method: "PUT"
      });
      expect(response.status).toBe(404);
    });
  });
});
