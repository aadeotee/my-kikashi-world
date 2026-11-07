/** World dimensions in blocks. +X is east, +Z is south; the journey runs north (towards -Z). */
export const W = 256
export const D = 320
export const H = 56
export const CHUNK = 32

/** Top surface of flat ground: a player standing on it has feet at y = G0. */
export const G0 = 12

export const MAZE_N = 17
export const MAZE_PITCH = 5
export const MAZE_SIZE = MAZE_N * MAZE_PITCH + 2
export const MAZE_X0 = 85
export const MAZE_Z0 = 60
export const MAZE_SEED = 21128
export const HEDGE_H = 5

export const GATE_Z = 182
export const GATE_X = 128

export const POND = { x: 78, z: 232, rx: 25, rz: 18 }
export const PADDY = { x0: 150, x1: 234, z0: 194, z1: 268 }
export const COTTAGE = { x0: 119, x1: 136, z0: 256, z1: 268 }
export const DOOR_X = 128
export const CLEARING = { x: 128, z: 34, rx: 56, rz: 27 }
export const GOLDEN_TREE = { x: 128, z: 20 }
