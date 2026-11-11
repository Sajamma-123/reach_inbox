# ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed Email Scheduling and Automation platform built with **Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL, Prisma, React, and Tailwind CSS**.

Engineered from first principles with **zero reliance on cron/node-cron**, zero in-memory rate counters, atomic Redis Lua token evaluation, and persistent delayed job queues capable of surviving server crashes and restarts.

---

## 🌟 Key Features

- **Google OAuth 2.0 Authentication**: Seamless user onboarding with secure session management via signed JWTs and HttpOnly cookies.
- **ReachInbox Campaign Composer**:
  - HTML & Plain text rich email drafting.
  - Multi-source recipient ingest (drag-and-drop CSV / TXT parsing with live recipient count detection).
  - Exact start date and time scheduling.
  - Configurable inter-message delay (e.g., 2s, 5s pacing to prevent SMTP bursting).
  - Configurable hourly sending limits.
- **BullMQ Delayed Queue Architecture**: Delayed execution managed entirely within Redis Sorted Sets (`ZSET`). If the server halts or restarts, delayed jobs resume automatically without dropping a single email.
- **Distributed Atomic Rate Limiter**:
  - Redis-backed distributed sliding hourly counter.
  - Executed via an **atomic Lua script** guaranteeing zero race conditions across distributed worker clusters.
  - When hourly limits are reached, pending emails are automatically rescheduled into the next available hour window.
- **Slack OAuth 2.0 & Real-Time Alerts**:
  - Real-time Slack notifications dispatched to connected team channels when hourly limits are reached.
  - Instant one-click test notification & disconnect controls.
- **Elasticsearch Full-Text Search**:
  - Sub-millisecond search across subject lines, bodies, and recipient addresses with fuzzy matching.
  - Automatic fallback to PostgreSQL queries if the Elasticsearch node is offline.
- **Live Monitoring Dashboard**:
  - Integrated `@bull-board` UI (`/admin/queues`) to inspect delayed, active, waiting, completed, and failed jobs in real-time.
- **Ethereal Email SMTP Integration**:
  - Zero-config SMTP delivery with auto-generated test accounts and instant web preview URLs for every delivered message.

---

## 🏗️ System Design & Scenario Walkthroughs

### Scenario 1: Server Restart & State Persistence
- **Challenge**: If 500 emails are scheduled for tomorrow at 10:00 AM and the backend process crashes or restarts overnight, how do we guarantee jobs are not lost or duplicated?
- **Architecture**:
  - When a campaign is created, jobs are committed to PostgreSQL (`EmailJob` table with status `DELAYED`) and dispatched to BullMQ.
  - BullMQ stores jobs in Redis sorted sets where the score is `Date.now() + delay`.
  - Redis runs with **Append-Only File (`--appendonly yes`)** persistence.
  - When the server or worker cluster restarts, BullMQ reconnects to Redis and immediately reads due jobs from the heap. No database re-scan or cron poller is ever needed.

### Scenario 2: High Volume (1,000+ Concurrent Emails)
- **Challenge**: Scheduling 1,000 emails at approximately the same time without overwhelming the SMTP server or consuming unbounded server memory.
- **Architecture**:
  - The API streams and validates recipients, inserts database records in a single transaction, and pushes jobs with calculated staggered delays:
    $$\text{Delay}_i = \text{InitialDelay} + (i \times \text{delaySeconds} \times 1000)$$
  - BullMQ workers operate with a bounded concurrency pool (`concurrency: 5`) and a token limiter (`max: 20, duration: 1000ms`), enforcing safe, throttled SMTP transmission.

### Scenario 3: Distributed Rate Limiting Across Multiple Workers
- **Challenge**: When multiple workers process jobs in parallel, in-memory counters suffer from severe race conditions, causing rate limits to be breached.
- **Architecture**:
  - We use an atomic Redis Lua script:
    ```lua
    local current = tonumber(redis.call('get', KEYS[1]) or "0")
    if current >= tonumber(ARGV[1]) then
        return {0, current, redis.call('ttl', KEYS[1])}
    else
        local newCount = redis.call('incr', KEYS[1])
        if newCount == 1 then redis.call('expire', KEYS[1], tonumber(ARGV[2])) end
        return {1, newCount, redis.call('ttl', KEYS[1])}
    end
    ```
  - If `allowed == 0`, the worker does not drop the job. It calculates the remaining TTL until the next hour, reschedules the job in BullMQ with `delay: resetInMs`, marks the recipient as `RATE_LIMITED`, and triggers an immediate Slack notification.

