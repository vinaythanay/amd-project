import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/sign-up
 * 
 * Register a new user using Better-Auth
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Better-Auth sign-up
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: name || undefined,
      },
      headers: request.headers,
    });

    // Handle the response - Better-Auth returns a Response with cookies
    if (result instanceof Response) {
      const cloned = result.clone();
      const data = await cloned.json();
      
      if (data.error) {
        return NextResponse.json(
          { error: data.error.message || 'Registration failed' },
          { status: 400 }
        );
      }

      // Create new response with Better-Auth's cookies
      const response = NextResponse.json({
        success: true,
        user: data.user || data.data?.user,
      });

      // Copy cookies from Better-Auth response
      const setCookieHeaders = result.headers.getSetCookie();
      if (setCookieHeaders && setCookieHeaders.length > 0) {
        setCookieHeaders.forEach(cookie => {
          response.headers.append('Set-Cookie', cookie);
        });
      }

      return response;
    }

    // Handle error result
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || 'Registration failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.data?.user,
    });
  } catch (error: any) {
    console.error('Sign-up error:', error);
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
