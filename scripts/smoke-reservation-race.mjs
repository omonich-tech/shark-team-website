const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createLead(index, selectedSessionId) {
  const response = await fetch(`${baseUrl}/api/public/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      parentName: `Race Parent ${index}`,
      childName: `Race Child ${index}`,
      phone: `+9989012345${String(index).padStart(2, "0")}`,
      childAge: 10,
      locale: "ru",
      selectedSessionId,
      landingPage: "/ru/trial",
      utmSource: "ci",
      utmMedium: "race",
      utmCampaign: "atomic-capacity"
    })
  });

  const payload = await response.json();
  assert(response.status === 201 && payload.ok, "Failed to create race lead");
  return payload.lead.id;
}

async function reserve(leadId) {
  const response = await fetch(`${baseUrl}/api/public/trial-bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ leadId })
  });

  return {
    status: response.status,
    payload: await response.json()
  };
}

const optionsResponse = await fetch(
  `${baseUrl}/api/public/trial-options?age=10`
);
const options = await optionsResponse.json();

assert(optionsResponse.ok && options.ok, "Trial options failed");
assert(options.sessions.length > 0, "Expected an available session");

const sessionId = options.sessions[0].id;

const leadIds = await Promise.all(
  [1, 2, 3].map((index) => createLead(index, sessionId))
);

const reservations = await Promise.all(leadIds.map((leadId) => reserve(leadId)));

const successful = reservations.filter(
  (result) => result.status === 201 && result.payload.ok === true
);
const full = reservations.filter(
  (result) =>
    result.status === 409 &&
    result.payload.ok === false &&
    result.payload.error === "SLOT_FULL"
);

assert(
  successful.length === 2,
  `Expected exactly 2 successful holds, got ${successful.length}`
);
assert(
  full.length === 1,
  `Expected exactly 1 SLOT_FULL response, got ${full.length}`
);

const successfulIndex = reservations.findIndex(
  (result) => result.status === 201 && result.payload.ok === true
);
const replay = await reserve(leadIds[successfulIndex]);

assert(replay.status === 201 && replay.payload.ok, "Hold replay must succeed");
assert(
  replay.payload.booking.id === successful[0].payload.booking.id ||
    successful.some(
      (result) => result.payload.booking.id === replay.payload.booking.id
    ),
  "Hold replay must return the existing booking"
);

console.log("Atomic reservation HTTP smoke test passed.");
