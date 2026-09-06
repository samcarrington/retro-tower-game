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

export interface GameState {
  status: GameStatus;
  score: number;
  ship: ShipState;
  bomb: Rect | null;
  towers: TowerState[];
  reason: GameOverReason;
}

export type RandomSource = () => number;

// Rectangle coordinates are top-left based. AABB contact is inclusive, so touching edges collide.
// Towers cap at groundY - dangerY. Bombs clear once their top reaches the 540px world bottom.
// Random sources return a unit interval value; supplied values are clamped to [0, 1].
