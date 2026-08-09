# Nexus — Dispatch Engine

A NOC/incident-dispatch platform built around real message-broker routing and real observability tooling — not a reskin of a threat-correlation engine, a different problem entirely: allocating a scarce pool of field operatives against a live queue of work, under SLA pressure, in real time.

Live demo: https://nexus.eitikobata.com
Live metrics: https://grafana.eitikobata.com/public-dashboards/ffec62910dbb4793b73ad3583366d2d1?kiosk

On-screen the system is presented as **N-SEC**, the security division that operates Nexus Station's dispatch console — the interface you see, the field agent, the mission log. "Nexus" is the platform underneath: the repo, the infra, the domain. Every name (N-SEC, Directive, Operative) is original — nothing here is a real product or licensed IP.

## What it does

Missions ("Directives") arrive continuously, each requiring a specific skill and carrying a priority. Nexus routes each Directive to an available Operative with the matching skill through a real message broker — not a queue-in-a-table, an actual RabbitMQ topology with per-skill priority queues and automatic delayed retry. A Handler (the human operator) watches the whole pipeline live over WebSocket: the queue, who's working what, who's free, and can override the router's decision at any point — reassign a Directive by hand, or escalate its priority — without ever losing the automatic routing's original attempt from the record.

If a Directive sits in the queue too long, an SLA sweep escalates its priority automatically and republishes it. The whole pipeline — queue depth, wait-time percentiles, SLA breach rate, operative utilization — is exported as Prometheus metrics and visualized on a live Grafana dashboard, publicly viewable without login.

The live demo is self-sustaining: a background generator keeps creating realistic Directives, a simulated Operative layer accepts/works/completes (or occasionally fails) them, and an hourly self-heal reset wipes and reseeds the roster so the demo never grinds to a halt or drifts into a weird state.

## Architecture

```
┌──────────────────┐    generates     ┌──────────────────────────┐
│ Directive         │ ───────────────▶│   NestJS Backend           │
│ Generator (sim)    │                 │                            │
└──────────────────┘                 │  ┌──────────────────────┐  │
                                       │  │ Directives Service     │  │
                                       │  │ (create, tryAssign,     │  │
                                       │  │  manualReassign,        │  │
                                       │  │  escalate, finish)      │  │
                                       │  └──────────┬───────────┘  │
                                       │             │              │
                          publish      │             ▼              │      ┌───────────┐
                       ┌───────────────┼──▶ ┌──────────────────┐   │◀────▶│ RabbitMQ  │
                       │               │    │ Per-skill priority │   │      │ (shared)  │
                       │               │    │ queues + DLX retry │   │      └───────────┘
                       │               │    └─────────┬─────────┘   │
                       │               │              │             │
                       │               │              ▼             │
                       │               │    ┌──────────────────┐   │      ┌───────────┐
                       │               │    │ Dispatch Consumer  │───────▶│ PostgreSQL │
                       │               │    │ (matches operative,│   │      │ (shared)   │
                       │               │    │  optimistic lock)  │   │      └───────────┘
                       │               │    └─────────┬─────────┘   │
                       │               │              │             │
                       │               │              ▼             │
              ┌────────┴───────┐       │    ┌──────────────────┐   │
              │ Operative       │       │    │ SLA Sweep (10s)    │   │
              │ Simulator       │       │    │ escalates + gauges │   │
              │ (accept/work/   │       │    └─────────┬─────────┘   │
              │  finish)        │       │              │             │
              └────────────────┘       │              ▼             │
                                       │    ┌──────────────────┐   │      ┌───────────┐
                                       │    │ EventEmitter2       │───────▶│ Prometheus │
                                       │    │ (decoupled fan-out)  │   │      │ (shared)   │
                                       │    └────┬────────┬───────┘   │      └─────┬─────┘
                                       │         │        │           │            │
                                       │         ▼        ▼           │            ▼
                                       │  ┌───────────┐ ┌─────────┐   │      ┌───────────┐
                                       │  │ WebSocket   │ │ Metrics │   │      │  Grafana   │
                                       │  │ Gateway      │ │ Service │   │      │  (shared,  │
                                       │  └──────┬────┘ └─────────┘   │      │  public)   │
                                       └─────────┼──────────────────┘      └───────────┘
                                                  │ live push
                                                  ▼
                                       ┌──────────────────────────┐
                                       │   Next.js Frontend         │
                                       │  (Handler dashboard,       │
                                       │   directive board, roster) │
                                       └──────────────────────────┘
```

