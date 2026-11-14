import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
      return;
    } catch {
      // lanjut ke file berikutnya
    }
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diisi.`);
  }
  return value;
}

async function main() {
  loadEnv();

  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const username = required("ADMIN_SEED_USERNAME").trim().toLowerCase();
  const password = required("ADMIN_SEED_PASSWORD");
  const domain =
    process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";

  if (!/^[a-z0-9._]{3,30}$/.test(username)) {
    throw new Error(
      "ADMIN_SEED_USERNAME harus 3-30 karakter: huruf kecil, angka, titik, garis bawah.",
    );
  }
  if (password.length < 8) {
    throw new Error("ADMIN_SEED_PASSWORD minimal 8 karakter.");
  }

  const email = `${username}@${domain}`;
  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (created.error) {
    if (!/already|registered|exists/i.test(created.error.message)) {
      throw created.error;
    }

    let page = 1;
    while (!userId) {
      const list = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (list.error) throw list.error;
      const found = list.data.users.find((user) => user.email === email);
      if (found) {
        userId = found.id;
        break;
      }
      if (list.data.users.length < 200) break;
      page += 1;
    }

    if (!userId) {
      throw new Error(`User ${email} sudah ada tetapi tidak ditemukan.`);
    }

    const updated = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updated.error) throw updated.error;
  } else {
    userId = created.data.user.id;
  }

  if (!userId) {
    throw new Error("Gagal membuat user admin.");
  }

  const profile = await supabase.from("profiles").upsert(
    {
      id: userId,
      username,
      full_name: "Admin",
      role: "admin",
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profile.error) throw profile.error;

  console.log(`Admin siap: ${username} (${email})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
