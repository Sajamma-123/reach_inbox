# ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed Email Scheduling and Automation platform built with **Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL, Prisma, React, and Tailwind CSS**.

Engineered from first principles with **zero reliance on cron/node-cron**, zero in-memory rate counters, atomic Redis Lua token evaluation, and persistent delayed job queues capable of surviving server crashes and restarts.

---

## 🗺️ Master Architecture Mindmap

```mermaid
flowchart TD
    %% Master System Mindmap
    subgraph ClientTier["1. CLIENT TIER (React 18 + Tailwind CSS)"]
        UI_Login["Google OAuth & Demo Landing"]
        UI_Dash["Metrics Overview & Elasticsearch Search"]
        UI_Compose["Campaign Composer (CSV Parsing & Live Count)"]
        UI_Queue["Scheduled Queue (Delay Pacing & Countdowns)"]
        UI_Sent["Delivered Emails (Ethereal Preview Links)"]
        UI_Monitor["Bull-Board Real-Time Queue Monitor"]
    end

    subgraph GatewayTier["2. API GATEWAY & SECURITY TIER (Express.js)"]
        GW_Auth["Google OAuth 2.0 & Session JWT Engine"]
        GW_Multer["Streaming Multipart CSV/TXT Ingest"]
        GW_Validation["Zod Request Validation & Sanitization"]
        GW_Routes["REST Router (/api/auth, /api/emails, /api/slack, /api/search)"]
        GW_Admin["Bull-Board Admin Router (/admin/queues)"]
    end

    subgraph StateTier["3. PERSISTENCE & DATA TIER (PostgreSQL 15 + Prisma)"]
        DB_User["User & Identity Models"]
        DB_Sender["Sender Profiles & Multi-Identity"]
        DB_Email["Email Campaigns & Pacing Metadata"]
        DB_Recip["Recipients & Status (PENDING, SENT, RATE_LIMITED)"]
        DB_Job["EmailJobs (BullMQ Job IDs & Execution Timestamps)"]
        DB_Attempt["DeliveryAttempts (SMTP Audit Logs)"]
        DB_Slack["SlackConnection (Access Tokens & Webhook URLs)"]
    end

    subgraph QueueTier["4. QUEUE & DISTRIBUTED STATE (Redis 7 + BullMQ)"]
        RD_ZSET["Redis Delayed Sorted Set (Microsecond Timer Heap)"]
        RD_AOF["Append-Only File (Crash Persistence)"]
        RD_Lua["Atomic Token Bucket Lua Rate Limiter"]
    end

    subgraph WorkerTier["5. WORKER CLUSTER & DISPATCH"]
        WK_Worker["BullMQ Worker (Concurrency: 5, Throttle: 20/s)"]
        WK_Idempotency["Database Deduplication Guard (Check Status != SENT)"]
        WK_Limiter["Hourly Quota Evaluation (checkAndIncrement)"]
        WK_Rescheduler["Auto-Rescheduler (Re-enqueue for Next Hour Window)"]
        WK_SMTP["Ethereal SMTP Transporter (HTML/Plain Text)"]
    end

    subgraph ExternalTier["6. EXTERNAL INTEGRATIONS"]
        EXT_Google["Google Identity OAuth Provider"]
        EXT_Slack["Slack Webhook / Bot API (Quota Alerts)"]
        EXT_ES["Elasticsearch 8 (Full-Text Search Index)"]
        EXT_Ethereal["Ethereal Email Server (Rendered Web Previews)"]
    end

    %% Flow Connectors
    ClientTier -->|"HTTP / REST API + Cookies"| GatewayTier
    GatewayTier -->|"Prisma ORM"| StateTier
    GatewayTier -->|"Enqueues Delayed Jobs"| QueueTier
    QueueTier -->|"Picks Expired Timers"| WorkerTier
    WorkerTier -->|"Idempotency & Audit"| StateTier
    WorkerTier -->|"SMTP Dispatch"| EXT_Ethereal
    WorkerTier -->|"Index Updates"| EXT_ES
    WorkerTier -->|"Rate Limit Alerts"| EXT_Slack
    GatewayTier -->|"OAuth Code Exchange"| EXT_Google
```

