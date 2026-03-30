import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isAdmin,
  getLatestWritePreview,
  getCompressionBatchPreview,
  getCompressionPreview,
  compressPersona,
  persistLatestWrite,
} = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getLatestWritePreview: vi.fn(),
  getCompressionBatchPreview: vi.fn(),
  getCompressionPreview: vi.fn(),
  compressPersona: vi.fn(),
  persistLatestWrite: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/server/route-helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    http: {
      badRequest: (message = "Bad Request") =>
        NextResponse.json({ error: message }, { status: 400 }),
      forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
      notFound: (message = "Not Found") => NextResponse.json({ error: message }, { status: 404 }),
      ok: (data: unknown) => NextResponse.json(data, { status: 200 }),
    },
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/memory", () => ({
  AiAgentMemoryAdminService: class {
    getLatestWritePreview = getLatestWritePreview;
    getCompressionBatchPreview = getCompressionBatchPreview;
    getCompressionPreview = getCompressionPreview;
    compressPersona = compressPersona;
    persistLatestWrite = persistLatestWrite;
  },
}));

describe("memory artifact routes", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    getLatestWritePreview.mockReset();
    getCompressionBatchPreview.mockReset();
    getCompressionPreview.mockReset();
    compressPersona.mockReset();
    persistLatestWrite.mockReset();
  });

  it("returns latest-write preview", async () => {
    getLatestWritePreview.mockResolvedValue({ path: "deterministic_comment" });
    const { GET } = await import("./latest-write-preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/ai/agent/memory/personas/persona-1/latest-write-preview",
      ),
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(getLatestWritePreview).toHaveBeenCalledWith("persona-1");
  });

  it("returns compression-batch preview", async () => {
    getCompressionBatchPreview.mockResolvedValue({ selectedShortMemoryIds: ["m1"] });
    const { POST } = await import("./compression-batch-preview/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/ai/agent/memory/personas/persona-1/compression-batch-preview",
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(getCompressionBatchPreview).toHaveBeenCalledWith("persona-1");
  });

  it("returns compression preview", async () => {
    getCompressionPreview.mockResolvedValue({ renderedLongMemory: "# Canonical Memory" });
    const { POST } = await import("./preview-compression/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/ai/agent/memory/personas/persona-1/preview-compression",
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(getCompressionPreview).toHaveBeenCalledWith("persona-1");
  });

  it("returns persisted compress response", async () => {
    compressPersona.mockResolvedValue({ mode: "persisted", personaId: "persona-1" });
    const { POST } = await import("./compress/route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/memory/personas/persona-1/compress", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(compressPersona).toHaveBeenCalledWith("persona-1");
  });

  it("returns persisted latest-write response", async () => {
    persistLatestWrite.mockResolvedValue({ mode: "persisted", personaId: "persona-1" });
    const { POST } = await import("./persist-latest-write/route");
    const response = await POST(
      new Request(
        "http://localhost/api/admin/ai/agent/memory/personas/persona-1/persist-latest-write",
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(persistLatestWrite).toHaveBeenCalledWith("persona-1");
  });
});
