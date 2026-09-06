export interface HighScoreEntry {
  runId: number;
  score: number;
}

export const HIGH_SCORE_LIMIT = 5;

export function recordHighScore(
  scores: HighScoreEntry[],
  entry: HighScoreEntry,
  limit = HIGH_SCORE_LIMIT,
): HighScoreEntry[] {
  if (scores.some((score) => score.runId === entry.runId)) return scores;
  return [...scores, entry]
    .sort((left, right) => right.score - left.score || left.runId - right.runId)
    .slice(0, Math.max(0, limit));
}
