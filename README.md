# Tenant Rent Expiry & Reminder System (Backend)

Full Node.js/Express/MongoDB backend for landlords to manage tenants and
automatically send rent-due / rent-expired reminders to both **tenant**
and **landlord** by **Email (Brevo)** and **SMS (Termii)**.

## Features

- Landlord auth (register/login, JWT)
- Tenant CRUD, scoped per landlord (add / edit / delete / list / view)
- Rent expiry tracking with computed `daysUntilExpiry`
- Auto-status transition (`active` -> `expired`)
- Renew endpoint to push out a tenant's next rent expiry date
- Daily cron job that sweeps all tenants and sends:
  - Upcoming reminders at configurable day-milestones (default 7, 3, 1, 0 days before due)
  - Recurring overdue reminders (default every 3 days, up to 60 days overdue)
- Duplicate-send protection via a per-tenant `reminderLog`, keyed to the current rent cycle
- Manual "run reminders now" endpoints (whole account or single tenant) — handy for testing
- Dashboard endpoint with tenant counts, expiring-soon and overdue lists
- Seed script with a sample dataset (one landlord + 4 tenants in different states)

## 1. Install

```bash
cd tenant-rent-system
npm install
```

## 2. Environment variables

Your `.env` is already set up. It should contain the variables listed in
`.env.example`:

- `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL`, `TERMII_BASE_URL`
- `REMINDER_CRON`, `REMINDER_DAYS_BEFORE`, `OVERDUE_REMINDER_INTERVAL_DAYS`, `OVERDUE_REMINDER_MAX_DAYS`

Notes:
- Brevo sender email must be a **verified sender** in your Brevo account.
- Termii sender ID must be an approved Sender ID (or use `TERMII_CHANNEL=dnd`/`generic` per your account setup).

## 3. (Optional) Seed sample data

```bash
npm run seed
```

Creates:
- Landlord: `landlord@example.com` / `password123`
- 4 tenants: one due in 7 days, one due today, one 3 days overdue, one safely active — so you can watch reminders fire without waiting for real dates.

## 4. Run

```bash
npm run dev     # nodemon, auto-restart
# or
npm start
```

Server boots on `PORT` (default 5000) and starts the reminder cron
(default: every day at 08:00 server time, `REMINDER_CRON="0 8 * * *"`).

## API Reference

All tenant/dashboard routes require header: `Authorization: Bearer <token>`

### Auth
| Method | Route | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `fullName, email, phone, password, companyName?` | Create landlord account |
| POST | `/api/auth/login` | `email, password` | Login, returns JWT |
| GET | `/api/auth/me` | - | Get logged-in landlord |
| PUT | `/api/auth/me` | `fullName?, phone?, companyName?, password?` | Update profile |

### Tenants
| Method | Route | Body / Query | Description |
|---|---|---|---|
| POST | `/api/tenants` | `name, email?, phone, propertyAddress, unitNumber?, rentAmount, currency?, rentStartDate, rentExpiryDate, notes?, remindersEnabled?` | Add tenant |
| GET | `/api/tenants?status=&search=&expiringInDays=` | - | List landlord's tenants (filterable) |
| GET | `/api/tenants/:id` | - | Get one tenant |
| PUT | `/api/tenants/:id` | any updatable field | Edit tenant |
| DELETE | `/api/tenants/:id` | - | Delete tenant |
| PATCH | `/api/tenants/:id/renew` | `{ months }` or `{ newExpiryDate }` | Renew rent cycle, resets reminder log |
| POST | `/api/tenants/reminders/run` | - | Manually run reminder sweep for all your tenants now |
| POST | `/api/tenants/:id/remind` | - | Manually send a reminder check for one tenant now |

### Dashboard
| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard` | Tenant counts, expiring-soon list, overdue list, total expected rent |

### Notifications health check
| Method | Route | Body | Description |
|---|---|---|---|
| POST | `/api/health/notifications` | `{ email?, phone? }` (at least one) | Fires one test email (Brevo) and/or one test SMS (Termii) to the address/number you supply — independent of tenant data. Use this to verify your `.env` credentials before wiring up real tenants. Returns per-channel `{ success, error? }` so you can see exactly which provider rejected the send and why. |

### External cron trigger (for Render free tier and similar)
| Method | Route | Headers | Description |
|---|---|---|---|
| POST | `/api/cron/trigger-reminders` | `x-cron-secret: <CRON_SECRET>` | Runs the full reminder sweep across every landlord's tenants. No JWT — meant to be called by an external scheduler, not the frontend. See "Reliable automatic reminders on Render" below. |

## Reliable automatic reminders on Render (or any free-tier host)

The built-in `node-cron` job in `jobs/reminderCron.js` only works if the
Node process stays running continuously. **Render's free tier spins the
service down after ~15 minutes of no incoming traffic** — if that
happens, the in-memory cron schedule dies with it, and nothing fires
again until an HTTP request wakes the service back up. This is why
reminders only seem to go out when you manually click "send" (a
request that wakes the app) but not on their own overnight.

Fix: let a free external scheduler ping your API on a schedule. The
HTTP request itself wakes Render up, and the endpoint runs the sweep.

**1. Set `CRON_SECRET` in your Render environment variables**
Generate any long random string and set it there — don't reuse a value from anywhere else.

**2. Set up a free scheduled ping at [cron-job.org](https://cron-job.org)**
- Create a free account
- Add a new cron job:
  - URL: `https://your-backend.onrender.com/api/cron/trigger-reminders`
  - Method: `POST`
  - Custom header: `x-cron-secret: <the same value you put in CRON_SECRET>`
  - Schedule: e.g. every hour, or a couple of times a day (running it more than once a day is safe — the reminder log prevents duplicate sends for the same milestone)
- Save and enable it

That's it — cron-job.org now hits your backend on schedule, which both wakes Render up and runs the sweep, so reminders go out even with nobody actively using the app.

**Alternative**: if you upgrade to a paid Render instance (which doesn't sleep), the original in-process `node-cron` job works fine on its own and you don't need this endpoint at all — though there's no harm in keeping both.

## How the reminder engine decides what to send

For every active tenant, each cron run computes `daysUntilExpiry`:

- If `daysUntilExpiry` matches one of `REMINDER_DAYS_BEFORE` (e.g. 7, 3, 1, 0) → sends an **upcoming due** reminder.
- If `daysUntilExpiry` is negative (overdue) and `abs(daysUntilExpiry) % OVERDUE_REMINDER_INTERVAL_DAYS === 0` and within `OVERDUE_REMINDER_MAX_DAYS` → sends an **overdue** reminder, and flips tenant `status` to `expired`.
- Each send is logged in `tenant.reminderLog` tagged to that exact `rentExpiryDate`, so the same milestone is never sent twice for the same cycle. Renewing the tenant (changing `rentExpiryDate`) clears the log so the next cycle's reminders fire fresh.
- Both the **tenant** (their own email/phone) and the **landlord** (account email/phone) get a message on every milestone.

## Folder structure

```
tenant-rent-system/
├── config/db.js
├── controllers/
│   ├── authController.js
│   ├── tenantController.js
│   └── dashboardController.js
├── jobs/reminderCron.js
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
├── models/
│   ├── Landlord.js
│   └── Tenant.js
├── routes/
│   ├── authRoutes.js
│   ├── tenantRoutes.js
│   └── dashboardRoutes.js
├── services/
│   ├── emailService.js   (Brevo)
│   ├── smsService.js     (Termii)
│   └── reminderService.js
├── utils/
│   ├── dateHelpers.js
│   ├── generateToken.js
│   └── seed.js
├── .env.example
├── package.json
└── server.js
```
