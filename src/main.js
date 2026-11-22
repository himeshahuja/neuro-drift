import './style.css'
import { buildTrack, pathLength, randomTrack, resample, toggleCone } from './track.js'
import { DT, Race, SIZES, drive, makeCar } from './sim.js'
import { drawBrain, drawCars, drawChart, drawParticles, drawSkids, drawStroke, drawTrack } from './render.js'

const $ = id => document.getElementById(id)
const canvas = $('world')
const ctx = canvas.getContext('2d')
const brainCanvas = $('brain'), chartCanvas = $('chart')

const portrait = innerHeight > innerWidth * 1.1
const W = portrait ? 1000 : 1600, H = portrait ? 1600 : 1000

let trackSeed = Math.floor(Math.random() * 1e9)
let track = buildTrack(randomTrack(W, H, Math.random), W, H)
const race = new Race(track, { rand: Math.random, pop: 120 })

let speed = 1
let drawing = false, stroke = null
let player = null, playerClock = 0, respawnAt = 0, playerBest = Infinity
const keys = new Set()
const particles = []
const view = { scale: 1, ox: 0, oy: 0, dpr: 1 }
const trackLayer = document.createElement('canvas')
const skidLayer = document.createElement('canvas')
const skidCtx = skidLayer.getContext('2d')

function layout() {
  const dpr = Math.min(2, devicePixelRatio || 1)
  const vw = innerWidth, vh = innerHeight
  canvas.width = vw * dpr
  canvas.height = vh * dpr
  view.dpr = dpr
  view.scale = Math.min(vw / W, vh / H)
  view.ox = (vw - W * view.scale) / 2
  view.oy = (vh - H * view.scale) / 2
  for (const layer of [trackLayer, skidLayer]) {
    layer.width = Math.ceil(W * view.scale * dpr)
    layer.height = Math.ceil(H * view.scale * dpr)
  }
  skidCtx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, 0, 0)
  paintTrack()
  for (const c of [brainCanvas, chartCanvas]) {
    const r = c.getBoundingClientRect()
    c.width = r.width * dpr
    c.height = r.height * dpr
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  paintChart()
}

function paintTrack() {
  const t = trackLayer.getContext('2d')
  t.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, 0, 0)
  drawTrack(t, track, trackSeed)
}

function paintChart() {
  const r = chartCanvas.getBoundingClientRect()
  drawChart(chartCanvas.getContext('2d'), r.width, r.height, race.history)
}

function clearSkids() {
  skidCtx.clearRect(0, 0, W, H)
}

function useTrack(next) {
  track = next
  trackSeed = Math.floor(Math.random() * 1e9)
  race.setTrack(track)
  if (player) resetPlayer()
  playerBest = Infinity
  particles.length = 0
  clearSkids()
  paintTrack()
}

function resetPlayer() {
  player = makeCar(track)
  playerClock = 0
}

function burst(x, y, color, count, force) {
  for (let i = 0; i < count && particles.length < 700; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * force
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, size: 1.5 + Math.random() * 2.5, color })
  }
}

function stepPlayer() {
  playerClock += DT
  if (!player.alive) {
    if (playerClock >= respawnAt) resetPlayer()
    return
  }
  const steer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
  const throttle = keys.has('up') ? 1 : keys.has('down') ? -1 : -0.05
  const ev = drive(player, track, steer, throttle, playerClock)
  if (ev === 'crash') {
    burst(player.x, player.y, '#ffffff', 26, 3)
    respawnAt = playerClock + 0.9
  } else if (ev === 'lap') {
    playerBest = Math.min(playerBest, player.lastLap)
  }
}

function simulate(steps) {
  const events = []
  for (let i = 0; i < steps; i++) {
    race.step(events)
    if (player) stepPlayer()
  }
  const crashCount = events.reduce((n, e) => n + (e.type === 'crash'), 0)
  const per = crashCount > 40 ? 2 : crashCount > 10 ? 5 : 12
  for (const ev of events) {
    if (ev.type === 'crash') burst(ev.x, ev.y, `hsl(${ev.hue} 90% 62%)`, per, 1 + ev.speed / 140)
    else if (ev.type === 'record') flash($('lap'))
    else if (ev.type === 'generation') {
      skidCtx.save()
      skidCtx.globalCompositeOperation = 'destination-out'
      skidCtx.fillStyle = 'rgba(0,0,0,0.3)'
      skidCtx.fillRect(0, 0, W, H)
      skidCtx.restore()
      paintChart()
      flash($('gen'))
    }
  }
}

