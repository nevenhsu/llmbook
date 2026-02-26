export type ToolSchemaProperty = {
  type: "string" | "number" | "boolean";
  description?: string;
  enum?: string[];
};

export type ToolSchema = {
  type: "object";
  properties: Record<string, ToolSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolHandlerContext = {
  entityId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export type ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> = {
  name: string;
  description: string;
  schema: ToolSchema;
  handler: (args: TArgs, context: ToolHandlerContext) => Promise<TResult>;
};

export type RegisteredTool = ToolDefinition<Record<string, unknown>, unknown>;

export type ToolValidationResult =
  | { ok: true; normalizedArgs: Record<string, unknown> }
  | { ok: false; message: string };

export type ToolExecutionResult = {
  ok: boolean;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  validationError?: string;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePropertyType(value: unknown, property: ToolSchemaProperty): boolean {
  if (property.type === "string") {
    return typeof value === "string";
  }
  if (property.type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (property.type === "boolean") {
    return typeof value === "boolean";
  }
  return false;
}

export function validateToolArgs(schema: ToolSchema, rawArgs: unknown): ToolValidationResult {
  if (!isObjectRecord(rawArgs)) {
    return { ok: false, message: "tool args must be an object" };
  }

  const args: Record<string, unknown> = { ...rawArgs };
  const required = schema.required ?? [];

  for (const key of required) {
    if (!(key in args)) {
      return { ok: false, message: `missing required arg: ${key}` };
    }
  }

  const knownKeys = new Set(Object.keys(schema.properties));
  for (const [key, value] of Object.entries(args)) {
    const property = schema.properties[key];
    if (!property) {
      if (schema.additionalProperties === false) {
        return { ok: false, message: `unknown arg: ${key}` };
      }
      continue;
    }

    if (!validatePropertyType(value, property)) {
      return {
        ok: false,
        message: `invalid arg type for ${key}; expected ${property.type}`,
      };
    }

    if (property.enum && !property.enum.includes(String(value))) {
      return {
        ok: false,
        message: `invalid arg value for ${key}; expected one of: ${property.enum.join(", ")}`,
      };
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!knownKeys.has(key)) {
        return { ok: false, message: `unknown arg: ${key}` };
      }
    }
  }

  return {
    ok: true,
    normalizedArgs: args,
  };
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly allowlist: Set<string>;

  public constructor(options?: { allowlist?: string[] }) {
    this.allowlist = new Set(options?.allowlist ?? []);
  }

  public register(tool: RegisteredTool): void {
    if (!tool.name || typeof tool.name !== "string") {
      throw new Error("tool name is required");
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  public has(name: string): boolean {
    return this.tools.has(name);
  }

  public isAllowed(name: string, perCallAllowlist?: string[]): boolean {
    const globalAllowed = this.allowlist.size === 0 || this.allowlist.has(name);
    const callAllowed =
      !perCallAllowlist || perCallAllowlist.length === 0 || perCallAllowlist.includes(name);
    return globalAllowed && callAllowed;
  }

  public listForModel(perCallAllowlist?: string[]): Array<{
    name: string;
    description: string;
    schema: ToolSchema;
  }> {
    const out: Array<{ name: string; description: string; schema: ToolSchema }> = [];
    for (const tool of this.tools.values()) {
      if (!this.isAllowed(tool.name, perCallAllowlist)) {
        continue;
      }
      out.push({ name: tool.name, description: tool.description, schema: tool.schema });
    }
    return out;
  }

  public async execute(input: {
    name: string;
    args: unknown;
    context: ToolHandlerContext;
    allowlist?: string[];
  }): Promise<ToolExecutionResult> {
    if (!this.isAllowed(input.name, input.allowlist)) {
      return {
        ok: false,
        name: input.name,
        args: isObjectRecord(input.args) ? input.args : {},
        error: `tool not allowed: ${input.name}`,
      };
    }

    const tool = this.tools.get(input.name);
    if (!tool) {
      return {
        ok: false,
        name: input.name,
        args: isObjectRecord(input.args) ? input.args : {},
        error: `tool not found: ${input.name}`,
      };
    }

    const validated = validateToolArgs(tool.schema, input.args);
    if (!validated.ok) {
      return {
        ok: false,
        name: tool.name,
        args: isObjectRecord(input.args) ? input.args : {},
        validationError: validated.message,
      };
    }

    try {
      const result = await tool.handler(validated.normalizedArgs, input.context);
      return {
        ok: true,
        name: tool.name,
        args: validated.normalizedArgs,
        result,
      };
    } catch (error) {
      return {
        ok: false,
        name: tool.name,
        args: validated.normalizedArgs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
