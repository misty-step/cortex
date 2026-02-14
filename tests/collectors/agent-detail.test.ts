import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { clearSessionCache } from "../../src/server/collectors/agents";
import { collectAgentDetail } from "../../src/server/collectors/agent-detail";

describe("collectAgentDetail", () => {
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    clearSessionCache();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-detail-test-"));
    agentsDir = path.join(tempDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createAgent(agentId: string) {
    const agentDir = path.join(agentsDir, agentId);
    const sessionsDir = path.join(agentDir, "sessions");
    const agentSubDir = path.join(agentDir, "agent");
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.mkdir(agentSubDir, { recursive: true });
    return { agentDir, sessionsDir, agentSubDir };
  }

  async function writeMasterConfig(agents: unknown[]) {
    await fs.writeFile(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ agents: { list: agents } }),
    );
  }

  it("returns full detail with all data sources present", async () => {
    const { sessionsDir, agentSubDir } = await createAgent("main");

    await writeMasterConfig([
      {
        id: "main",
        name: "Kaylee",
        workspace: "/home/user/workspace",
        model: { primary: "anthropic/claude-opus-4-6", fallbacks: ["openrouter/minimax"] },
        subagents: { allowAgents: ["amos", "pepper"] },
      },
    ]);

    await fs.writeFile(
      path.join(agentSubDir, "models.json"),
      JSON.stringify({
        providers: {
          anthropic: {
            models: [
              {
                id: "claude-opus-4",
                name: "Claude Opus 4",
                reasoning: true,
                contextWindow: 200000,
                maxTokens: 32000,
              },
            ],
          },
          openrouter: {
            models: [
              {
                id: "minimax/MiniMax-M2.5",
                name: "MiniMax M2.5",
                reasoning: false,
                contextWindow: 256000,
                maxTokens: 16000,
              },
            ],
          },
        },
      }),
    );

    await fs.writeFile(
      path.join(agentSubDir, "auth-profiles.json"),
      JSON.stringify({
        profiles: {
          "anthropic:default": { key: "sk-secret-key", provider: "anthropic", type: "api_key" },
          "openrouter:default": { key: "sk-or-secret", provider: "openrouter", type: "api_key" },
        },
        usageStats: {
          "anthropic:default": { errorCount: 0, lastUsed: 1707000000000, lastFailureAt: 0 },
          "openrouter:default": {
            errorCount: 3,
            lastUsed: 1707000000000,
            lastFailureAt: 1706999000000,
          },
        },
      }),
    );

    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "agent:main:main:uuid1": {
          updatedAt: Date.now(),
          model: "claude-opus-4-6",
          skillsSnapshot: {
            resolvedSkills: [
              { name: "github", description: "GitHub ops" },
              { name: "coding-agent", description: "Coding" },
            ],
          },
        },
        "agent:main:heartbeat:uuid2": {
          updatedAt: Date.now() - 60000,
          model: "claude-haiku",
          skillsSnapshot: { resolvedSkills: [] },
        },
      }),
    );

    const detail = await collectAgentDetail(tempDir, "main");
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe("main");
    expect(detail!.name).toBe("main"); // from config.json fallback (no config.json = use id)
    expect(detail!.workspace).toBe("/home/user/workspace");
    expect(detail!.model).toEqual({
      primary: "anthropic/claude-opus-4-6",
      fallbacks: ["openrouter/minimax"],
    });
    expect(detail!.subagents).toEqual(["amos", "pepper"]);
    expect(detail!.availableModels).toHaveLength(2);
    expect(detail!.availableModels[0]!.provider).toBe("anthropic");
    expect(detail!.authProfiles).toHaveLength(2);
    expect(detail!.sessions).toHaveLength(2);
    expect(detail!.skills).toEqual(["github", "coding-agent"]);
  });

  it("returns detail with missing optional files", async () => {
    const { sessionsDir } = await createAgent("bare");

    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "session-1": { updatedAt: Date.now(), model: "test-model" },
      }),
    );

    const detail = await collectAgentDetail(tempDir, "bare");
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe("bare");
    expect(detail!.workspace).toBeNull();
    expect(detail!.model).toBeNull();
    expect(detail!.subagents).toEqual([]);
    expect(detail!.availableModels).toEqual([]);
    expect(detail!.authProfiles).toEqual([]);
    expect(detail!.sessions).toHaveLength(1);
    expect(detail!.skills).toEqual([]);
  });

  it("returns null for nonexistent agent", async () => {
    const detail = await collectAgentDetail(tempDir, "nonexistent");
    expect(detail).toBeNull();
  });

  it("strips API keys from auth profiles", async () => {
    const { sessionsDir, agentSubDir } = await createAgent("secure");

    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "session-1": { updatedAt: Date.now(), model: "test" },
      }),
    );

    await fs.writeFile(
      path.join(agentSubDir, "auth-profiles.json"),
      JSON.stringify({
        profiles: {
          "anthropic:default": {
            key: "sk-ant-super-secret-key-12345",
            provider: "anthropic",
            type: "api_key",
          },
        },
        usageStats: {
          "anthropic:default": { errorCount: 0, lastUsed: 1707000000000 },
        },
      }),
    );

    const detail = await collectAgentDetail(tempDir, "secure");
    expect(detail).not.toBeNull();

    // Verify no key field in auth profiles
    const profile = detail!.authProfiles[0]!;
    expect(profile.profileId).toBe("anthropic:default");
    expect(profile.provider).toBe("anthropic");
    expect(profile.errorCount).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((profile as any).key).toBeUndefined();

    // Also verify the entire detail object has no "key" field nested
    const json = JSON.stringify(detail);
    expect(json).not.toContain("sk-ant-super-secret-key-12345");
  });

  it("extracts skills from the latest session", async () => {
    const { sessionsDir } = await createAgent("skilled");

    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "older-session": {
          updatedAt: 1000,
          model: "model-a",
          skillsSnapshot: {
            resolvedSkills: [{ name: "old-skill" }],
          },
        },
        "newer-session": {
          updatedAt: 2000,
          model: "model-b",
          skillsSnapshot: {
            resolvedSkills: [{ name: "new-skill-a" }, { name: "new-skill-b" }],
          },
        },
      }),
    );

    const detail = await collectAgentDetail(tempDir, "skilled");
    expect(detail!.skills).toEqual(["new-skill-a", "new-skill-b"]);
  });
});
