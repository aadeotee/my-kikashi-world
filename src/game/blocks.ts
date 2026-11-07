import { Color } from 'three'
import { P } from './palette'

export const B = {
  AIR: 0,
  BARRIER: 1,
  GRASS: 2,
  DIRT: 3,
  STONE: 4,
  COBBLE: 5,
  GRAVEL: 6,
  SAND: 7,
  MUD: 8,
  PLASTER: 9,
  TIMBER: 10,
  PLANK: 11,
  ROOF: 12,
  ROOF_LIGHT: 13,
  BRICK: 14,
  LEAF_OAK: 15,
  LEAF_BIRCH: 16,
  LEAF_WILLOW: 17,
  LEAF_GOLD: 18,
  LEAF_BLOSSOM: 19,
  LEAF_PINE: 20,
  BARK: 21,
  BIRCH: 22,
  HEDGE: 23,
  HEDGE_BLOOM: 24,
  GLASS: 25,
  ROCK: 26,
  DIRT_PATH: 27,
  MOSSY: 28,
  SOIL: 29,
  LANTERN: 30,
  PETAL: 31,
} as const

export interface BlockDef {
  /** Blocks the player. */
  solid: boolean
  /** Hides the faces of neighbouring blocks. */
  opaque: boolean
  /** Candidate colours picked per block. */
  colors: Color[]
  tex: number
  wind: number
  glow: number
  /** Per-block brightness jitter. */
  jitter: number
}

const c = (...hex: string[]) => hex.map((h) => new Color(h))
const def = (colors: string[], o: Partial<BlockDef> = {}): BlockDef => ({
  solid: true,
  opaque: true,
  colors: c(...colors),
  tex: 0.16,
  wind: 0,
  glow: 0,
  jitter: 0.05,
  ...o,
})
const leaf = (colors: string[], wind = 0.32): BlockDef =>
  def(colors, { solid: false, tex: 0.3, wind, jitter: 0.05 })

export const DEFS: BlockDef[] = []
DEFS[B.AIR] = def([P.cream], { solid: false, opaque: false })
DEFS[B.BARRIER] = def([P.cream], { opaque: false })
DEFS[B.GRASS] = def([P.moss], { tex: 0.2 })
DEFS[B.DIRT] = def([P.earth, P.earthDeep], { tex: 0.24 })
DEFS[B.STONE] = def([P.stone, P.stoneDark, P.stoneLight], { tex: 0.2, jitter: 0.04 })
DEFS[B.COBBLE] = def([P.stoneLight, P.stone, P.creamDark], { tex: 0.22, jitter: 0.06 })
DEFS[B.GRAVEL] = def([P.gravel, P.sand, P.creamDark], { tex: 0.3, jitter: 0.04 })
DEFS[B.SAND] = def([P.sand, P.gravel], { tex: 0.18, jitter: 0.03 })
DEFS[B.MUD] = def([P.mud, P.earthDeep], { tex: 0.22 })
DEFS[B.PLASTER] = def([P.cream, P.creamDark], { tex: 0.09, jitter: 0.02 })
DEFS[B.TIMBER] = def([P.timber, P.earthDeep], { tex: 0.2, jitter: 0.04 })
DEFS[B.PLANK] = def([P.plank, P.plankLight], { tex: 0.2, jitter: 0.05 })
DEFS[B.ROOF] = def([P.terracotta, P.terracottaLight], { tex: 0.16, jitter: 0.04 })
DEFS[B.ROOF_LIGHT] = def([P.terracottaLight, P.terracotta], { tex: 0.16, jitter: 0.04 })
DEFS[B.BRICK] = def([P.terracottaDeep, P.terracotta, P.stoneDark], { tex: 0.2, jitter: 0.05 })
DEFS[B.LEAF_OAK] = leaf([P.moss, P.sage, P.mossDeep])
DEFS[B.LEAF_BIRCH] = leaf([P.sage, P.sageLight, P.moss])
DEFS[B.LEAF_WILLOW] = leaf([P.sage, P.moss, P.sageLight], 0.55)
DEFS[B.LEAF_GOLD] = def([P.butterDeep, P.butter, '#cfa94e'], {
  solid: false,
  tex: 0.26,
  wind: 0.25,
  glow: 0.05,
  jitter: 0.09,
})
DEFS[B.LEAF_BLOSSOM] = leaf([P.rose, '#e0b3a6', P.cream])
DEFS[B.LEAF_PINE] = leaf([P.forest, P.forestDeep, P.mossDeep], 0.14)
DEFS[B.BARK] = def([P.bark, P.timber], { tex: 0.26 })
DEFS[B.BIRCH] = def([P.cream, P.creamDark, P.stoneDark], { tex: 0.2, jitter: 0.03 })
DEFS[B.HEDGE] = def([P.mossDeep, '#6a8551', '#567049'], { tex: 0.36, wind: 0.05, jitter: 0.05 })
DEFS[B.HEDGE_BLOOM] = def(['#6a8551', P.moss], { tex: 0.36, wind: 0.05, jitter: 0.05 })
DEFS[B.GLASS] = def(['#f2d9a0'], { tex: 0.04, glow: 0.8, jitter: 0.02 })
DEFS[B.ROCK] = def([P.stoneDark, P.stone], { tex: 0.26, jitter: 0.07 })
DEFS[B.DIRT_PATH] = def([P.gravel, P.sand, '#b9a583'], { tex: 0.26, jitter: 0.04 })
DEFS[B.MOSSY] = def([P.stone, P.moss, P.stoneDark], { tex: 0.26, jitter: 0.06 })
DEFS[B.SOIL] = def([P.earthDeep, P.mud], { tex: 0.3 })
DEFS[B.LANTERN] = def([P.butter], { tex: 0, glow: 1.4, jitter: 0 })
DEFS[B.PETAL] = def([P.rose, P.butter, P.cream], { solid: false, tex: 0.2, wind: 0.3 })

export const SOLID = new Uint8Array(64)
export const OPAQUE = new Uint8Array(64)
DEFS.forEach((d, i) => {
  SOLID[i] = d.solid ? 1 : 0
  OPAQUE[i] = d.opaque ? 1 : 0
})
