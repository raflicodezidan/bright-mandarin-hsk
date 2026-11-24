import { z } from "zod";
import {
  fullNameSchema,
  passwordSchema,
  usernameSchema,
} from "@/lib/validation/students";

export const createTeacherSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const teacherIdSchema = z.object({
  teacherId: z.string().uuid(),
});

export const assignStudentToTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const unassignStudentSchema = z.object({
  studentId: z.string().uuid(),
});

export const toggleTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  isActive: z.boolean(),
});

export const setTestAssignmentsSchema = z.object({
  testId: z.string().uuid(),
  teacherIds: z.array(z.string().uuid()).max(100),
});
