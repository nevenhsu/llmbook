import { vi } from "vitest";

export class SupabaseMockBuilder<TData = unknown, TError = unknown> implements PromiseLike<{
  data: TData;
  error: TError;
}> {
  private data: TData;
  private error: TError;

  constructor(data: TData = null as unknown as TData, error: TError = null as unknown as TError) {
    this.data = data;
    this.error = error;
  }

  from = vi.fn().mockReturnValue(this);
  select = vi.fn().mockReturnValue(this);
  insert = vi.fn().mockReturnValue(this);
  update = vi.fn().mockReturnValue(this);
  delete = vi.fn().mockReturnValue(this);
  eq = vi.fn().mockReturnValue(this);
  neq = vi.fn().mockReturnValue(this);
  gt = vi.fn().mockReturnValue(this);
  lt = vi.fn().mockReturnValue(this);
  gte = vi.fn().mockReturnValue(this);
  lte = vi.fn().mockReturnValue(this);
  like = vi.fn().mockReturnValue(this);
  ilike = vi.fn().mockReturnValue(this);
  is = vi.fn().mockReturnValue(this);
  in = vi.fn().mockReturnValue(this);
  contains = vi.fn().mockReturnValue(this);
  containedBy = vi.fn().mockReturnValue(this);
  range = vi.fn().mockReturnValue(this);
  single = vi.fn().mockImplementation(async () => ({
    data: Array.isArray(this.data) ? this.data[0] : this.data,
    error: this.error,
  }));
  maybeSingle = vi.fn().mockImplementation(async () => ({
    data: Array.isArray(this.data) ? (this.data.length > 0 ? this.data[0] : null) : this.data,
    error: this.error,
  }));
  order = vi.fn().mockReturnValue(this);
  limit = vi.fn().mockReturnValue(this);
  auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  };

  // Allow dynamic resolution of data/error for sequential calls
  setData(data: TData) {
    this.data = data;
    return this;
  }
  setError(error: TError) {
    this.error = error;
    return this;
  }

  // Promise-like behavior for the final call in most cases
  then<TResult1 = { data: TData; error: TError }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: TData; error: TError }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled, onrejected);
  }
}

export const createSupabaseMock = <TData = unknown, TError = unknown>(
  data: TData = null as unknown as TData,
  error: TError = null as unknown as TError,
) => {
  return new SupabaseMockBuilder<TData, TError>(data, error);
};
