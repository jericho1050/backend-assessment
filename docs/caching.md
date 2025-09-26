## Caching Strategy (Task 6.1)

### Endpoints Selected
- GET `/api/tasks`: high read rate; supports pagination, filters, sort.
- GET `/api/tasks/:id`: frequent single-item lookups.
- (Future) `/api/auth/me`: short-lived cache possible per user (not implemented here).

### Mechanisms
- In-memory TTL cache via `src/utils/cache.ts` (pluggable interface for Redis later).
- HTTP headers: `Cache-Control` and `X-Cache` hit/miss diagnostics.

### Keys & TTLs
- `tasks:list:<sorted-query>` — 30s TTL.
- `tasks:id:<id>` — 60s TTL.

Key construction for lists sorts query params and encodes values for stable keys.

### Invalidation
- On task update/delete: delete the item key and repopulate on read.
- On create: rely on short TTL for list invalidation (simple strategy). For Redis, prefer tagging per filter set and bulk invalidation.

### Serialization
- JSON stringify values before cache set; routes use `c.body(payload)` to avoid double serialization.

### Metrics & Monitoring
- `X-Cache` header signals HIT/MISS. Extend with counters and logging to measure hit ratio.

### Graceful Degradation
- If cache fails, routes continue to DB and respond normally.

### Redis Adapter (Future)
- Implement `CacheClient` with Redis and swap via DI/env flag. Use `EX` for TTLs and `DEL` for invalidation; consider tags using Redis sets or keyspace notifications.

