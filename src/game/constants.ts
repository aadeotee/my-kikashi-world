/** World dimensions in blocks. The page reads top to bottom, which is from high Z down to low Z. */
export const W = 256
export const D = 320
export const H = 56
export const CHUNK = 32

/** Top surface of flat ground: a player standing on it has feet at y = G0. */
export const G0 = 12

export const HEDGE_H = 2
/** The maze's left edge, and its top row (the highest Z). */
export const MAZE_X0 = 114
export const MAZE_TOP = 236

export const POND = { x: 98, z: 240, rx: 13, rz: 8 }
export const COTTAGE = { x0: 119, x1: 136, z0: 256, z1: 268 }
export const DOOR_X = 128
export const BENCH = { x: 127, z: 187 }
export const GOLDEN_TREE = { x: 128, z: 84 }
/** How far the page can scroll once the options are showing. */
export const PAGE_TOP = 184
export const PAGE_BOTTOM = 94
