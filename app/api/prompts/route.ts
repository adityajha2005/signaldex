import { z } from "zod";
import { withApi, throwStatus } from "@/lib/api";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(3, "name must be at least 3 characters"),
  content: z
    .string()
    .min(10, "content must be at least 10 characters")
    .max(4000, "content must not exceed 4000 characters"),
  category: z.string().min(1, "category is required"),
  modelUsed: z.string().min(1, "modelUsed is required"),
});

async function handlePost(request: Request): Promise<unknown> {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors).flat()[0] ??
      "Invalid body";
    throwStatus(msg, 400);
  }
  const { name, content, category, modelUsed } = parsed.data;

  const prompt = await prisma.prompt.create({
    data: { name, content, category, modelUsed },
    select: { id: true, name: true, category: true, modelUsed: true, createdAt: true },
  });

  return prompt;
}

export const POST = withApi(handlePost);