## Key features

- **Real message-broker routing, not a queue-in-a-table.** One RabbitMQ queue per skill, declared with `x-max-priority` so a Directive's priority maps to a native AMQP message priority — the broker itself, not application code, decides who gets seen first within a skill.
- **Delayed retry without a plugin.** A Directive that finds no available Operative isn't busy-looped or dropped — it's parked in a per-skill retry queue with a short TTL whose dead-letter exchange points back at the main queue. It reappears automatically a few seconds later, no delayed-message plugin required.
- **Race-safe assignment.** Both the automatic router and the Handler's manual override go through the same transactional optimistic-lock pattern (`updateMany` on a status condition, checked for `count === 0`), so two consumers — or a human and the router — can never double-book the same Operative. Losing a race returns a precise `409 Conflict`, not silent corruption.
- **Decoupled transport from domain.** Domain services (`DirectivesService`, `OperativesService`, `SlaService`) never know who's listening. They emit events through `EventEmitter2`; the WebSocket gateway and the Prometheus metrics service both subscribe independently. Neither can break the other.
- **Self-observing pipeline.** Every metric on the Grafana dashboard — queue depth by priority, wait-time percentiles (p50/p90/p99), SLA breach rate, operative utilization — describes the health of Nexus's *own* dispatch pipeline, not the behavior of an external entity. That's the deliberate difference from a SIEM/correlation engine: the thing being observed here is internal throughput under load, not a detected pattern of outside behavior.
- **Human override with a visible trail.** A Handler can reassign a Directive or escalate its priority by hand at any point. Both actions run through the same race-safe path as automatic routing, so a manual override never silently clobbers a routing decision that landed a moment earlier — it either succeeds cleanly or reports exactly why it couldn't.
- **Self-healing demo.** An hourly reset (and one immediately on cold start) wipes accumulated Directives/Assignments/SlaEvents and reseeds a fixed 12-operative roster with randomized skills and a few starting off-duty, so the public demo never sits empty, never grows unbounded, and never needs manual intervention.

## Technical decisions & trade-offs

**RabbitMQ priority queues over application-level sorting** — Directive priority could have been "sort by priority column when picking the next one to process." Using the broker's own `x-max-priority` instead means the routing guarantee lives at the transport layer, which is the whole point of choosing a real message broker for this project over reusing Redis Streams (the pattern already proven in Section 8½): it forces engagement with actual queueing semantics — exchanges, routing keys, delivery ordering — not just "a log with consumer groups."

**Per-skill queues + DLX-based retry over a single shared queue** — a single queue would need every consumer to filter for its own skill, wasting delivery attempts. Splitting by skill means a consumer only ever sees work it can actually take. The retry-via-dead-letter-exchange pattern (short TTL queue whose DLX points back at the main queue) avoids both a busy-loop and a dependency on the RabbitMQ delayed-message plugin, which isn't available on every managed broker.

**Optimistic locking via `updateMany` + count check, not row locks** — Postgres row-level locking (`SELECT ... FOR UPDATE`) would also solve the double-booking race, but ties the guarantee to holding a transaction open across the lock. `updateMany` with a status precondition is simpler to reason about, works identically whether the caller is the automatic consumer or the manual-override endpoint, and fails fast with a count of zero rather than blocking.

**EventEmitter2 for internal fan-out instead of direct service calls** — `DirectivesService` could have injected the WebSocket gateway and the metrics service directly and called them after every state change. Emitting domain events instead means adding a third listener (say, an audit log, later) never touches `DirectivesService` at all — and it mirrors the same ingestion/correlation separation principle from Section 8½, applied to a different seam.

**SLA gauge and operative-utilization gauge refreshed on a fixed 10s tick, not on every state change** — the tempting approach is to recompute a gauge every time an Operative's status changes (there are at least four call sites: auto-routing, manual reassign, accept, finish). Chasing every call site is fragile — miss one and the gauge silently goes stale, which is exactly what happened during initial testing here. Recomputing on a single periodic tick instead means correctness doesn't depend on remembering to wire a new call site every time the code changes elsewhere.

