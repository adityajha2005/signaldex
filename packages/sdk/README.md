# @signaldex/sdk

Signaldex API client for Node and browser. Create prompts, run evaluations, fetch leaderboard, allocate confidence points.

## Install

```bash
npm install @signaldex/sdk
```

## Usage

```ts
import { createClient } from "@signaldex/sdk";

const client = createClient({
  baseUrl: "https://your-signaldex.com", // or http://localhost:3000
  apiKey: "your-internal-api-key",         // required for evaluate()
});

// Create a prompt
const created = await client.createPrompt({
  name: "My Prompt",
  content: "You are a helpful assistant. Answer concisely.",
  category: "general",
  modelUsed: "grok-4-1-fast-reasoning",
});
if (!created.success) throw new Error(created.error);
const promptId = created.data.id;

// Run evaluation (uses apiKey)
const result = await client.evaluate({ promptId, category: "general" });
if (result.success) console.log(result.data.metrics);

// Leaderboard
const board = await client.getLeaderboard();
if (board.success) console.log(board.data);

// Allocate confidence points
const alloc = await client.allocate({
  userId: "user-uuid",
  promptId: "prompt-uuid",
  points: 100,
});
if (alloc.success) console.log(alloc.data.totalConfidence);
```

## API

- `createClient({ baseUrl?, apiKey? })` — returns client
- `client.createPrompt(params)` — POST /api/prompts
- `client.evaluate({ promptId, category? })` — POST /api/evaluate (requires apiKey)
- `client.getLeaderboard()` — GET /api/leaderboard
- `client.allocate({ userId, promptId, points })` — POST /api/allocate

All methods return `Promise<ApiResponse<T>>`: `{ success: true, data }` or `{ success: false, error }`.
