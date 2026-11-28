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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const domain = process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";

  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Menyiapkan data simulasi Guru dan Murid...");

  // 1. Data Guru (2 Guru: 1 guru yang sudah ada 'rafli_teacher', + 1 guru baru 'laoshi_chen')
  const teacherDefs = [
    {
      username: "rafli_teacher",
      fullName: "Rafli Maulana Zidane",
      password: "Teacher12345",
    },
    {
      username: "chen_laoshi",
      fullName: "Chen Wei Laoshi",
      password: "Teacher12345",
    },
  ];

  const teacherIds: string[] = [];

  for (const t of teacherDefs) {
    const email = `${t.username}@${domain}`;
    const userRes = await supabase.auth.admin.createUser({
      email,
      password: t.password,
      email_confirm: true,
      user_metadata: { username: t.username },
    });

    let id = userRes.data.user?.id;
    if (userRes.error) {
      const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      id = list.data.users.find((u) => u.email === email)?.id;
    }

    if (!id) {
      console.error("Gagal mendapatkan id guru:", t.username);
      continue;
    }

    await supabase.from("profiles").upsert(
      {
        id,
        username: t.username,
        full_name: t.fullName,
        role: "teacher",
        is_active: true,
      },
      { onConflict: "id" },
    );

    teacherIds.push(id);
    console.log(`Guru siap: ${t.fullName} (${t.username}) -> ${id}`);
  }

  // 2. Data 5 Murid per Guru dengan variasi nilai (bagus, sedang, hingga rendah)
  // Guru 1 (Rafli): 5 murid
  // Guru 2 (Chen): 5 murid
  const studentGroups = [
    {
      teacherId: teacherIds[0],
      teacherName: "Rafli Maulana Zidane",
      students: [
        { username: "budi.santoso", fullName: "Budi Santoso", scores: [95, 90, 100, 92] }, // Sangat Bagus (90-100)
        { username: "siti.rahma", fullName: "Siti Rahmawati", scores: [85, 80, 88, 82] },   // Bagus (80-88)
        { username: "kevin.wijaya", fullName: "Kevin Wijaya", scores: [75, 70, 72, 78] },   // Cukup (70-78)
        { username: "dewi.lestari", fullName: "Dewi Lestari", scores: [65, 58, 62, 60] },   // Pas-pasan (58-65)
        { username: "andi.pratama", fullName: "Andi Pratama", scores: [45, 50, 42, 52] },   // Rendah (<60)
      ],
    },
    {
      teacherId: teacherIds[1],
      teacherName: "Chen Wei Laoshi",
      students: [
        { username: "michelle.tan", fullName: "Michelle Tan", scores: [98, 95, 96, 100] }, // Sangat Bagus (95-100)
        { username: "jason.lim", fullName: "Jason Lim", scores: [82, 85, 78, 84] },         // Bagus (78-85)
        { username: "amanda.putri", fullName: "Amanda Putri", scores: [70, 74, 68, 72] },   // Cukup (68-74)
        { username: "rizky.hidayat", fullName: "Rizky Hidayat", scores: [58, 62, 55, 60] }, // Pas-pasan (55-62)
        { username: "fajar.nugroho", fullName: "Fajar Nugroho", scores: [40, 35, 48, 42] }, // Rendah (<60)
      ],
    },
  ];

  // Ambil tes yang tersedia untuk dikaitkan dengan attempt
  const testsRes = await supabase
    .from("tests")
    .select("id, title, level")
    .order("created_at", { ascending: false });

  const tests = testsRes.data ?? [];
  if (tests.length === 0) {
    throw new Error("Tidak ada tes di database untuk mengaitkan attempt.");
  }

  const baseTest = tests[0];

  for (const group of studentGroups) {
    console.log(`\nMemproses murid untuk ${group.teacherName}...`);

    for (const s of group.students) {
      const email = `${s.username}@${domain}`;
      const userRes = await supabase.auth.admin.createUser({
        email,
        password: "Murid12345",
        email_confirm: true,
        user_metadata: { username: s.username },
      });

      let studentId = userRes.data.user?.id;
      if (userRes.error) {
        const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        studentId = list.data.users.find((u) => u.email === email)?.id;
      }

      if (!studentId) {
        console.error("Gagal mendapatkan id murid:", s.username);
        continue;
      }

      // Upsert profile
      await supabase.from("profiles").upsert(
        {
          id: studentId,
          username: s.username,
          full_name: s.fullName,
          role: "student",
          is_active: true,
        },
        { onConflict: "id" },
      );

      // Tugaskan ke guru di tabel teacher_students
      // Matikan penugasan lama jika ada
      await supabase
        .from("teacher_students")
        .update({ ended_at: new Date().toISOString() })
        .eq("student_id", studentId)
        .is("ended_at", null);

      await supabase.from("teacher_students").insert({
        teacher_id: group.teacherId,
        student_id: studentId,
        assigned_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Buat riwayat attempt untuk grafik tren
      // Hapus attempt lama murid ini agar bersih
      await supabase.from("attempts").delete().eq("student_id", studentId);

      // Total soal simulasi: 20 soal
      const totalCount = 20;

      for (let i = 0; i < s.scores.length; i++) {
        const targetPct = s.scores[i];
        const correctCount = Math.round((targetPct / 100) * totalCount);
        const testToUse = tests[i % tests.length] ?? baseTest;

        // Rentang waktu mundur (tes 1 = 15 hari lalu, tes 2 = 10 hari lalu, dst)
        const daysAgo = (s.scores.length - i) * 3;
        const submittedDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const startedDate = new Date(submittedDate.getTime() - 25 * 60 * 1000);

        await supabase.from("attempts").insert({
          test_id: testToUse.id,
          student_id: studentId,
          status: "submitted",
          started_at: startedDate.toISOString(),
          expires_at: new Date(startedDate.getTime() + 35 * 60 * 1000).toISOString(),
          submitted_at: submittedDate.toISOString(),
          total_count: totalCount,
          correct_count: correctCount,
          listening_total: 10,
          listening_correct: Math.round(correctCount / 2),
          reading_total: 10,
          reading_correct: correctCount - Math.round(correctCount / 2),
        });
      }

      console.log(`  ✓ Murid ${s.fullName} (@${s.username}) selesai dibuat dengan ${s.scores.length} riwayat tes.`);
    }
  }

  console.log("\n✅ Semua data percobaan berhasil dibuat!");
}

main().catch((err) => {
  console.error("Gagal menjalankan seed:", err);
  process.exit(1);
});
