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
  text: z.string().trim().max(2000).default(""),
  imagePath: z.string().max(300).nullable().optional(),
}).refine((option) => option.text.length > 0 || Boolean(option.imagePath), {
  message: "Isi teks atau unggah gambar untuk setiap opsi.",
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
  weight: z.coerce
    .number()
    .int("Bobot harus bilangan bulat.")
    .min(1, "Bobot minimal 1.")
    .max(100, "Bobot maksimal 100.")
    .default(1)
    .optional(),
});

// Impor hasil scan PDF: kunci jawaban belum diketahui karena halaman kunci
// tidak dibaca. Soal tetap dibuat dan ditandai "Kunci belum diisi".
export const importedQuestionSchema = z.object({
  section: questionSectionSchema,
  prompt: z
    .string()
    .trim()
    .min(1, "Teks soal wajib diisi.")
    .max(4000, "Teks soal maksimal 4000 karakter."),
  weight: z.coerce
    .number()
    .int("Bobot harus bilangan bulat.")
    .min(1, "Bobot minimal 1.")
    .max(100, "Bobot maksimal 100.")
    .default(1)
    .optional(),
  options: z
    .array(questionOptionSchema)
    .min(2, "Minimal 2 opsi.")
    .max(5, "Maksimal 5 opsi."),
  correctLabel: z
    .union([z.literal(""), z.string().regex(/^[A-E]$/)])
    .optional(),
});

export const questionTextUpdateSchema = z.object({
  testId: z.string().uuid(),
  questionId: z.string().uuid(),
  prompt: z.string().trim().min(1, "Teks soal wajib diisi.").max(4000),
  options: z.array(questionOptionSchema).min(2).max(5),
  correctLabel: z.string().regex(/^[A-E]$/, "Pilih kunci jawaban."),
  weight: z.coerce
    .number()
    .int("Bobot harus bilangan bulat.")
    .min(1, "Bobot minimal 1.")
    .max(100, "Bobot maksimal 100.")
    .optional(),
});

const matchingItemSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().trim().min(1).max(300),
});

const hanziChoiceSchema = z.object({
  label: z.string().regex(/^[A-Fa-f]$/),
  text: z.string().trim().min(1).max(2000),
});

export const interactiveQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("matching"),
    section: questionSectionSchema,
    prompt: z.string().trim().min(1).max(4000),
    weight: z.coerce
      .number()
      .int("Bobot harus bilangan bulat.")
      .min(1, "Bobot minimal 1.")
      .max(100, "Bobot maksimal 100.")
      .default(1)
      .optional(),
    config: z.object({
      leftItems: z.array(matchingItemSchema).min(2).max(10),
      rightItems: z.array(matchingItemSchema).min(2).max(10),
    }),
    answerKey: z.object({ matches: z.record(z.string(), z.string()) }),
  }),
  z.object({
    type: z.literal("hanzi_blank"),
    section: questionSectionSchema,
    prompt: z.string().trim().min(1).max(4000).refine((value) => value.includes("{{blank}}"), "Teks harus memuat {{blank}}."),
    weight: z.coerce
      .number()
      .int("Bobot harus bilangan bulat.")
      .min(1, "Bobot minimal 1.")
      .max(100, "Bobot maksimal 100.")
      .default(1)
      .optional(),
    config: z.object({
      choices: z.array(hanziChoiceSchema).min(2).max(6),
      blankCount: z.literal(1),
    }),
    answerKey: z.object({ correctLabel: z.string().regex(/^[A-Fa-f]$/) }),
  }),
  z.object({
    type: z.literal("rearrange_sentence"),
    section: questionSectionSchema,
    prompt: z.string().trim().min(1).max(4000),
    weight: z.coerce
      .number()
      .int("Bobot harus bilangan bulat.")
      .min(1, "Bobot minimal 1.")
      .max(100, "Bobot maksimal 100.")
      .default(1)
      .optional(),
    config: z.object({
      tokens: z.array(matchingItemSchema).min(2).max(30),
    }),
    answerKey: z.object({ order: z.array(z.string().min(1).max(40)).min(2).max(30) }),
  }),
]);

