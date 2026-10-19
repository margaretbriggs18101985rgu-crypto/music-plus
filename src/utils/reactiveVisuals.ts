// Android stage controls. The stored JSON remains compatible with primitive-only settings backups.
export const reactiveVisualDefaults = {
  intensity: 0.85,
  depth: 0.2,
  coverResolution: 512,
  cinema: 0.5,
  cinemaEnabled: true,
  particleGlow: false,
  outlineHighlight: false,
  starRiver: true,
  particleSize: 1,
  speed: 1,
  twist: 0,
  colorTension: 1.1,
  bloom: 0.62,
  scatter: 0,
  backgroundDim: 0.2,
  terrainEnabled: false,
  terrainHeight: 0.55,
  terrainDepth: 0.6,
  terrainOffset: 0.78,
  spectrumEnabled: false,
  kickAuto: true,
  kickSensitivity: 1,
  kickLowHz: 45,
  kickHighHz: 170,
  bassWeight: 1,
  midWeight: 0.65,
  trebleWeight: 0.45,
}
export type ReactiveVisuals = typeof reactiveVisualDefaults
export type VisualNumberKey = { [K in keyof ReactiveVisuals]: ReactiveVisuals[K] extends number ? K : never }[keyof ReactiveVisuals]
export type VisualSwitchKey = Exclude<keyof ReactiveVisuals, VisualNumberKey>
export const reactiveVisualRanges: Record<VisualNumberKey, readonly [number, number, number]> = {
  intensity: [0, 2, 0.05],
  depth: [0, 1, 0.05],
  coverResolution: [64, 512, 16],
  cinema: [0, 1.5, 0.05],
  particleSize: [0.3, 3, 0.05],
  speed: [0, 3, 0.05],
  twist: [0, 2, 0.05],
  colorTension: [0, 2, 0.05],
  bloom: [0, 1.5, 0.05],
  scatter: [0, 1, 0.05],
  backgroundDim: [0, 1, 0.05],
  terrainHeight: [0, 1.5, 0.05],
  terrainDepth: [0, 1, 0.05],
  terrainOffset: [0.4, 1, 0.02],
  kickSensitivity: [0.4, 2, 0.05],
  kickLowHz: [25, 110, 1],
  kickHighHz: [120, 300, 1],
  bassWeight: [0, 2, 0.05],
  midWeight: [0, 2, 0.05],
  trebleWeight: [0, 2, 0.05],
}
export const parseReactiveVisuals = (stored: unknown): ReactiveVisuals => {
  const result = { ...reactiveVisualDefaults }
  let value: any
  try { value = typeof stored == 'string' ? JSON.parse(stored) : stored } catch { return result }
  if (!value || typeof value != 'object' || Array.isArray(value)) return result
  for (const field of Object.keys(result) as Array<keyof ReactiveVisuals>) {
    if (typeof result[field] == 'boolean') {
      if (typeof value[field] == 'boolean') Object.assign(result, { [field]: value[field] })
    } else if (typeof value[field] == 'number' && Number.isFinite(value[field])) {
      const [min, max] = reactiveVisualRanges[field as VisualNumberKey]
      Object.assign(result, { [field]: Math.max(min, Math.min(max, value[field])) })
    }
  }
  result.coverResolution = Math.round(result.coverResolution)
  return result
}
