# Scaling ChatBridge

## Purpose

This document describes how ChatBridge should evolve if we need to support a scenario where roughly 200,000 users are on the platform at the same time.

The goal is not to optimize prematurely for an unrealistic benchmark. The goal is to understand:

- what "200k concurrent users" really means for this product
- which parts of the current architecture would fail first
- what we can improve immediately
- what architectural changes are required before large-scale launch

## Framing The Problem

The phrase "200k users at once" can mean very different things operationally. For ChatBridge, we should think in terms of traffic classes instead of one big number.

### Traffic Classes

1. Passive users
   Users with the web app open, but not actively launching apps or sending tool requests.

2. Interactive app users
   Users actively opening embedded apps, restoring app sessions, and saving app state.

3. Tool users
   Users whose apps are invoking bridge-mediated tools or authenticated third-party APIs.

4. LLM-heavy users
   Users actively sending chat prompts that trigger model calls, routing, summarization, or follow-up reasoning.

These classes have very different infrastructure costs.

If 200,000 users simply load the UI and browse, the main challenge is static delivery and lightweight API fan-out.

If 200,000 users are all actively invoking tools or model requests at the same time, the limiting factor becomes downstream API capacity, queueing, cost, and rate limits, not just the bridge server.

## Current Architecture Snapshot

Today, the bridge runtime is a single Express app with database-backed registry and session routes.

Relevant code paths:

- Bridge server entrypoint: `bridge/src/server.ts`
- Database connection pool: `bridge/src/db/connection.ts`
- Registry and session routes: `bridge/src/admin/registryRoutes.ts`
- Tool execution path: `bridge/src/orchestration/ToolMediator.ts`
- Frontend registry polling: `chatbox/src/renderer/features/chatbridge/hooks/useBridgeApps.ts`
- Frontend app session state saves: `chatbox/src/renderer/features/chatbridge/components/EmbeddedBridgeSurface.tsx`
- Development app proxy: `bridge/src/admin/appProxyRoutes.ts`

## What Breaks First In The Current Design

### 1. Single-process bridge runtime

The bridge currently runs as a single Node/Express process. That is fine for development and early staging, but not for large-scale concurrent traffic.

Implications:

- one process failure affects all traffic on that instance
- no horizontal scaling strategy is defined in the current runtime
- burst handling is limited by one process and one host

### 2. Tiny Postgres connection pool

The Postgres pool is currently configured with `max: 10`.

That is a normal development setting, but under real concurrency it means:

- queued DB work appears quickly
- latency spikes under burst traffic
- hot routes become DB-bound before CPU is fully used

### 3. Registry polling fan-out

The frontend polls `/api/registry/active` every 60 seconds.

At 200,000 open clients, that becomes roughly:

- 200,000 requests per minute
- about 3,333 requests per second

That is too much load for a DB-backed registry endpoint that changes infrequently.

### 4. Session state write amplification

Embedded apps can emit `app:save-state`, and the frontend forwards that directly to the bridge for persistence.

The current implementation comments that this is debounced, but it is effectively fire-and-forget per event. Under heavy interaction, this creates unnecessary write pressure on the bridge and database.

### 5. Tool-path synchronous database work

Each tool request currently does multiple synchronous operations:

- registry lookup
- app version lookup
- tool validation
- tool execution
- tool execution logging

This makes the tool path expensive under concurrency, especially if many tool calls are short-lived and frequent.

### 6. Bridge-side app proxy is not a production scaling path

The app proxy route fetches remote app assets through the bridge. Even though it is intended for development, it is worth being explicit: if that pattern were used in production, the bridge would become a bottleneck for static/app asset delivery.

### 7. Downstream providers become the real bottleneck

For authenticated apps, external APIs and OAuth providers are a scaling boundary.

For LLM-backed chat, model providers become the largest bottleneck in:

- cost
- latency
- rate limiting
- quota exhaustion
- failure propagation

This means "scale ChatBridge" must include backpressure and fallback strategies for downstream services.

## Scaling Principles

Before proposing infrastructure, we should lock in a few design principles.

### 1. Keep the bridge focused on dynamic coordination

The bridge should not serve work that a CDN can serve better.

That means:

- static UI assets should be CDN-backed
- app bundles should be hosted separately or through CDN-backed origins
- rarely changing registry metadata should be cached aggressively

### 2. Make hot paths stateless

The bridge should be horizontally scalable. Any request that requires sticky in-memory state will make scale harder.

State needed across instances should live in shared infrastructure such as:

- Postgres for durable records
- Redis for hot session state, locks, and caching
- queues for slow or retryable work

