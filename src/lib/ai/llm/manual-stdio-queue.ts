import * as readline from "readline/promises";
import path from "path";
import fs from "fs/promises";
import type { LlmGenerateTextInput, InvokeLlmOutput } from "./types";

let currentTaskPromise: Promise<void> = Promise.resolve();
let invokeCounter = 0;

const RESPONSE_END_MARKER = "<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>";

async function writePromptLog(invokeId: number, content: string): Promise<void> {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;

  const dir = path.join(process.cwd(), "logs", "manual-prompts");
  await fs.mkdir(dir, { recursive: true });

  const filename = `prompt-${timestamp}-${invokeId}.txt`;
  await fs.writeFile(path.join(dir, filename), content, "utf-8");
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

  console.log("\n=======================================================");
  console.log(`[MANUAL LLM TICK: Waiting for human paste | Invoke #${invokeId}]`);
  console.log(JSON.stringify(header, null, 2));
  console.log("-------------------------------------------------------");
  console.log(fullPromptOutput);
  console.log("-------------------------------------------------------");
  console.log("請將上述 Prompt 複製，並貼到網頁端 LLM (如 ChatGPT / Claude) 中。");
  console.log("接著，請將從該界面取得的「純文字回覆」貼在下方。");
  console.log(`貼完後，請在新的一行輸入： ${RESPONSE_END_MARKER}`);
  console.log("或者在空白行按 Ctrl-D (EOF) 結束輸入。");
  console.log("=======================================================\n");

  // Write log async
  await writePromptLog(invokeId, fullPromptOutput).catch((err) => {
    console.error(`[ManualLLM] Failed to write prompt log: ${(err as Error).message}`);
  });

  const rl = readline.createInterface({
    input: options?.input ?? process.stdin,
    output: options?.output ?? process.stdout,
    terminal: true,
  });

  let collectedText = "";

  try {
    for await (const line of rl) {
      if (line.trim() === RESPONSE_END_MARKER) {
        break;
      }
      collectedText += line + "\n";
    }
  } finally {
    rl.close();
  }

  return {
    text: collectedText.trim(),
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
