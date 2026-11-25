// Tipe ini mengikuti bentuk keluaran `supabase gen types typescript`.
// Regenerasi setelah migrasi berubah:
//   npx supabase gen types typescript --project-id <project-ref> --schema public \
//     > lib/supabase/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          role?: Database["public"]["Enums"]["user_role"];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      teacher_students: {
        Row: {
          id: string;
          teacher_id: string;
          student_id: string;
          assigned_by: string | null;
          assigned_at: string;
          ended_at: string | null;
          ended_by: string | null;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          student_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
          ended_at?: string | null;
          ended_by?: string | null;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          student_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
          ended_at?: string | null;
          ended_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_students_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      test_assignments: {
        Row: {
          id: string;
          test_id: string;
          teacher_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          test_id: string;
          teacher_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          test_id?: string;
          teacher_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_assignments_test_id_fkey";
            columns: ["test_id"];
            isOneToOne: false;
            referencedRelation: "tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tests: {
        Row: {
          id: string;
          title: string;
          level: number;
          description: string;
          duration_minutes: number;
          status: Database["public"]["Enums"]["test_status"];
          created_by: string | null;
          pdf_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          level: number;
          description?: string;
          duration_minutes: number;
          status?: Database["public"]["Enums"]["test_status"];
          created_by?: string | null;
          pdf_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          level?: number;
          description?: string;
          duration_minutes?: number;
          status?: Database["public"]["Enums"]["test_status"];
          created_by?: string | null;
          pdf_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          id: string;
          test_id: string;
          section: Database["public"]["Enums"]["question_section"];
          position: number;
          prompt: string;
          image_path: string | null;
          audio_path: string | null;
          question_type: Database["public"]["Enums"]["question_type"];
          interaction_config: Json;
          pdf_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_id: string;
          section: Database["public"]["Enums"]["question_section"];
          position: number;
          prompt: string;
          image_path?: string | null;
          audio_path?: string | null;
          question_type?: Database["public"]["Enums"]["question_type"];
          interaction_config?: Json;
          pdf_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_id?: string;
          section?: Database["public"]["Enums"]["question_section"];
          position?: number;
          prompt?: string;
          image_path?: string | null;
          audio_path?: string | null;
          question_type?: Database["public"]["Enums"]["question_type"];
          interaction_config?: Json;
          pdf_path?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey";
            columns: ["test_id"];
            isOneToOne: false;
            referencedRelation: "tests";
            referencedColumns: ["id"];
          },
        ];
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          text: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          label: string;
          text: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          label?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      answer_keys: {
        Row: {
          question_id: string;
          correct_option_id: string;
        };
        Insert: {
          question_id: string;
          correct_option_id: string;
        };
        Update: {
          question_id?: string;
          correct_option_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "answer_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      interactive_answer_keys: {
        Row: { question_id: string; answer: Json; created_at: string; updated_at: string };
        Insert: { question_id: string; answer: Json; created_at?: string; updated_at?: string };
        Update: { question_id?: string; answer?: Json; created_at?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: "interactive_answer_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      pdf_choice_overlays: {
        Row: {
          id: string;
          question_id: string;
          page_number: number;
          label: string;
          x: number;
          y: number;
          width: number;
          height: number;
          option_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          page_number: number;
          label: string;
          x: number;
          y: number;
          width?: number;
          height?: number;
          option_id: string;
          created_at?: string;
        };
        Update: {
          question_id?: string;
          page_number?: number;
          label?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          option_id?: string;
        };
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          test_id: string;
          student_id: string;
          started_at: string;
          expires_at: string;
          submitted_at: string | null;
          status: Database["public"]["Enums"]["attempt_status"];
          correct_count: number | null;
          total_count: number | null;
          listening_correct: number | null;
          listening_total: number | null;
          reading_correct: number | null;
          reading_total: number | null;
        };
        Insert: {
          id?: string;
          test_id: string;
          student_id: string;
          started_at?: string;
          expires_at: string;
          submitted_at?: string | null;
          status?: Database["public"]["Enums"]["attempt_status"];
          correct_count?: number | null;
          total_count?: number | null;
          listening_correct?: number | null;
          listening_total?: number | null;
          reading_correct?: number | null;
          reading_total?: number | null;
        };
        Update: {
          id?: string;
          test_id?: string;
          student_id?: string;
          started_at?: string;
          expires_at?: string;
          submitted_at?: string | null;
          status?: Database["public"]["Enums"]["attempt_status"];
          correct_count?: number | null;
          total_count?: number | null;
          listening_correct?: number | null;
          listening_total?: number | null;
          reading_correct?: number | null;
          reading_total?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_test_id_fkey";
            columns: ["test_id"];
            isOneToOne: false;
            referencedRelation: "tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attempt_answers: {
        Row: {
          attempt_id: string;
          question_id: string;
          selected_option_id: string | null;
          answer_payload: Json;
          answered_at: string;
        };
        Insert: {
          attempt_id: string;
          question_id: string;
          selected_option_id?: string | null;
          answer_payload?: Json;
          answered_at?: string;
        };
        Update: {
          attempt_id?: string;
          question_id?: string;
          selected_option_id?: string | null;
          answer_payload?: Json;
          answered_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "attempts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      student_attempt_status: {
        Row: {
          id: string;
          test_id: string;
          started_at: string;
          expires_at: string;
          submitted_at: string | null;
          status: Database["public"]["Enums"]["attempt_status"];
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_teacher: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_teacher_of_student: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      teacher_owns_test: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      teacher_can_access_test: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      teacher_can_review_test: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      teacher_can_access_question: {
        Args: { p_question_id: string };
        Returns: boolean;
      };
      teacher_owns_question: {
        Args: { p_question_id: string };
        Returns: boolean;
      };
      teacher_can_access_attempt: {
        Args: { p_attempt_id: string };
        Returns: boolean;
      };
      student_can_access_test: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      can_manage_attempt: {
        Args: { p_attempt_id: string };
        Returns: boolean;
      };
      has_attempt_for_test: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      assign_student_to_teacher: {
        Args: { p_teacher_id: string; p_student_id: string };
        Returns: undefined;
      };
      unassign_student: {
        Args: { p_student_id: string };
        Returns: undefined;
      };
      set_test_assignments: {
        Args: { p_test_id: string; p_teacher_ids: string[] };
        Returns: undefined;
      };
      owner_teacher_kpis: {
        Args: Record<string, never>;
        Returns: {
          teacher_id: string;
          full_name: string;
          username: string;
          is_active: boolean;
          student_count: number;
          attempt_count: number;
          completed_count: number;
          avg_percentage: number;
          weak_student_count: number;
          last_activity_at: string | null;
        }[];
      };
      has_active_attempt: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      has_active_attempt_for_question: {
        Args: { p_question_id: string };
        Returns: boolean;
      };
      get_test_summary: {
        Args: { p_test_id: string };
        Returns: {
          id: string;
          title: string;
          level: number;
          description: string;
          duration_minutes: number;
          listening_count: number;
          reading_count: number;
          total_count: number;
        }[];
      };
      start_attempt: {
        Args: { p_test_id: string };
        Returns: {
          attempt_id: string;
          attempt_expires_at: string;
          server_now: string;
        }[];
      };
      save_answer: {
        Args: {
          p_attempt_id: string;
          p_question_id: string;
          p_option_id: string;
        };
        Returns: undefined;
      };
      save_interactive_answer: {
        Args: { p_attempt_id: string; p_question_id: string; p_answer: Json };
        Returns: undefined;
      };
      submit_attempt: {
        Args: { p_attempt_id: string };
        Returns: {
          id: string;
          status: Database["public"]["Enums"]["attempt_status"];
        }[];
      };
      finalize_expired_attempts: {
        Args: Record<string, never>;
        Returns: number;
      };
      reset_attempt: {
        Args: { p_attempt_id: string };
        Returns: undefined;
      };
      save_question: {
        Args: {
          p_test_id: string;
          p_question_id: string | null;
          p_section: Database["public"]["Enums"]["question_section"];
          p_prompt: string;
          p_image_path: string | null;
          p_audio_path: string | null;
          p_options: Json;
          p_correct_label: string;
        };
        Returns: string;
      };
      save_interactive_question: {
        Args: {
          p_test_id: string;
          p_question_id: string | null;
          p_section: Database["public"]["Enums"]["question_section"];
          p_type: Database["public"]["Enums"]["question_type"];
          p_prompt: string;
          p_config: Json;
          p_answer_key: Json;
        };
        Returns: string;
      };
      interactive_question_payload: {
        Args: { p_question_id: string };
        Returns: Json;
      };
      delete_question: {
        Args: { p_question_id: string };
        Returns: string;
      };
      move_question: {
        Args: { p_question_id: string; p_direction: number };
        Returns: undefined;
      };
      duplicate_test: {
        Args: { p_test_id: string; p_media_map?: Json };
        Returns: string;
      };
      update_question_text: {
        Args: {
          p_test_id: string;
          p_question_id: string;
          p_prompt: string;
          p_options: Json;
          p_correct_label: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: "owner" | "admin" | "teacher" | "student";
      question_type: "multiple_choice" | "matching" | "hanzi_blank" | "rearrange_sentence";
      test_status: "draft" | "open" | "closed" | "archived";
      question_section: "listening" | "reading";
      attempt_status: "in_progress" | "submitted" | "expired";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Functions<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
