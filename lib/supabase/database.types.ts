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
      tests: {
        Row: {
          id: string;
          title: string;
          level: number;
          description: string;
          duration_minutes: number;
          status: Database["public"]["Enums"]["test_status"];
          created_by: string | null;
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
          selected_option_id: string;
          answered_at: string;
        };
        Insert: {
          attempt_id: string;
          question_id: string;
          selected_option_id: string;
          answered_at?: string;
        };
        Update: {
          attempt_id?: string;
          question_id?: string;
          selected_option_id?: string;
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
      has_active_attempt: {
        Args: { p_test_id: string };
        Returns: boolean;
      };
      has_active_attempt_for_question: {
        Args: { p_question_id: string };
        Returns: boolean;
      };
      has_attempt_for_test: {
        Args: { p_test_id: string };
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
    };
    Enums: {
      user_role: "admin" | "student";
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
