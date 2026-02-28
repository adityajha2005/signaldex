export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type Prompt = {
  id: string;
  name: string;
  category: string;
  modelUsed: string;
  createdAt: string;
};

export type Metrics = {
  meanScore: number;
  stdDeviation: number;
  volatility: number;
  roi: number;
  sharpeRatio: number;
};

export type EvaluateResult = {
  promptId: string;
  scores: number[];
  failedCount: number;
  metrics: Metrics;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  category: string;
  meanScore: number;
  volatility: number;
  sharpeRatio: number;
};

export type CreatePromptParams = {
  name: string;
  content: string;
  category: string;
  modelUsed: string;
};

export type EvaluateParams = {
  promptId: string;
  category?: string;
};

export type AllocateParams = {
  userId: string;
  promptId: string;
  points: number;
};

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit & { apiKey?: string } = {}
): Promise<ApiResponse<T>> {
  const { apiKey, ...init } = options;
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(url, { ...init, headers });
  const json = (await res.json()) as ApiResponse<T> & { success?: boolean };
  if (!res.ok) {
    return {
      success: false,
      error: "error" in json ? json.error : `HTTP ${res.status}`,
    };
  }
  return json as ApiResponse<T>;
}

export type SignaldexClientOptions = {
  baseUrl?: string;
  apiKey?: string;
};

export function createClient(options: SignaldexClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "https://your-signaldex-instance.com";
  const apiKey = options.apiKey;

  return {
    /** Create a prompt. */
    async createPrompt(
      params: CreatePromptParams
    ): Promise<ApiResponse<Prompt>> {
      return request<Prompt>(baseUrl, "/api/prompts", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /** Run evaluation for a prompt. Requires apiKey in client options. */
    async evaluate(params: EvaluateParams): Promise<ApiResponse<EvaluateResult>> {
      if (!apiKey) {
        return {
          success: false,
          error: "apiKey is required for evaluate()",
        };
      }
      return request<EvaluateResult>(baseUrl, "/api/evaluate", {
        method: "POST",
        apiKey,
        body: JSON.stringify({
          promptId: params.promptId,
          category: params.category ?? "general",
        }),
      });
    },

    /** Get top 20 prompts by sharpeRatio, then meanScore. */
    async getLeaderboard(): Promise<ApiResponse<LeaderboardEntry[]>> {
      return request<LeaderboardEntry[]>(baseUrl, "/api/leaderboard", {
        method: "GET",
      });
    },

    /** Allocate confidence points (1–1000). Max 1000 total per user. */
    async allocate(
      params: AllocateParams
    ): Promise<ApiResponse<{ totalConfidence: number }>> {
      return request<{ totalConfidence: number }>(baseUrl, "/api/allocate", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
  };
}

export type SignaldexClient = ReturnType<typeof createClient>;
