import { forward, makeActs, randomGenome } from './nn.js'
import { nextGeneration } from './ga.js'
import { castRay, nearestIndex, onTrack } from './track.js'

export const SIZES = [8, 10, 2]
export const DT = 1 / 60
// A generation is a race: it ends once every car has finished or crashed.
export const RACE_LAPS = 2
const SAFETY_TIME = 120
export const RAY_LEN = 200
export const RAYS = [-90, -50, -20, 0, 20, 50, 90].map(d => d * Math.PI / 180)
export const MAX_SPEED = 340
// Every 2 s a car must have gained 27 samples (about 80 px/s) or it is retired.
const ACCEL = 260, BRAKE = 420, TURN = 3.2, DRAG = 0.4, PACE_WINDOW = 2, PACE_MIN = 27

export function makeCar(track, genome = null, hue = 0) {
  const s = track.start
  return {
    x: s.x, y: s.y, angle: s.angle, speed: 0, steer: 0,
    alive: true, finished: 0, genome, hue,
    idx: 0, total: 0, best: 0, mark: 0, markAt: 0,
    laps: 0, lapStart: 0, lastLap: 0, bestLap: Infinity,
    sensors: new Float32Array(RAYS.length),
    acts: makeActs(SIZES),
  }
}

export function sense(car, track) {
  for (let i = 0; i < RAYS.length; i++) {
    car.sensors[i] = castRay(track, car.x, car.y, car.angle + RAYS[i], RAY_LEN) / RAY_LEN
  }
}

// One physics tick. Returns 'crash', 'lap' or null.
export function drive(car, track, steer, throttle, clock) {
  car.speed += throttle * (throttle >= 0 ? ACCEL : BRAKE) * DT
  car.speed -= car.speed * DRAG * DT
  car.speed = Math.max(0, Math.min(MAX_SPEED, car.speed))
  car.steer = steer
  car.angle += steer * TURN * Math.min(1, car.speed / 60) * (1 - 0.55 * car.speed / MAX_SPEED) * DT
  car.x += Math.cos(car.angle) * car.speed * DT
  car.y += Math.sin(car.angle) * car.speed * DT

  const nx = car.x + Math.cos(car.angle) * 7, ny = car.y + Math.sin(car.angle) * 7
  if (!onTrack(track, car.x, car.y) || !onTrack(track, nx, ny)) {
    car.alive = false
    return 'crash'
  }

  const n = track.n
  const idx = nearestIndex(track, car.x, car.y, car.idx)
  let d = idx - car.idx
  if (d > n / 2) d -= n
  else if (d < -n / 2) d += n
  car.idx = idx
  car.total += d
  if (car.total > car.best) car.best = car.total

  const laps = Math.floor(car.best / n)
  if (laps > car.laps) {
    car.lastLap = clock - car.lapStart
    car.bestLap = Math.min(car.bestLap, car.lastLap)
    car.lapStart = clock
    car.laps = laps
    return 'lap'
  }
  return null
}

export class Race {
  constructor(track, { rand, pop = 120 } = {}) {
    this.rand = rand
    this.track = track
    this.restart(pop)
  }

  restart(pop = this.genomes.length) {
    this.gen = 1
    this.history = []
    this.bestLap = Infinity
    this.genomes = Array.from({ length: pop }, () => randomGenome(SIZES, this.rand))
    this.hues = this.genomes.map(() => this.rand() * 360)
    this.spawn()
  }

  // A new track keeps the current brains: watch whether they generalise.
  setTrack(track) {
    this.track = track
    this.bestLap = Infinity
    this.spawn()
  }

  spawn() {
    this.t = 0
    this.cars = this.genomes.map((g, i) => makeCar(this.track, g, this.hues[i]))
    this.alive = this.cars.length
    this.finished = 0
  }

  step(events = []) {
    this.t += DT
    const input = new Float32Array(SIZES[0])
    for (const car of this.cars) {
      if (!car.alive) continue
      sense(car, this.track)
      input.set(car.sensors)
      input[RAYS.length] = car.speed / MAX_SPEED
      const [steer, throttle] = forward(SIZES, car.genome, input, car.acts)
      const ev = drive(car, this.track, steer, throttle, this.t)
      if (ev === 'crash') {
        this.alive--
        events.push({ type: 'crash', x: car.x, y: car.y, hue: car.hue, speed: car.speed })
      } else if (car.total < -20 || this.tooSlow(car)) {
        car.alive = false
        this.alive--
      } else if (ev === 'lap') {
        if (car.lastLap < this.bestLap) {
          this.bestLap = car.lastLap
          events.push({ type: 'record', time: car.lastLap, hue: car.hue })
        }
        // Past the flag the car parks on the line and waits for the rest.
        if (car.laps >= RACE_LAPS) {
          car.alive = false
          car.finished = this.t
          car.speed = 0
          this.alive--
          this.finished++
        }
      }
    }
    if (this.alive === 0 || this.t >= SAFETY_TIME) this.evolve(events)
    return events
  }

  tooSlow(car) {
    if (this.t - car.markAt < PACE_WINDOW) return false
    if (car.best - car.mark < PACE_MIN) return true
    car.mark = car.best
    car.markAt = this.t
    return false
  }

  evolve(events = []) {
    const n = this.track.n
    // Finishers also score for how quickly they took the flag.
    const fitness = this.cars.map(c => c.best + (c.finished ? (SAFETY_TIME - c.finished) * 20 : 0))
    const progress = this.cars.map(c => c.best)
    const best = Math.max(...progress)
    const mean = progress.reduce((a, b) => a + b, 0) / progress.length
    this.history.push({ gen: this.gen, best: best / n, mean: mean / n })
    const next = nextGeneration(this.genomes, this.hues, fitness, this.rand)
    this.genomes = next.genomes
    this.hues = next.hues
    this.gen++
    this.spawn()
    events.push({ type: 'generation', gen: this.gen })
  }

  leader() {
    let lead = null
    for (const c of this.cars) {
      if (!c.alive) continue
      if (!lead || c.total > lead.total) lead = c
    }
    return lead
  }
}
