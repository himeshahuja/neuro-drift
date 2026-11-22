import { gauss } from './nn.js'

// Elites survive untouched; everyone else is a tournament-picked pair, crossed
// gene by gene, with a few genes nudged. Paint is inherited from the fitter
// parent with a little drift, so colours show the bloodlines taking over.
export function nextGeneration(genomes, hues, fitness, rand, { elite = 6, rate = 0.08, sigma = 0.4 } = {}) {
  const n = genomes.length
  const order = [...genomes.keys()].sort((a, b) => fitness[b] - fitness[a])
  const out = [], outHues = []
  for (let e = 0; e < elite && e < n; e++) {
    out.push(genomes[order[e]].slice())
    outHues.push(hues[order[e]])
  }
  const pick = () => {
    let best = Math.floor(rand() * n)
    for (let t = 0; t < 2; t++) {
      const c = Math.floor(rand() * n)
      if (fitness[c] > fitness[best]) best = c
    }
    return best
  }
  while (out.length < n) {
    const a = pick(), b = pick()
    const A = genomes[a], B = genomes[b]
    const child = new Float32Array(A.length)
    for (let i = 0; i < child.length; i++) {
      child[i] = rand() < 0.5 ? A[i] : B[i]
      if (rand() < rate) child[i] += gauss(rand) * sigma
    }
    out.push(child)
    const hue = fitness[a] >= fitness[b] ? hues[a] : hues[b]
    outHues.push((hue + gauss(rand) * 5 + 360) % 360)
  }
  return { genomes: out, hues: outHues }
}
