import { spawn, spawnSync, type ChildProcess } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "@/lib/prisma";

const repoRoot = path.resolve(process.cwd(), "..");
const nanoclawTemplateRoot = path.join(repoRoot, "nanoclaw");
const instancesRoot = path.join(process.cwd(), ".runtime", "nanoclaw");
const immutableEntries = [
  "src",
  "setup",
  "dist",
  "container",
  "node_modules",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "CLAUDE.md",
] as const;

type RuntimeRecord = {
  authProcess?: ChildProcess;
  botProcess?: ChildProcess;
};

const runtimeRegistry = new Map<string, RuntimeRecord>();

/** Next.js only loads `frontend/.env`; backend keys often live in repo root `.env`. */
let cachedRepoRootEnv: Record<string, string> | null = null;

function readRepoRootEnv(): Record<string, string> {
  if (cachedRepoRootEnv) return cachedRepoRootEnv;
  cachedRepoRootEnv = {};
  const envPath = path.join(repoRoot, ".env");
  try {
    const raw = fs.readFileSync(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      cachedRepoRootEnv[key] = val;
    }
  } catch {
    // no repo-root .env
  }
  return cachedRepoRootEnv;
}

function resolveEnv(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  return readRepoRootEnv()[key]?.trim();
}

function getRuntimeRecord(deploymentId: string): RuntimeRecord {
  let record = runtimeRegistry.get(deploymentId);
  if (!record) {
    record = {};
    runtimeRegistry.set(deploymentId, record);
  }
  return record;
}

async function addLog(deploymentId: string, message: string): Promise<void> {
  await prisma.deploymentLog.create({
    data: { deploymentId, message },
  });
}

async function updateDeployment(
  deploymentId: string,
  data: Parameters<typeof prisma.deployment.update>[0]["data"],
): Promise<void> {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data,
  });
}

function parseClaudeCredential(
  rawValue: string,
):
  | { key: "CLAUDE_CODE_OAUTH_TOKEN" | "ANTHROPIC_API_KEY"; value: string }
  | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (value.startsWith("sk-ant")) {
    return { key: "ANTHROPIC_API_KEY", value };
  }
  return { key: "CLAUDE_CODE_OAUTH_TOKEN", value };
}

function findClaudeCredential(
  overrideValue?: string | null,
):
  | { key: "CLAUDE_CODE_OAUTH_TOKEN" | "ANTHROPIC_API_KEY"; value: string }
  | null {
  if (overrideValue?.trim()) {
    return parseClaudeCredential(overrideValue);
  }

  const candidates = [
    "YELLAI_CLAUDE_CODE_OAUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "YELLAI_ANTHROPIC_API_KEY",
    "ANTHROPIC_API_KEY",
  ] as const;

  for (const key of candidates) {
    const value = resolveEnv(key);
    if (!value) continue;
    if (key.includes("OAUTH")) {
      return { key: "CLAUDE_CODE_OAUTH_TOKEN", value };
    }
    return { key: "ANTHROPIC_API_KEY", value };
  }

  return null;
}

function checkPrerequisites(
  overrideCredential?: string | null,
): { ok: true } | { ok: false; message: string } {
  const credential = findClaudeCredential(overrideCredential);
  if (!credential) {
    return {
      ok: false,
      message:
        "Missing Claude auth. Paste a Claude token or Anthropic API key in the deploy form, or configure a server default in frontend/.env or the repo root .env.",
    };
  }

  const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (docker.status !== 0) {
    return {
      ok: false,
      message:
        "Docker is not available to the app process. Start Docker Desktop and make sure the current user can run docker commands.",
    };
  }

  return { ok: true };
}

async function ensureSymlink(target: string, linkPath: string): Promise<void> {
  try {
    const stat = await fsp.lstat(linkPath);
    if (stat.isSymbolicLink()) {
      const existing = await fsp.readlink(linkPath);
      if (path.resolve(path.dirname(linkPath), existing) === target) return;
    }
    await fsp.rm(linkPath, { recursive: true, force: true });
  } catch {
    // missing is fine
  }

  await fsp.symlink(target, linkPath);
}

async function ensureDirectoryScaffold(instanceRoot: string): Promise<void> {
  await fsp.mkdir(instanceRoot, { recursive: true });

  for (const entry of immutableEntries) {
    await ensureSymlink(
      path.join(nanoclawTemplateRoot, entry),
      path.join(instanceRoot, entry),
    );
  }

  await fsp.mkdir(path.join(instanceRoot, "logs"), { recursive: true });
  await fsp.mkdir(path.join(instanceRoot, "data"), { recursive: true });
  await fsp.mkdir(path.join(instanceRoot, "store"), { recursive: true });
  await fsp.mkdir(path.join(instanceRoot, "groups"), { recursive: true });

  await fsp.cp(
    path.join(nanoclawTemplateRoot, "groups", "main"),
    path.join(instanceRoot, "groups", "main"),
    { recursive: true, force: true },
  );
  await fsp.cp(
    path.join(nanoclawTemplateRoot, "groups", "global"),
    path.join(instanceRoot, "groups", "global"),
    { recursive: true, force: true },
  );
}

