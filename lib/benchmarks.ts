const BENCHMARKS: Record<string, string[]> = {
  marketing: [
    "Rewrite this product description to increase urgency.",
    "Improve this landing page headline for higher conversion.",
  ],
  general: [
    "Summarize this paragraph in 2 sentences.",
    "Rewrite this text to sound more professional.",
  ],
};

const DEFAULT = BENCHMARKS.general;

export function getBenchmarks(category: string): string[] {
  return BENCHMARKS[category] ?? DEFAULT;
}
