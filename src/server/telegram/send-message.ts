type SendTelegramMessageInput = {
  chatId: bigint | string;
  text: string;
  replyMarkup?: Record<string, unknown>;
};

export async function sendTelegramMessage(
  input: SendTelegramMessageInput
) {
  if (process.env.TELEGRAM_DRY_RUN === "true") {
    return {
      ok: true as const,
      messageId: `dry-${Date.now()}`
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      ok: false as const,
      error: "TELEGRAM_BOT_TOKEN_MISSING" as const
    };
  }

  const apiBase =
    process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";

  const response = await fetch(
    `${apiBase}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: input.chatId.toString(),
        text: input.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(input.replyMarkup
          ? { reply_markup: input.replyMarkup }
          : {})
      })
    }
  );

  const payload = (await response.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };

  if (!response.ok || payload.ok !== true) {
    return {
      ok: false as const,
      error:
        payload.description ??
        `TELEGRAM_HTTP_${response.status}`
    };
  }

  return {
    ok: true as const,
    messageId: String(payload.result?.message_id ?? "")
  };
}


type SendTelegramPhotoInput = {
  chatId: bigint | string;
  photo: string;
  caption?: string;
  replyMarkup?: Record<string, unknown>;
};

export async function sendTelegramPhoto(input: SendTelegramPhotoInput) {
  if (process.env.TELEGRAM_DRY_RUN === "true") {
    return {
      ok: true as const,
      messageId: `dry-${Date.now()}`
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      ok: false as const,
      error: "TELEGRAM_BOT_TOKEN_MISSING" as const
    };
  }

  const apiBase =
    process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";

  const response = await fetch(
    `${apiBase}/bot${token}/sendPhoto`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: input.chatId.toString(),
        photo: input.photo,
        ...(input.caption
          ? {
              caption: input.caption,
              parse_mode: "HTML"
            }
          : {}),
        ...(input.replyMarkup
          ? { reply_markup: input.replyMarkup }
          : {})
      })
    }
  );

  const payload = (await response.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };

  if (!response.ok || payload.ok !== true) {
    return {
      ok: false as const,
      error:
        payload.description ??
        `TELEGRAM_HTTP_${response.status}`
    };
  }

  return {
    ok: true as const,
    messageId: String(payload.result?.message_id ?? "")
  };
}

export async function answerTelegramCallbackQuery(input: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}) {
  if (process.env.TELEGRAM_DRY_RUN === "true") {
    return { ok: true as const };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      ok: false as const,
      error: "TELEGRAM_BOT_TOKEN_MISSING" as const
    };
  }

  const apiBase =
    process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";

  const response = await fetch(
    `${apiBase}/bot${token}/answerCallbackQuery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        callback_query_id: input.callbackQueryId,
        ...(input.text ? { text: input.text } : {}),
        ...(input.showAlert ? { show_alert: true } : {})
      })
    }
  );

  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
  };

  if (!response.ok || payload.ok !== true) {
    return {
      ok: false as const,
      error:
        payload.description ??
        `TELEGRAM_HTTP_${response.status}`
    };
  }

  return { ok: true as const };
}