async function writeInstanceEnv(
  instanceRoot: string,
  assistantName: string,
  credential: { key: "CLAUDE_CODE_OAUTH_TOKEN" | "ANTHROPIC_API_KEY"; value: string },
): Promise<void> {
  const lines = [
    `${credential.key}=${credential.value}`,
    `ASSISTANT_NAME=${assistantName}`,
    "ASSISTANT_HAS_OWN_NUMBER=false",
    `HOME=${os.homedir()}`,
  ];
  await fsp.writeFile(path.join(instanceRoot, ".env"), `${lines.join("\n")}\n`, "utf-8");
}

function buildInstanceProcessEnv(
  assistantName: string,
  credential?: { key: "CLAUDE_CODE_OAUTH_TOKEN" | "ANTHROPIC_API_KEY"; value: string } | null,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ASSISTANT_NAME: assistantName,
    ASSISTANT_HAS_OWN_NUMBER: "false",
    HOME: os.homedir(),
  };

  if (credential) {
    env[credential.key] = credential.value;
  }

  return env;
}

function pipeProcessLogs(
  deploymentId: string,
  proc: ChildProcess,
  prefix: string,
): void {
  const forward = (chunk: Buffer | string) => {
    const text = chunk.toString();
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      void addLog(deploymentId, `${prefix}: ${line}`);
    }
  };

  proc.stdout?.on("data", forward);
  proc.stderr?.on("data", forward);
}

async function runLoggedCommand(
  deploymentId: string,
  instanceRoot: string,
  command: string,
  args: string[],
  prefix: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await addLog(deploymentId, `${prefix}: ${command} ${args.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: instanceRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    pipeProcessLogs(deploymentId, proc, prefix);
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${prefix} exited with code ${code ?? -1}`));
    });
  });
}

async function ensureContainerImage(deploymentId: string, instanceRoot: string): Promise<void> {
  const inspect = spawnSync("docker", ["image", "inspect", "nanoclaw-agent:latest"], {
    stdio: "ignore",
  });
  if (inspect.status === 0) {
    await addLog(deploymentId, "Container image already available.");
    return;
  }

  await addLog(deploymentId, "Building NanoClaw container image...");
  await runLoggedCommand(
    deploymentId,
    instanceRoot,
    "bash",
    ["container/build.sh"],
    "container",
    buildInstanceProcessEnv("Yell"),
  );
}

async function waitForAuth(instanceRoot: string, timeoutMs = 180_000): Promise<string> {
  const statusFile = path.join(instanceRoot, "store", "auth-status.txt");
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const value = (await fsp.readFile(statusFile, "utf-8")).trim();
      if (value) return value;
    } catch {
      // file not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for WhatsApp authentication.");
}

function readPhoneNumber(instanceRoot: string): string | null {
  try {
    const creds = JSON.parse(
      fs.readFileSync(path.join(instanceRoot, "store", "auth", "creds.json"), "utf-8"),
    );
    const id = creds?.me?.id as string | undefined;
    if (!id) return null;
    return id.split(":")[0].split("@")[0] || null;
  } catch {
    return null;
  }
}

async function registerMainChat(
  deploymentId: string,
  instanceRoot: string,
  assistantName: string,
  phoneNumber: string,
): Promise<void> {
  const jid = `${phoneNumber}@s.whatsapp.net`;
  const args = [
    "tsx",
    "setup/index.ts",
    "--step",
    "register",
    "--jid",
    jid,
    "--name",
    "Your Yell chat",
    "--trigger",
    `@${assistantName}`,
    "--folder",
    "main",
    "--channel",
    "whatsapp",
    "--assistant-name",
    assistantName,
    "--is-main",
    "--no-trigger-required",
  ];

  await runLoggedCommand(deploymentId, instanceRoot, "npx", args, "register");
}

