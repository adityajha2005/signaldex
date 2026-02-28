# Signaldex

Deterministic prompt evaluation engine. Submit prompts, run benchmarks against xAI (Grok), get scores and aggregates. Leaderboard by Sharpe-like ratio. Confidence allocation (points) per user per prompt. Web2 demo — no crypto, no payments.

## Stack

- **Next.js** (App Router), **TypeScript**
- **Prisma** + **PostgreSQL** (Neon)
- **xAI API** (Grok, temperature 0)
- **Zod** for validation

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. Neon with `?sslmode=require`) |
| `XAI_API_KEY` | Yes | xAI API key |
| `INTERNAL_API_KEY` | Yes | Secret for protecting `POST /api/evaluate` (e.g. 32-byte hex) |
| `XAI_MODEL` | No | Model name (default: `grok-4-1-fast-reasoning`) |

```bash
npx prisma migrate dev --name init
npm run dev
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/prompts` | — | Create prompt. Body: `name`, `content` (10–4000 chars), `category`. Evaluations run on Signaldex. |
| POST | `/api/evaluate` | `x-api-key` header | Run benchmarks for a prompt. Body: `promptId`, `category` (optional, default `general`). Persists runs and aggregate. |
| GET | `/api/leaderboard` | — | Top 20 prompts by `sharpeRatio` DESC, `meanScore` DESC. |
| POST | `/api/allocate` | — | Allocate confidence points. Body: `userId`, `promptId`, `points` (1–1000). Max 1000 points per user total. |

All responses: `{ success: boolean, data?: T, error?: string }`.

## Example

```bash
# Create prompt
curl -X POST http://localhost:3000/api/prompts \
  -H "Content-Type: application/json" \
  -d '{"name":"My Prompt","content":"You are a helpful assistant. Answer concisely.","category":"general"}'

# Evaluate (use prompt id and your INTERNAL_API_KEY)
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -d '{"promptId":"<id>","category":"general"}'

# Leaderboard
curl http://localhost:3000/api/leaderboard
```

## SDK

Install the official client:

```bash
npm install @signaldex/sdk
```

```ts
import { createClient } from "@signaldex/sdk";

const client = createClient({
  baseUrl: "https://your-signaldex.com",
  apiKey: "your-internal-api-key",
});
const created = await client.createPrompt({ name, content, category });
const result = await client.evaluate({ promptId: created.data.id });
```

See [packages/sdk/README.md](packages/sdk/README.md) for full API. To publish the SDK: from `packages/sdk`, run `npm run build` then `npm publish --access public` (requires npm org `signaldex` or a scoped account).

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production
- `npm run lint` — ESLint
- `npx prisma studio` — DB UI
- `npx prisma migrate dev` — run migrations
