import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { BOOKABLE_GROUP_WHERE } from "../src/server/public-data/visibility";
import { getTrialOptions } from "../src/server/trial/get-trial-options";
import {
  beginTelegramTrial,
  handleTelegramTrialCallback,
  handleTelegramTrialText
} from "../src/server/telegram/trial-flow";

const prisma = getPrisma();
const userId = 777819n;
const chatId = 777819n;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const groups = await prisma.trainingGroup.findMany({
    where: BOOKABLE_GROUP_WHERE,
    include: { sport: true, branch: true },
    orderBy: { ageMin: "asc" }
  });
  let selection: {
    sportId: string;
    branchId: string;
    age: number;
    sessionId: string;
  } | null = null;
  for (const group of groups) {
    const options = await getTrialOptions(group.ageMin, group.sport.slug, group.branch.slug);
    if (options.ok && options.bookingAvailable && options.sessions.length) {
      selection = { sportId: group.sportId, branchId: group.branchId,
        age: group.ageMin, sessionId: options.sessions[0].id };
      break;
    }
  }
  assert(selection, "No bookable group/session available for Telegram trial smoke");

  const start = await beginTelegramTrial(userId, chatId, "ru");
  assert(start.replyMarkup, "Telegram sport choices missing");
  const branch = await handleTelegramTrialCallback(userId, chatId, "trial:s:" + selection.sportId);
  assert(branch?.replyMarkup, "Telegram branch choices missing");
  const age = await handleTelegramTrialCallback(userId, chatId, "trial:b:" + selection.branchId);
  assert(age?.replyMarkup, "Telegram age choices missing");
  const sessions = await handleTelegramTrialCallback(userId, chatId, "trial:a:" + selection.age);
  assert(sessions?.replyMarkup, "Telegram session choices missing");
  const parent = await handleTelegramTrialCallback(userId, chatId, "trial:t:" + selection.sessionId);
  assert(parent?.text.includes("имя родителя"), "Telegram parent name step missing");
  const childName = await handleTelegramTrialText(userId, "CI Telegram Parent");
  assert(childName?.text.includes("ребёнка"), "Telegram child name step missing");
  const phone = await handleTelegramTrialText(userId, "CI Telegram Child");
  assert(phone?.text.includes("телефона"), "Telegram phone step missing");
  const reject = await handleTelegramTrialText(userId, "abc");
  assert(reject?.text.includes("номер"), "Invalid phone was not rejected");
  const confirm = await handleTelegramTrialText(userId, "+998901234567");
  assert(confirm?.replyMarkup, "Telegram confirmation action missing");
  const booked = await handleTelegramTrialCallback(userId, chatId, "trial:confirm");
  assert(booked?.text.includes("CRM") || booked?.text.includes("Место"), "Telegram booking was not completed");
  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId: userId }, include: { lead: true }
  });
  assert(contact?.lead && contact.lead.source === "telegram", "Telegram lead not linked to CRM");
  assert(contact.lead.selectedSessionId === selection.sessionId, "Wrong booked session");
  const booking = await prisma.trialBooking.findFirst({ where: { leadId: contact.leadId! } });
  assert(booking, "Trial booking missing in CRM");
  const countBefore = await prisma.trialBooking.count({ where: { leadId: contact.leadId! } });
  await handleTelegramTrialCallback(userId, chatId, "trial:confirm");
  const countAfter = await prisma.trialBooking.count({ where: { leadId: contact.leadId! } });
  assert(countAfter === countBefore, "Duplicate booking on repeated Telegram confirmation");
  console.log("Telegram in-chat trial booking smoke passed.");
}

main().then(async () => prisma.$disconnect()).catch(async error => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
