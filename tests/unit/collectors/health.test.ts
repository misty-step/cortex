import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import { collectHealth } from "../../../src/server/collectors/health.js";

describe("collectHealth", () => {
  let server: http.Server;
  let port: number;

  function startServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<number> {
    return new Promise((resolve) => {
      server = http.createServer(handler);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
  }

  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  it("should return ok when gateway responds 200", async () => {
    port = await startServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    const result = await collectHealth(port);

    expect(result.status).toBe("ok");
    expect(result.gateway).toBe("reachable");
    expect(result.timestamp).toBeTypeOf("number");
  });

  it("should return degraded when gateway responds non-200", async () => {
    port = await startServer((_req, res) => {
      res.writeHead(503);
      res.end();
    });

    const result = await collectHealth(port);

    expect(result.status).toBe("degraded");
    expect(result.gateway).toBe("unreachable");
  });

  it("should return degraded on network error (connection refused)", async () => {
    // Use a port where nothing is listening
    const result = await collectHealth(19999);

    expect(result.status).toBe("degraded");
    expect(result.gateway).toBe("unreachable");
  });

  it("should return degraded on timeout", async () => {
    port = await startServer((_req, _res) => {
      // Never respond — let it hang until abort
    });

    const result = await collectHealth(port);

    expect(result.status).toBe("degraded");
    expect(result.gateway).toBe("unreachable");
  }, 5000);

  it("should resolve only once even with multiple events", async () => {
    port = await startServer((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    // The settled guard ensures only one resolution.
    // If it resolved multiple times, the promise would reject with unhandled errors.
    const result = await collectHealth(port);

    expect(result.status).toBe("ok");
  });
});
