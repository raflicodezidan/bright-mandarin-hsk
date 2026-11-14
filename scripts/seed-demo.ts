import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
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
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed demo tidak boleh berjalan di production.");
  }

  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const domain = process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";

  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await admin
    .from("tests")
    .select("id")
    .eq("title", "HSK 1 — Latihan Demo")
    .maybeSingle();

  if (existing.data) {
    console.log("Tes demo sudah ada. Lewati.");
    return;
  }

  const students = [
    { username: "demo.murid1", fullName: "Demo Murid Satu" },
    { username: "demo.murid2", fullName: "Demo Murid Dua" },
    { username: "demo.murid3", fullName: "Demo Murid Tiga" },
  ];

  for (const student of students) {
    const email = `${student.username}@${domain}`;
    const created = await admin.auth.admin.createUser({
      email,
      password: "Demo12345",
      email_confirm: true,
      user_metadata: { username: student.username },
    });

    let id = created.data.user?.id;
    if (created.error) {
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      id = list.data.users.find((user) => user.email === email)?.id;
    }

    if (!id) continue;

    await admin.from("profiles").upsert(
      {
        id,
        username: student.username,
        full_name: student.fullName,
        role: "student",
        is_active: true,
      },
      { onConflict: "id" },
    );
  }

  const adminProfile = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const test = await admin
    .from("tests")
    .insert({
      title: "HSK 1 — Latihan Demo",
      level: 1,
      description:
        "Tes demo untuk pengembangan. Bagian Listening belum memakai audio.",
      duration_minutes: 15,
      status: "draft",
      created_by: adminProfile.data?.id ?? null,
    })
    .select("id")
    .single();

  if (test.error || !test.data) {
    throw test.error ?? new Error("Gagal membuat tes demo.");
  }

  const testId = test.data.id;

  const questions: {
    section: "listening" | "reading";
    prompt: string;
    options: string[];
    correct: number;
    position: number;
  }[] = [
    {
      section: "listening",
      prompt: "你好，我叫王明。你叫什么名字？",
      options: ["我叫李华。", "我很好。", "再见。", "谢谢。"],
      correct: 0,
      position: 1,
    },
    {
      section: "listening",
      prompt: "今天星期几？",
      options: ["星期一。", "今天很热。", "我吃米饭。", "他在学校。"],
      correct: 0,
      position: 2,
    },
    {
      section: "reading",
      prompt: "我喜欢喝茶。",
      options: ["茶", "咖啡", "水", "牛奶"],
      correct: 0,
      position: 1,
    },
    {
      section: "reading",
      prompt: "她在学校学习汉语。",
      options: ["老师", "学生", "医生", "司机"],
      correct: 1,
      position: 2,
    },
  ];

  const labels = ["A", "B", "C", "D", "E"];

  for (const question of questions) {
    const inserted = await admin
      .from("questions")
      .insert({
        test_id: testId,
        section: question.section,
        position: question.position,
        prompt: question.prompt,
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data) {
      throw inserted.error ?? new Error("Gagal membuat soal demo.");
    }

    for (let index = 0; index < question.options.length; index += 1) {
      const option = await admin
        .from("question_options")
        .insert({
          question_id: inserted.data.id,
          label: labels[index],
          text: question.options[index],
        })
        .select("id")
        .single();

      if (option.error || !option.data) {
        throw option.error ?? new Error("Gagal membuat opsi demo.");
      }

      if (index === question.correct) {
        await admin.from("answer_keys").insert({
          question_id: inserted.data.id,
          correct_option_id: option.data.id,
        });
      }
    }
  }

  await admin.from("tests").update({ status: "open" }).eq("id", testId);

  console.log(`Data demo siap. Tes: ${testId}`);
  console.log("Akun murid demo: demo.murid1 / demo.murid2 / demo.murid3, password Demo12345");
  console.log(`UUID acak untuk referensi: ${randomUUID()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
