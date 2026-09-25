import {
  LeadStatus,
  PaymentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type RpcId = number | null;

type RpcParams = Record<string, unknown>;

export type PaymeRpcRequest = {
  id: number;
  method: string;
  params: RpcParams;
};

export type PaymeRpcResponse =
  | {
      result: unknown;
      id: RpcId;
    }
  | {
      error: {
        code: number;
        message: {
          ru: string;
          uz: string;
          en: string;
        };
        data?: string;
      };
      id: RpcId;
    };

function localized(ru: string, uz: string, en: string) {
  return { ru, uz, en };
}

export function rpcError(
  id: RpcId,
  code: number,
  message: ReturnType<typeof localized>,
  data?: string
): PaymeRpcResponse {
  return {
    error: {
      code,
      message,
      ...(data ? { data } : {})
    },
    id
  };
}

export function rpcResult(id: RpcId, result: unknown): PaymeRpcResponse {
  return { result, id };
}

function invalidRequest(id: RpcId) {
  return rpcError(
    id,
    -32600,
    localized(
      "Некорректный RPC-запрос",
      "Noto‘g‘ri RPC so‘rovi",
      "Invalid RPC request"
    )
  );
}

function orderNotFound(id: RpcId) {
  return rpcError(
    id,
    -31050,
    localized(
      "Заказ не найден",
      "Buyurtma topilmadi",
      "Order not found"
    ),
    "order_id"
  );
}

function incorrectAmount(id: RpcId) {
  return rpcError(
    id,
    -31001,
    localized(
      "Неверная сумма",
      "Noto‘g‘ri summa",
      "Incorrect amount"
    )
  );
}

function transactionNotFound(id: RpcId) {
  return rpcError(
    id,
    -31003,
    localized(
      "Транзакция не найдена",
      "Tranzaksiya topilmadi",
      "Transaction not found"
    )
  );
}

function operationNotAllowed(id: RpcId) {
  return rpcError(
    id,
    -31008,
    localized(
      "Невозможно выполнить операцию",
      "Operatsiyani bajarib bo‘lmaydi",
      "Operation is not allowed"
    )
  );
}

function cannotCancel(id: RpcId) {
  return rpcError(
    id,
    -31007,
    localized(
      "Услуга уже оказана",
      "Xizmat allaqachon ko‘rsatilgan",
      "Service has already been provided"
    )
  );
}

function getOrderId(params: RpcParams) {
  const account = params.account;

  if (!account || typeof account !== "object") {
    return null;
  }

  const orderId = (account as Record<string, unknown>).order_id;
  return typeof orderId === "string" && orderId ? orderId : null;
}

function getAmount(params: RpcParams) {
  return typeof params.amount === "number" &&
    Number.isInteger(params.amount) &&
    params.amount > 0
    ? params.amount
    : null;
}

function dateMs(value: Date | null) {
  return value ? value.getTime() : 0;
}

function transactionView(transaction: {
  id: string;
  providerTransactionId: string;
  requestTime: bigint;
  amountTiyin: number;
  state: number;
  reason: number | null;
  merchantCreateTime: Date;
  merchantPerformTime: Date | null;
  merchantCancelTime: Date | null;
  payment: {
    id: string;
  };
}) {
  return {
    id: transaction.providerTransactionId,
    time: Number(transaction.requestTime),
    amount: transaction.amountTiyin,
    account: {
      order_id: transaction.payment.id
    },
    create_time: transaction.merchantCreateTime.getTime(),
    perform_time: dateMs(transaction.merchantPerformTime),
    cancel_time: dateMs(transaction.merchantCancelTime),
    transaction: transaction.id,
    state: transaction.state,
    reason: transaction.reason
  };
}

async function findPayableOrder(
  id: RpcId,
  orderId: string,
  amount: number
): Promise<
  | {
      ok: true;
      payment: {
        id: string;
        amountTiyin: number;
        status: PaymentStatus;
        trialBooking: {
          id: string;
          status: TrialBookingStatus;
          expiresAt: Date;
        };
      };
    }
  | {
      ok: false;
      response: PaymeRpcResponse;
    }
> {
  const prisma = getPrisma();

  const payment = await prisma.payment.findUnique({
    where: { id: orderId },
    include: {
      trialBooking: true
    }
  });

  if (!payment) {
    return { ok: false, response: orderNotFound(id) };
  }

  if (payment.amountTiyin !== amount) {
    return { ok: false, response: incorrectAmount(id) };
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return { ok: false, response: operationNotAllowed(id) };
  }

  const booking = payment.trialBooking;
  const now = new Date();

  if (
    booking.status === TrialBookingStatus.HOLD &&
    booking.expiresAt <= now
  ) {
    await prisma.trialBooking.update({
      where: { id: booking.id },
      data: { status: TrialBookingStatus.EXPIRED }
    });

    return { ok: false, response: operationNotAllowed(id) };
  }

  if (
    booking.status !== TrialBookingStatus.HOLD &&
    booking.status !== TrialBookingStatus.PAYMENT_PENDING
  ) {
    return { ok: false, response: operationNotAllowed(id) };
  }

  return {
    ok: true,
    payment
  };
}

async function checkPerform(id: RpcId, params: RpcParams) {
  const orderId = getOrderId(params);
  const amount = getAmount(params);

  if (!orderId) {
    return orderNotFound(id);
  }

  if (amount === null) {
    return incorrectAmount(id);
  }

  const order = await findPayableOrder(id, orderId, amount);

  if (!order.ok) {
    return order.response;
  }

  return rpcResult(id, { allow: true });
}

async function createTransaction(id: RpcId, params: RpcParams) {
  const providerTransactionId =
    typeof params.id === "string" ? params.id : null;
  const requestTime =
    typeof params.time === "number" && Number.isInteger(params.time)
      ? params.time
      : null;
  const amount = getAmount(params);
  const orderId = getOrderId(params);

  if (!providerTransactionId || requestTime === null || amount === null) {
    return invalidRequest(id);
  }

  if (!orderId) {
    return orderNotFound(id);
  }

  const prisma = getPrisma();

  const existing = await prisma.paymeTransaction.findUnique({
    where: { providerTransactionId },
    include: { payment: true }
  });

  if (existing) {
    if (existing.payment.id !== orderId) {
      return operationNotAllowed(id);
    }

    if (existing.amountTiyin !== amount) {
      return incorrectAmount(id);
    }

    return rpcResult(id, {
      create_time: existing.merchantCreateTime.getTime(),
      transaction: existing.id,
      state: existing.state
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;

    const payment = await tx.payment.findUnique({
      where: { id: orderId },
      include: {
        trialBooking: true
      }
    });

    if (!payment) {
      return orderNotFound(id);
    }

    if (payment.amountTiyin !== amount) {
      return incorrectAmount(id);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return operationNotAllowed(id);
    }

    const booking = payment.trialBooking;
    const now = new Date();

    if (
      booking.status === TrialBookingStatus.HOLD &&
      booking.expiresAt <= now
    ) {
      await tx.trialBooking.update({
        where: { id: booking.id },
        data: { status: TrialBookingStatus.EXPIRED }
      });

      return operationNotAllowed(id);
    }

    if (
      booking.status !== TrialBookingStatus.HOLD &&
      booking.status !== TrialBookingStatus.PAYMENT_PENDING
    ) {
      return operationNotAllowed(id);
    }

    const activeTransaction = await tx.paymeTransaction.findFirst({
      where: {
        paymentId: payment.id,
        state: { in: [1, 2] }
      }
    });

    if (activeTransaction) {
      return operationNotAllowed(id);
    }

    const createdAt = new Date();

    const transaction = await tx.paymeTransaction.create({
      data: {
        paymentId: payment.id,
        providerTransactionId,
        requestTime: BigInt(requestTime),
        amountTiyin: amount,
        state: 1,
        merchantCreateTime: createdAt
      }
    });

    await tx.trialBooking.update({
      where: { id: booking.id },
      data: {
        status: TrialBookingStatus.PAYMENT_PENDING
      }
    });

    return rpcResult(id, {
      create_time: transaction.merchantCreateTime.getTime(),
      transaction: transaction.id,
      state: 1
    });
  });
}

async function performTransaction(id: RpcId, params: RpcParams) {
  const providerTransactionId =
    typeof params.id === "string" ? params.id : null;

  if (!providerTransactionId) {
    return invalidRequest(id);
  }

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "PaymeTransaction"
      WHERE "providerTransactionId" = ${providerTransactionId}
      FOR UPDATE
    `;

    const transaction = await tx.paymeTransaction.findUnique({
      where: { providerTransactionId },
      include: {
        payment: {
          include: {
            trialBooking: {
              include: {
                lead: true
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      return transactionNotFound(id);
    }

    if (transaction.state === 2) {
      return rpcResult(id, {
        transaction: transaction.id,
        perform_time: dateMs(transaction.merchantPerformTime),
        state: 2
      });
    }

    if (transaction.state !== 1) {
      return operationNotAllowed(id);
    }

    const now = new Date();
    const booking = transaction.payment.trialBooking;

    const updated = await tx.paymeTransaction.update({
      where: { id: transaction.id },
      data: {
        state: 2,
        merchantPerformTime: now
      }
    });

    await tx.payment.update({
      where: { id: transaction.payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: now
      }
    });

    await tx.trialBooking.update({
      where: { id: booking.id },
      data: {
        status: TrialBookingStatus.CONFIRMED,
        confirmedAt: now
      }
    });

    const lead = booking.lead;

    const parent = await tx.parent.upsert({
      where: { phone: lead.phone },
      update: {
        name: lead.parentName,
        locale: lead.locale
      },
      create: {
        name: lead.parentName,
        phone: lead.phone,
        locale: lead.locale
      }
    });

    let childId = lead.childId;

    if (!childId) {
      const existingChild = await tx.child.findFirst({
        where: {
          parentId: parent.id,
          name: lead.childName
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      childId = existingChild
        ? existingChild.id
        : (
            await tx.child.create({
              data: {
                parentId: parent.id,
                name: lead.childName,
                ageAtRegistration: lead.childAge
              }
            })
          ).id;
    }

    await tx.lead.update({
      where: { id: booking.leadId },
      data: {
        status: LeadStatus.TRIAL_CONFIRMED,
        parentId: parent.id,
        childId
      }
    });

    return rpcResult(id, {
      transaction: updated.id,
      perform_time: now.getTime(),
      state: 2
    });
  });
}

async function cancelTransaction(id: RpcId, params: RpcParams) {
  const providerTransactionId =
    typeof params.id === "string" ? params.id : null;
  const reason =
    typeof params.reason === "number" && Number.isInteger(params.reason)
      ? params.reason
      : null;

  if (!providerTransactionId || reason === null) {
    return invalidRequest(id);
  }

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "PaymeTransaction"
      WHERE "providerTransactionId" = ${providerTransactionId}
      FOR UPDATE
    `;

    const transaction = await tx.paymeTransaction.findUnique({
      where: { providerTransactionId },
      include: {
        payment: {
          include: {
            trialBooking: true
          }
        }
      }
    });

    if (!transaction) {
      return transactionNotFound(id);
    }

    if (transaction.state === -1 || transaction.state === -2) {
      return rpcResult(id, {
        transaction: transaction.id,
        cancel_time: dateMs(transaction.merchantCancelTime),
        state: transaction.state
      });
    }

    const booking = transaction.payment.trialBooking;
    const now = new Date();

    if (
      transaction.state === 2 &&
      booking.status === TrialBookingStatus.ATTENDED
    ) {
      return cannotCancel(id);
    }

    if (transaction.state === 1) {
      const nextBookingStatus =
        booking.expiresAt > now
          ? TrialBookingStatus.HOLD
          : TrialBookingStatus.EXPIRED;

      const nextLeadStatus =
        nextBookingStatus === TrialBookingStatus.HOLD
          ? LeadStatus.TRIAL_HELD
          : LeadStatus.TRIAL_SELECTED;

      const updated = await tx.paymeTransaction.update({
        where: { id: transaction.id },
        data: {
          state: -1,
          reason,
          merchantCancelTime: now
        }
      });

      await tx.trialBooking.update({
        where: { id: booking.id },
        data: {
          status: nextBookingStatus
        }
      });

      await tx.lead.update({
        where: { id: booking.leadId },
        data: {
          status: nextLeadStatus
        }
      });

      return rpcResult(id, {
        transaction: updated.id,
        cancel_time: now.getTime(),
        state: -1
      });
    }

    if (transaction.state === 2) {
      const updated = await tx.paymeTransaction.update({
        where: { id: transaction.id },
        data: {
          state: -2,
          reason,
          merchantCancelTime: now
        }
      });

      await tx.payment.update({
        where: { id: transaction.payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          cancelledAt: now
        }
      });

      await tx.trialBooking.update({
        where: { id: booking.id },
        data: {
          status: TrialBookingStatus.CANCELLED,
          cancelledAt: now
        }
      });

      await tx.lead.update({
        where: { id: booking.leadId },
        data: {
          status: LeadStatus.CLOSED
        }
      });

      return rpcResult(id, {
        transaction: updated.id,
        cancel_time: now.getTime(),
        state: -2
      });
    }

    return operationNotAllowed(id);
  });
}