### 3. Move expensive work off the synchronous request path

A user-facing request should do only the minimum necessary work to respond quickly.

Slow operations should be:

- queued
- batched
- retried asynchronously
- reduced through caching

### 4. Design for degraded operation

At large scale, some dependency is always slow or failing. The platform must degrade safely.

Examples:

- registry cache stale but usable
- app state temporarily not persisted, but UI still functions
- tool execution delayed and surfaced to the user as pending
- third-party provider unavailable, but the chat shell remains healthy

## Target High-Level Architecture

For large-scale operation, ChatBridge should separate into clearly different infrastructure roles.

### Layer 1: Static delivery

- Chatbox web frontend served from CDN
- Embedded app assets served from CDN or dedicated app origins
- Cacheable registry snapshots distributed close to users

### Layer 2: Edge and load balancing

- global CDN and edge cache for public GET traffic
- load balancer in front of bridge API replicas
- WAF and rate limiting at the edge

### Layer 3: Stateless bridge API

- multiple bridge instances
- no instance-local session authority
- shared cache and persistence behind the API tier

Responsibilities:

- auth/session token verification
- app launch coordination
- tool request acceptance
- session state coordination
- version and policy checks

### Layer 4: Fast shared state

- Redis or equivalent for hot session state
- distributed locks where needed
- request deduplication and short-lived caching
- rate-limit counters and quota enforcement

### Layer 5: Durable system of record

- Postgres for durable app sessions, approvals, audit history, and important state snapshots
- async writes where immediate durability is not required
- read replicas if reporting or read-heavy APIs grow

### Layer 6: Async workers and queues

- job queue for non-immediate logging and analytics
- worker tier for slow tool executions
- worker tier for retries and backoff against third-party APIs

### Layer 7: External providers

- LLM providers
- OAuth providers
- third-party APIs such as Spotify or weather providers

This layer must be protected by:

- circuit breakers
- timeouts
- retries with limits
- per-provider rate limiting
- fallback behavior

## Step-By-Step Scaling Plan

## Phase 0: Measure Before Rebuilding

Before major changes, we need visibility.

Add metrics for:

- requests per route
- p50, p95, and p99 latency per route
- Postgres query latency
- connection pool saturation
- session state write rate
- tool execution rate and duration
- downstream API failure rate
- cache hit rate
- active app sessions

Without this, we will guess incorrectly about the real bottleneck.

## Phase 1: Remove Obvious Waste

These changes should happen first because they reduce load without requiring a major redesign.

### 1. Cache the registry aggressively

`/api/registry/active` is a strong caching candidate because the registry changes far less often than users poll it.

Options:

- in-memory cache inside bridge with short TTL
- Redis-backed shared cache
- publish a versioned registry snapshot as static JSON

Best practical direction:

- serve a cached registry snapshot
- return `ETag` or version metadata
- replace blind 60-second polling with a much longer TTL plus manual refresh or version checks

### 2. Debounce and checkpoint session state

Do not write every tiny UI interaction to Postgres.

Instead:

- debounce state saves client-side
- save on meaningful checkpoints
- save on close, completion, pause, or periodic heartbeat
- optionally store the latest hot state in Redis and flush durable snapshots less often

### 3. Reduce synchronous tool-path logging

Tool analytics should not block user response.

Change logging from inline DB writes to:

- buffered async emission
- queue-backed writes
- batch inserts

### 4. Keep app assets off the bridge

Do not proxy embedded app assets through the bridge in production.

Apps should be served from dedicated origins or CDN-backed paths.

## Phase 2: Make The Bridge Horizontally Scalable

Once obvious waste is removed, the next step is making the bridge safe to replicate.

### 1. Run multiple bridge replicas

Put stateless bridge instances behind a load balancer.

Requirements:

- no critical in-memory-only state
- shared session and cache backing services
- consistent auth verification across instances

### 2. Introduce Redis for hot coordination

Redis should be used for:

- hot app session state
- registry cache
- short-lived auth/session metadata
- distributed rate limiting
- deduplication of repeated launch requests

### 3. Keep Postgres as the durable record

Postgres remains the source of truth for:

- app registry approvals
- version pinning
- review history
- durable session snapshots
- audit trails

But it should not be the only place hot session traffic lands on every interaction.

## Phase 3: Protect Expensive Dependencies

At this point, our internal services may be fine, but downstream providers can still collapse the user experience.

### 1. Put quotas and rate limits around tool execution

We need:

- per-user quotas
- per-app quotas
- per-provider quotas
- burst limits

