/** Original Lanternwild content. No extracted game data is read by this world. */
export const WORLD_VERSION = "lanternwild-1";
export const WIDTH = 4600;
export const SPAWN = Object.freeze({ x: 180, y: 540 });
export const BEACONS = Object.freeze([
  { x: 780, y: 345, name: "Thistledock", cost: 3 },
  { x: 2280, y: 340, name: "Amber Canopy", cost: 5 },
  { x: 4320, y: 570, name: "The Hollow Crown", cost: 8 },
]);
export const PLATFORMS = Object.freeze([
  [0, 960, 570, 80],
  [1030, 1980, 570, 110],
  [2050, 3110, 570, 90],
  [3180, 4600, 570, 140],
  [340, 600, 450, 48],
  [650, 900, 345, 58],
  [1160, 1430, 445, 55],
  [1510, 1760, 335, 65],
  [2080, 2400, 340, 75],
  [2500, 2760, 455, 50],
  [2870, 3060, 345, 60],
  [3340, 3550, 450, 60],
  [3670, 3900, 350, 80],
]);
export const GLIMMERS = Object.freeze([
  [370, 410],
  [460, 410],
  [555, 410],
  [680, 305],
  [850, 305],
  [1160, 405],
  [1320, 405],
  [1550, 295],
  [1680, 295],
  [2100, 300],
  [2370, 300],
  [2550, 415],
  [2700, 415],
  [2910, 305],
  [3020, 305],
  [3380, 410],
  [3520, 410],
  [3710, 310],
  [3850, 310],
  [4050, 525],
  [4400, 525],
]);
export const ENEMIES = Object.freeze([
  [1180, 1100, 1420],
  [1690, 1510, 1850],
  [2140, 2090, 2440],
  [2670, 2510, 2810],
  [3000, 2870, 3060],
  [3440, 3240, 3560],
  [3940, 3780, 4130],
  [4210, 4030, 4470],
]);
export const REGIONS = Object.freeze([
  {
    until: 1030,
    name: "Thistledock",
    subtitle: "Every journey begins with a little light.",
  },
  {
    until: 3180,
    name: "Amber Canopy",
    subtitle: "Follow the fireflies beyond the mist.",
  },
  {
    until: WIDTH,
    name: "The Hollow Crown",
    subtitle: "Something old is stirring in the roots.",
  },
]);

/** These movement coefficients are authored for Lanternwild, not loaded from WZ. */
export function createWorld() {
  return {
    schemaVersion: 1,
    map: { fs: 1 },
    globals: {
      walkForce: 180000,
      walkSpeed: 275,
      walkDrag: 195000,
      slipForce: 120000,
      slipSpeed: 310,
      floatDrag1: 90000,
      floatDrag2: 150000,
      floatCoefficient: 0.035,
      swimForce: 100000,
      swimSpeed: 180,
      flyForce: 100000,
      flySpeed: 170,
      gravityAcc: 1350,
      fallSpeed: 760,
      jumpSpeed: 650,
      maxFriction: 1.5,
      minFriction: 0.3,
      swimSpeedDec: 0.8,
      flyJumpDec: 0.7,
    },
    footholds: PLATFORMS.map((p, i) => ({
      id: i + 1,
      layer: 1,
      group: 0,
      x1: p[0],
      x2: p[1],
      y1: p[2],
      y2: p[2],
      prev: 0,
      next: 0,
    })),
    ladders: [
      { id: 1, x: 420, y1: 450, y2: 570, ladder: 1, uf: 1, page: 1 },
      { id: 2, x: 730, y1: 345, y2: 570, ladder: 1, uf: 1, page: 1 },
      { id: 3, x: 2200, y1: 340, y2: 570, ladder: 1, uf: 1, page: 1 },
    ],
  };
}

export function emptyInput() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false,
    attack: false,
    attackPressed: false,
    cast: false,
    castPressed: false,
    interact: false,
  };
}
