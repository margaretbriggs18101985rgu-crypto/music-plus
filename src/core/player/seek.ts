interface SeekDependencies {
  trackId: () => string | null
  seek: (seconds: number) => Promise<void>
  position: () => Promise<number>
  commit: (seconds: number) => void
  failed: (error: unknown) => void
}

/** Serialize native seeks; only the latest request may publish a confirmed position. */
export const createPlaybackSeeker = (dependencies: SeekDependencies) => {
  let revision = 0
  let running = false
  let pending: { time: number, id: string, revision: number } | null = null
  const drain = async() => {
    if (running) return
    running = true
    try {
      while (pending) {
        const request = pending
        pending = null
        if (request.id != dependencies.trackId()) continue
        try {
          await dependencies.seek(request.time)
          const position = await dependencies.position()
          if (request.revision == revision && request.id == dependencies.trackId() && Number.isFinite(position)) {
            dependencies.commit(Math.max(0, position))
          }
        } catch (error) {
          if (request.revision != revision || request.id != dependencies.trackId()) continue
          dependencies.failed(error)
          // A rejected seek must leave both clocks at the actual audio position.
          const position = await dependencies.position().catch(() => NaN)
          if (request.revision == revision && request.id == dependencies.trackId() && Number.isFinite(position)) {
            dependencies.commit(Math.max(0, position))
          }
        }
      }
    } finally { running = false }
  }
  return {
    get revision() { return revision },
    get busy() { return running || pending != null },
    invalidate() { revision++; pending = null },
    request(time: number) {
      const id = dependencies.trackId()
      if (!id || !Number.isFinite(time)) return
      pending = { time: Math.max(0, time), id, revision: ++revision }
      void drain()
    },
  }
}