// Impor hasil scan PDF: kunci jawaban boleh kosong karena halaman kunci tidak
// dibaca. Soal tetap dibuat dan ditandai "Kunci belum diisi".
export const importedInteractiveQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    testId: z.string().uuid(),
    type: z.literal("matching"),
    prompt: z.string().trim().min(1).max(4000),
    weight: z.coerce
      .number()
      .int("Bobot harus bilangan bulat.")
      .min(1, "Bobot minimal 1.")
      .max(100, "Bobot maksimal 100.")
      .default(1)
      .optional(),
    config: z.object({
      leftItems: z.array(matchingItemSchema).min(2).max(10),
      rightItems: z.array(matchingItemSchema).min(2).max(10),
    }),
    answerKey: z
      .object({ matches: z.record(z.string(), z.string()).optional() })
      .optional(),
  }),
  z.object({
    testId: z.string().uuid(),
    type: z.literal("hanzi_blank"),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .refine((value) => value.includes("{{blank}}"), "Teks harus memuat {{blank}}."),
    weight: z.coerce
      .number()
      .int("Bobot harus bilangan bulat.")
      .min(1, "Bobot minimal 1.")
      .max(100, "Bobot maksimal 100.")
      .default(1)
      .optional(),
    config: z.object({
      choices: z.array(hanziChoiceSchema).min(2).max(6),
      blankCount: z.literal(1),
    }),
    answerKey: z
      .object({
        correctLabel: z
          .union([z.literal(""), z.string().regex(/^[A-Fa-f]$/)])
          .optional(),
      })
      .optional(),
  }),
]);

export const questionInteractionUpdateSchema = z.object({
  questionId: z.string().uuid(),
  testId: z.string().uuid(),
  type: z.enum(["matching", "hanzi_blank", "rearrange_sentence"]),
  prompt: z.string().trim().min(1).max(4000),
  config: z.record(z.string(), z.unknown()),
  answerKey: z.record(z.string(), z.unknown()),
});

// Overlay PDF memakai koordinat relatif (0–1) terhadap halaman asli. Kunci
// jawaban tidak pernah disimpan di sini; kunci tetap di tabel answer_keys /
// interactive_answer_keys.
export const pdfOverlaySchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["choice", "blank", "match", "drop"]),
  pageNumber: z.number().int().min(1).max(100),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(0.2),
  height: z.number().min(0.01).max(0.2),
  label: z.string().max(20).optional(),
});

export const pdfChoiceQuestionSchema = z.object({
  testId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(4000),
  section: questionSectionSchema,
  options: z.array(questionOptionSchema).min(2).max(5),
  overlays: z.array(pdfOverlaySchema).min(2).max(5),
  correctLabel: z.string().regex(/^[A-E]$/),
});

const pdfChoiceLabelSchema = z.string().regex(/^[A-Fa-f]$/);

export const pdfBlankQuestionSchema = z.object({
  testId: z.string().uuid(),
  section: questionSectionSchema,
  choices: z.array(z.object({
    label: pdfChoiceLabelSchema,
    text: z.string().trim().min(1).max(2000),
  })).min(2).max(8),
  blanks: z.array(z.object({
    id: z.string().min(1).max(40),
    prompt: z.string().trim().min(1).max(4000),
    correctLabel: pdfChoiceLabelSchema,
    overlay: pdfOverlaySchema,
  })).min(1).max(30),
});

export const pdfMatchingQuestionSchema = z.object({
  testId: z.string().uuid(),
  section: questionSectionSchema,
  prompt: z.string().trim().min(1).max(4000),
  leftItems: z.array(matchingItemSchema).min(2).max(10),
  rightItems: z.array(matchingItemSchema).min(2).max(10),
  matches: z.record(z.string(), z.string()),
  overlays: z.array(pdfOverlaySchema).min(2).max(10),
});

export const pdfRearrangeQuestionSchema = z.object({
  testId: z.string().uuid(),
  section: questionSectionSchema,
  prompt: z.string().trim().min(1).max(4000),
  tokens: z.array(matchingItemSchema).min(2).max(30),
  order: z.array(z.string().min(1).max(40)).min(2).max(30),
  overlays: z.array(pdfOverlaySchema).max(1).default([]),
});

export type TestInput = z.infer<typeof testSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