**Runtime placeholder substitution for `NEXT_PUBLIC_*` env vars** — Next.js inlines `NEXT_PUBLIC_*` variables into the client bundle at *build* time, but this project's deployment platform only injects environment variables at container *runtime*, with no separate build-arg mechanism exposed for custom Dockerfiles. The fix: bake in unique placeholder tokens at build time, then swap them for the real runtime values via a `sed`-based entrypoint script that runs once, immediately before the server starts. It's a known workaround for this exact category of platform constraint, not a novel hack — documented here because it's the kind of failure (a production site trying to reach `localhost` from a visitor's own browser) that's invisible until you actually deploy and click around.

## Known limitations (intentional, not overlooked)

- **No authentication on the Handler console or the override endpoints** (`reassign`, `escalate`, operative status). Deferred deliberately, same reasoning as Section 8½'s single-role decision: RBAC is meaningful once there's more than one kind of Handler to tell apart, not before.
- **Single consumer per skill queue** — no horizontal scaling story for the dispatch consumer yet. Fine at demo scale; a production version would need consumer-group partitioning per skill.
- **Fixed skill set, hardcoded at bootstrap** — skills aren't a dynamic, admin-managed resource; the RabbitMQ topology is asserted for a known list at startup. Adding a skill today means a code change, not a UI action.
- **No automated tests yet.** The system was validated end-to-end manually — local, then against production infra piece by piece (RabbitMQ alone, then Prisma, then metrics, then the frontend) — which is what actually caught every real bug documented above. A test suite is the natural next investment.

## Stack

| Layer | Tech |
|---|---|
| Backend | NestJS, TypeScript, Prisma |
| Messaging | RabbitMQ (priority queues, DLX-based delayed retry) |
| Real-time | Socket.IO (WebSocket) |
| Database | PostgreSQL (shared instance) |
| Observability | Prometheus + Grafana (shared instances, public dashboard) |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, TanStack Query |
| Infra | Docker (multi-stage builds), EasyPanel, shared services across projects |

## Running locally

Requires Docker and Docker Compose.

```bash
git clone https://github.com/eitikobata/nexus-dispatch.git
cd nexus-dispatch

# spin up local Postgres + RabbitMQ + Prometheus + Grafana
cd infra
docker compose -f docker-compose.dev.yml up -d
cd ..

# backend
cd backend
cp .env.example .env   # point DATABASE_URL / RABBITMQ_URL at the local infra above
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev

# frontend (separate terminal)
cd ../frontend
cp .env.example .env   # point NEXT_PUBLIC_API_URL / WS_URL at the local backend
npm install
npm run dev
```

Frontend: http://localhost:3001
Backend: http://localhost:3000
RabbitMQ management UI: http://localhost:15672
Grafana: http://localhost:3001 *(local Grafana port collides with the frontend dev port — remap one when running both together)*

Minimum environment variables (backend), set in `backend/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RABBITMQ_URL` | RabbitMQ connection string |
| `FRONTEND_URL` | Comma-separated allowed CORS origins (production + local dev can coexist) |
| `DIRECTIVE_GEN_MIN_INTERVAL_SEC` / `MAX` | Simulated Directive arrival rate |
| `OPERATIVE_ABORT_CHANCE_PCT` | Chance a simulated Operative loses contact mid-mission |
| `SLA_BREACH_THRESHOLD_SEC` | Queue wait time before priority auto-escalates |

Frontend (`frontend/.env`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_GRAFANA_URL` (optional — the "Live metrics" header link only renders when set).

## Project structure

```
nexus-dispatch/
├── backend/          # NestJS API — directives, operatives, RabbitMQ, SLA sweep, metrics, WebSocket
│   ├── src/
│   └── prisma/         # schema + migrations
├── frontend/          # Next.js Handler dashboard
│   └── src/
├── infra/             # local-dev-only docker-compose + Prometheus config (never deployed)
├── backend/Dockerfile
├── frontend/Dockerfile
└── frontend/docker-entrypoint.sh
```

`infra/` never ships to production — Postgres, RabbitMQ, Prometheus, and Grafana all run as separate, shared EasyPanel services in production, reused across every project in this portfolio rather than provisioned per-project.

## Author

Built by Eiti Kobata as a portfolio project. Every agent, station, and division name (N-SEC, Nexus, Directive, Operative) is original — no licensed characters, IP, or trademarks.