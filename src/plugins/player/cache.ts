export const MAX_PLAYER_CACHE_SIZE_MIB = 256
export const DEFAULT_PLAYER_CACHE_SIZE_MIB = MAX_PLAYER_CACHE_SIZE_MIB

export const normalizePlayerCacheSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return 0
  return Math.min(Math.trunc(size), MAX_PLAYER_CACHE_SIZE_MIB)
}
