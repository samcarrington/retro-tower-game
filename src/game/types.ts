export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GameStatus = "ready" | "playing" | "gameover";
export type GameOverReason = "tower-limit" | "ship-collision" | "ground" | null;

export interface ShipState {
  rect: Rect;
  laps: number;
}

export interface TowerState {
  rect: Rect;
  height: number;
  growthRate: number;
  respawnRemaining: number;
}

export interface BombState {
  rect: Rect;
  velocityX: number;
  velocityY: number;
}

export type GameEffectType = "bomb-drop" | "tower-explosion" | "player-explosion";

export interface GameEffect {
  id: number;
  type: GameEffectType;
  x: number;
  y: number;
}

export interface GameState {
  status: GameStatus;
  runId: number;
  elapsedSeconds: number;
  score: number;
  ship: ShipState;
  bomb: BombState | null;
  towers: TowerState[];
  destroyedTowerMask: number;
  towerClearBonusAwarded: boolean;
  effects: GameEffect[];
  nextEffectId: number;
  reason: GameOverReason;
}

export type RandomSource = () => number;

// Rectangle coordinates are top-left based. AABB contact is inclusive, so touching edges collide.
// Towers cap at groundY - dangerY. Bombs clear after leaving the bottom or right world edge.
// Random sources return a unit interval value; supplied values are clamped to [0, 1].
