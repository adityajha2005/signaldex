import { z } from "zod";
import { withApi, throwStatus } from "@/lib/api";
import { prisma } from "@/lib/db";

const MIN_POINTS = 1;
const MAX_POINTS = 1000;
const MAX_USER_TOTAL = 1000;

const bodySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  promptId: z.string().uuid("promptId must be a valid UUID"),
  points: z.coerce
    .number()
    .int()
    .min(MIN_POINTS, `points must be between ${MIN_POINTS} and ${MAX_POINTS}`)
    .max(MAX_POINTS, `points must be between ${MIN_POINTS} and ${MAX_POINTS}`),
});

async function handlePost(request: Request): Promise<unknown> {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid body";
    throwStatus(msg, 400);
  }
  const { userId, promptId, points: pointsInt } = parsed.data;

  let totalConfidence: number;
  try {
    totalConfidence = await prisma.$transaction(async (tx) => {
      const existing = await tx.confidenceAllocation.findUnique({
        where: { userId_promptId: { userId, promptId } },
        select: { points: true },
      });

      const userTotalResult = await tx.confidenceAllocation.aggregate({
        where: { userId },
        _sum: { points: true },
      });
      const currentUserTotal = userTotalResult._sum.points ?? 0;
      const newUserTotal = currentUserTotal - (existing?.points ?? 0) + pointsInt;

      if (newUserTotal > MAX_USER_TOTAL) {
        throwStatus(
          `User total allocation cannot exceed ${MAX_USER_TOTAL} points`,
          400
        );
      }

      await tx.confidenceAllocation.upsert({
        where: { userId_promptId: { userId, promptId } },
        create: { userId, promptId, points: pointsInt },
        update: { points: pointsInt },
      });

      const promptTotalResult = await tx.confidenceAllocation.aggregate({
        where: { promptId },
        _sum: { points: true },
      });
      return promptTotalResult._sum.points ?? 0;
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    const err = e as Error & { code?: string; status?: number };
    if (err?.status != null) throw e; // re-throw our own throwStatus errors
    if (err?.code === "P2003") throwStatus("User or prompt not found", 404);
    throw e;
  }

  return { totalConfidence };
}

export const POST = withApi(handlePost);
