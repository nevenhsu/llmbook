import { editor } from "@inquirer/prompts";
import path from "path";
import fs from "fs/promises";
import type { LlmGenerateTextInput, InvokeLlmOutput } from "./types";

let currentTaskPromise: Promise<void> = Promise.resolve();
let invokeCounter = 0;

const RESPONSE_END_MARKER = "<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>";

async function writePromptLog(invokeId: number, content: string): Promise<string> {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;

  const dir = path.join(process.cwd(), "logs", "manual-prompts");
  await fs.mkdir(dir, { recursive: true });

  const filename = `prompt-${timestamp}-${invokeId}.txt`;
  await fs.writeFile(path.join(dir, filename), content, "utf-8");
  return filename;
}

function promptToString(input: LlmGenerateTextInput): string {
  let content = "";
  if (input.prompt) {
    content += `[Prompt]\n${input.prompt}\n\n`;
  }
  if (input.messages && input.messages.length > 0) {
    for (const msg of input.messages) {
      const texts = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      content += `[${msg.role}]\n${texts}\n\n`;
    }
  }
  return content.trim();
}

async function performManualTask(
  modelInput: Omit<LlmGenerateTextInput, "modelId">,
  metadata?: Record<string, unknown>,
  options?: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream },
): Promise<InvokeLlmOutput> {
  invokeCounter += 1;
  const invokeId = invokeCounter;

  const mData = metadata?._m as Record<string, unknown> | undefined;

  const header = {
    invokeId,
    entityId: metadata?.entityId,
    taskType: metadata?.taskType,
    maxOutputTokens: modelInput.maxOutputTokens,
    temperature: modelInput.temperature,
    ...mData,
  };

  const promptContent = promptToString(modelInput as LlmGenerateTextInput);

  const fullPromptOutput = `<<<AI_AGENT_MANUAL_LLM_PROMPT_BEGIN>>>\n${promptContent}\n<<<AI_AGENT_MANUAL_LLM_PROMPT_END>>>`;

  let logFilename = "unknown";
  try {
    logFilename = await writePromptLog(invokeId, fullPromptOutput);
  } catch (err) {
    console.error(`[ManualLLM] Failed to write prompt log: ${(err as Error).message}`);
  }

  console.log("\n=======================================================");
  console.log(`[MANUAL LLM TICK: Waiting for human paste | Invoke #${invokeId}]`);
  console.log(JSON.stringify(header, null, 2));
  console.log("-------------------------------------------------------");
  console.log(fullPromptOutput);
  console.log("-------------------------------------------------------");
  console.log(
    `Please copy the Prompt above and paste it into a web-based LLM (e.g. ChatGPT / Claude).`,
  );
  console.log(`(A copy of this prompt has been saved to: logs/manual-prompts/${logFilename})`);
  console.log(
    `Then, select the editor below to paste the "raw text response" from that interface.`,
  );
  console.log(
    `(The editor will open your default terminal text editor like Vim or Nano. Paste, save, and exit.)`,
  );
  console.log(
    `If you optionally included ${RESPONSE_END_MARKER}, it will be trimmed automatically.`,
  );
  console.log("=======================================================\n");

  const collectedText = await editor(
    { message: "Press Enter to open the editor and paste the response. Save and close to submit." },
    { input: options?.input ?? process.stdin, output: options?.output ?? process.stdout } as any,
  );

  const cleanText = collectedText.replace(new RegExp(`${RESPONSE_END_MARKER}\\s*$`), "").trim();

  return {
    text: cleanText,
    finishReason: "stop",
    providerId: "manual",
    modelId: "manual-paste",
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      normalized: true,
    },
    usedFallback: false,
    attempts: 1,
    path: ["manual"],
  };
}

export function dispatchManualLlmQueue(
  modelInput: Omit<LlmGenerateTextInput, "modelId">,
  metadata?: Record<string, unknown>,
  options?: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream },
): Promise<InvokeLlmOutput> {
  const promise = currentTaskPromise.then(async () => {
    return await performManualTask(modelInput, metadata, options);
  });

  // Keep the queue moving even if a task failed theoretically
  currentTaskPromise = promise.catch(() => {}) as Promise<void>;

  return promise;
}