### Scenario 4: Duplicate Prevention & SMTP Idempotency
- **Challenge**: Networks fail and SMTP socket timeouts can occur *after* the email has been received by the mail transfer agent.
- **Architecture**:
  - Every BullMQ job is assigned a deterministic ID: `job_${emailId}_${recipientId}`.
  - Before invoking SMTP, the worker queries PostgreSQL to check `recipient.status === 'SENT'`. If already sent, the job acks immediately without re-dispatching.
  - Delivery outcomes are recorded in the `DeliveryAttempt` audit log.
  - *Trade-off*: Pure exactly-once delivery over SMTP is fundamentally impossible due to the Two Generals' Problem if the connection drops between the SMTP `DATA` response and TCP ACK; our architecture achieves safe at-least-once with database deduplication guards.

### Scenario 5: Slack Webhook & OAuth Alert Triggering
- **Challenge**: Alert users in Slack whenever an hourly threshold is exceeded.
- **Architecture**:
  - Users authenticate via Slack OAuth (`/api/slack/connect`). Access tokens and incoming webhook URLs are stored in `SlackConnection`.
  - When `rateLimiterService` detects `allowed === false`, it emits a `rate_limit_exceeded` event.
  - `slackService` formats a Rich Block Kit alert with sender identity, limit count, and estimated time to resume, and posts it to the designated Slack channel.

---

## 🗄️ Database Entity Relationship (ER)

```
User (1) ────────── (N) Sender
User (1) ────────── (N) Email
User (1) ────────── (1) SlackConnection
Sender (1) ──────── (N) Email
Email (1) ───────── (N) EmailRecipient
Email (1) ───────── (N) EmailJob
EmailRecipient (1) ─ (N) EmailJob
EmailJob (1) ────── (N) DeliveryAttempt
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js 18+ & npm 10+
- Docker & Docker Compose (or local PostgreSQL 15 & Redis 7)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Sajamma-123/reach_inbox.git
cd reach_inbox
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```
Ensure your Google OAuth credentials are set:
```ini
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

### 3. Start Infrastructure (Docker)
```bash
docker compose up -d
```
This starts:
- **PostgreSQL 15** on port `5432`
- **Redis 7 (AOF enabled)** on port `6379`
- **Elasticsearch 8** on port `9200`

### 4. Database Setup & Prisma Generation
```bash
npm run prisma:generate --workspace=backend
npm run prisma:push --workspace=backend
```

### 5. Run the Application
In two terminal windows:

**Backend Server & BullMQ Worker:**
```bash
npm run backend:dev
```
*Runs on `http://localhost:5000`*
*Bull-Board Live Monitor at `http://localhost:5000/admin/queues`*

**Frontend React Client:**
```bash
npm run frontend:dev
```
*Runs on `http://localhost:5173`*

---

## 🧪 Testing Scenarios & Verification

### Scenario Test 1: Compose with CSV & Delayed Pacing
1. Log in via **Sign in with Google** or click **Quick Demo Login**.
2. Click **Compose Campaign**.
3. Upload a sample CSV containing 10 email addresses.
4. Set Start Time = Current Time + 1 minute.
5. Set Delay = 3 seconds, Hourly Limit = 50.
6. Click **Schedule Campaign**.
7. Navigate to **Scheduled Queue** and observe the staggered execution timestamps.
8. When due, watch jobs transition to **Sent & Delivered** and click **Open in Ethereal** to inspect the live delivered email.

### Scenario Test 2: Distributed Hourly Rate Limiting
1. Compose a campaign with 5 recipients.
2. Set Hourly Limit = 2.
3. Observe the first 2 emails execute successfully.
4. Observe the 3rd, 4th, and 5th emails automatically transition to `RESCHEDULED` with the exact delay until the next hour window.
5. If Slack is connected, inspect the incoming rich rate limit alert in your Slack channel!

---

## 📹 5-Minute Demonstration Plan

1. **Minute 0:00 - 0:45**: Architecture overview (BullMQ sorted set heap, Redis atomic Lua rate limiter, Prisma PostgreSQL schema).
2. **Minute 0:45 - 1:30**: Google OAuth authentication & demo login walkthrough.
3. **Minute 1:30 - 2:30**: Email composition with CSV upload, delay pacing (e.g. 2s), and live detected recipient count.
4. **Minute 2:30 - 3:30**: Live execution verification in Ethereal Email and the `/admin/queues` Bull-Board monitor.
5. **Minute 3:30 - 4:15**: Rate limit test: trigger an hourly quota, show job rescheduling and live Slack alert.
6. **Minute 4:15 - 5:00**: Server restart resilience test: kill the backend process while jobs are delayed, reboot, and demonstrate zero lost jobs.
