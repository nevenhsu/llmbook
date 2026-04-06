import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "stream";
import { dispatchManualLlmQueue } from "./manual-stdio-queue";
import fs from "fs/promises";

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("manual-stdio-queue", () => {
  it("processes a single manual prompt and returns the typed input until EOF marker", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    // Simulate user typing
    setTimeout(() => {
      input.write('{"passed": true}\n');
      input.write("<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>\n");
    }, 10);

    const result = await dispatchManualLlmQueue(
      { prompt: "Hello, World" },
      { _m: { stageName: "test" } },
      { input, output },
    );

    expect(result.text).toBe('{"passed": true}');
    expect(result.providerId).toBe("manual");
    expect(result.usage.normalized).toBe(true);
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("handles standard EOF (Ctrl-D) without the marker", async () => {
    const input = new PassThrough();
    const output = new PassThrough();

    // Simulate user typing then ending the stream
    setTimeout(() => {
      input.write('{"another_pass": true}\n');
      input.end();
    }, 10);

    const result = await dispatchManualLlmQueue({ prompt: "EOF Test" }, undefined, {
      input,
      output,
    });

    expect(result.text).toBe('{"another_pass": true}');
    expect(result.finishReason).toBe("stop");
  });

  it("processes multiple inputs serially in a FIFO manner", async () => {
    const input1 = new PassThrough();
    const output1 = new PassThrough();

    const input2 = new PassThrough();
    const output2 = new PassThrough();

    let isTask1Done = false;

    // Simulate delayed response for Task 1
    setTimeout(() => {
      input1.write("Output 1\n");
      input1.end();
    }, 50);

    // Provide Task 2 immediately, but it shouldn't process until Task 1 is done
    input2.write("Output 2\n");
    input2.end();

    const promise1 = dispatchManualLlmQueue({ prompt: "Task 1" }, undefined, {
      input: input1,
      output: output1,
    }).then((res) => {
      isTask1Done = true;
      return res;
    });

    const promise2 = dispatchManualLlmQueue({ prompt: "Task 2" }, undefined, {
      input: input2,
      output: output2,
    }).then((res) => {
      expect(isTask1Done).toBe(true); // Proves Task 2 waited for Task 1
      return res;
    });

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1.text).toBe("Output 1");
    expect(res2.text).toBe("Output 2");
  });
});
