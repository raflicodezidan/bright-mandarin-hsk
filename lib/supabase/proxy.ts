import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/tests"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Cek keberadaan cookie sesi tanpa round-trip ke Supabase Auth agar
  // navigasi antar halaman tetap cepat. Verifikasi sesi yang sesungguhnya
  // tetap dilakukan di Server Component / Server Action (requireAdmin, dll).
  const hasSessionCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );

  if (isProtected && !hasSessionCookie) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}
