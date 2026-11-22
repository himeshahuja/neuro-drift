// A tiny fully connected tanh network. The genome is one flat array:
// for each layer, for each neuron, a bias followed by its incoming weights.

export function weightCount(sizes) {
  let n = 0
  for (let l = 1; l < sizes.length; l++) n += (sizes[l - 1] + 1) * sizes[l]
  return n
}

export function gauss(rand) {
  const u = 1 - rand(), v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function randomGenome(sizes, rand) {
  const g = new Float32Array(weightCount(sizes))
  for (let i = 0; i < g.length; i++) g[i] = gauss(rand)
  return g
}

export function makeActs(sizes) {
  return sizes.map(n => new Float32Array(n))
}

export function forward(sizes, genome, input, acts) {
  acts[0].set(input)
  let k = 0
  for (let l = 1; l < sizes.length; l++) {
    const prev = acts[l - 1], cur = acts[l]
    for (let j = 0; j < sizes[l]; j++) {
      let s = genome[k++]
      for (let i = 0; i < prev.length; i++) s += genome[k++] * prev[i]
      cur[j] = Math.tanh(s)
    }
  }
  return acts[acts.length - 1]
}
