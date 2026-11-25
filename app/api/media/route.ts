import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "question-media";
// Hanya path yang dibuat server (upload/duplikat): audio/images UUID, atau PDF
// yang terikat ke UUID tes.
// Mencegah path traversal dan manipulasi filter PostgREST lewat parameter.
const MEDIA_PATH = /^(audio|images)\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$|^pdfs\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i;

export async function GET(request: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };

  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 401, headers: noStore });
  }

  const path = request.nextUrl.searchParams.get("path");
  if (!path || !MEDIA_PATH.test(path)) {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400, headers: noStore });
  }

  const supabase = await createClient();
  const question = await supabase
    .from("questions")
    .select("test_id")
    .or(`image_path.eq.${path},audio_path.eq.${path}`)
    .maybeSingle();
  const pdfTestId = path.startsWith("pdfs/") ? path.split("/")[1] : null;
  const pdfTest = pdfTestId
    ? await supabase.from("tests").select("id").eq("id", pdfTestId).eq("pdf_path", path).maybeSingle()
    : null;

  if (!question.data && !pdfTest?.data) {
    return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404, headers: noStore });
  }

  const active = await supabase.rpc("has_active_attempt", {
    p_test_id: question.data?.test_id ?? pdfTestId!,
  });

  if (session.profile.role !== "student" || active.data !== true) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
  }

  const admin = createAdminClient();
  const signed = await admin.storage.from(BUCKET).createSignedUrl(path, 600);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Gagal memuat media." }, { status: 500, headers: noStore });
  }

  return NextResponse.redirect(signed.data.signedUrl, {
    status: 302,
    headers: noStore,
  });
}
