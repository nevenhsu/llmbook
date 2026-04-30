import dotenv from "dotenv";
import { resolve } from "node:path";
import { generateText } from "ai";
import { createMinimax } from "vercel-minimax-ai-provider";

dotenv.config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });

const apiKey = (process.env.MINIMAX_API_KEY || "").trim();

if (!apiKey) {
  console.error("MINIMAX_API_KEY missing");
  process.exit(1);
}

const baseUrls = [
  "https://api.minimaxi.com/anthropic/v1",
  "https://api.minimaxi.com/anthropic",
  "https://api.minimax.io/v1",
  "https://api.minimax.com/anthropic/v1",
  "https://api.minimax.com/v1",
];

const modelIds = ["MiniMax-M2.5"];

function toErr(input: unknown): { message: string; statusCode?: number; code?: string } {
  if (input instanceof Error) {
    const anyErr = input as Error & { statusCode?: number; code?: string; cause?: unknown };
    const cause = (anyErr.cause ?? null) as {
      statusCode?: number;
      code?: string;
      message?: string;
    } | null;
    return {
      message: anyErr.message,
      statusCode:
        typeof anyErr.statusCode === "number"
          ? anyErr.statusCode
          : typeof cause?.statusCode === "number"
            ? cause.statusCode
            : undefined,
      code:
        typeof anyErr.code === "string"
          ? anyErr.code
          : typeof cause?.code === "string"
            ? cause.code
            : undefined,
    };
  }
  return { message: String(input) };
}

async function main() {
  for (const baseURL of baseUrls) {
    for (const modelId of modelIds) {
      const startedAt = Date.now();
      try {
        const client = createMinimax({ apiKey, baseURL });
        const model = client(modelId);
        const output = await generateText({
          model,
          prompt: "Respond with exactly: pong",
          maxOutputTokens: 32,
          temperature: 0,
        });
        console.log(
          JSON.stringify({
            ok: true,
            baseURL,
            modelId,
            finishReason: output.finishReason,
            text: output.text,
            elapsedMs: Date.now() - startedAt,
          }),
        );
      } catch (error) {
        const parsed = toErr(error);
        console.log(
          JSON.stringify({
            ok: false,
            baseURL,
            modelId,
            message: parsed.message,
            statusCode: parsed.statusCode ?? null,
            code: parsed.code ?? null,
            elapsedMs: Date.now() - startedAt,
          }),
        );
      }
    }
  }
}

main().catch((error) => {
  const parsed = toErr(error);
  console.error(JSON.stringify({ ok: false, fatal: true, ...parsed }));
  process.exit(1);
});
