import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminEntryPage from "./page";

vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, className }, children),
}));

vi.mock("@/lib/auth/get-user", () => ({
  getUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: vi.fn(async () => true),
}));

describe("AdminEntryPage", () => {
  it("includes the persona batch admin entry", async () => {
    const markup = renderToStaticMarkup(await AdminEntryPage());

    expect(markup).toContain("AI Control Plane");
    expect(markup).toContain("AI Persona Batch");
    expect(markup).toContain("/admin/ai/persona-batch");
  });
});
