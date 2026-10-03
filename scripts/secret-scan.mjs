#!/usr/bin/env node
/**
 * Dependency-free secret scanner. Blocks commits (and fails CI) when a credential,
 * private key, token or real-looking connection string is about to be committed.
 *
 *   node scripts/secret-scan.mjs            scan the staged changes (pre-commit)
 *   node scripts/secret-scan.mjs --all      scan every tracked file
 *   node scripts/secret-scan.mjs --history  scan every added line in the whole git history
 *
 * Intentional placeholders: append `secret-scan:allow` to the line, or use one of the
 * well-known placeholder values in PLACEHOLDERS. Findings never print the secret itself.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Files that must never be committed, whatever they contain. */
export const FORBIDDEN_FILES = [
  /(^|\/)\.env(\.(?!example$)[^/]+)?$/i,
  /\.(pem|key|p12|pfx|jks|keystore|ppk)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|\/)(credentials|service-account[^/]*|secrets?)\.json$/i,
  /(^|\/)\.(npmrc|pypirc|netrc|pgpass)$/i,
  /\.sqlite3?$|\.db$|\.dump$|\.sql\.gz$|\.bak$/i,
];

/** Paths that legitimately contain secret-shaped strings (hashes, generated data). */
const SKIP_PATHS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)node_modules\//,
  /(^|\/)\.local-media\//,
  /\.(png|jpe?g|webp|avif|gif|ico|pdf|woff2?|ttf|mp4)$/i,
];

/** Values that are documented dev/CI placeholders and carry no risk. */
const PLACEHOLDERS = [
  'dev-only-secret-change-me',
  'ci-secret-',
  'AKIAIOSFODNN7EXAMPLE',
  'auren:auren@localhost',
  'auren:auren@127.0.0.1',
  'auren:auren@postgres',
  'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  'your-',
  'changeme',
  'CHANGE-ME',
];

