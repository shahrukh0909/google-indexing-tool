// Submit your own site's pages to Google's Indexing API.
// See README.md for setup. https://github.com/shahrukh0909/google-indexing-tool
//
// Usage:
//   SITE=https://www.example.com GOOGLE_INDEXING_KEY=/path/to/key.json node index.mjs             # every page in the sitemap
//   SITE=https://www.example.com GOOGLE_INDEXING_KEY=/path/to/key.json node index.mjs /about /blog # only these pages
//   SITE=https://www.example.com node index.mjs --dry-run                                         # list pages, send nothing
//
// The key file is read from the path in GOOGLE_INDEXING_KEY. It is never printed.
// Never commit it.
//
// Google documents this API for job posting and livestream pages only. For other
// pages a submission is usually crawled quickly, but Google still decides whether
// to index the page. Default quota: 200 submissions a day.

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const SITE = (process.env.SITE ?? "").replace(/\/$/, "");
if (!SITE) {
  console.error("Set SITE to your site's address, for example SITE=https://www.example.com");
  process.exit(1);
}
const SCOPE = "https://www.googleapis.com/auth/indexing";
const ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const DAILY_QUOTA = 200;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const paths = args.filter((a) => !a.startsWith("--"));

const b64url = (input) => Buffer.from(input).toString("base64url");

async function sitemapUrls() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`Sitemap request failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
}

async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: key.token_uri, iat: now, exp: now + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key, "base64url");
  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return body.access_token;
}

const urls = paths.length
  ? paths.map((p) => (p.startsWith("http") ? p : `${SITE}${p.startsWith("/") ? "" : "/"}${p}`))
  : await sitemapUrls();

if (urls.length > DAILY_QUOTA) {
  console.error(`${urls.length} pages is over the daily quota of ${DAILY_QUOTA}. Pass fewer pages.`);
  process.exit(1);
}

if (dryRun) {
  console.log(`Dry run: ${urls.length} pages would be submitted.`);
  urls.forEach((u) => console.log(`  ${u}`));
  process.exit(0);
}

const keyPath = process.env.GOOGLE_INDEXING_KEY;
if (!keyPath) {
  console.error("Set GOOGLE_INDEXING_KEY to the path of the service account key file.");
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyPath, "utf8"));
console.log(`Submitting ${urls.length} pages as ${key.client_email}`);

const token = await accessToken(key);
let ok = 0;
for (const url of urls) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  if (res.ok) {
    ok += 1;
    console.log(`  accepted  ${url}`);
  } else {
    const body = await res.json().catch(() => ({}));
    console.log(`  ${res.status}       ${url}  ${body.error?.message ?? ""}`);
    if (res.status === 403 || res.status === 429) {
      console.error("Stopping: Google refused the request (permission or quota).");
      break;
    }
  }
}
console.log(`${ok} of ${urls.length} accepted.`);
