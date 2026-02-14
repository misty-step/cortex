import * as http from "node:http";
import type { HealthStatus } from "../../shared/types.js";
import { config } from "../config.js";

function healthResult(reachable: boolean): HealthStatus {
  return {
    status: reachable ? "ok" : "degraded",
    gateway: reachable ? "reachable" : "unreachable",
    timestamp: Date.now(),
  };
}

export async function collectHealth(
  gatewayPort: number = config.gatewayPort,
): Promise<HealthStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: HealthStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);

    const req = http.request(
      {
        host: "127.0.0.1",
        port: gatewayPort,
        method: "HEAD",
        path: "/",
        signal: controller.signal,
      },
      (res) => {
        res.resume();
        // Resolve immediately on response — no need to wait for body on HEAD
        settle(healthResult(res.statusCode === 200));
      },
    );

    req.on("error", () => {
      settle(healthResult(false));
    });

    req.end();
  });
}
