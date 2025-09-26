type CacheValue = string

export interface CacheClient {
  get(key: string): Promise<CacheValue | null>
  set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void>
  del(key: string | string[]): Promise<void>
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, { v: CacheValue; exp: number | null }>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.timer = setInterval(() => {
      const now = Date.now()
      for (const [k, { exp }] of this.store) {
        if (exp !== null && exp <= now) this.store.delete(k)
      }
    }, 30_000)
  }

  async get(key: string): Promise<CacheValue | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.exp !== null && entry.exp <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.v
  }

  async set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void> {
    const exp = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    this.store.set(key, { v: value, exp })
  }

  async del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      key.forEach((k) => this.store.delete(k))
    } else {
      this.store.delete(key)
    }
  }
}

export const cache: CacheClient = new InMemoryCache()

// Key helpers
export const cacheKeys = {
  tasksList: (params: Record<string, any>) => {
    const normalized = Object.keys(params)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(String(params[k]))}`)
      .join('&')
    return `tasks:list:${normalized}`
  },
  taskById: (id: string | number) => `tasks:id:${id}`,
}

