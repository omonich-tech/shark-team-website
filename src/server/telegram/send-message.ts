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
