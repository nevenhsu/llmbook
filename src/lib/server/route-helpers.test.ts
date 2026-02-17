import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { jsonError, jsonOk, http, validateBody, parseJsonBody } from "./route-helpers";

describe("jsonError", () => {
  it("returns error response with default 500 status", () => {
    const response = jsonError("Something went wrong");
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(500);
  });

  it("returns error response with custom status", () => {
    const response = jsonError("Not found", 404);
    expect(response.status).toBe(404);
  });

  it("returns error in body", async () => {
    const response = jsonError("Custom error", 400);
    const body = await response.json();
    expect(body).toEqual({ error: "Custom error" });
  });
});

describe("jsonOk", () => {
  it("returns success response with default 200 status", () => {
    const response = jsonOk({ id: "123" });
    expect(response.status).toBe(200);
  });

  it("returns success response with custom status", () => {
    const response = jsonOk({ id: "123" }, 201);
    expect(response.status).toBe(201);
  });

  it("returns data in body", async () => {
    const data = { score: 10, userVote: 1 };
    const response = jsonOk(data);
    const body = await response.json();
    expect(body).toEqual(data);
  });
});

describe("http helpers", () => {
  it("badRequest returns 400", () => {
    const response = http.badRequest("Invalid input");
    expect(response.status).toBe(400);
  });

  it("unauthorized returns 401", () => {
    const response = http.unauthorized();
    expect(response.status).toBe(401);
  });

  it("forbidden returns 403", () => {
    const response = http.forbidden();
    expect(response.status).toBe(403);
  });

  it("notFound returns 404", () => {
    const response = http.notFound();
    expect(response.status).toBe(404);
  });

  it("conflict returns 409", () => {
    const response = http.conflict();
    expect(response.status).toBe(409);
  });

  it("internalError returns 500", () => {
    const response = http.internalError();
    expect(response.status).toBe(500);
  });

  it("ok returns 200 with data", async () => {
    const data = { success: true };
    const response = http.ok(data);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
  });

  it("created returns 201 with data", async () => {
    const data = { id: "new-id" };
    const response = http.created(data);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(data);
  });
});

describe("validateBody", () => {
  it("returns valid for complete body", () => {
    const body = { title: "Test", boardId: "123" };
    const result = validateBody(body, ["title", "boardId"]);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual(body);
    }
  });

  it("returns invalid for missing fields", () => {
    const body = { title: "Test" };
    const result = validateBody(body, ["title", "boardId"]);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.response.status).toBe(400);
    }
  });

  it("returns invalid for null fields", () => {
    const body = { title: "Test", boardId: null };
    const result = validateBody(body, ["title", "boardId"]);

    expect(result.valid).toBe(false);
  });

  it("returns invalid for undefined fields", () => {
    const body = { title: "Test", boardId: undefined };
    const result = validateBody(body, ["title", "boardId"]);

    expect(result.valid).toBe(false);
  });

  it("error message includes missing field names", async () => {
    const body = {};
    const result = validateBody(body, ["title", "body"]);

    if (!result.valid) {
      const json = await result.response.json();
      expect(json.error).toContain("title");
      expect(json.error).toContain("body");
    }
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON body", async () => {
    const body = { test: "data" };
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const result = await parseJsonBody(request);
    expect(result).toEqual(body);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not valid json",
    });

    const result = await parseJsonBody(request);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("error message indicates invalid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not valid json",
    });

    const result = await parseJsonBody(request);
    const body = await (result as NextResponse).json();
    expect(body.error).toContain("Invalid JSON");
  });
});
