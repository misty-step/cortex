import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { collectAgents, clearSessionCache } from "../../../src/server/collectors/agents";

describe("collectAgents", () => {
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    clearSessionCache();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agents-test-"));
    agentsDir = path.join(tempDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no agents exist", async () => {
    const agents = await collectAgents(tempDir);
    expect(agents).toHaveLength(0);
  });

  it("reads agent config with online status", async () => {
    const agentId = "test-agent";
    const agentDir = path.join(agentsDir, agentId);
    await fs.mkdir(agentDir, { recursive: true });

    // Create agent config
    await fs.writeFile(
      path.join(agentDir, "config.json"),
      JSON.stringify({
        id: agentId,
        name: "Test Agent",
        enabled: true,
        heartbeatInterval: 30000,
      }),
    );

    // Create active session
    const sessionsDir = path.join(agentDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "session-1": {
          systemSent: true,
          createdAt: Date.now() - 60000,
          updatedAt: Date.now(),
          model: "claude-opus-4",
        },
      }),
    );

    const agents = await collectAgents(tempDir);
    expect(agents).toHaveLength(1);

    const agent = agents[0]!;
    expect(agent.id).toBe(agentId);
    expect(agent.name).toBe("Test Agent");
    expect(agent.online).toBe(true);
    expect(agent.sessionCount).toBe(1);
    expect(agent.lastHeartbeat).toBeDefined();
  });

  it("marks agent as offline when no recent session activity", async () => {
    const agentId = "offline-agent";
    const agentDir = path.join(agentsDir, agentId);
    await fs.mkdir(agentDir, { recursive: true });

    await fs.writeFile(
      path.join(agentDir, "config.json"),
      JSON.stringify({
        id: agentId,
        name: "Offline Agent",
        enabled: true,
        heartbeatInterval: 30000,
      }),
    );

    // Create stale session (older than 2 minutes)
    const sessionsDir = path.join(agentDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "session-1": {
          systemSent: true,
          createdAt: Date.now() - 300000,
          updatedAt: Date.now() - 300000,
          model: "claude-opus-4",
        },
      }),
    );

    const agents = await collectAgents(tempDir);
    expect(agents[0]!.online).toBe(false);
  });

  it("marks agent as offline when no sessions exist", async () => {
    const agentId = "no-sessions-agent";
    const agentDir = path.join(agentsDir, agentId);
    await fs.mkdir(agentDir, { recursive: true });

    await fs.writeFile(
      path.join(agentDir, "config.json"),
      JSON.stringify({
        id: agentId,
        name: "No Sessions Agent",
        enabled: true,
      }),
    );

    const agents = await collectAgents(tempDir);
    expect(agents[0]!.online).toBe(false);
    expect(agents[0]!.sessionCount).toBe(0);
  });

  it("returns agent with defaults when config.json is missing", async () => {
    const agentId = "no-config-agent";
    const agentDir = path.join(agentsDir, agentId);

    // Only create sessions dir — no config.json
    const sessionsDir = path.join(agentDir, "sessions");
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "session-1": {
          systemSent: true,
          createdAt: Date.now() - 60000,
          updatedAt: Date.now(),
          model: "claude-sonnet-4-5",
        },
      }),
    );

    const agents = await collectAgents(tempDir);
    expect(agents).toHaveLength(1);

    const agent = agents[0]!;
    expect(agent.id).toBe(agentId);
    expect(agent.name).toBe(agentId);
    expect(agent.enabled).toBe(true);
    expect(agent.online).toBe(true);
    expect(agent.sessionCount).toBe(1);
  });

  it("reads multiple agents", async () => {
    const agentIds = ["agent-1", "agent-2", "agent-3"];

    for (const agentId of agentIds) {
      const agentDir = path.join(agentsDir, agentId);
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, "config.json"),
        JSON.stringify({
          id: agentId,
          name: `Agent ${agentId}`,
          enabled: true,
        }),
      );
    }

    const agents = await collectAgents(tempDir);
    expect(agents).toHaveLength(3);
  });
});
