import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const packageJsonPath = join(root, "package.json");
const srcDir = join(root, "src");

const forbiddenPackages = [
  "@chakra-ui/react",
  "@emotion/react",
  "@emotion/styled",
  "antd",
  "@headlessui/react",
  "@fortawesome/fontawesome-svg-core",
  "@fortawesome/free-solid-svg-icons",
  "@fortawesome/react-fontawesome",
  "react-toastify",
  "react-icons",
  "@heroicons/react",
];

const forbiddenImportPrefixes = [
  "@chakra-ui/",
  "@emotion/",
  "antd",
  "@headlessui/react",
  "@fortawesome/",
  "react-toastify",
  "react-icons",
  "@heroicons/",
];

const classNamePattern = /className\s*=\s*(?:"([^"]*)"|`([^`]*)`)/g;
const utilityExact = new Set([
  "absolute",
  "block",
  "fixed",
  "flex",
  "grid",
  "hidden",
  "inline",
  "relative",
  "sr-only",
]);
const utilityPrefixes = [
  "bg-",
  "border",
  "bottom-",
  "disabled:",
  "focus:",
  "focus-visible:",
  "gap-",
  "h-",
  "hover:",
  "items-",
  "justify-",
  "left-",
  "m-",
  "max-",
  "mb-",
  "min-",
  "ml-",
  "mr-",
  "mt-",
  "opacity-",
  "overflow-",
  "p-",
  "px-",
  "py-",
  "right-",
  "rounded",
  "space-",
  "text-",
  "top-",
  "transition",
  "w-",
  "z-",
];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function fail(message, details) {
  console.error(`\n[design:audit] ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exitCode = 1;
}

function isTailwindLikeToken(token) {
  if (!token || token.startsWith("urban-") || token.startsWith("global-")) return false;
  if (token.includes("${")) return false;
  if (utilityExact.has(token)) return true;
  return utilityPrefixes.some((prefix) => token === prefix.replace("-", "") || token.startsWith(prefix));
}

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const directDeps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
};

const badDeps = forbiddenPackages.filter((name) => directDeps[name]);
if (badDeps.length) {
  fail("Forbidden direct design-system dependencies found:", badDeps);
}

const sourceFiles = existsSync(srcDir) ? walk(srcDir) : [];
const badImports = [];
const tailwindLikeClasses = [];
const nativeDialogs = [];
// Diálogos nativos do browser — devem usar AdminConfirmDialog / AdminDrawer /
// useAdminToast. window.confirm/alert/prompt e as formas nuas alert()/prompt().
const nativeDialogPattern = /(?:window\.(?:alert|confirm|prompt)|(?:^|[^.\w])(?:alert|prompt))\s*\(/gm;

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const textWithoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const rel = relative(root, file);

  const importMatches = text.matchAll(/(?:from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|require\(["']([^"']+)["']\))/g);
  for (const match of importMatches) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? "";
    if (forbiddenImportPrefixes.some((prefix) => specifier === prefix || specifier.startsWith(prefix))) {
      badImports.push(`${rel}: ${specifier}`);
    }
  }

  const classMatches = textWithoutComments.matchAll(classNamePattern);
  for (const match of classMatches) {
    const classValue = match[1] ?? match[2] ?? "";
    const tokens = classValue.split(/\s+/).filter(isTailwindLikeToken);
    if (tokens.length) {
      tailwindLikeClasses.push(`${rel}: ${tokens.join(" ")}`);
    }
  }

  for (const match of textWithoutComments.matchAll(nativeDialogPattern)) {
    const line = textWithoutComments.slice(0, match.index).split("\n").length;
    nativeDialogs.push(`${rel}:${line}: ${match[0].trim()}`);
  }
}

if (badImports.length) {
  fail("Forbidden design-system imports found:", badImports);
}

if (tailwindLikeClasses.length) {
  console.warn(`\n[design:audit] Tailwind-like class audit: ${tailwindLikeClasses.length} residual match(es).`);
  console.warn("[design:audit] These are warnings while the remaining focus/public-layout cleanup is completed.");
  for (const detail of tailwindLikeClasses.slice(0, 20)) console.warn(`- ${detail}`);
}

if (nativeDialogs.length) {
  console.warn(`\n[design:audit] Native browser dialogs found: ${nativeDialogs.length} occurrence(s).`);
  console.warn("[design:audit] Use AdminConfirmDialog / AdminDrawer / useAdminToast instead of window.alert/confirm/prompt.");
  for (const detail of nativeDialogs) console.warn(`- ${detail}`);
}

if (!process.exitCode) {
  console.log("[design:audit] OK: no forbidden design-system dependencies or imports.");
}
