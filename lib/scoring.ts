const DECIMALS = 4;

function round4(x: number): number {
  return Math.round(x * 10 ** DECIMALS) / 10 ** DECIMALS;
}

export type Metrics = {
  meanScore: number;
  stdDeviation: number;
  volatility: number;
  roi: number;
  sharpeRatio: number;
};

/**
 * Compute aggregate metrics from a list of 0–1 scores.
 */
export function calculateMetrics(scores: number[]): Metrics {
  const n = scores.length;
  if (n === 0) {
    return {
      meanScore: 0,
      stdDeviation: 0,
      volatility: 0,
      roi: 0,
      sharpeRatio: 0,
    };
  }

  // Arithmetic mean of all scores
  const meanScore = scores.reduce((a, b) => a + b, 0) / n;

  // Population standard deviation: sqrt(mean of squared deviations from mean)
  const variance =
    scores.reduce((sum, x) => sum + (x - meanScore) ** 2, 0) / n;
  const stdDeviation = Math.sqrt(variance);

  // Volatility: same as std dev for this model (spread of outcomes)
  const volatility = stdDeviation;

  // ROI vs neutral baseline (0.5): how much better than random
  const baselineScore = 0.5;
  const roi = meanScore - baselineScore;

  // Sharpe-like ratio: excess return per unit risk; 0 when no variance
  const sharpeRatio =
    stdDeviation > 0 ? roi / stdDeviation : 0;

  return {
    meanScore: round4(meanScore),
    stdDeviation: round4(stdDeviation),
    volatility: round4(volatility),
    roi: round4(roi),
    sharpeRatio: round4(sharpeRatio),
  };
}
