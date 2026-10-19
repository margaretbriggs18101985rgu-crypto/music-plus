export interface LyricWordTiming {
  start: number
  end: number
  startTime: number
  endTime: number
}

/** LX's providers already normalize QRC/KRC/YRC to <relativeMs,durationMs>. */
export const matchLyricWords = (lines: ReadonlyArray<{ time: number, text: string }>, lyric = ''): LyricWordTiming[][] => {
  const timed = new Map<number, { text: string, words: LyricWordTiming[] }>()
  const offset = Number(/\[offset:\s*(-?\d+)\]/i.exec(lyric)?.[1] ?? 0)
  for (const raw of lyric.split(/\r?\n/)) {
    const timestamp = /^\[(\d+):(\d+(?:\.\d+)?)\]/.exec(raw.trim())
    if (!timestamp) continue
    const time = Math.round((Number(timestamp[1]) * 60 + Number(timestamp[2])) * 1000)
    const body = raw.trim().slice(timestamp[0].length)
    const tokens = [...body.matchAll(/<(\d+),(\d+)>/g)]
    if (!tokens.length) continue
    let text = body.slice(0, tokens[0].index)
    const words: LyricWordTiming[] = []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const word = body.slice(token.index + token[0].length, tokens[i + 1]?.index ?? body.length)
      const start = text.length
      text += word
      const startTime = time + Number(token[1]) - offset
      const endTime = startTime + Number(token[2])
      if (word && Number.isFinite(endTime) && endTime > startTime) words.push({ start, end: text.length, startTime, endTime })
    }
    // lrc-file-parser trims each displayed sentence. Keep UTF-16 offsets, as
    // Compose TextLayoutResult uses the same indexing (including emoji).
    const leading = text.length - text.trimStart().length
    const trimmed = text.trim()
    const adjusted = words.map(word => ({ ...word, start: Math.max(0, word.start - leading), end: Math.min(trimmed.length, word.end - leading) }))
      .filter(word => word.end > word.start)
    if (adjusted.some((word, index) => index > 0 && word.startTime < adjusted[index - 1].endTime)) continue
    timed.set(time, { text: trimmed, words: adjusted })
  }
  return lines.map(line => {
    const match = timed.get(Math.round(line.time))
    // Never attach another version's timing to text that merely looks similar.
    return match?.text === line.text ? match.words : []
  })
}