function flash(el) {
  el.classList.remove('flash')
  void el.offsetWidth
  el.classList.add('flash')
}

const fmt = t => (t === Infinity ? '—' : `${t.toFixed(2)}s`)
const hud = {}
function setText(id, value) {
  if (hud[id] === value) return
  hud[id] = value
  $(id).textContent = value
}

let last = performance.now(), acc = 0
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (!stroke) {
    acc += dt * 60 * speed
    const steps = Math.min(150, Math.floor(acc))
    acc -= steps
    simulate(steps)
  }
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vx *= 0.92
    p.vy *= 0.92
    p.life -= dt * 1.4
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1)

  const leader = race.leader()
  drawSkids(skidCtx, race.cars)
  if (player) drawSkids(skidCtx, [player])

  const { dpr, scale, ox, oy } = view
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#0c120e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(trackLayer, Math.round(ox * dpr), Math.round(oy * dpr))
  ctx.drawImage(skidLayer, Math.round(ox * dpr), Math.round(oy * dpr))
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr)
  drawCars(ctx, race, leader, player)
  drawParticles(ctx, particles)
  if (stroke) drawStroke(ctx, stroke)

  const br = brainCanvas.getBoundingClientRect()
  drawBrain(brainCanvas.getContext('2d'), br.width, br.height, SIZES, leader?.genome, leader?.acts)

  setText('gen', String(race.gen))
  setText('alive', `${race.alive}/${race.cars.length}`)
  setText('lap', fmt(race.bestLap))
  setText('laps', String(leader ? leader.laps : 0))
  setText('you', fmt(playerBest))
  $('you-stat').hidden = !player
  requestAnimationFrame(frame)
}

// Pointer: draw a new circuit, or drop and lift cones.
function toWorld(e) {
  return { x: (e.clientX - view.ox) / view.scale, y: (e.clientY - view.oy) / view.scale }
}

canvas.addEventListener('pointerdown', e => {
  const p = toWorld(e)
  if (drawing) {
    stroke = [p]
    canvas.setPointerCapture(e.pointerId)
  } else if (toggleCone(track, p.x, p.y)) {
    paintTrack()
  }
})

canvas.addEventListener('pointermove', e => {
  if (!stroke) return
  const p = toWorld(e), q = stroke[stroke.length - 1]
  if (Math.hypot(p.x - q.x, p.y - q.y) > 8) stroke.push(p)
})

canvas.addEventListener('pointerup', () => {
  if (!stroke) return
  const pts = stroke
  stroke = null
  if (pts.length < 12 || pathLength(pts) < 900) return
  useTrack(buildTrack(resample(pts, 28), W, H))
  setDrawing(false)
})

function setDrawing(on) {
  drawing = on
  $('draw').classList.toggle('on', on)
  canvas.classList.toggle('drawing', on)
}

function setSpeed(s) {
  speed = s
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === s)
}

function setPlayer(on) {
  if (on && !player) {
    resetPlayer()
    playerBest = Infinity
    setSpeed(1)
  } else if (!on) {
    player = null
  }
  $('drive').classList.toggle('on', !!player)
}

for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)))
$('new').addEventListener('click', () => { setDrawing(false); useTrack(buildTrack(randomTrack(W, H, Math.random), W, H)) })
$('draw').addEventListener('click', () => setDrawing(!drawing))
$('drive').addEventListener('click', () => setPlayer(!player))
$('reset').addEventListener('click', () => {
  race.restart()
  particles.length = 0
  clearSkids()
  paintChart()
})

const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }
addEventListener('keydown', e => {
  const k = KEYMAP[e.code]
  if (!k) return
  e.preventDefault()
  if (!player) setPlayer(true)
  keys.add(k)
})
addEventListener('keyup', e => keys.delete(KEYMAP[e.code]))
addEventListener('blur', () => keys.clear())
addEventListener('resize', layout)

layout()
setSpeed(1)
requestAnimationFrame(frame)
