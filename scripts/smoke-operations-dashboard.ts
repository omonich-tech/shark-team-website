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

  assert(login.ok, "Dashboard smoke admin login failed");
  const cookie = cookieFrom(login);

  const dashboard = await fetch(baseUrl + "/admin", {
    headers: { Cookie: cookie }
  });
  const html = await dashboard.text();

  assert(dashboard.ok, "Admin dashboard did not render");
  assert(html.includes("Dashboard"), "Dashboard title is missing");
  assert(html.includes("Операционный центр"), "Operations center heading is missing");
  assert(html.includes("Требует внимания"), "Operational alerts block is missing");
  assert(html.includes("Заполненность групп"), "Group capacity metric is missing");
  assert(html.includes("Пробное → абонемент"), "Trial conversion metric is missing");
  assert(html.includes("Выручка за месяц"), "Monthly revenue metric is missing");
  assert(html.includes("Посещаемость · 30 дней"), "Attendance metric is missing");
  assert(html.includes("Просрочено"), "Overdue payment metric is missing");

  console.log("Operations dashboard HTTP smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
