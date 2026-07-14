#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const squadsDir = path.join(root, "squads");
const skillsDir = path.join(root, "skills");
const nativeSkills = new Set(["web_search", "web_fetch"]);
const errors = [];
const warnings = [];

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function lines(filePath) {
  return read(filePath).split(/\r?\n/);
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function parseCsv(filePath) {
  const [headerLine, ...rowLines] = lines(filePath).filter((line) => line.trim());
  if (!headerLine) return { headers: [], rows: [] };

  const headers = headerLine.split(",").map((part) => part.trim());
  const rows = rowLines.map((line) => {
    const values = line.split(",").map((part) => part.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });

  return { headers, rows };
}

function collectYamlList(filePath, key) {
  const collected = [];
  let inList = false;

  for (const line of lines(filePath)) {
    if (new RegExp(`^${key}:\\s*\\[\\]\\s*$`).test(line)) {
      inList = false;
      continue;
    }

    if (new RegExp(`^${key}:\\s*$`).test(line)) {
      inList = true;
      continue;
    }

    if (inList && /^\S.*:\s*/.test(line)) {
      inList = false;
    }

    if (inList) {
      const match = line.match(/^\s*-\s+(.+?)\s*$/);
      if (match) {
        collected.push(match[1].trim().replace(/^["']|["']$/g, ""));
      }
    }
  }

  return collected;
}

function verifySkills(filePath) {
  for (const skill of collectYamlList(filePath, "skills")) {
    if (nativeSkills.has(skill)) continue;

    const skillPath = path.join(skillsDir, skill, "SKILL.md");
    if (!exists(skillPath)) {
      errors.push(`Missing skill '${skill}' declared in ${rel(filePath)}`);
    }
  }
}

function verifyAgentTasks(agentPath) {
  const agentDir = path.dirname(agentPath);
  const agentBase = path.basename(agentPath).replace(/\.agent\.md$/, "");

  for (const task of collectYamlList(agentPath, "tasks")) {
    const normalized = task.replace(/\//g, path.sep);
    const candidates = [
      path.join(agentDir, normalized),
      path.join(agentDir, agentBase, normalized),
    ];

    if (!candidates.some(exists)) {
      errors.push(`Missing task '${task}' declared in ${rel(agentPath)}`);
    }
  }
}

function verifyPipeline(squadDir, pipelinePath) {
  for (const line of lines(pipelinePath)) {
    const fileMatch = line.match(/file:\s*"?([^"\r\n]+)"?/);
    if (fileMatch) {
      const stepRel = fileMatch[1].trim().replace(/\//g, path.sep);
      const stepPath = path.join(squadDir, "pipeline", stepRel);
      if (!exists(stepPath)) {
        errors.push(`Missing pipeline step '${fileMatch[1].trim()}' in ${rel(pipelinePath)}`);
      }
    }

    const taskMatch = line.match(/task:\s*"?([^"\r\n]+)"?/);
    if (taskMatch) {
      const taskRel = taskMatch[1].trim().replace(/\//g, path.sep);
      const candidates = [
        path.join(squadDir, "agents", taskRel),
        path.join(squadDir, "agents", "tasks", taskRel),
        path.join(squadDir, "pipeline", taskRel),
      ];

      if (!candidates.some(exists)) {
        errors.push(`Missing pipeline task '${taskMatch[1].trim()}' in ${rel(pipelinePath)}`);
      }
    }
  }
}

function verifySquad(squadDir) {
  const requiredFiles = [
    "squad.yaml",
    "squad-party.csv",
    path.join("pipeline", "pipeline.yaml"),
    path.join("_memory", "memories.md"),
    path.join("_memory", "runs.md"),
  ];

  for (const requiredFile of requiredFiles) {
    const fullPath = path.join(squadDir, requiredFile);
    if (!exists(fullPath)) {
      errors.push(`Missing ${rel(fullPath)}`);
    }
  }

  const partyPath = path.join(squadDir, "squad-party.csv");
  if (exists(partyPath)) {
    const { headers, rows } = parseCsv(partyPath);
    for (const header of ["id", "name", "role", "path"]) {
      if (!headers.includes(header)) {
        errors.push(`Missing '${header}' column in ${rel(partyPath)}`);
      }
    }

    for (const row of rows) {
      if (!row.id || !row.path) {
        errors.push(`Missing id/path value in ${rel(partyPath)}`);
        continue;
      }

      const agentPath = path.join(squadDir, row.path.replace(/^\.\//, "").replace(/\//g, path.sep));
      if (!exists(agentPath)) {
        errors.push(`Missing agent file '${row.path}' referenced in ${rel(partyPath)}`);
      }
    }
  }

  const squadYaml = path.join(squadDir, "squad.yaml");
  if (exists(squadYaml)) verifySkills(squadYaml);

  const pipelinePath = path.join(squadDir, "pipeline", "pipeline.yaml");
  if (exists(pipelinePath)) verifyPipeline(squadDir, pipelinePath);

  const agentsDir = path.join(squadDir, "agents");
  if (exists(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".agent.md")) {
        const agentPath = path.join(agentsDir, entry.name);
        verifySkills(agentPath);
        verifyAgentTasks(agentPath);
      }
    }
  } else {
    warnings.push(`No agents directory found in ${rel(squadDir)}`);
  }
}

if (!exists(squadsDir)) {
  errors.push("Missing squads directory");
} else {
  for (const entry of fs.readdirSync(squadsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) verifySquad(path.join(squadsDir, entry.name));
  }
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log("");
}

if (errors.length) {
  console.error("Opensquad readiness check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Opensquad readiness check passed.");
