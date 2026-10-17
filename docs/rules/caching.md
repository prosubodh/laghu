# Caching Strategies & Event-Driven Invalidation

> **Core Mandate:** Enforce Cache Port semantics with namespaced keys, jittered TTLs, XFetch stampede defense, event-driven cache invalidation, and HTTP conditional caching (ETags / 304).

---

## 1. The YAGNI Gate: Database First, Caching Second

Caching introduces state duplication, cache invalidation race conditions, and memory overhead. **Caching is never a substitute for missing database indexes or poorly structured SQL queries.**

```mermaid
flowchart TD
    subgraph CachingGate["Caching YAGNI Gate"]
        B1["1. Simple Baseline (Day 1)<br/>• Relational queries with composite indexes<br/>• Request-scoped in-memory DataLoader batching to eliminate N+1<br/>• Zero distributed cache infrastructure (no Redis / Memcached)"]
        B2["2. Anti-Triggers (Forbidden)<br/>• Queries that are slow due to missing indexes or sequential scans<br/>• High-write / high-churn entities (write-heavy mutation streams)<br/>• Low-traffic administrative or internal operational queries"]
        B3["3. The Tipping Point (Graduation)<br/>• Query has been optimized with EXPLAIN ANALYZE, but p99 latency still exceeds SLA (> 100ms)<br/>• Read-to-write asymmetry on the entity exceeds 20:1<br/>• Downstream external API rate limits or third-party egress costs demand response caching"]
        B1 -->|Forbidden if missing indexes| B2
        B1 -->|Triggered by high read/write ratio| B3
    end
```

---

## 2. Abstract Cache Port & Cache-Aside Pattern

Application services interact with caching infrastructure through a swappable **Cache Port**, supporting any backend (Redis, Valkey, Dragonfly, KeyDB, Memcached, or in-memory LRU):

```mermaid
classDiagram
    class CachePort {
        <<interface>>
        +get(key: string) Optional~string~
        +set(key: string, value: string, ttlSeconds: number) void
        +delete(key: string) void
        +deletePattern(pattern: string) void
        +acquireLock(lockKey: string, ttlMs: number) boolean
    }
```

### Cache-Aside Implementation & Stampede Defense
```
function getCachedOrFetch(cachePort, key, ttlSeconds, fetcher):
  cachedValue = cachePort.get(key)
  if cachedValue is present:
    return deserialize(cachedValue)

  freshValue = fetcher()
  // Add 10% random jitter to TTL to prevent simultaneous expiration spikes
  jitter = randomInt(0, floor(ttlSeconds * 0.1))
  cachePort.set(key, serialize(freshValue), ttlSeconds + jitter)
  return freshValue
```

For high-throughput cache regeneration, employ the **XFetch algorithm** (probabilistic early expiration) to asynchronously warm the cache before hard expiry.

---

## 3. Key Namespacing & Event-Driven Invalidation

- **Universal Key Hierarchy**: Structure all keys hierarchically:
  `tenant:{tenantId}:{entity}:{entityId}` (e.g. `tenant:123:order:987`)
- **Event-Driven Invalidation**: Invalidate affected cache keys immediately upon emitting domain mutation events (`OrderUpdated`, `CustomerDeleted`) rather than waiting for passive TTL expiry.

---

## 4. HTTP Conditional Caching (ETags)

- Generate strong cryptographic `ETag` hashes (e.g. SHA-256 of representation or resource version) for cacheable `GET` endpoints.
- Return **`304 Not Modified`** with zero payload body when inbound requests present matching `If-None-Match` headers, preserving bandwidth and client CPU.
