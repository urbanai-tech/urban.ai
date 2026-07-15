import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "src/app/componentes/ui/component-catalog.json");

export function checkComponentCatalog() {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const errors = [];
  const ids = new Set();
  for (const component of catalog.components ?? []) {
    if (ids.has(component.id)) errors.push(`duplicate id: ${component.id}`);
    ids.add(component.id);
    const sourcePath = join(root, component.source);
    if (!existsSync(sourcePath)) errors.push(`missing source: ${component.source}`);
    if (!Array.isArray(component.states) || component.states.length < 2) {
      errors.push(`insufficient states: ${component.id}`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return catalog;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const catalog = checkComponentCatalog();
    console.log(`[design:catalog] OK: ${catalog.components.length} critical components cataloged.`);
  } catch (error) {
    console.error(`[design:catalog] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
