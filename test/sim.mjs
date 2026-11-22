import assert from 'node:assert/strict'
import { buildTrack, nearestIndex, onTrack, randomTrack, toggleCone, pathLength } from '../src/track.js'
import { Race } from '../src/sim.js'
import { forward, makeActs, weightCount } from '../src/nn.js'

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 1600, H = 1000

// Network shape and determinism.
assert.equal(weightCount([8, 10, 2]), 9 * 10 + 11 * 2)
const zero = new Float32Array(weightCount([2, 2]))
assert.deepEqual([...forward([2, 2], zero, [1, 1], makeActs([2, 2]))], [0, 0])

// Tracks: start is on the asphalt, the infield corner is not, indices wrap.
const rand = mulberry32(7)
const track = buildTrack(randomTrack(W, H, rand), W, H)
assert.ok(track.n > 300, `track has ${track.n} samples`)
assert.ok(onTrack(track, track.start.x, track.start.y))
assert.ok(!onTrack(track, 2, 2))
assert.ok(!onTrack(track, W / 2, H / 2))
const last = track.center[track.n - 1]
assert.equal(nearestIndex(track, last.x, last.y, 0), track.n - 1)
assert.ok(Math.abs(pathLength(track.center) / track.n - 6) < 0.5)

// Cones block the asphalt and lift again.
const mid = track.center[Math.floor(track.n / 2)]
assert.ok(toggleCone(track, mid.x, mid.y))
assert.ok(!onTrack(track, mid.x, mid.y))
assert.ok(toggleCone(track, mid.x, mid.y))
assert.ok(onTrack(track, mid.x, mid.y))

// Evolution: a population should learn to lap the track.
const race = new Race(track, { rand: mulberry32(1), pop: 80 })
let record = Infinity
const t0 = performance.now()
while (race.gen <= 30 && record === Infinity) {
  for (const ev of race.step()) if (ev.type === 'record') record = Math.min(record, ev.time)
}
const ms = performance.now() - t0
console.log(`first lap by generation ${race.gen} in ${record.toFixed(2)}s (${ms.toFixed(0)} ms)`)
console.log(race.history.map(h => h.best.toFixed(2)).join(' '))
assert.ok(record < Infinity, 'no car completed a lap in 30 generations')

console.log('ok')
