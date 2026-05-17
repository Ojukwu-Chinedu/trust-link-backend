# ⚙️ TrustLink — Backend API

> **The oracle layer between the physical world and the blockchain.**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square)](https://prisma.io)
[![Stellar](https://img.shields.io/badge/Stellar-Horizon%20API-7B68EE?style=flat-square&logo=stellar)](https://stellar.org)
[![Stellar Wave](https://img.shields.io/badge/Stellar%20Wave-Open%20Issues-blue?style=flat-square)](https://www.drips.network/wave/stellar)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

---

## 📖 Overview

The TrustLink Backend is the **automated oracle** of the TrustLink protocol. While the Soroban smart contract is the trustless vault, the backend is the bridge between the physical world (shipping carriers, email inboxes, SMS alerts) and the blockchain.

Its core responsibilities:

1. **🔭 Watch** the Stellar blockchain for escrow state changes (`Funded`, `Shipped`, `Disputed`)
2. **📡 Poll** logistics APIs to track real-world delivery status
3. **✍️ Sign** auto-release transactions when the delivery window closes without a dispute
4. **📣 Notify** buyers and vendors at every meaningful state transition via Email/SMS
5. **🧑‍⚖️ Route** disputes to an admin dashboard for manual review

---

## 🏗️ Architecture

```
                              ┌──────────────────────┐
                              │   Stellar Network     │
                              │  (Horizon / Soroban)  │
                              └──────────┬───────────┘
                                         │ Event Stream
                                         ▼
┌────────────────────────────────────────────────────────────┐
│                    TrustLink Backend                        │
│                                                            │
│  ┌────────────────┐   ┌──────────────────┐                 │
│  │  Blockchain    │   │  Delivery Oracle  │                 │
│  │  Listener      │   │  (Cron Worker)    │                 │
│  │  (SSE Stream)  │   │                  │                 │
│  └───────┬────────┘   └────────┬─────────┘                 │
│          │                     │                           │
│          ▼                     ▼                           │
│  ┌──────────────────────────────────────────┐              │
│  │           Escrow Service                 │              │
│  │  (Core business logic + state sync)      │              │
│  └──────────────────┬───────────────────────┘              │
│                     │                                      │
│        ┌────────────┼────────────┐                         │
│        ▼            ▼            ▼                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐               │
│  │ Database │ │Notifica- │ │  Auto-Release│               │
│  │(Postgres)│ │tion Svc  │ │  Signer      │               │
│  │  Prisma  │ │(Twilio / │ │  (Admin Key) │               │
│  └──────────┘ │SendGrid) │ └──────────────┘               │
│               └──────────┘                                 │
│                                                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                  REST API (NestJS)                    │ │
│  │    /escrow  /disputes  /webhooks  /admin              │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 API Reference

### Escrow Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/escrow` | Vendor JWT | Create an escrow record and generate a shareable link |
| `GET` | `/escrow/:id` | Public | Get escrow details and current state |
| `GET` | `/escrow/:id/tracking` | Public | Get live shipment tracking data |
| `PATCH` | `/escrow/:id/ship` | Vendor JWT | Update tracking ID after shipment |
| `GET` | `/vendor/escrows` | Vendor JWT | List all escrows for the authenticated vendor |

### Dispute Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/dispute` | Buyer JWT | Open a dispute with evidence upload |
| `GET` | `/dispute/:id` | Buyer/Admin | Get dispute details and status |
| `PATCH` | `/dispute/:id/resolve` | Admin JWT | Resolve dispute (release or refund) |
| `GET` | `/admin/disputes` | Admin JWT | List all open disputes |

### Webhook Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/webhooks/logistics` | HMAC Sig | Receive delivery status updates from logistics APIs |
| `POST` | `/webhooks/stellar` | Internal | Process Stellar Horizon event stream callbacks |

### Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/challenge` | Issue a Stellar SEP-10 challenge transaction |
| `POST` | `/auth/verify` | Verify signed challenge and issue JWT |

> Authentication uses **Stellar SEP-10** (Web Authentication) — vendors sign a challenge transaction with their Stellar keypair. No passwords.

---

## 🗄️ Database Schema

```prisma
model Escrow {
  id              String        @id @default(cuid())
  contractId      String        @unique  // On-chain escrow ID
  vendorAddress   String
  buyerAddress    String?
  tokenAddress    String
  amountRaw       BigInt
  state           EscrowState   @default(PENDING)
  trackingId      String?
  shippingWindow  Int           // seconds
  createdAt       DateTime      @default(now())
  shippedAt       DateTime?
  deliveredAt     DateTime?
  completedAt     DateTime?
  dispute         Dispute?
  notifications   Notification[]
}

model Dispute {
  id            String          @id @default(cuid())
  escrowId      String          @unique
  escrow        Escrow          @relation(fields: [escrowId], references: [id])
  reason        String
  evidenceUrls  String[]
  status        DisputeStatus   @default(OPEN)
  resolution    String?
  resolvedBy    String?
  createdAt     DateTime        @default(now())
  resolvedAt    DateTime?
}

model Notification {
  id          String    @id @default(cuid())
  escrowId    String
  escrow      Escrow    @relation(fields: [escrowId], references: [id])
  type        String    // EMAIL | SMS
  recipient   String
  event       String    // FUNDED | SHIPPED | DELIVERED | DISPUTED | COMPLETED
  sentAt      DateTime  @default(now())
  status      String    // SENT | FAILED
}

enum EscrowState {
  PENDING
  FUNDED
  SHIPPED
  COMPLETED
  DISPUTED
  REFUNDED
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
}
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js `20+`
- PostgreSQL `15+`
- A funded Stellar **testnet** keypair (for the system auto-release signer)
- API keys for Twilio (SMS) and SendGrid (email)
- Terminal Africa API key (or GIGL for Nigerian logistics)

### Environment Variables

Create a `.env` file:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trustlink"

# Stellar
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=C...                      # Your deployed contract ID
SYSTEM_SIGNER_SECRET=S...             # System keypair for auto-release signing
USDC_CONTRACT_ID=C...

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Notifications
SENDGRID_API_KEY=SG...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

# Logistics
TERMINAL_AFRICA_API_KEY=...
TERMINAL_AFRICA_BASE_URL=https://api.terminal.africa/v1

# Storage (for dispute evidence uploads)
AWS_S3_BUCKET=trustlink-evidence
AWS_REGION=af-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/your-org/trustlink-backend
cd trustlink-backend

# Install dependencies
npm install

# Set up the database
npx prisma migrate dev --name init
npx prisma generate

# Start in development mode (with hot reload)
npm run start:dev
```

The API will be available at `http://localhost:3001`.

### API Documentation (Swagger)

When running in development, Swagger UI is available at:

```
http://localhost:3001/api/docs
```

---

## 🔭 Blockchain Listener

The backend maintains a persistent **Server-Sent Events (SSE)** connection to the Stellar Horizon API, streaming transaction events for the TrustLink contract address.

```typescript
// Simplified: src/stellar/blockchain-listener.service.ts
const eventStream = horizon
  .transactions()
  .forAccount(CONTRACT_ID)
  .cursor("now")
  .stream({
    onmessage: async (tx) => {
      const events = await parseSorobanEvents(tx);
      for (const event of events) {
        await escrowService.syncStateFromChain(event);
      }
    },
  });
```

When a `Funded` event is detected, the backend:
1. Updates the database state to `FUNDED`
2. Starts the delivery timer
3. Sends a "Payment Received" notification to the vendor
4. Registers the tracking ID with the logistics API poller

---

## ⏰ Auto-Release Worker

A cron job runs every **5 minutes** and checks for escrows in the `SHIPPED` state where:
- Confirmed delivery timestamp exists, AND
- 48 hours have elapsed, AND
- No active dispute has been raised

When conditions are met, the system keypair signs and submits an `auto_release` transaction to the Soroban contract.

```typescript
// src/workers/auto-release.worker.ts
@Cron(CronExpression.EVERY_5_MINUTES)
async checkAutoReleaseEligible() {
  const eligible = await this.prisma.escrow.findMany({
    where: {
      state: "SHIPPED",
      deliveredAt: { lte: subHours(new Date(), 48) },
      dispute: null,
    },
  });

  for (const escrow of eligible) {
    await this.stellarService.submitAutoRelease(escrow.contractId);
  }
}
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests (requires a running DB)
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage report
npm run test:cov
```

### Test Coverage Goals

- ✅ Escrow creation and link generation
- ✅ SEP-10 auth challenge/verify flow
- ✅ Blockchain event parsing and DB sync
- ✅ Auto-release eligibility logic
- ✅ Dispute creation and evidence upload
- ✅ Notification dispatch (mocked Twilio/SendGrid)
- [ ] Logistics webhook handler
- [ ] Admin dispute resolution flow
- [ ] Rate limiting and abuse prevention

---

## 📁 Project Structure

```
trustlink-backend/
├── src/
│   ├── app.module.ts               # Root NestJS module
│   ├── escrow/                     # Escrow module
│   │   ├── escrow.controller.ts
│   │   ├── escrow.service.ts
│   │   └── dto/
│   ├── dispute/                    # Dispute module
│   ├── auth/                       # SEP-10 authentication
│   ├── notifications/              # Email & SMS service
│   ├── stellar/                    # Horizon & Soroban SDK layer
│   │   ├── blockchain-listener.service.ts
│   │   ├── contract.service.ts
│   │   └── horizon.service.ts
│   ├── logistics/                  # Terminal Africa / GIGL
│   ├── workers/                    # Background jobs (auto-release, polling)
│   └── admin/                      # Admin panel API
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
└── README.md
```

---

## 🌊 Contributing via Stellar Wave

This repository is part of the **[Stellar Wave Program](https://www.drips.network/wave/stellar)**. Contribute, earn points, and get real rewards from the Stellar Development Foundation's funding pool.

### Good First Issues

Look for [`good first issue`](../../issues?q=label%3A%22good+first+issue%22) and [`Stellar Wave`](../../issues?q=label%3A%22Stellar+Wave%22) labels.

**Beginner-friendly tasks:**
- Add missing Swagger `@ApiProperty` decorators to DTOs
- Write unit tests for the `NotificationService`
- Add a `GET /health` endpoint with DB and Stellar connectivity checks
- Improve error messages in the dispute creation flow
- Add input sanitization to evidence upload file types

**Medium complexity tasks:**
- Implement rate limiting on public escrow endpoints
- Add idempotency keys to prevent duplicate `auto_release` submissions
- Build the webhook handler for Terminal Africa delivery events
- Write integration tests for the SEP-10 auth flow

**High complexity tasks:**
- Implement a retry queue (BullMQ) for failed Stellar transactions
- Add support for GIGL as a second logistics provider
- Build the admin analytics endpoint (total volume, fee revenue, dispute rate)
- Implement contract event replay on backend restart (catch up missed events)

### Contribution Workflow

```bash
# 1. Fork and branch
git checkout -b feat/your-feature-name

# 2. Make changes — follow NestJS conventions

# 3. Run tests and linter
npm run test && npm run lint

# 4. Commit with conventional commits
git commit -m "feat(escrow): add idempotency key to auto-release worker"

# 5. Open a PR linked to the issue
```

---

## 🗺️ Roadmap

- [x] Core escrow REST API
- [x] SEP-10 wallet authentication
- [x] Blockchain event listener
- [x] Auto-release cron worker
- [x] Notification service (Email/SMS)
- [ ] Logistics webhook handler (Terminal Africa)
- [ ] Admin dispute resolution API
- [ ] BullMQ retry queue for failed transactions
- [ ] Vendor analytics endpoint
- [ ] API rate limiting & abuse protection
- [ ] Multi-region deployment (West Africa latency optimization)
- [ ] OpenTelemetry tracing

---

## 📜 License

MIT © TrustLink Contributors

---

> Built on Node.js · Powered by Stellar Horizon & Soroban · Part of the Stellar Wave open-source ecosystem.
