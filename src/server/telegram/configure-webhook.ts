export async function configureTelegramWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!token || !appUrl || !secret) {
    return {
      ok: false as const,
      error: "TELEGRAM_WEBHOOK_ENV_MISSING" as const
    };
  }

  const apiBase =
    process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";

  const response = await fetch(`${apiBase}/bot${token}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false
    })
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: boolean;
  };

  if (!response.ok || payload.ok !== true) {
    return {
      ok: false as const,
      error: payload.description ?? `TELEGRAM_HTTP_${response.status}`
    };
  }

  const commandsResponse = await fetch(
    `${apiBase}/bot${token}/setMyCommands`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        commands: [
          {
            command: "start",
            description: "Открыть SHARK TEAM"
          },
          {
            command: "cabinet",
            description: "Кабинет родителя"
          },
          {
            command: "menu",
            description: "Главное меню"
          }
        ]
      })
    }
  );

  const commandsPayload = (await commandsResponse.json()) as {
    ok?: boolean;
    description?: string;
    result?: boolean;
  };

  if (!commandsResponse.ok || commandsPayload.ok !== true) {
    return {
      ok: false as const,
      error:
        commandsPayload.description ??
        `TELEGRAM_COMMANDS_HTTP_${commandsResponse.status}`
    };
  }

  return {
    ok: true as const,
    webhookUrl: `${appUrl}/api/telegram/webhook`,
    allowedUpdates: ["message", "callback_query"] as const,
    commands: ["start", "cabinet", "menu"] as const
  };
}
