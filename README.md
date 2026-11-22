# Neuro Drift

120 cars, each driven by a neural network with 112 weights, learn to race by evolution. Nobody teaches them a racing line: the ones that get furthest breed, and in a few generations the lap times start to fall.

Live: https://himeshahuja.github.io/neuro-drift/

## Play

- **Draw** a circuit with the mouse or a finger. The evolved brains carry over, so you can see whether they generalise.
- **Click the track** to drop a cone, and click it again to lift it. Mid-race roadblocks force the population to adapt.
- **Drive** with the arrow keys or WASD to race the champion. Your best lap shows next to theirs.
- **1× / 5× / 25×** fast-forward evolution.

## How it works

- **Sensors.** Each car casts 7 rays (−90° to +90°) against a 4 px on-track bitmap. With its speed, that makes 8 inputs.
- **Brain.** An 8 → 10 → 2 tanh network outputs steering and throttle. Grip falls with speed, so the fast cars have to learn to brake for corners.
- **Fitness.** Progress is measured along the track's centre line, searched near the car's last position so self-crossing tracks still work. A car dies if it hits a wall or a cone, makes no new progress for 2 s, or drives backwards.
- **Evolution.** The top 6 survive unchanged. The rest are bred from 3-way tournament picks, with uniform crossover and Gaussian mutation on 8% of genes. Paint is inherited from the fitter parent, so you can watch one bloodline's colour take over the grid.
- **Tracks.** Random tracks are circles bent by sine harmonics, so they never cross themselves. Drawn tracks are smoothed with Chaikin's algorithm and resampled every 6 px.

```
npm install
npm run dev
npm test
```
