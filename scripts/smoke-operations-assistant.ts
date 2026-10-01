import "dotenv/config";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Admin login did not return a cookie");
  return raw.split(";")[0];
}

async function main() {
  assert(username && password, "Admin credentials are missing");

  const login = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  assert(login.ok, "Assistant smoke admin login failed");
  const cookie = cookieFrom(login);

  const page = await fetch(baseUrl + "/admin/assistant", {
    headers: { Cookie: cookie }
  });
  const html = await page.text();

  assert(page.ok, "Assistant page did not render");
  assert(html.includes("AI-ассистент"), "Assistant title is missing");
  assert(html.includes("Операционный бриф"), "Assistant brief heading is missing");
  assert(html.includes("Что делать сейчас"), "Assistant action list is missing");
  assert(html.includes("Автоматический разбор фактов CRM"), "Assistant grounding note is missing");

  const api = await fetch(baseUrl + "/api/admin/assistant/brief", {
    headers: { Cookie: cookie }
  });
  const payload = await api.json();

  assert(api.ok && payload.ok, "Assistant brief API failed");
  assert(
    payload.brief &&
      typeof payload.brief.headline === "string" &&
      Array.isArray(payload.brief.actions),
    "Assistant brief API payload is invalid"
  );
  assert(
    typeof payload.brief.counts.total === "number",
    "Assistant brief totals are missing"
  );

  console.log("Operations assistant HTTP smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
