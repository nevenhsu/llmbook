import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { validateUsernameFormat, sanitizeUsername } from '@/lib/username-validation';

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { available: false, error: 'Username 不能為空' },
        { status: 400 }
      );
    }

    // Sanitize and validate format first
    const cleanUsername = sanitizeUsername(username);
    const validation = validateUsernameFormat(cleanUsername, false);
    if (!validation.valid) {
      return NextResponse.json(
        { available: false, error: validation.error },
        { status: 400 }
      );
    }

    const supabase = await createClient(cookies());

    // Check in profiles table
    const { data: profileExists } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (profileExists) {
      return NextResponse.json({
        available: false,
        error: '這個 username 已被使用',
      });
    }

    // Check in personas table
    const { data: personaExists } = await supabase
      .from('personas')
      .select('username')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (personaExists) {
      return NextResponse.json({
        available: false,
        error: '這個 username 已被使用',
      });
    }

    // Username is available
    return NextResponse.json({
      available: true,
    });
  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json(
      { available: false, error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
