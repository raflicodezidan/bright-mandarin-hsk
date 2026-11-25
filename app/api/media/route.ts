import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile, isStaffRole } from "@/lib/auth";
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
  const isPdf = path.startsWith("pdfs/");
  const isSharedAudio = !isPdf && path.startsWith("audio/");
  const pdfTestId = isPdf ? path.split("/")[1] : null;

  if (isPdf) {
    const pdfTest = await supabase
      .from("tests")
      .select("id, pdf_path, student_pdf_path")
      .eq("id", pdfTestId!)
      .maybeSingle();
    if (!pdfTest.data) {
      return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404, headers: noStore });
    }

    if (isStaffRole(session.profile.role)) {
      // RLS tes sudah membatasi guru ke tes miliknya/ditugaskan. Staf boleh
      // membuka PDF guru untuk pratinjau tanpa membuat pengerjaan.
      const allowed =
        pdfTest.data.pdf_path === path || pdfTest.data.student_pdf_path === path;
      if (!allowed) {
        return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
      }
    } else {
      // Murid hanya boleh membaca salinan PDF yang bersih, dan hanya selama
      // pengerjaan aktif. PDF guru yang memuat kunci tidak pernah dikirim.
      if (pdfTest.data.student_pdf_path !== path) {
        return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
      }
      const active = await supabase.rpc("has_active_attempt", { p_test_id: pdfTestId! });
      if (active.data !== true) {
        return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
      }
    }
  } else {
    const question = await supabase
      .from("questions")
      .select("test_id")
      .or(`image_path.eq.${path},audio_path.eq.${path}`)
      .maybeSingle();

    if (!question.data) {
      if (isSharedAudio) {
        const shared = await supabase.from("tests").select("id").eq("listening_audio_path", path).maybeSingle();
        if (shared.data) {
          if (!isStaffRole(session.profile.role)) {
            const active = await supabase.rpc("has_active_attempt", { p_test_id: shared.data.id });
            if (active.data !== true) return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
          }
          const signed = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 600);
          if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: "Gagal memuat media." }, { status: 500, headers: noStore });
          return NextResponse.redirect(signed.data.signedUrl, { status: 302, headers: noStore });
        }
      }
      const option = await supabase.from("question_options").select("question_id").eq("image_path", path).maybeSingle();
      if (option.data) {
        const owner = await supabase.from("questions").select("test_id").eq("id", option.data.question_id).maybeSingle();
        if (!owner.data) return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404, headers: noStore });
        if (!isStaffRole(session.profile.role)) {
          const active = await supabase.rpc("has_active_attempt", { p_test_id: owner.data.test_id });
          if (active.data !== true) return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
        }
        const signed = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 600);
        if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: "Gagal memuat media." }, { status: 500, headers: noStore });
        return NextResponse.redirect(signed.data.signedUrl, { status: 302, headers: noStore });
      }
      const shared = await supabase.from("tests").select("id").eq("listening_audio_path", path).maybeSingle();
      if (!shared.data) return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404, headers: noStore });
      if (!isStaffRole(session.profile.role)) {
        const active = await supabase.rpc("has_active_attempt", { p_test_id: shared.data.id });
        if (active.data !== true) return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
      }
      const signed = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 600);
      if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: "Gagal memuat media." }, { status: 500, headers: noStore });
      return NextResponse.redirect(signed.data.signedUrl, { status: 302, headers: noStore });
    }

    if (isStaffRole(session.profile.role)) {
      // RLS soal/tes sudah membatasi akses guru.
      if (!question.data.test_id) {
        return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
      }
    } else {
      const active = await supabase.rpc("has_active_attempt", {
        p_test_id: question.data.test_id,
      });
      if (active.data !== true) {
        return NextResponse.json({ error: "Akses ditolak." }, { status: 403, headers: noStore });
      }
    }
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
