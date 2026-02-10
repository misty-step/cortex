import * as http from "node:http";

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  gateway: "reachable" | "unreachable";
  timestamp: number;
}

export async function collectHealth(gatewayPort: number = 18789): Promise<HealthStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      resolve({
        status: reachable ? "ok" : "degraded",
        gateway: reachable ? "reachable" : "unreachable",
        timestamp: Date.now(),
      });
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
        clearTimeout(timer);
        res.resume();
        done(res.statusCode === 200);
      },
    );

    req.on("error", () => {
      clearTimeout(timer);
      done(false);
    });

    req.end();
  });
}
