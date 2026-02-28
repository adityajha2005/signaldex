import { z } from "zod";
import { withApi, throwStatus, requireApiKey } from "@/lib/api";
import { evaluateSingleRun } from "@/lib/evaluation";
import { getBenchmarks } from "@/lib/benchmarks";
import { calculateMetrics } from "@/lib/scoring";
import { prisma } from "@/lib/db";

const CONCURRENCY_LIMIT = 5;

const bodySchema = z.object({
  promptId: z.string().uuid("promptId must be a valid UUID"),
  category: z.string().optional().default("general"),
});

async function runWithLimit<T, R>(
  tasks: T[],
  limit: number,
  fn: (task: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const chunk = tasks.slice(i, i + limit);
    const settled = await Promise.allSettled(chunk.map((t) => fn(t)));
    results.push(...settled);
  }
  return results;
}

async function handlePost(request: Request): Promise<unknown> {
  requireApiKey(request);

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid body";
    throwStatus(msg, 400);
  }
  const { promptId, category } = parsed.data;

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, content: true },
  });
  if (!prompt) throwStatus("Prompt not found", 404);

  const benchmarks = getBenchmarks(category);
  const settled = await runWithLimit(
    benchmarks,
    CONCURRENCY_LIMIT,
    (testInput) => evaluateSingleRun(prompt.content, testInput)
  );

  const successful: Array<{ testInput: string; output: string; score: number }> = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      successful.push({
        testInput: benchmarks[i],
        output: result.value.output,
        score: result.value.score,
      });
    } else {
      console.error(
        `[evaluate] Failed run for benchmark "${benchmarks[i]}":`,
        result.reason
      );
    }
  });

  if (successful.length > 0) {
    const metrics = calculateMetrics(successful.map((r) => r.score));

    await prisma.$transaction([
      ...successful.map((r) =>
        prisma.evaluationRun.create({
          data: {
            promptId,
            testInput: r.testInput,
            output: r.output,
            rawScore: r.score,
          },
        })
      ),
      prisma.evaluationAggregate.upsert({
        where: { promptId },
        create: {
          promptId,
          meanScore: metrics.meanScore,
          stdDeviation: metrics.stdDeviation,
          volatility: metrics.volatility,
          roi: metrics.roi,
          sharpeRatio: metrics.sharpeRatio,
        },
        update: {
          meanScore: metrics.meanScore,
          stdDeviation: metrics.stdDeviation,
          volatility: metrics.volatility,
          roi: metrics.roi,
          sharpeRatio: metrics.sharpeRatio,
        },
      }),
    ]);

    return {
      promptId,
      scores: successful.map((r) => r.score),
      failedCount: benchmarks.length - successful.length,
      metrics,
    };
  }

  return {
    promptId,
    scores: [],
    failedCount: benchmarks.length,
    metrics: calculateMetrics([]),
  };
}

export const POST = withApi(handlePost);
