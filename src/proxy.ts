import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public paths
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/callback') || pathname.startsWith('/banned')) {
    if (user && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Require auth for all other routes
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    // Preserve invite code through the auth flow
    const invite = request.nextUrl.searchParams.get('invite')
    if (invite) loginUrl.searchParams.set('invite', invite)
    return NextResponse.redirect(loginUrl)
  }

  // Check banned status for non-admin routes
  if (pathname !== '/banned') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_banned, is_admin')
      .eq('id', user.id)
      .single()

    if (profile?.is_banned) {
      return NextResponse.redirect(new URL('/banned', request.url))
    }

    // Admin route protection
    if (pathname.startsWith('/admin') && !profile?.is_admin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