---

## 🔄 End-to-End Campaign Scheduling Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant UI as React Dashboard
    participant API as Express Gateway
    participant DB as PostgreSQL (Prisma)
    participant Queue as BullMQ (Redis ZSET)
    participant ES as Elasticsearch

    User->>UI: Fills Subject, Body, Start Time (e.g., +5m), Delay (2s), Hourly Limit (100)
    User->>UI: Uploads CSV file (e.g., 50 recipients)
    UI->>UI: Stream-parses CSV in browser & displays: "Detected: 50 recipients"
    User->>UI: Clicks "Schedule Campaign"
    UI->>API: POST /api/emails/schedule (Multipart FormData)
    
    API->>API: Server-side CSV validation & email deduplication
    API->>DB: Begin Transaction: Create Email & 50 EmailRecipient records
    DB-->>API: Transaction Committed (Generated IDs)
    
    loop For each recipient i = 0 to 49
        API->>API: Calculate Delay_i = (StartTime - Now) + (i * DelaySeconds * 1000)
        API->>DB: Insert EmailJob (id: job_emailId_recipientId, status: 'DELAYED')
        API->>Queue: emailQueue.add('send-email', payload, { delay: Delay_i, jobId })
        API->>ES: Index document with status: 'SCHEDULED'
    end

    API-->>UI: 201 Created (batchId, 50 scheduled, firstExecutionTime)
    UI-->>User: Success toast & auto-redirects to "Scheduled Queue" tab
```

---

## ⚡ BullMQ Worker Execution & Idempotency Pipeline

```mermaid
flowchart TD
    TimerExpired["Redis ZSET: Delay Timer Expires"] --> PickJob["Worker Picks Job from Queue"]
    PickJob --> CheckDB{"Query Database:\nIs recipient.status == 'SENT'?"}
    
    CheckDB -->|"Yes (Already Sent)"| DropJob["Duplicate Prevention:\nAck Job & Skip (No-Op)"]
    
    CheckDB -->|"No (Pending)"| RunLimiter["Execute Atomic Redis Lua Rate Limiter"]
    
    RunLimiter --> CheckLimit{"Hourly Limit\nExceeded?"}
    
    CheckLimit -->|"Yes (Limit Hit)"| RescheduleJob["1. Calculate TTL until next hour\n2. Re-enqueue job with delay = TTL\n3. Mark EmailJob = 'RESCHEDULED'\n4. Mark Recipient = 'RATE_LIMITED'"]
    RescheduleJob --> AlertSlack["Dispatch Rich Block Kit Alert to Slack Channel"]
    
    CheckLimit -->|"No (Quota Available)"| SendSMTP["Dispatch Email via Ethereal SMTP Transporter"]
    
    SendSMTP --> SMTPResult{"SMTP Response"}
    
    SMTPResult -->|"Success"| UpdateSuccess["1. Mark Recipient = 'SENT'\n2. Mark EmailJob = 'COMPLETED'\n3. Save DeliveryAttempt (SUCCESS)\n4. Store Ethereal previewUrl\n5. Update Elasticsearch = 'SENT'"]
    
    SMTPResult -->|"Failure / Timeout"| UpdateFail["1. Record DeliveryAttempt (FAILURE)\n2. Mark EmailJob = 'FAILED'\n3. BullMQ Exponential Backoff Retry"]
