# Telegram Mini App — первый релиз

- Entry: `https://sharkteam.uz/miniapp`.
- Bot: existing `@sharkteam_uz_bot`; the parent and coach Web App launch buttons are on `/start` and `/menu`.
- No separate coach bot token required for this initial release.
- Parent auth: verify Telegram WebApp `initData` HMAC, require fresh `auth_date`, map verified `telegramUserId` to `TelegramContact.parentId`, then query only the parent's children.
- Coach auth: existing CRM username/password and HttpOnly `shark_coach_session` cookie; existing `getCoachSession` checks coach assignment and active status.
- Read API: `GET /api/miniapp/dashboard?role=parent|coach`.
- Coach attendance write: `POST /api/miniapp/dashboard` using existing `markCoachAttendance` authorization/business logic.
- Parent indicators are database-derived: 90-day attendance among **marked** lessons, actual subscription status/next due date, upcoming sessions, latest six recorded progress assessments, trial history. Missing data is shown as missing, not invented.
- Coach sees assigned sessions, confirmed trial signups, per-session attendance and can submit trial assessments and complete sessions through existing secured CRM endpoints. Detailed historical views remain in the web cabinet.

## Next iterations

1. Improve absence reason details, approval controls and complete assessment history in Mini App.
2. Add parent absence request, subscription history and notifications preferences.
3. Introduce dedicated coach Telegram bot only after bot credentials/ownership and role provisioning are configured. Keep a single CRM/database.
4. Real-device QA in Telegram iOS and Android, including expired initData, login, role switching and two-child families.

Do not mistake a successful Vercel build for a completed Telegram device test.