This prevents one app or cohort from starving the rest of the system.

### 2. Queue slow tool work

Some tool calls can remain synchronous, but slow calls should become accepted-then-processed jobs.

Pattern:

1. Accept request
2. Create job
3. Return pending status
4. Worker executes
5. Client polls or subscribes for completion

### 3. Add circuit breakers and fallbacks

If Spotify, weather, or LLM providers degrade:

- fail fast
- stop retry storms
- show a recoverable UI state
- keep the chat shell available

## Phase 4: Prepare For Very Large Concurrency

This phase matters only when real usage and load tests justify it.

### 1. Region and edge strategy

If the product becomes geographically distributed:

- serve static assets globally from CDN
- place bridge replicas in one or more regions
- keep latency-sensitive reads close to users where possible

### 2. Read/write split where justified

If registry, reporting, or session inspection become read-heavy:

- use read replicas for safe fan-out
- keep writes on the primary
- avoid stale-read issues for correctness-sensitive paths

### 3. Event-driven observability and analytics

Large-scale systems should emit events rather than making every analytical concern a transactional database write.

Examples:

- tool execution event stream
- app lifecycle event stream
- provider health events

## Practical Capacity Model

To think clearly, we should model concurrency in layers.

Example scenario:

- 200,000 users have the app open
- 20,000 are actively interacting in a 1-minute window
- 5,000 have embedded apps open
- 1,000 are triggering tool requests in the same minute
- 300 are hitting expensive third-party or LLM-backed operations simultaneously

This is much more realistic than assuming all 200,000 users stress every subsystem equally.

The architecture should be designed so:

- passive presence is cheap
- app embedding is moderately expensive
- tool execution is controlled
- LLM or external API usage is heavily governed

## Specific Recommendations For This Repo

These are the most important next moves given the current codebase.

### Highest-priority changes

1. Cache `/api/registry/active`
2. Replace constant frontend polling with long-lived cache semantics
3. Debounce `app:save-state` and persist checkpoints instead of every event
4. Move tool execution logging out of the request path
5. Introduce Redis for hot session and cache workloads
6. Run the bridge as multiple stateless replicas
7. Keep app bundles off the bridge in production

### Near-term implementation notes

- `bridge/src/admin/registryRoutes.ts`
  Add caching and version metadata around active registry reads.

- `chatbox/src/renderer/features/chatbridge/hooks/useBridgeApps.ts`
  Reduce polling frequency and prefer cache-aware fetch behavior.

- `chatbox/src/renderer/features/chatbridge/components/EmbeddedBridgeSurface.tsx`
  Add true debounce/checkpoint logic for state persistence.

- `bridge/src/orchestration/ToolMediator.ts`
  Move execution logging to an async path and cache manifest/registry lookups where safe.

- `bridge/src/db/connection.ts`
  Revisit pool sizing only after route caching and write reduction are in place. Bigger pools alone do not solve scaling.

## What Not To Do

There are a few tempting but misleading scaling moves we should avoid.

### 1. Do not start by just increasing Postgres pool size

That can shift the bottleneck, but it does not fix wasteful traffic patterns.

### 2. Do not proxy static app assets through the bridge

That turns a dynamic coordination service into an avoidable bandwidth bottleneck.

### 3. Do not store all hot interaction state only in the bridge process

That breaks horizontal scaling and failover.

### 4. Do not make every event a durable synchronous transaction

Not every state change deserves immediate durable storage.

## Load Testing Plan

We should validate each phase with realistic traffic mixes.

### Stage 1

- thousands of passive clients
- registry fetches only
- confirm cache effectiveness

### Stage 2

- thousands of app launches and resumes
- moderate state-save traffic
- validate bridge and Redis behavior

### Stage 3

- realistic tool request mix
- downstream provider throttling
- failure injection and recovery

### Stage 4

- burst tests
- soak tests
- rolling deploy during active traffic

Success criteria should include:

- acceptable p95 latency
- no DB saturation
- no runaway retry storms
- controlled degradation under downstream failures

## Conclusion

ChatBridge can be designed to support very large concurrency, but not by treating every user action as a synchronous bridge-to-Postgres operation.

The path to scale is:

1. make passive traffic cheap
2. make hot paths stateless
3. move noisy writes and slow work off the request path
4. protect external dependencies with rate limits, queues, and fallbacks
5. validate each step with measurements and load tests

For this repo, the right first moves are not exotic. They are:

- cache the registry
- reduce polling
- debounce state persistence
- async tool logging
- introduce shared cache infrastructure before chasing bigger scale numbers
