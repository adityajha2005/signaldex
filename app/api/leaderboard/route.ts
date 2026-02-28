import { withApi } from "@/lib/api";
import { prisma } from "@/lib/db";

async function handleGet(): Promise<unknown> {
  const rows = await prisma.evaluationAggregate.findMany({
    orderBy: [{ sharpeRatio: "desc" }, { meanScore: "desc" }],
    take: 20,
    select: {
      meanScore: true,
      volatility: true,
      sharpeRatio: true,
      prompt: {
        select: { id: true, name: true, category: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.prompt.id,
    name: row.prompt.name,
    category: row.prompt.category,
    meanScore: row.meanScore,
    volatility: row.volatility,
    sharpeRatio: row.sharpeRatio,
  }));
}

export const GET = withApi(async () => handleGet());
