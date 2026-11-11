/**
 * Atomic Redis Rate Limiting Script
 * KEYS[1]: Rate limit key, e.g., "ratelimit:sender:<senderId>:hour:<hourTimestamp>"
 * ARGV[1]: Hourly limit (integer)
 * ARGV[2]: Window TTL in seconds (e.g., 3600)
 *
 * Returns array: [isAllowed (0 or 1), currentCount, ttlRemaining]
 */
export const ATOMIC_RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = tonumber(redis.call('get', key) or "0")

if current >= limit then
    local remainingTtl = redis.call('ttl', key)
    if remainingTtl < 0 then
        remainingTtl = ttl
        redis.call('expire', key, ttl)
    end
    return {0, current, remainingTtl}
else
    local newCount = redis.call('incr', key)
    if newCount == 1 then
        redis.call('expire', key, ttl)
    end
    local remainingTtl = redis.call('ttl', key)
    return {1, newCount, remainingTtl}
end
`;
