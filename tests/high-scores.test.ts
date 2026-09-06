import { describe, expect, it } from "vitest";
import { recordHighScore } from "../src/browser/high-scores";

describe("runtime high scores", () => {
  it("sorts scores, keeps five entries, and records each run once", () => {
    const scores = [
      { runId: 1, score: 100 },
      { runId: 2, score: 500 },
      { runId: 3, score: 300 },
      { runId: 4, score: 200 },
      { runId: 5, score: 400 },
    ];

    expect(recordHighScore(scores, { runId: 6, score: 600 })).toEqual([
      { runId: 6, score: 600 },
      { runId: 2, score: 500 },
      { runId: 5, score: 400 },
      { runId: 3, score: 300 },
      { runId: 4, score: 200 },
    ]);
    expect(recordHighScore(scores, { runId: 2, score: 999 })).toEqual(scores);
  });
});
