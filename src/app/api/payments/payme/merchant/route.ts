import { NextRequest, NextResponse } from "next/server";
import { isPaymeAuthorized } from "@/server/payments/payme/auth";
import {
  handlePaymeRpc,
  rpcError,
  type PaymeRpcRequest
} from "@/server/payments/payme/rpc";

export const dynamic = "force-dynamic";

const parseErrorMessage = {
  ru: "Ошибка разбора JSON",
  uz: "JSON tahlil qilish xatosi",
  en: "JSON parse error"
};

const authErrorMessage = {
  ru: "Недостаточно привилегий для выполнения метода",
  uz: "Metodni bajarish uchun huquq yetarli emas",
  en: "Insufficient privileges"
};

const invalidRequestMessage = {
  ru: "Некорректный RPC-запрос",
  uz: "Noto‘g‘ri RPC so‘rovi",
  en: "Invalid RPC request"
};

export async function POST(request: NextRequest) {
  const raw = await request.text();
  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      rpcError(null, -32700, parseErrorMessage),
      { status: 200 }
    );
  }

  const candidate = body as Partial<PaymeRpcRequest>;
  const id = typeof candidate.id === "number" ? candidate.id : null;

  if (!isPaymeAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      rpcError(id, -32504, authErrorMessage),
      { status: 200 }
    );
  }

  if (
    typeof candidate.id !== "number" ||
    !Number.isInteger(candidate.id) ||
    typeof candidate.method !== "string" ||
    !candidate.params ||
    typeof candidate.params !== "object" ||
    Array.isArray(candidate.params)
  ) {
    return NextResponse.json(
      rpcError(id, -32600, invalidRequestMessage),
      { status: 200 }
    );
  }

  try {
    const response = await handlePaymeRpc({
      id: candidate.id,
      method: candidate.method,
      params: candidate.params as Record<string, unknown>
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Payme Merchant API failed", error);

    return NextResponse.json(
      rpcError(candidate.id, -32400, {
        ru: "Системная ошибка",
        uz: "Tizim xatosi",
        en: "System error"
      }),
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    rpcError(null, -32300, {
      ru: "Метод запроса должен быть POST",
      uz: "So‘rov usuli POST bo‘lishi kerak",
      en: "Request method must be POST"
    }),
    { status: 200 }
  );
}
