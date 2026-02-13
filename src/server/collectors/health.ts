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
        clearTimeout(timer);
        res.resume();
        res.on("error", () => {
          resolve(healthResult(false));
        });
        res.on("end", () => {
          resolve(healthResult(res.statusCode === 200));
        });
      },
    );

    req.on("error", () => {
      clearTimeout(timer);
      resolve(healthResult(false));
    });

    req.end();
  });
}
