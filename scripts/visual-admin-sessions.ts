import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser"
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      return candidate;
    }

    const result = spawnSync("which", [candidate], {
      encoding: "utf8"
    });

    if (result.status === 0) {
      return result.stdout.trim();
    }
  }

  throw new Error("Chrome/Chromium executable not found");
}

async function waitForJsonVersion(port: number) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/json/version`
      );

      if (response.ok) {
        return (await response.json()) as {
          webSocketDebuggerUrl: string;
        };
      }
    } catch {
      // Chrome is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Chrome DevTools endpoint did not start");
}

type CdpResult = Record<string, unknown>;

type CdpMessage = {
  id?: number;
  error?: {
    message?: string;
  };
  result?: CdpResult;
};

class CdpClient {
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: CdpResult) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(private socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as CdpMessage;

      if (!payload.id) return;

      const request = this.pending.get(payload.id);
      if (!request) return;

      this.pending.delete(payload.id);

      if (payload.error) {
        request.reject(
          new Error(
            payload.error.message ?? "Chrome DevTools command failed"
          )
        );
      } else {
        request.resolve(payload.result ?? {});
      }
    });
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;

    return new Promise<CdpResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params
        })
      );
    });
  }
}

async function connectCdp(url: string) {
  const socket = new WebSocket(url);

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Could not connect to Chrome DevTools")),
      { once: true }
    );
  });

  return {
    socket,
    client: new CdpClient(socket)
  };
}

async function waitForPage(
  client: CdpClient,
  expectedText: string
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression: `({
        ready: document.readyState,
        text: document.body?.innerText ?? "",
        overlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay"))
      })`,
      returnByValue: true
    });

    const runtime = result as {
      result?: {
        value?: {
          ready?: string;
          text?: string;
          overlay?: boolean;
        };
      };
    };
    const value = runtime.result?.value;

    if (
      value?.ready === "complete" &&
      value?.text?.includes(expectedText) &&
      !value.overlay
    ) {
      return value.text;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    "Page did not become ready with expected text: " + expectedText
  );
}

async function navigate(
  client: CdpClient,
  url: string,
  expectedText: string
) {
  await client.send("Page.navigate", { url });
  return waitForPage(client, expectedText);
}

async function screenshot(
  client: CdpClient,
  fileName: string
) {
  const metrics = await client.send("Page.getLayoutMetrics");
  const layout = metrics as {
    cssContentSize?: {
      width?: number;
      height?: number;
    };
  };
  const width = Math.max(
    1440,
    Math.ceil(layout.cssContentSize?.width ?? 1440)
  );
  const height = Math.min(
    12000,
    Math.max(1000, Math.ceil(layout.cssContentSize?.height ?? 1000))
  );

  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false
  });

  const captured = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true
  });

  const image = captured as { data?: string };
  assert(image.data, "Chrome did not return screenshot data");

  await writeFile(
    fileName,
    Buffer.from(image.data, "base64")
  );
}

async function main() {
  assert(username, "ADMIN_USERNAME is missing");
  assert(password, "ADMIN_PASSWORD is missing");

  const loginResponse = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      password
    })
  });

  assert(loginResponse.ok, "CI admin login failed");

  const setCookie = loginResponse.headers.get("set-cookie");
  assert(setCookie, "Admin login did not return session cookie");

  const match = /shark_admin_session=([^;]+)/.exec(setCookie);
  assert(match?.[1], "Admin session cookie value is missing");

  const chromePath = findChrome();
  const port = 9222;
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${port}`,
      "--user-data-dir=/tmp/shark-admin-ui-chrome",
      "about:blank"
    ],
    {
      stdio: "ignore"
    }
  );

  try {
    const version = await waitForJsonVersion(port);
    const { socket, client } = await connectCdp(
      version.webSocketDebuggerUrl
    );

    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Network.enable");
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false
      });

      const cookieResult = await client.send("Network.setCookie", {
        name: "shark_admin_session",
        value: match[1],
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax"
      });

      assert(cookieResult.success, "Could not set admin session cookie");

      await mkdir("artifacts", { recursive: true });

      const listText = await navigate(
        client,
        baseUrl + "/admin/sessions?scope=all",
        "Занятия"
      );

      assert(listText.includes("Фильтры"), "Sessions filters are missing");
      assert(listText.includes("Отмечено"), "Marked count column is missing");
      assert(
        listText.includes("Не завершены вовремя"),
        "Overdue sessions metric is missing"
      );

      const firstDetail = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const anchors = Array.from(
            document.querySelectorAll('tbody a[href^="/admin/sessions/"]')
          );
          const href = anchors
            .map((anchor) => anchor.getAttribute("href"))
            .find((value) => value && /^\\/admin\\/sessions\\/[^?]+$/.test(value));
          return href ?? null;
        })()`,
        returnByValue: true
      });

      const detailRuntime = firstDetail as {
        result?: {
          value?: string | null;
        };
      };
      const detailPath = detailRuntime.result?.value ?? null;
      assert(detailPath, "No session detail link found");

      await screenshot(
        client,
        "artifacts/admin-sessions-list.png"
      );

      const detailText = await navigate(
        client,
        baseUrl + detailPath,
        "Участники и посещаемость"
      );

      assert(
        detailText.includes("Состояние"),
        "Session detail state metric is missing"
      );
      assert(
        detailText.includes("Пробники"),
        "Session detail trial metric is missing"
      );

      await screenshot(
        client,
        "artifacts/admin-session-detail.png"
      );

      await writeFile(
        "artifacts/admin-sessions-visual.json",
        JSON.stringify(
          {
            ok: true,
            listUrl: "/admin/sessions?scope=all",
            detailUrl: detailPath,
            checked: [
              "Занятия",
              "Фильтры",
              "Отмечено",
              "Не завершены вовремя",
              "Участники и посещаемость",
              "Состояние",
              "Пробники"
            ]
          },
          null,
          2
        )
      );

      console.log("Admin sessions visual smoke test passed.");
    } finally {
      socket.close();
    }
  } finally {
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
