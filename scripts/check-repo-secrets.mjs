import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8"
})
  .split("\0")
  .filter(Boolean);

const forbiddenEnvFiles = tracked.filter(
  (file) =>
    /(^|\/)\.env($|\.)/.test(file) &&
    !file.endsWith(".env.example")
);

const patterns = [
  {
    name: "OpenAI API key",
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/
  },
  {
    name: "Telegram bot token",
    regex: /\b\d{6,12}:[A-Za-z0-9_-]{25,}\b/
  },
  {
    name: "Vercel Blob write token",
    regex: /\bvercel_blob_rw_[A-Za-z0-9_-]{20,}\b/
  },
  {
    name: "Private key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
  },
  {
    name: "Non-placeholder Payme key assignment",
    regex: /PAYME_KEY\s*[:=]\s*["']?(?!ci-key\b)[A-Za-z0-9_-]{16,}/
  }
];

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml",
  ".sql", ".txt", ".html", ".css", ".toml", ".ini", ".example"
]);

function extension(file) {
  const index = file.lastIndexOf(".");
  return index >= 0 ? file.slice(index) : "";
}

const findings = [];

for (const file of tracked) {
  if (!textExtensions.has(extension(file)) && !file.startsWith(".github/")) {
    continue;
  }

  let content;

  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      findings.push(`${file}: ${pattern.name}`);
    }
  }
}

if (forbiddenEnvFiles.length > 0 || findings.length > 0) {
  console.error("Repository secret scan failed.");

  for (const file of forbiddenEnvFiles) {
    console.error(`- tracked environment file: ${file}`);
  }

  for (const finding of findings) {
    console.error(`- ${finding}`);
  }

  process.exit(1);
}

console.log("Repository secret scan passed.");
