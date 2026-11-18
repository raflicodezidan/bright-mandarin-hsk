import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._]{3,30}$/,
    "Username 3-30 karakter: huruf kecil, angka, titik, atau garis bawah.",
  );

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(100, "Password terlalu panjang.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi.")
  .max(120, "Nama maksimal 120 karakter.");

export const createStudentSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const updateStudentSchema = z.object({
  studentId: z.string().uuid(),
  fullName: fullNameSchema,
});

export const studentIdSchema = z.object({
  studentId: z.string().uuid(),
});

export const resetStudentPasswordSchema = z.object({
  studentId: z.string().uuid(),
  password: passwordSchema,
});

export const toggleStudentSchema = z.object({
  studentId: z.string().uuid(),
  isActive: z.boolean(),
});
