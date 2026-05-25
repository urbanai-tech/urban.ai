import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { watch as chokidarWatch } from "chokidar";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { SquadInfo, SquadState, WsMessage } from "../types/state";

const VALID_SQUAD_STATUSES = new Set(["idle", "running", "completed", "checkpoint"]);
const ACTIVE_SQUAD_STATUSES = new Set(["running", "checkpoint"]);

function resolveSquadsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../squads"),  // started from dashboard/
    path.resolve(process.cwd(), "squads"),     // started from project root
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../squads"); // default (will be created on demand)
}

async function discoverSquads(squadsDir: string): Promise<SquadInfo[]> {
  let entries;
  try {
    entries = await fsp.readdir(squadsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const squads: SquadInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const yamlPath = path.join(squadsDir, entry.name, "squad.yaml");
    try {
      const raw = await fsp.readFile(yamlPath, "utf-8");
      const parsed = parseYaml(raw);
      const normalized = normalizeSquadConfig(parsed, entry.name);
      if (normalized) {
        squads.push(normalized);
        continue;
      }
    } catch {
      // No squad.yaml or invalid YAML — fall through to default
    }

    squads.push({
      code: entry.name,
      name: entry.name,
      description: "",
      icon: "\u{1F4CB}",
      agents: [],
    });
  }

  return squads;
}

function normalizeSquadConfig(parsed: unknown, fallbackCode: string): SquadInfo | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const nested = root.squad && typeof root.squad === "object"
    ? root.squad as Record<string, unknown>
    : null;
  const s = nested ?? root;

  const code = firstString(s.code, root.code, fallbackCode) ?? fallbackCode;
  const name = firstString(s.name, root.name, s.title, root.title, code) ?? code;
  const description =
    firstString(s.description, root.description, s.purpose, root.purpose, s.summary, root.summary) ?? "";
  const icon = firstString(s.icon, root.icon) ?? "\u{1F4CB}";
  const agents = normalizeAgents(s.agents ?? root.agents ?? root.team);

  return { code, name, description, icon, agents };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeAgents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((agent) => {
      if (typeof agent === "string") return agent;
      if (agent && typeof agent === "object") {
        const a = agent as Record<string, unknown>;
        return firstString(a.file, a.path, a.agent, a.id, a.name);
      }
      return null;
    })
    .filter((agent): agent is string => typeof agent === "string" && agent.length > 0);
}

function isValidState(data: unknown): data is SquadState {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const step = d.step as Record<string, unknown> | null;
  return (
    typeof d.status === "string" &&
    VALID_SQUAD_STATUSES.has(d.status) &&
    step != null && typeof step === "object" &&
    Number.isFinite(Number(step.current)) &&
    Number.isFinite(Number(step.total)) &&
    Array.isArray(d.agents)
  );
}

function isActiveState(state: SquadState): boolean {
  return ACTIVE_SQUAD_STATUSES.has(state.status);
}

async function readActiveStates(squadsDir: string): Promise<Record<string, SquadState>> {
  const states: Record<string, SquadState> = {};

  let entries;
  try {
    entries = await fsp.readdir(squadsDir, { withFileTypes: true });
  } catch {
    return states;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statePath = path.join(squadsDir, entry.name, "state.json");

    try {
      const raw = await fsp.readFile(statePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (isValidState(parsed) && isActiveState(parsed)) {
        states[entry.name] = parsed;
      }
    } catch {
      // Skip missing or invalid JSON
    }
  }

  return states;
}

async function buildSnapshot(squadsDir: string): Promise<WsMessage> {
  return {
    type: "SNAPSHOT",
    squads: await discoverSquads(squadsDir),
    activeStates: await readActiveStates(squadsDir),
  };
}

function broadcast(wss: WebSocketServer, msg: WsMessage) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        // Client connection dying — ws library will clean it up
      }
    }
  }
}

function installSnapshotMiddleware(server: Pick<ViteDevServer | PreviewServer, "middlewares">, squadsDir: string) {
  server.middlewares.use(async (req, res, next) => {
    if (req.url !== "/api/snapshot") return next();
    try {
      const snapshot = await buildSnapshot(squadsDir);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      res.end(JSON.stringify(snapshot));
    } catch {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });
}

export function squadWatcherPlugin(): Plugin {
  return {
    name: "squad-watcher",
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) {
        server.config.logger.warn("[squad-watcher] no httpServer — skipping");
        return;
      }

      const squadsDir = resolveSquadsDir();
      server.config.logger.info(`[squad-watcher] squads dir: ${squadsDir}`);

      // Create WebSocket server with noServer to avoid intercepting Vite's HMR
      const wss = new WebSocketServer({ noServer: true });
      (server.httpServer as Server).on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (req.url === "/__squads_ws") {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
        // Let Vite handle all other upgrade requests (HMR)
      });

      // Send snapshot on new connection
      wss.on("connection", async (ws) => {
        try {
          const snap = await buildSnapshot(squadsDir);
          ws.send(JSON.stringify(snap));
        } catch {
          // Connection may have closed before snapshot was ready
        }
      });

      // Ensure squads directory exists
      fsp.mkdir(squadsDir, { recursive: true }).catch((err) => {
        server.config.logger.error(`[squad-watcher] failed to create squads dir: ${err.message}`);
      });

      // REST API fallback — serves snapshot over HTTP for polling clients
      installSnapshotMiddleware(server, squadsDir);

      // File watcher using chokidar — reliable cross-platform, handles partial writes
      const watcher = chokidarWatch(squadsDir, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
        ignored: [/(^|[/\\])\./, /node_modules/, /output[/\\]/],
        depth: 2,
      });

      function handleFileChange(filePath: string) {
        const relative = path.relative(squadsDir, filePath).replace(/\\/g, "/");
        const parts = relative.split("/");
        if (parts.length < 2) return;

        const squadName = parts[0];
        const fileName = parts[1];

        if (fileName === "state.json") {
          fsp.readFile(filePath, "utf-8").then((raw) => {
            const parsed = JSON.parse(raw);
            if (!isValidState(parsed)) return;
            if (!isActiveState(parsed)) {
              broadcast(wss, { type: "SQUAD_INACTIVE", squad: squadName });
              return;
            }
            broadcast(wss, { type: "SQUAD_UPDATE", squad: squadName, state: parsed });
          }).catch(() => {
            // Invalid JSON — next change event will retry
          });
        } else if (fileName === "squad.yaml") {
          buildSnapshot(squadsDir).then((snap) => broadcast(wss, snap));
        }
      }

      function handleFileRemoval(filePath: string) {
        const relative = path.relative(squadsDir, filePath).replace(/\\/g, "/");
        const parts = relative.split("/");
        if (parts.length < 2) return;

        const squadName = parts[0];
        const fileName = parts[1];

        if (fileName === "state.json") {
          broadcast(wss, { type: "SQUAD_INACTIVE", squad: squadName });
        } else if (fileName === "squad.yaml") {
          buildSnapshot(squadsDir).then((snap) => broadcast(wss, snap));
        }
      }

      watcher.on("add", handleFileChange);
      watcher.on("change", handleFileChange);
      watcher.on("unlink", handleFileRemoval);

      server.httpServer.on("close", () => {
        watcher.close();
      });
    },
    configurePreviewServer(server: PreviewServer) {
      const squadsDir = resolveSquadsDir();
      installSnapshotMiddleware(server, squadsDir);
    },
  };
}