function startBotProcess(deploymentId: string, instanceRoot: string): ChildProcess {
  const assistantName = readAssistantName(instanceRoot);
  const credential = findClaudeCredential();
  const proc = spawn("node", ["dist/index.js"], {
    cwd: instanceRoot,
    env: buildInstanceProcessEnv(assistantName, credential),
    stdio: ["ignore", "pipe", "pipe"],
  });

  pipeProcessLogs(deploymentId, proc, "bot");

  proc.on("close", (code) => {
    const record = runtimeRegistry.get(deploymentId);
    if (record?.botProcess === proc) {
      record.botProcess = undefined;
    }
    if (code !== 0) {
      void addLog(deploymentId, `bot: exited with code ${code ?? -1}`);
      void updateDeployment(deploymentId, {
        status: "failed",
        errorMessage: `NanoClaw bot exited with code ${code ?? -1}`,
      });
    }
  });

  return proc;
}

function readAssistantName(instanceRoot: string): string {
  try {
    const envContent = fs.readFileSync(path.join(instanceRoot, ".env"), "utf-8");
    const match = envContent.match(/^ASSISTANT_NAME=(.+)$/m);
    return match?.[1]?.trim() || "Yell";
  } catch {
    return "Yell";
  }
}

export async function runLocalDeployment(
  deploymentId: string,
  assistantName: string,
  claudeCredential?: string | null,
): Promise<void> {
  const prereqs = checkPrerequisites(claudeCredential);
  if (!prereqs.ok) {
    await updateDeployment(deploymentId, {
      status: "failed",
      errorMessage: prereqs.message,
    });
    await addLog(deploymentId, prereqs.message);
    return;
  }

  const instanceRoot = path.join(instancesRoot, deploymentId);
  const runtime = getRuntimeRecord(deploymentId);
  const credential = findClaudeCredential(claudeCredential);

  if (!credential) {
    await addLog(deploymentId, "No Claude credential resolved for deployment.");
    await updateDeployment(deploymentId, {
      status: "failed",
      errorMessage: "Missing Claude credential.",
    });
    return;
  }

  try {
    await updateDeployment(deploymentId, {
      status: "provisioning",
      localPath: instanceRoot,
      assistantName,
      errorMessage: null,
    });
    await addLog(deploymentId, `Creating local NanoClaw instance at ${instanceRoot}`);

    await ensureDirectoryScaffold(instanceRoot);
    await writeInstanceEnv(instanceRoot, assistantName, credential);
    await runLoggedCommand(
      deploymentId,
      instanceRoot,
      "npm",
      ["run", "build"],
      "build",
      buildInstanceProcessEnv(assistantName, credential),
    );
    await ensureContainerImage(deploymentId, instanceRoot);

    await updateDeployment(deploymentId, { status: "configuring" });
    await addLog(deploymentId, "Waiting for WhatsApp QR code...");

    const authProcess = spawn("npx", ["tsx", "src/whatsapp-auth.ts"], {
      cwd: instanceRoot,
      env: buildInstanceProcessEnv(assistantName, credential),
      stdio: ["ignore", "pipe", "pipe"],
    });
    runtime.authProcess = authProcess;
    pipeProcessLogs(deploymentId, authProcess, "auth");

    const authStatus = await waitForAuth(instanceRoot);
    if (!authStatus.startsWith("authenticated") && authStatus !== "already_authenticated") {
      throw new Error(`WhatsApp auth failed: ${authStatus}`);
    }

    await new Promise<void>((resolve) => {
      authProcess.once("close", () => resolve());
      setTimeout(resolve, 2000);
    });

    const phoneNumber = readPhoneNumber(instanceRoot);
    if (!phoneNumber) {
      throw new Error("WhatsApp auth completed but phone number could not be determined.");
    }

    await updateDeployment(deploymentId, { phoneNumber });
    await addLog(deploymentId, `WhatsApp connected for ${phoneNumber}`);

    await registerMainChat(deploymentId, instanceRoot, assistantName, phoneNumber);
    await addLog(deploymentId, "Starting NanoClaw bot process...");

    const botProcess = startBotProcess(deploymentId, instanceRoot);
    runtime.botProcess = botProcess;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await updateDeployment(deploymentId, {
      status: "ready",
      runtimePid: botProcess.pid ?? null,
      gatewayUrl: null,
      instanceId: path.basename(instanceRoot),
      errorMessage: null,
    });
    await addLog(
      deploymentId,
      `Ready. Open WhatsApp and message yourself with @${assistantName} to start talking to your assistant.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await addLog(deploymentId, `Failed: ${message}`);
    await updateDeployment(deploymentId, {
      status: "failed",
      errorMessage: message.slice(0, 500),
    });
  }
}

export async function getDeploymentQrSvg(localPath: string): Promise<string | null> {
  const qrFile = path.join(localPath, "store", "qr-data.txt");
  try {
    const qrData = (await fsp.readFile(qrFile, "utf-8")).trim();
    if (!qrData) return null;
    const QRCode = await import("qrcode");
    return QRCode.toString(qrData, { type: "svg", margin: 1, width: 320 });
  } catch {
    return null;
  }
}
