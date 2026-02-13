#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

import { repo, labels, milestones, issues } from "./plan.mjs";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const err = new Error(
      `${cmd} ${args.join(" ")} failed (exit ${res.status})\n${res.stderr || ""}`,
    );
    // @ts-expect-error attach extra context
    err.stdout = res.stdout;
    // @ts-expect-error attach extra context
    err.stderr = res.stderr;
    throw err;
  }
  return (res.stdout ?? "").trim();
}

function gh(args, opts) {
  return run("gh", args, opts);
}

function requireAuth() {
  try {
    gh(["auth", "status"]);
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    console.error("");
    console.error("GitHub auth is required for backlog sync.");
    console.error("Fix with ONE of:");
    console.error("  1) gh auth login -h github.com");
    console.error("  2) export GH_TOKEN=...   (token needs repo scope / public_repo)");
    process.exit(2);
  }
}

function ensureLabels() {
  for (const l of labels) {
    gh([
      "label",
      "create",
      l.name,
      "--color",
      l.color,
      "--description",
      l.description,
      "--force",
      "-R",
      repo,
    ]);
  }
}

function listMilestones() {
  const out = gh([
    "api",
    `repos/${repo}/milestones?state=all&per_page=100`,
  ]);
  return JSON.parse(out);
}

function ensureMilestones() {
  const existing = listMilestones();
  /** @type {Map<string, any>} */
  const byTitle = new Map(existing.map((m) => [m.title, m]));

  for (const m of milestones) {
    const found = byTitle.get(m.title);
    if (!found) {
      const args = [
        "api",
        "-X",
        "POST",
        `repos/${repo}/milestones`,
        "-f",
        `title=${m.title}`,
        "-f",
        `description=${m.description ?? ""}`,
      ];
      if (m.dueOn) args.push("-f", `due_on=${m.dueOn}`);
      gh(args);
      continue;
    }

    // PATCH existing milestone to keep in sync with plan.
    const patchArgs = [
      "api",
      "-X",
      "PATCH",
      `repos/${repo}/milestones/${found.number}`,
      "-f",
      `title=${m.title}`,
      "-f",
      `description=${m.description ?? ""}`,
      "-f",
      "state=open",
    ];
    if (m.dueOn) patchArgs.push("-f", `due_on=${m.dueOn}`);
    gh(patchArgs);
  }
}

function milestoneNumberByTitle() {
  const existing = listMilestones();
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const m of existing) map.set(m.title, m.number);
  return map;
}

function findIssueByBacklogId(id) {
  const q = `repo:${repo} is:issue in:body "Backlog-Id: ${id}"`;
  const endpoint = `search/issues?q=${encodeURIComponent(q)}&per_page=5`;
  const out = gh(["api", endpoint]);
  const json = JSON.parse(out);
  const item = json.items?.[0];
  return item?.number ?? null;
}

function upsertIssue(issue, milestoneMap) {
  const milestoneNumber = issue.milestone
    ? milestoneMap.get(issue.milestone) ?? null
    : null;

  if (issue.milestone && milestoneNumber === null) {
    throw new Error(
      `Unknown milestone title "${issue.milestone}" for ${issue.id}. Create milestones first.`,
    );
  }

  const number =
    typeof issue.existingNumber === "number"
      ? issue.existingNumber
      : findIssueByBacklogId(issue.id);

  const method = number ? "PATCH" : "POST";
  const endpoint = number
    ? `repos/${repo}/issues/${number}`
    : `repos/${repo}/issues`;

  /** @type {string[]} */
  const args = ["api", "-X", method, endpoint];
  args.push("-f", `title=${issue.title}`);

  // Use stdin for body to preserve newlines.
  args.push("-F", "body=@-");

  if (milestoneNumber !== null) args.push("-F", `milestone=${milestoneNumber}`);

  // Replace labels with desired set (send array).
  for (const label of issue.labels ?? []) {
    args.push("-F", `labels[]=${label}`);
  }

  const body = issue.body ?? "";
  gh(args, { input: body });
}

function main() {
  requireAuth();

  console.log(`Syncing backlog to ${repo}...`);
  ensureLabels();
  ensureMilestones();

  const milestoneMap = milestoneNumberByTitle();

  for (const issue of issues) {
    upsertIssue(issue, milestoneMap);
  }

  console.log("Backlog sync complete.");
}

main();

