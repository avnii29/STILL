import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { operator, isOperatorReady } from "../src/config/operator";

const root = process.cwd();
const production = process.env.NODE_ENV === "production";
const problems: string[] = [];
const warnings: string[] = [];

function walk(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next" || entry === "src/generated") {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = walk(root).filter((file) => {
  if (file.includes("/docs/") || file.endsWith("package-lock.json")) return false;
  return /\.(ts|tsx|js|mjs|json|md|css|html)$/.test(file);
});

const tracker = [
  "googletagmanager",
  "google-analytics",
  "gtag(",
  "meta pixel",
  "fbq(",
  "posthog",
  "hotjar",
  "clarity.ms",
  "mixpanel",
  "amplitude",
  "cdn.segment.com",
  "fullstory",
  "tiktok",
];

for (const file of files) {
  if (file.includes("trust-check") || file.includes("TRUST-AUDIT") || file.includes("legal/")) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const needle of tracker) {
    if (text.toLowerCase().includes(needle)) {
      problems.push(`Optional tracker string "${needle}" in ${file}`);
    }
  }
  if (/\b(10,?000 people|trusted by|★★★★★|product hunt)\b/i.test(text)) {
    problems.push(`Possible fake social proof in ${file}`);
  }
  if (/sk_live_|sk-ant-|AKIA[0-9A-Z]{16}|-----BEGIN PRIVATE KEY-----/.test(text) && !file.includes(".example")) {
    problems.push(`Secret-looking value in ${file}`);
  }
}

if (!isOperatorReady(operator)) {
  const message = "Operator legal name and contact email are unset (src/config/operator.ts / STILL_* env).";
  if (production) problems.push(message);
  else warnings.push(message);
}

const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
if (production && /localhost|127\.0\.0\.1/.test(site)) {
  problems.push("Production site URL still points at localhost.");
}

const rls = readFileSync(join(root, "prisma/sql/rls.sql"), "utf8");
if (!rls.includes("consent_events")) {
  problems.push("RLS is missing consent_events.");
}

const licenses = readFileSync(join(root, "docs/ASSET-LICENSES.md"), "utf8");
const inUse = [
  "still-sky-morning",
  "still-sky-afternoon",
  "still-sky-evening",
  "still-sky-night",
  "still-mark.png",
];
for (const asset of inUse) {
  if (licenses.includes(asset) && licenses.includes("DO NOT SHIP")) {
    const message = `${asset} is in use and flagged DO NOT SHIP until licensed.`;
    if (production) problems.push(message);
    else warnings.push(message);
  }
}

if (!licenses.includes("Figtree")) {
  warnings.push("Font licenses should remain documented in ASSET-LICENSES.md.");
}

for (const warning of warnings) {
  console.warn(`warn  ${warning}`);
}
for (const problem of problems) {
  console.error(`fail  ${problem}`);
}

if (problems.length === 0) {
  console.log(
    warnings.length
      ? `trust:check passed with ${warnings.length} warning(s).`
      : "trust:check passed.",
  );
  process.exit(0);
}

process.exit(1);
