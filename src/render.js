import { CONE_R } from './track.js'
import { RAYS, RAY_LEN } from './sim.js'

const INFIELD = '#0c120e'
const ASPHALT = '#2a2d31'
const KERB_RED = '#e5432f'
const KERB_WHITE = '#efe9dc'
const AMBER = '#ffb000'

function centrePath(ctx, track) {
  ctx.beginPath()
  track.center.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
}

// Everything that only changes with the track: grass, kerbs, asphalt, start line, cones.
export function drawTrack(ctx, track, seed = 1) {
  ctx.fillStyle = INFIELD
  ctx.fillRect(0, 0, track.W, track.H)
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(120,170,120,0.05)' : 'rgba(0,0,0,0.25)'
    ctx.fillRect(rand() * track.W, rand() * track.H, 2, 2)
  }

  ctx.lineJoin = ctx.lineCap = 'round'
  centrePath(ctx, track)
  ctx.lineWidth = track.width + 8
  ctx.strokeStyle = KERB_WHITE
  ctx.stroke()
  ctx.setLineDash([12, 12])
  ctx.strokeStyle = KERB_RED
  ctx.lineCap = 'butt'
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineCap = 'round'
  ctx.lineWidth = track.width
  ctx.strokeStyle = ASPHALT
  ctx.stroke()
  ctx.setLineDash([10, 16])
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.stroke()
  ctx.setLineDash([])

  // Chequered start line across the track.
  const { x, y, angle } = track.start
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const sq = track.width / 8
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#111' : KERB_WHITE
      ctx.fillRect(-sq + col * sq, -track.width / 2 + row * sq, sq, sq)
    }
  }
  ctx.restore()

  for (const c of track.cones) drawCone(ctx, c.x, c.y)
}

function drawCone(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.arc(x + 2, y + 3, CONE_R - 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff6a1a'
  ctx.beginPath()
  ctx.arc(x, y, CONE_R - 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = KERB_WHITE
  ctx.beginPath()
  ctx.arc(x, y, CONE_R - 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff6a1a'
  ctx.beginPath()
  ctx.arc(x, y, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

function carBody(ctx, car, fill) {
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.angle)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(-8, -4.5, 16, 9, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0.5, -3.2, 3.5, 6.4)
  ctx.restore()
}

export function drawSkids(ctx, cars) {
  for (const car of cars) {
    if (!car.alive || car.speed < 140 || Math.abs(car.steer) < 0.6) continue
    const c = Math.cos(car.angle), s = Math.sin(car.angle)
    ctx.fillStyle = 'rgba(8,8,10,0.22)'
    for (const side of [-3.5, 3.5]) {
      ctx.fillRect(car.x - c * 7 - s * side - 1, car.y - s * 7 + c * side - 1, 2, 2)
    }
  }
}

export function drawCars(ctx, race, leader, player) {
  for (const car of race.cars) {
    if (!car.alive && !car.finished) carBody(ctx, car, 'rgba(90,90,90,0.35)')
  }
  for (const car of race.cars) {
    if ((car.alive || car.finished) && car !== leader) carBody(ctx, car, `hsl(${car.hue} 85% 58%)`)
  }
  if (leader) {
    ctx.lineWidth = 1
    for (let i = 0; i < RAYS.length; i++) {
      const a = leader.angle + RAYS[i], d = leader.sensors[i] * RAY_LEN
      const hx = leader.x + Math.cos(a) * d, hy = leader.y + Math.sin(a) * d
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.moveTo(leader.x, leader.y)
      ctx.lineTo(hx, hy)
      ctx.stroke()
      ctx.fillStyle = leader.sensors[i] < 0.25 ? KERB_RED : 'rgba(255,255,255,0.8)'
      ctx.fillRect(hx - 2, hy - 2, 4, 4)
    }
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(leader.x, leader.y, 15, 0, Math.PI * 2)
    ctx.stroke()
    carBody(ctx, leader, `hsl(${leader.hue} 90% 62%)`)
  }
  if (player) {
    carBody(ctx, player, player.alive ? '#ffffff' : 'rgba(255,255,255,0.3)')
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 11px "Chakra Petch", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('YOU', player.x, player.y - 13)
  }
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

export function drawStroke(ctx, pts) {
  if (pts.length < 2) return
  ctx.strokeStyle = AMBER
  ctx.lineWidth = 4
  ctx.lineJoin = ctx.lineCap = 'round'
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.stroke()
}

// The leader's brain: inputs on the left, steer and throttle on the right.
export function drawBrain(ctx, w, h, sizes, genome, acts) {
  ctx.clearRect(0, 0, w, h)
  if (!genome) return
  const padX = 14, padY = 12
  const pos = sizes.map((n, l) => Array.from({ length: n }, (_, i) => ({
    x: padX + (l / (sizes.length - 1)) * (w - padX * 2),
    y: padY + (n === 1 ? 0.5 : i / (n - 1)) * (h - padY * 2),
  })))
  let k = 0
  for (let l = 1; l < sizes.length; l++) {
    for (let j = 0; j < sizes[l]; j++) {
      k++
      for (let i = 0; i < sizes[l - 1]; i++) {
        const wgt = genome[k++]
        const signal = Math.abs(wgt * acts[l - 1][i])
        ctx.strokeStyle = wgt > 0 ? `rgba(255,176,0,${Math.min(0.85, 0.06 + signal * 0.4)})` : `rgba(90,170,255,${Math.min(0.85, 0.06 + signal * 0.4)})`
        ctx.lineWidth = Math.min(2.5, 0.4 + Math.abs(wgt) * 0.6)
        ctx.beginPath()
        ctx.moveTo(pos[l - 1][i].x, pos[l - 1][i].y)
        ctx.lineTo(pos[l][j].x, pos[l][j].y)
        ctx.stroke()
      }
    }
  }
  for (let l = 0; l < sizes.length; l++) {
    for (let i = 0; i < sizes[l]; i++) {
      const a = acts[l][i], p = pos[l][i]
      ctx.fillStyle = INFIELD
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = a >= 0 ? `rgba(255,176,0,${0.2 + Math.abs(a) * 0.8})` : `rgba(90,170,255,${0.2 + Math.abs(a) * 0.8})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Best and mean laps per generation.
export function drawChart(ctx, w, h, history) {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h - 0.5)
  ctx.lineTo(w, h - 0.5)
  ctx.stroke()
  if (history.length < 2) return
  const top = Math.max(1, ...history.map(p => p.best))
  const line = (key, color, width) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    history.forEach((p, i) => {
      const x = (i / (history.length - 1)) * (w - 2) + 1
      const y = h - 2 - (p[key] / top) * (h - 6)
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.stroke()
  }
  line('mean', 'rgba(239,233,220,0.35)', 1.25)
  line('best', AMBER, 2)
}
