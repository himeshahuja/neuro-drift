// A track is a closed centre line sampled every few pixels, plus a coarse
// on-track bitmap so collision and sensor rays are table lookups.

export const CELL = 4
export const WIDTH = 46
export const SPACING = 6
export const CONE_R = 11
const MARGIN = 70

export function chaikin(pts, iterations) {
  let out = pts
  for (let it = 0; it < iterations; it++) {
    const next = []
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length]
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
    }
    out = next
  }
  return out
}

// Evenly spaced points along a closed polyline.
export function resample(pts, step) {
  const out = [{ ...pts[0] }]
  let carry = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    let d = step - carry
    while (d < len) {
      out.push({ x: a.x + (b.x - a.x) * d / len, y: a.y + (b.y - a.y) * d / len })
      d += step
    }
    carry = len - (d - step)
  }
  // Drop the last point if it nearly lands on the first.
  const last = out[out.length - 1]
  if (Math.hypot(last.x - out[0].x, last.y - out[0].y) < step * 0.5) out.pop()
  return out
}

export function pathLength(pts, closed = true) {
  let len = 0
  const end = closed ? pts.length : pts.length - 1
  for (let i = 0; i < end; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    len += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return len
}

// A star-shaped blob: a few sine harmonics bend a circle, so it never crosses itself.
export function randomTrack(W, H, rand) {
  const harmonics = []
  let total = 0
  for (let k = 2; k <= 5; k++) {
    const amp = rand() * 0.38 / Math.sqrt(k - 1)
    harmonics.push({ k, amp, phase: rand() * Math.PI * 2 })
    total += amp
  }
  const squash = total > 0.5 ? 0.5 / total : 1
  const K = 20, cx = W / 2, cy = H / 2, rx = W / 2 - MARGIN, ry = H / 2 - MARGIN
  const pts = []
  for (let i = 0; i < K; i++) {
    const t = (i / K) * Math.PI * 2
    let r = 1 - (rand() * 0.08)
    for (const h of harmonics) r -= h.amp * squash * (0.5 + 0.5 * Math.sin(h.k * t + h.phase))
    pts.push({ x: cx + Math.cos(t) * r * rx, y: cy + Math.sin(t) * r * ry })
  }
  return pts
}

export function buildTrack(points, W, H, width = WIDTH) {
  const center = resample(chaikin(points, 3), SPACING)
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL)
  const a = center[0], b = center[2]
  const track = {
    center, n: center.length, width, W, H, cols, rows,
    mask: new Uint8Array(cols * rows),
    cones: [],
    start: { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) },
  }
  stamp(track)
  return track
}

function paint(track, x, y, r, value) {
  const { cols, rows, mask } = track
  const c0 = Math.max(0, Math.floor((x - r) / CELL)), c1 = Math.min(cols - 1, Math.floor((x + r) / CELL))
  const r0 = Math.max(0, Math.floor((y - r) / CELL)), r1 = Math.min(rows - 1, Math.floor((y + r) / CELL))
  const r2 = r * r
  for (let row = r0; row <= r1; row++) {
    const dy = (row + 0.5) * CELL - y
    for (let col = c0; col <= c1; col++) {
      const dx = (col + 0.5) * CELL - x
      if (dx * dx + dy * dy <= r2) mask[row * cols + col] = value
    }
  }
}

function stamp(track) {
  track.mask.fill(0)
  for (const p of track.center) paint(track, p.x, p.y, track.width / 2, 1)
  for (const c of track.cones) paint(track, c.x, c.y, CONE_R, 0)
}

export function onTrack(track, x, y) {
  const col = Math.floor(x / CELL), row = Math.floor(y / CELL)
  if (col < 0 || row < 0 || col >= track.cols || row >= track.rows) return false
  return track.mask[row * track.cols + col] === 1
}

export function castRay(track, x, y, angle, max) {
  const dx = Math.cos(angle), dy = Math.sin(angle), step = CELL * 0.8
  for (let d = step; d < max; d += step) {
    if (!onTrack(track, x + dx * d, y + dy * d)) return d
  }
  return max
}

// Closest centre sample, searched near the previous one so crossings don't confuse it.
export function nearestIndex(track, x, y, hint = -1, window = 24) {
  const { center, n } = track
  let best = 0, bestD = Infinity
  const from = hint < 0 ? 0 : hint - window
  const to = hint < 0 ? n - 1 : hint + window
  for (let i = from; i <= to; i++) {
    const j = ((i % n) + n) % n
    const p = center[j]
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d < bestD) { bestD = d; best = j }
  }
  return best
}

// Click on the track to drop a cone, click a cone to lift it.
export function toggleCone(track, x, y) {
  const hit = track.cones.findIndex(c => Math.hypot(c.x - x, c.y - y) < CONE_R + 6)
  if (hit >= 0) {
    track.cones.splice(hit, 1)
    stamp(track)
    return true
  }
  const s = track.start
  if (!onTrack(track, x, y) || Math.hypot(s.x - x, s.y - y) < 90) return false
  track.cones.push({ x, y })
  paint(track, x, y, CONE_R, 0)
  return true
}
