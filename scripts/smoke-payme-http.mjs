const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const merchantUrl = `${baseUrl}/api/payments/payme/merchant`;
const auth =
  "Basic " + Buffer.from("ci-login:ci-key").toString("base64");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    payload: await response.json()
  };
}

async function rpc(id, method, params, authorized = true) {
  return postJson(
    merchantUrl,
    { id, method, params },
    authorized ? { Authorization: auth } : {}
  );
}

const optionsResponse = await fetch(
  `${baseUrl}/api/public/trial-options?age=10`
);
const options = await optionsResponse.json();

assert(optionsResponse.ok && options.ok, "Trial options failed");
assert(options.sessions.length > 0, "No free Session available for Payme test");

const sessionId = options.sessions[0].id;

const lead = await postJson(`${baseUrl}/api/public/leads`, {
  parentName: "Payme Parent",
  childName: "Payme Child",
  phone: "+998909876543",
  childAge: 10,
  locale: "ru",
  selectedSessionId: sessionId,
  landingPage: "/ru/trial",
  utmSource: "ci",
  utmMedium: "payme",
  utmCampaign: "merchant-api"
});

assert(lead.status === 201 && lead.payload.ok, "Payme lead creation failed");

const booking = await postJson(`${baseUrl}/api/public/trial-bookings`, {
  leadId: lead.payload.lead.id
});

assert(
  booking.status === 201 && booking.payload.ok,
  "Payme booking HOLD failed"
);

const init = await postJson(
  `${baseUrl}/api/public/payments/payme/init`,
  {
    bookingId: booking.payload.booking.id,
    locale: "ru"
  }
);

assert(init.status === 201 && init.payload.ok, "Payme init failed");
assert(init.payload.payment.amountUzs === 50000, "Unexpected UZS amount");
assert(init.payload.payment.amountTiyin === 5000000, "Unexpected tiyin amount");
assert(
  init.payload.checkout.fields.merchant === "ci-merchant",
  "Merchant ID missing from checkout"
);
assert(
  init.payload.checkout.fields["account[order_id]"] ===
    init.payload.payment.id,
  "Payme order_id mismatch"
);

const orderId = init.payload.payment.id;
const amount = init.payload.payment.amountTiyin;
const providerTransactionId = "123456789012345678901234";
const secondProviderTransactionId = "987654321098765432109876";
const requestTime = Date.now();

const unauthorized = await rpc(
  1,
  "CheckPerformTransaction",
  {
    amount,
    account: { order_id: orderId }
  },
  false
);

assert(unauthorized.status === 200, "Payme errors must use HTTP 200");
assert(
  unauthorized.payload.error?.code === -32504,
  "Expected Payme authorization error"
);

const wrongAmount = await rpc(2, "CheckPerformTransaction", {
  amount: amount + 100,
  account: { order_id: orderId }
});

assert(
  wrongAmount.payload.error?.code === -31001,
  "Expected incorrect amount error"
);

const missingOrder = await rpc(3, "CheckPerformTransaction", {
  amount,
  account: { order_id: "missing-order" }
});

assert(
  missingOrder.payload.error?.code === -31050,
  "Expected missing order error"
);

const check = await rpc(4, "CheckPerformTransaction", {
  amount,
  account: { order_id: orderId }
});

assert(check.payload.result?.allow === true, "Payment should be allowed");

const create = await rpc(5, "CreateTransaction", {
  id: providerTransactionId,
  time: requestTime,
  amount,
  account: { order_id: orderId }
});

assert(create.payload.result?.state === 1, "CreateTransaction must return state 1");

const repeatedCreate = await rpc(6, "CreateTransaction", {
  id: providerTransactionId,
  time: requestTime,
  amount,
  account: { order_id: orderId }
});

assert(
  repeatedCreate.payload.result?.transaction ===
    create.payload.result?.transaction,
  "Repeated CreateTransaction must be idempotent"
);

const duplicateActive = await rpc(7, "CreateTransaction", {
  id: secondProviderTransactionId,
  time: requestTime + 1,
  amount,
  account: { order_id: orderId }
});

assert(
  duplicateActive.payload.error?.code === -31008,
  "Second active Payme transaction must be rejected"
);

const pendingStatusResponse = await fetch(
  `${baseUrl}/api/public/payments/${orderId}`
);
const pendingStatus = await pendingStatusResponse.json();

assert(pendingStatus.payment.status === "PENDING", "Payment must be pending");
assert(
  pendingStatus.payment.bookingStatus === "PAYMENT_PENDING",
  "Booking must consume capacity while Payme is processing"
);

const perform = await rpc(8, "PerformTransaction", {
  id: providerTransactionId
});

assert(perform.payload.result?.state === 2, "PerformTransaction must return state 2");

const repeatedPerform = await rpc(9, "PerformTransaction", {
  id: providerTransactionId
});

assert(
  repeatedPerform.payload.result?.perform_time ===
    perform.payload.result?.perform_time,
  "Repeated PerformTransaction must be idempotent"
);

const paidStatusResponse = await fetch(
  `${baseUrl}/api/public/payments/${orderId}`
);
const paidStatus = await paidStatusResponse.json();

assert(paidStatus.payment.status === "PAID", "Payment was not marked PAID");
assert(
  paidStatus.payment.bookingStatus === "CONFIRMED",
  "Booking was not CONFIRMED after Payme payment"
);

const checkTransaction = await rpc(10, "CheckTransaction", {
  id: providerTransactionId
});

assert(
  checkTransaction.payload.result?.state === 2,
  "CheckTransaction must show paid state"
);

const statement = await rpc(11, "GetStatement", {
  from: requestTime - 1000,
  to: requestTime + 1000
});

assert(
  statement.payload.result?.transactions?.some(
    (transaction) => transaction.id === providerTransactionId
  ),
  "GetStatement did not return the Payme transaction"
);

const cancel = await rpc(12, "CancelTransaction", {
  id: providerTransactionId,
  reason: 5
});

assert(cancel.payload.result?.state === -2, "Paid transaction must cancel to -2");

const repeatedCancel = await rpc(13, "CancelTransaction", {
  id: providerTransactionId,
  reason: 5
});

assert(
  repeatedCancel.payload.result?.cancel_time ===
    cancel.payload.result?.cancel_time,
  "Repeated CancelTransaction must be idempotent"
);

const refundedStatusResponse = await fetch(
  `${baseUrl}/api/public/payments/${orderId}`
);
const refundedStatus = await refundedStatusResponse.json();

assert(
  refundedStatus.payment.status === "REFUNDED",
  "Cancelled paid payment must be REFUNDED"
);
assert(
  refundedStatus.payment.bookingStatus === "CANCELLED",
  "Refunded booking must be CANCELLED"
);

console.log("Payme Merchant API HTTP smoke test passed.");
