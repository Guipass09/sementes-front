export function fitSessionContent(width: number, height: number, ratio: number | null) {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1;
  const h = Number.isFinite(height) ? Math.max(1, height) : 1;
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return { width: w, height: h };
  const fittedWidth = Math.min(w, h * ratio);
  return { width: fittedWidth, height: fittedWidth / ratio };
}