async function checkTransaction(id: RpcId, params: RpcParams) {
  const providerTransactionId =
    typeof params.id === "string" ? params.id : null;

  if (!providerTransactionId) {
    return invalidRequest(id);
  }

  const prisma = getPrisma();

  const transaction = await prisma.paymeTransaction.findUnique({
    where: { providerTransactionId }
  });

  if (!transaction) {
    return transactionNotFound(id);
  }

  return rpcResult(id, {
    create_time: transaction.merchantCreateTime.getTime(),
    perform_time: dateMs(transaction.merchantPerformTime),
    cancel_time: dateMs(transaction.merchantCancelTime),
    transaction: transaction.id,
    state: transaction.state,
    reason: transaction.reason
  });
}

async function getStatement(id: RpcId, params: RpcParams) {
  const from =
    typeof params.from === "number" && Number.isInteger(params.from)
      ? params.from
      : null;
  const to =
    typeof params.to === "number" && Number.isInteger(params.to)
      ? params.to
      : null;

  if (from === null || to === null || from > to) {
    return invalidRequest(id);
  }

  const prisma = getPrisma();

  const transactions = await prisma.paymeTransaction.findMany({
    where: {
      requestTime: {
        gte: BigInt(from),
        lte: BigInt(to)
      }
    },
    include: {
      payment: true
    },
    orderBy: {
      requestTime: "asc"
    }
  });

  return rpcResult(id, {
    transactions: transactions.map(transactionView)
  });
}

export async function handlePaymeRpc(
  request: PaymeRpcRequest
): Promise<PaymeRpcResponse> {
  switch (request.method) {
    case "CheckPerformTransaction":
      return checkPerform(request.id, request.params);
    case "CreateTransaction":
      return createTransaction(request.id, request.params);
    case "PerformTransaction":
      return performTransaction(request.id, request.params);
    case "CancelTransaction":
      return cancelTransaction(request.id, request.params);
    case "CheckTransaction":
      return checkTransaction(request.id, request.params);
    case "GetStatement":
      return getStatement(request.id, request.params);
    default:
      return rpcError(
        request.id,
        -32601,
        localized(
          "Метод не найден",
          "Metod topilmadi",
          "Method not found"
        ),
        request.method
      );
  }
}
