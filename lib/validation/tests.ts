import { z } from "zod";

export const testSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  level: z.coerce.number().int().min(1).max(6),
  description: z
    .string()
    .trim()
    .max(4000, "Deskripsi maksimal 4000 karakter.")
    .default(""),
  durationMinutes: z.coerce
    .number()
    .int("Durasi harus bilangan bulat.")
    .min(5, "Durasi minimal 5 menit.")
    .max(240, "Durasi maksimal 240 menit."),
});

export const testStatusSchema = z.object({
  testId: z.string().uuid(),
  status: z.enum(["draft", "open", "closed", "archived"]),
});

export const questionSectionSchema = z.enum(["listening", "reading"]);

export const questionOptionSchema = z.object({
  label: z.string().regex(/^[A-E]$/),
  text: z.string().trim().min(1, "Teks opsi wajib diisi.").max(2000),
});

export const questionSchema = z.object({
  section: questionSectionSchema,
  prompt: z
    .string()
    .trim()
    .min(1, "Teks soal wajib diisi.")
    .max(4000, "Teks soal maksimal 4000 karakter."),
  options: z
    .array(questionOptionSchema)
    .min(2, "Minimal 2 opsi.")
    .max(5, "Maksimal 5 opsi."),
  correctLabel: z.string().regex(/^[A-E]$/, "Pilih kunci jawaban."),
});

export type TestInput = z.infer<typeof testSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
