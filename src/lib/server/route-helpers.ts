/**
 * Server-side route utilities for Next.js App Router
 * 
 * Reduces boilerplate in API route handlers for:
 * - Auth checking
 * - Error response formatting
 * - Supabase client creation
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// Standard error response format
export interface ApiErrorResponse {
  error: string;
}

// Standard success response wrapper
export interface ApiSuccessResponse<T> {
  data: T;
}

/**
 * Create authenticated Supabase client for route handlers
 */
export async function getSupabaseServerClient() {
  return createClient(await cookies());
}

/**
 * Get current user from request, or null if not authenticated
 */
export async function getCurrentUser(supabase?: SupabaseClient): Promise<{ id: string } | null> {
  const client = supabase || await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return user ? { id: user.id } : null;
}

/**
 * Require authentication, return 401 if not logged in
 * Use in route handlers that require auth
 */
export async function requireAuth(
  supabase?: SupabaseClient
): Promise<{ user: { id: string }; supabase: SupabaseClient } | NextResponse<ApiErrorResponse>> {
  const client = supabase || await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  
  if (!user) {
    return jsonError('Unauthorized', 401);
  }
  
  return { user: { id: user.id }, supabase: client };
}

/**
 * Standardized JSON error response
 */
export function jsonError(message: string, status: number = 500): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standardized JSON success response
 */
export function jsonOk<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Common HTTP status code helpers
 */
export const http = {
  badRequest: (message: string = 'Bad Request') => jsonError(message, 400),
  unauthorized: (message: string = 'Unauthorized') => jsonError(message, 401),
  forbidden: (message: string = 'Forbidden') => jsonError(message, 403),
  notFound: (message: string = 'Not Found') => jsonError(message, 404),
  conflict: (message: string = 'Conflict') => jsonError(message, 409),
  internalError: (message: string = 'Internal Server Error') => jsonError(message, 500),
  ok: <T>(data: T) => jsonOk(data, 200),
  created: <T>(data: T) => jsonOk(data, 201),
};

/**
 * Type-safe route handler wrapper with error handling
 * 
 * Usage:
 * ```ts
 * export const POST = withErrorHandler(async (req) => {
 *   const body = await req.json();
 *   // ... handler logic
 *   return jsonOk(result);
 * });
 * ```
 */
export function withErrorHandler<TContext = unknown>(
  handler: (req: Request, context: TContext) => Promise<NextResponse>
): (req: Request, context: TContext) => Promise<NextResponse> {
  return async (req: Request, context: TContext) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error('Route handler error:', error);
      
      if (error instanceof Error) {
        // Return specific error messages for known errors
        if (error.message.includes('not found')) {
          return http.notFound(error.message);
        }
        if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
          return http.unauthorized();
        }
        if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
          return http.forbidden();
        }
        return jsonError(error.message, 400);
      }
      
      return http.internalError();
    }
  };
}

/**
 * Wrapper for authenticated route handlers
 * Automatically checks auth and passes user to handler
 * 
 * Usage:
 * ```ts
 * export const POST = withAuth(async (req, { user, supabase }) => {
 *   // User is guaranteed to be authenticated here
 *   const body = await req.json();
 *   // ... handler logic
 *   return jsonOk(result);
 * });
 * ```
 */
export interface AuthContext {
  user: { id: string };
  supabase: SupabaseClient;
}

export function withAuth<TParams = unknown>(
  handler: (req: Request, ctx: AuthContext, routeContext: { params: Promise<TParams> }) => Promise<NextResponse>
): (req: Request, routeContext: { params: Promise<TParams> }) => Promise<NextResponse> {
  return withErrorHandler(async (req: Request, routeContext: { params: Promise<TParams> }) => {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return http.unauthorized();
    }
    
    return handler(req, { user: { id: user.id }, supabase }, routeContext);
  });
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T>(req: Request): Promise<T | NextResponse<ApiErrorResponse>> {
  try {
    return await req.json() as T;
  } catch {
    return http.badRequest('Invalid JSON body');
  }
}

/**
 * Validate request body with Zod-like schema (simple version)
 */
export function validateBody<T extends Record<string, unknown>>(
  body: T,
  requiredFields: string[]
): { valid: true; data: T } | { valid: false; response: NextResponse<ApiErrorResponse> } {
  const missing = requiredFields.filter(field => !(field in body) || body[field] === undefined || body[field] === null);
  
  if (missing.length > 0) {
    return {
      valid: false,
      response: http.badRequest(`Missing required fields: ${missing.join(', ')}`),
    };
  }
  
  return { valid: true, data: body };
}
