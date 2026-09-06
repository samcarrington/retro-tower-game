import { FIXED_STEP_SECONDS, MAX_FRAME_SECONDS } from "../game/config";

export interface AnimationFrameDriver {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface FixedStepClockOptions {
  step: (dtSeconds: number) => void;
  render: (frameSeconds: number) => void;
  driver?: AnimationFrameDriver;
}

const browserDriver: AnimationFrameDriver = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export class FixedStepClock {
  private readonly stepCallback: (dtSeconds: number) => void;
  private readonly renderCallback: (frameSeconds: number) => void;
  private readonly driver: AnimationFrameDriver;
  private frameHandle: number | null = null;
  private previousTimestamp: number | null = null;
  private accumulator = 0;
  private active = false;
  private disposed = false;

  public constructor(options: FixedStepClockOptions) {
    this.stepCallback = options.step;
    this.renderCallback = options.render;
    this.driver = options.driver ?? browserDriver;
  }

  public start(): void {
    if (this.frameHandle !== null || this.disposed) return;
    this.frameHandle = this.driver.request(this.onFrame);
  }

  public setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.discardElapsedTime();
  }

  public reset(): void {
    this.discardElapsedTime();
  }

  public advance(timestamp: number): void {
    if (!Number.isFinite(timestamp)) return;
    if (this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
      this.renderCallback(0);
      return;
    }

    const elapsed = Math.max(0, (timestamp - this.previousTimestamp) / 1000);
    this.previousTimestamp = timestamp;

    const activeElapsed = this.active ? Math.min(elapsed, MAX_FRAME_SECONDS) : 0;
    if (activeElapsed > 0) {
      this.accumulator += activeElapsed;
      while (this.accumulator + Number.EPSILON >= FIXED_STEP_SECONDS) {
        this.stepCallback(FIXED_STEP_SECONDS);
        this.accumulator -= FIXED_STEP_SECONDS;
      }
    }

    this.renderCallback(activeElapsed);
  }

  public dispose(): void {
    this.disposed = true;
    if (this.frameHandle !== null) {
      this.driver.cancel(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private readonly onFrame: FrameRequestCallback = (timestamp) => {
    this.frameHandle = null;
    if (this.disposed) return;
    this.advance(timestamp);
    this.frameHandle = this.driver.request(this.onFrame);
  };

  private discardElapsedTime(): void {
    this.previousTimestamp = null;
    this.accumulator = 0;
  }
}
