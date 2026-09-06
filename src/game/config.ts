// Proposed starting values for playtesting; these are tuning constants, not requirements.
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const GROUND_Y = 504;
export const DANGER_Y = 140;

export const SHIP_WIDTH = 40;
export const SHIP_HEIGHT = 16;
export const SHIP_START_X = 0;
export const SHIP_START_Y = 72;
export const SHIP_SPEED = 180;
export const SHIP_DESCENT_PER_LAP = 16;

export const TOWER_COUNT = 9;
export const TOWER_WIDTH = 64;
export const TOWER_FIRST_X = 48;
export const TOWER_SPACING = 100;
export const TOWER_MIN_HEIGHT = 40;
export const TOWER_MAX_HEIGHT = 110;
export const TOWER_MIN_GROWTH = 3;
export const TOWER_MAX_GROWTH = 7;
export const TOWER_RESPAWN_SECONDS = 2;
export const TOWER_HEIGHT_CAP = GROUND_Y - DANGER_Y;

export const BOMB_WIDTH = 6;
export const BOMB_HEIGHT = 12;
export const BOMB_SPEED = 420;
export const TOWER_SCORE = 100;

export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_SECONDS = 0.1;

export const COLOURS = {
  navy: 0x101827,
  cream: 0xf6edcf,
  amber: 0xe8a443,
  red: 0x8d2535,
} as const;
