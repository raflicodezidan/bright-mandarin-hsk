import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
      return;
    } catch {
      // lanjut
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";

const studentUsername = process.env.TEST_STUDENT_USERNAME ?? "";
const studentPassword = process.env.TEST_STUDENT_PASSWORD ?? "";
const inactiveUsername = process.env.TEST_INACTIVE_USERNAME ?? "";
const inactivePassword = process.env.TEST_INACTIVE_PASSWORD ?? "";
const adminUsername = process.env.TEST_ADMIN_USERNAME ?? "";
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? "";

type Outcome = { name: string; status: "LULUS" | "GAGAL" | "LEWATI"; detail: string };

const results: Outcome[] = [];

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, status: passed ? "LULUS" : "GAGAL", detail });
}

function skip(name: string, detail: string) {
  results.push({ name, status: "LEWATI", detail });
}

async function main() {
  if (!url || !anonKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum diisi.");
    process.exit(2);
  }
  if (!studentUsername || !studentPassword) {
    console.error(
      "Isi TEST_STUDENT_USERNAME dan TEST_STUDENT_PASSWORD di .env.local untuk menjalankan verifikasi.",
    );
    process.exit(2);
  }

  const student = createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
  const login = await student.auth.signInWithPassword({
    email: `${studentUsername}@${domain}`,
    password: studentPassword,
  });

  if (login.error) {
    console.error(`Gagal login murid uji: ${login.error.message}`);
    process.exit(2);
  }

  // AC-2: kunci jawaban tidak terbaca murid.
  const keys = await student.from("answer_keys").select("question_id").limit(5);
  record(
    "AC-2 answer_keys tidak terbaca murid",
    Boolean(keys.error) || (keys.data ?? []).length === 0,
    keys.error ? `ditolak: ${keys.error.message}` : `${keys.data?.length ?? 0} baris`,
  );

  // AC-3: soal tidak terbaca tanpa attempt aktif.
  const status = await student
    .from("student_attempt_status")
    .select("id, test_id, status, expires_at");
  const active = (status.data ?? []).find((item) => item.status === "in_progress");

  if (active) {
    skip(
      "AC-3 soal tidak terbaca tanpa attempt aktif",
      "Akun murid uji masih punya attempt in_progress. Selesaikan/reset dulu.",
    );
  } else if (status.error) {
    record("AC-3 soal tidak terbaca tanpa attempt aktif", false, status.error.message);
  } else {
    const questions = await student.from("questions").select("id").limit(5);
    record(
      "AC-3 soal tidak terbaca tanpa attempt aktif",
      Boolean(questions.error) || (questions.data ?? []).length === 0,
      questions.error
        ? `ditolak: ${questions.error.message}`
        : `${questions.data?.length ?? 0} baris`,
    );
  }

  // AC-12: skor tidak terbaca murid.
  const attempts = await student.from("attempts").select("correct_count").limit(5);
  record(
    "AC-12 kolom skor attempts tidak terbaca murid",
    Boolean(attempts.error) || (attempts.data ?? []).length === 0,
    attempts.error ? `ditolak: ${attempts.error.message}` : `${attempts.data?.length ?? 0} baris`,
  );

  const view = await student.from("student_attempt_status").select("*");
  const viewHasScore =
    Array.isArray(view.data) &&
    view.data.some((row) => "correct_count" in row || "total_count" in row);
  record(
    "AC-12 view status tidak memuat kolom skor",
    !viewHasScore,
    viewHasScore ? "view memuat skor" : "tidak ada kolom skor",
  );

  // AC-5: start_attempt kedua kali pada tes yang sudah selesai ditolak.
  const finished = (status.data ?? []).find((item) => item.status !== "in_progress");
  if (!finished) {
    skip("AC-5 start_attempt ulang ditolak", "Belum ada pengerjaan selesai pada akun uji.");
  } else {
    const retry = await student.rpc("start_attempt", { p_test_id: finished.test_id });
    record(
      "AC-5 start_attempt ulang ditolak",
      Boolean(retry.error),
      retry.error?.message ?? "tidak ditolak",
    );

    // SEC-1: submit_attempt tidak boleh mengembalikan kolom skor.
    const submit = await student.rpc("submit_attempt", {
      p_attempt_id: finished.id,
    });
    const submitRows = Array.isArray(submit.data) ? submit.data : [];
    const leaksScore = submitRows.some(
      (row: Record<string, unknown>) =>
        "correct_count" in row || "total_count" in row,
    );
    record(
      "SEC-1 submit_attempt tidak mengembalikan skor",
      !submit.error && !leaksScore,
      submit.error?.message ?? (leaksScore ? "respons memuat skor" : "hanya status"),
    );
  }

  // AC-7: timer memakai expires_at server, bukan jam klien.
  skip(
    "AC-7 jam perangkat tidak mempengaruhi timer",
    "Diuji manual di browser: ubah jam perangkat, timer tetap.",
  );

  // AC-11: akun nonaktif tidak bisa login.
  if (!inactiveUsername || !inactivePassword) {
    skip("AC-11 akun nonaktif ditolak", "TEST_INACTIVE_USERNAME/PASSWORD belum diisi.");
  } else {
    const inactiveClient = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
    });
    const inactive = await inactiveClient.auth.signInWithPassword({
      email: `${inactiveUsername}@${domain}`,
      password: inactivePassword,
    });
    record(
      "AC-11 akun nonaktif ditolak",
      Boolean(inactive.error),
      inactive.error?.message ?? "login berhasil (salah)",
    );
  }

  // reset_attempt hanya admin.
  if (finished) {
    const reset = await student.rpc("reset_attempt", { p_attempt_id: finished.id });
    record(
      "Murid tidak bisa reset_attempt",
      Boolean(reset.error),
      reset.error?.message ?? "tidak ditolak",
    );
  }

  // Insert langsung ditolak RLS.
  const insertAttempt = await student.from("attempts").insert({
    test_id: finished?.test_id ?? "00000000-0000-0000-0000-000000000000",
    student_id: login.data.user.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    status: "in_progress",
  });

  record(
    "Murid tidak bisa insert attempts",
    Boolean(insertAttempt.error),
    insertAttempt.error?.message ?? "insert berhasil (salah)",
  );

  if (finished) {
    const insertAnswer = await student.from("attempt_answers").insert({
      attempt_id: finished.id,
      question_id: "00000000-0000-0000-0000-000000000000",
      selected_option_id: "00000000-0000-0000-0000-000000000000",
    });
    record(
      "Murid tidak bisa insert attempt_answers",
      Boolean(insertAnswer.error),
      insertAnswer.error?.message ?? "insert berhasil (salah)",
    );
  }

  // Storage hanya admin.
  const upload = await student.storage
    .from("question-media")
    .upload(`verifikasi/${Date.now()}.txt`, new Blob(["uji"]), {
      contentType: "text/plain",
    });
  record(
    "Murid tidak bisa mengunggah media",
    Boolean(upload.error),
    upload.error?.message ?? "unggah berhasil (salah)",
  );

  // Signup publik mati.
  const signup = await createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  }).auth.signUp({
    email: `verifikasi-${Date.now()}@${domain}`,
    password: `Acak-${Date.now()}`,
  });
  record(
    "Pendaftaran publik ditolak",
    Boolean(signup.error),
    signup.error?.message ?? "signup berhasil (salah)",
  );

  // Admin uji (opsional) harus bisa membaca kunci.
  if (adminUsername && adminPassword) {
    const admin = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
    });
    const adminLogin = await admin.auth.signInWithPassword({
      email: `${adminUsername}@${domain}`,
      password: adminPassword,
    });
    if (adminLogin.error) {
      record("Admin uji dapat login", false, adminLogin.error.message);
    } else {
      const adminKeys = await admin.from("answer_keys").select("question_id").limit(1);
      record(
        "Admin uji dapat membaca answer_keys",
        !adminKeys.error,
        adminKeys.error?.message ?? "ok",
      );
    }
  } else {
    skip("Admin uji dapat membaca answer_keys", "TEST_ADMIN_USERNAME/PASSWORD belum diisi.");
  }

  // Bersihkan sesi.
  await student.auth.signOut();

  const width = Math.max(...results.map((item) => item.name.length));
  for (const item of results) {
    console.log(
      `${item.status.padEnd(7)} ${item.name.padEnd(width)}  ${item.detail}`,
    );
  }

  if (serviceKey) {
    console.log("\nService role key tersedia untuk script seed; tidak dipakai di sini.");
  }

  const failed = results.filter((item) => item.status === "GAGAL");
  console.log(
    `\n${results.length} pemeriksaan: ${results.length - failed.length} lulus, ${failed.length} gagal, ${
      results.filter((item) => item.status === "LEWATI").length
    } dilewati.`,
  );

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
