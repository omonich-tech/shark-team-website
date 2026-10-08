import { appUrl } from "@/lib/seo";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY_PATH = "/indexnow-key.txt";
const INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

export function getIndexNowKey() {
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";

  if (!key) {
    return null;
  }

  if (!INDEXNOW_KEY_RE.test(key)) {
    throw new Error(
      "INDEXNOW_KEY must be 8-128 characters using only letters, numbers, and dashes"
    );
  }

  return key;
}

export function indexNowKeyLocation() {
  return `${appUrl()}${INDEXNOW_KEY_PATH}`;
}

function normalizeUrls(values: string[]) {
  const base = new URL(appUrl());
  const urls = new Set<string>();

  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;

    const url = new URL(value, base);

    if (url.origin !== base.origin) {
      throw new Error(`IndexNow URL must belong to ${base.origin}: ${value}`);
    }

    url.hash = "";
    urls.add(url.toString());
  }

  if (urls.size === 0) {
    throw new Error("At least one IndexNow URL is required");
  }

  if (urls.size > 10_000) {
    throw new Error("IndexNow supports at most 10,000 URLs per request");
  }

  return {
    host: base.host,
    urls: Array.from(urls)
  };
}

export async function submitIndexNowUrls(values: string[]) {
  const key = getIndexNowKey();

  if (!key) {
    return {
      submitted: false as const,
      reason: "INDEXNOW_KEY_NOT_CONFIGURED" as const,
      count: 0
    };
  }

  const { host, urls } = normalizeUrls(values);

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      host,
      key,
      keyLocation: indexNowKeyLocation(),
      urlList: urls
    }),
    cache: "no-store"
  });

  if (response.status !== 200 && response.status !== 202) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(
      `IndexNow rejected the submission with HTTP ${response.status}${body ? `: ${body}` : ""}`
    );
  }

  return {
    submitted: true as const,
    status: response.status,
    count: urls.length
  };
}