const RULES = [
  {
    id: 'private-key',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  { id: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  {
    id: 'github-token',
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  },
  { id: 'stripe-key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { id: 'stripe-webhook-secret', re: /\bwhsec_[A-Za-z0-9]{20,}\b/ },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'google-oauth-secret', re: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'anthropic-or-openai-key', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { id: 'resend-key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/ },
  { id: 'sentry-auth-token', re: /\bsntry[su]_[A-Za-z0-9]{40,}\b/ },
  { id: 'sentry-dsn', re: /https:\/\/[0-9a-f]{32}@[a-z0-9.-]+\.ingest\.[a-z.]*sentry\.io\/\d+/ },
  { id: 'sendgrid-key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/ },
  { id: 'twilio-key', re: /\bSK[0-9a-f]{32}\b/ },
  { id: 'vercel-blob-token', re: /vercel_blob_rw_[A-Za-z0-9_]{20,}/ },
  { id: 'cloudinary-url', re: /cloudinary:\/\/\d+:[A-Za-z0-9_-]{10,}@/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { id: 'inngest-key', re: /\b(?:signkey|eventkey)-(?:prod|test|branch)-[A-Za-z0-9]{20,}\b/ },
  {
    id: 'url-with-password',
    relaxedInTests: true,
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"`]+:([^\s@/'"`${}<>]{4,})@(?!localhost\b|127\.0\.0\.1\b|postgres\b|host\b)[^\s/'"`]+/i,
  },
  {
    id: 'hardcoded-credential',
    relaxedInTests: true,
    // name = "long-random-looking value"; env references ($VAR, process.env, ${{ }}) and empty values pass.
    re: /\b[\w.-]*(?:secret|passw(?:or)?d|token|api[_-]?key|private[_-]?key|auth[_-]?key|signing[_-]?key)[\w.-]*\s*[:=]\s*["']?([A-Za-z0-9/+_=.-]{20,})["']?/i,
    entropy: 3.5,
  },
];

export function shannonEntropy(value) {
  const counts = new Map();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const TEST_PATH = /(^|\/)(__tests__|tests)\/|\.(test|spec)\.[jt]sx?$/;
/** A dotted identifier chain such as env.SECRET or generator.build(): code, not a literal. */
const isCodeReference = (v) => /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+!?$/.test(v);

const isPlaceholder = (text) =>
  PLACEHOLDERS.some((p) => text.toLowerCase().includes(p.toLowerCase()));

/** Scan one text blob. Returns findings without ever including the matched secret. */
export function scanText(path, text) {
  if (SKIP_PATHS.some((re) => re.test(path))) return [];
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length > 2000 || line.includes('secret-scan:allow')) continue;
    for (const rule of RULES) {
      const m = rule.re.exec(line);
      if (!m) continue;
      if (rule.relaxedInTests && TEST_PATH.test(path)) continue;
      const value = m[1] ?? m[0];
      if (isCodeReference(value)) continue;
      // A placeholder excuses only the value that was matched, never the rest of the line: a real
      // secret next to a documented placeholder is still a finding.
      if (
        isPlaceholder(rule.id === 'hardcoded-credential' ? value : m[0]) ||
        /process\.env|\$\{\{|\$\{?[A-Z_]+\}?|<[^>]+>/.test(value)
      )
        continue;
      if (rule.entropy && shannonEntropy(value) < rule.entropy) continue;
      findings.push({ path, line: i + 1, rule: rule.id, length: value.length });
      break;
    }
  }
  return findings;
}

export function scanPath(path) {
  return FORBIDDEN_FILES.some((re) => re.test(path))
    ? [{ path, line: 0, rule: 'forbidden-file', length: 0 }]
    : [];
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function scanStaged() {
  const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .split('\0')
    .filter(Boolean);
  const out = [];
  for (const path of names) {
    out.push(...scanPath(path));
    let text = '';
    try {
      text = git(['show', `:${path}`]);
    } catch {
      continue;
    }
    if (text.includes('\0')) continue;
    out.push(...scanText(path, text));
  }
  return out;
}

function scanAll() {
  const names = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const out = [];
  for (const path of names) {
    out.push(...scanPath(path));
    let text = '';
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\0')) continue;
    out.push(...scanText(path, text));
  }
  return out;
}

function scanHistory() {
  const log = git([
    'log',
    '--all',
    '--no-merges',
    '-p',
    '--no-color',
    '--format=commit %h',
    '--unified=0',
  ]);
  const out = [];
  let commit = '';
  let path = '';
  let newLine = 0;
  for (const raw of log.split('\n')) {
    if (raw.startsWith('commit ')) commit = raw.slice(7);
    else if (raw.startsWith('+++ b/')) {
      path = raw.slice(6);
      out.push(...scanPath(path).map((f) => ({ ...f, commit })));
    } else if (raw.startsWith('@@')) newLine = Number(/\+(\d+)/.exec(raw)?.[1] ?? 0) - 1;
    else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      newLine += 1;
      out.push(...scanText(path, raw.slice(1)).map((f) => ({ ...f, line: newLine, commit })));
    }
  }
  return out;
}

function main() {
  const mode = process.argv.includes('--history')
    ? 'history'
    : process.argv.includes('--all')
      ? 'all'
      : 'staged';
  const findings = mode === 'history' ? scanHistory() : mode === 'all' ? scanAll() : scanStaged();
  if (findings.length === 0) {
    console.log(`secret-scan (${mode}): no secrets found`);
    return;
  }
  console.error(
    `\nsecret-scan (${mode}): ${findings.length} possible secret(s) found. Nothing was printed from the files.\n`,
  );
  for (const f of findings) {
    const where = f.line ? `${f.path}:${f.line}` : f.path;
    console.error(`  [${f.rule}] ${where}${f.commit ? ` (commit ${f.commit})` : ''}`);
  }
  console.error(
    '\nRemove the secret, rotate it if it was ever real, and load it from the environment instead.' +
      '\nFalse positive (placeholder)? Add "secret-scan:allow" to that line.\n',
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
