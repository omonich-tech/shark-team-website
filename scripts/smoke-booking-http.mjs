const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const optionsResponse = await fetch(
  `${baseUrl}/api/public/trial-options?age=10`
);
const options = await optionsResponse.json();

assert(optionsResponse.ok, "Trial options endpoint returned an error");
assert(options.ok === true, "Trial options payload is not ok");
assert(options.bookingAvailable === true, "Expected booking to be available");
assert(options.sessions.length > 0, "Expected at least one trial session");

const selectedSessionId = options.sessions[0].id;

const leadResponse = await fetch(`${baseUrl}/api/public/leads`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    parentName: "Test Parent",
    childName: "Test Child",
    phone: "+998901234567",
    childAge: 10,
    locale: "ru",
    selectedSessionId,
    landingPage: "/ru/trial",
    utmSource: "ci",
    utmMedium: "smoke",
    utmCampaign: "booking-flow"
  })
});

const lead = await leadResponse.json();

assert(leadResponse.status === 201, "Lead endpoint did not return 201");
assert(lead.ok === true, "Lead payload is not ok");
assert(typeof lead.lead?.id === "string", "Lead id is missing");
assert(
  lead.lead.selectedSessionId === selectedSessionId,
  "Lead selected session does not match"
);

console.log("Booking HTTP smoke test passed:", lead.lead.id);
