export const normalizeLyricColor = (input: string): string | null => {
  const hex = input.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(hex)) return '#' + hex.split('').map(value => value + value).join('').toUpperCase()
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null
}