```

---

## 🛡️ Distributed Atomic Rate-Limiting Mindmap

```mermaid
flowchart LR
    subgraph RequestContext["Worker Context"]
        R_Sender["Sender: user@example.com"]
        R_Limit["Hourly Limit: 50 emails/hr"]
        R_Time["Current Time: Epoch Milliseconds"]
    end

    subgraph WindowCalc["Epoch Window Calculation"]
        W_Hour["Epoch Hour = math.floor(Now / 3,600,000)"]
        W_Key["Redis Key = 'ratelimit:sender:{id}:hour:{epochHour}'"]
    end

    subgraph LuaScript["Atomic Redis Lua Engine"]
        L_Fetch["current = redis.call('get', key) or 0"]
        L_Branch{"current >= Limit ?"}
        L_Deny["Return: {0, current, ttl}"]
        L_Allow["redis.call('incr', key)\nif 1st then redis.call('expire', key, 3600)\nReturn: {1, count, ttl}"]
    end

    subgraph Resolution["Action Taken"]
        Act_Allow["ALLOWED:\nProceed to SMTP Transmission"]
        Act_Deny["RATE LIMITED:\nReschedule Job + Alert Slack"]
    end

    RequestContext --> WindowCalc
    WindowCalc --> LuaScript
    L_Fetch --> L_Branch
    L_Branch -->|"Exceeded"| L_Deny
    L_Branch -->|"Under Limit"| L_Allow
    L_Allow --> Act_Allow
    L_Deny --> Act_Deny
```

---

## 💥 Server Crash & Restart Resilience Mindmap

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client Application
    participant Express as Express API Server
    participant Redis as Redis 7 (Append-Only File)
    participant Worker as BullMQ Worker Cluster
    participant SMTP as Ethereal SMTP

    Client->>Express: Schedules 500 emails for 10:00 AM tomorrow
    Express->>Redis: Dispatches jobs to Redis ZSET with delay = 14 hours
    Redis->>Redis: Persists commands to disk via AOF fsync
    Note over Express,Worker: ⚡ UNEXPECTED CRASH / POWER OUTAGE / DEPLOYMENT REBOOT ⚡
    Express--xExpress: Server process terminates
    Worker--xWorker: Workers terminate
    Note over Redis: Redis persists ZSET on disk. No memory or timer loss.
    Note over Express,Worker: 🟢 SYSTEM RESTARTS 🟢
    Express->>Redis: Express boots & reconnects
    Worker->>Redis: BullMQ Worker starts and subscribes to reachinbox-email-queue
    Redis-->>Worker: At 10:00 AM, delay timers expire; due jobs are emitted
    Worker->>SMTP: Emails sent reliably with inter-message delay
    Note over Client,SMTP: Result: Zero lost jobs, zero duplicated jobs!
```

---

## 🗄️ Database Entity Relationship (ER) & Table Mapping

```
User (1) ────────── (N) Sender
User (1) ────────── (N) email_data (Email model)
User (1) ────────── (1) SlackConnection
Sender (1) ──────── (N) email_data (Email model)
email_data (1) ──── (N) EmailRecipient
email_data (1) ──── (N) EmailJob
EmailRecipient (1) ─ (N) EmailJob
EmailJob (1) ────── (N) DeliveryAttempt
```

> **Note on Table Mapping**: The primary campaign model `Email` is mapped directly to table `email_data` in PostgreSQL via Prisma (`@@map("email_data")`), allowing direct SQL queries in pgAdmin (`SELECT * FROM "email_data";`) or ORM operations seamlessly.

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js 18+ & npm 10+
- PostgreSQL 15+ (Local or Docker) & Redis 7

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Sajamma-123/reach_inbox.git
cd reach_inbox
npm install
```

### 2. Configure Environment Variables
Configure `.env` at root:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# PostgreSQL connection (e.g. database REACH INbOX)
DATABASE_URL="postgresql://postgres:12345@localhost:5432/REACH%20INbOX?schema=public"

# Redis & BullMQ
REDIS_HOST=localhost
REDIS_PORT=6379

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Slack Notifications (OAuth or Incoming Webhook)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 3. Database Setup & Prisma Sync
```bash
npm run prisma:generate --workspace=backend
npm run prisma:push --workspace=backend
```

### 4. Run the Application
In two terminal windows:

**Backend Server & Worker:**
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



