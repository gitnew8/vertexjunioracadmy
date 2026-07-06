export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          mode: string
          student_class: string | null
          student_id: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          student_class?: string | null
          student_id: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          student_class?: string | null
          student_id?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_attendance: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          left_at: string | null
          student_class: string | null
          student_id: string | null
          student_name: string | null
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          student_class?: string | null
          student_id?: string | null
          student_name?: string | null
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          student_class?: string | null
          student_id?: string | null
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          created_at: string
          cycle_label: string
          due_amount: number | null
          id: string
          last_payment_date: string | null
          paid_amount: number
          payment_status: string | null
          student_id: string
          total_fee: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_label?: string
          due_amount?: number | null
          id?: string
          last_payment_date?: string | null
          paid_amount?: number
          payment_status?: string | null
          student_id: string
          total_fee?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_label?: string
          due_amount?: number | null
          id?: string
          last_payment_date?: string | null
          paid_amount?: number
          payment_status?: string | null
          student_id?: string
          total_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          room_code: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          student_class: string
          subject: string | null
          teacher_name: string | null
          title: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          room_code: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          student_class: string
          subject?: string | null
          teacher_name?: string | null
          title: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          room_code?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          student_class?: string
          subject?: string | null
          teacher_name?: string | null
          title?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          fee_id: string | null
          id: string
          notes: string | null
          paid_month: string
          payment_date: string
          payment_method: string
          receipt_no: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          fee_id?: string | null
          id?: string
          notes?: string | null
          paid_month?: string
          payment_date?: string
          payment_method?: string
          receipt_no?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_id?: string | null
          id?: string
          notes?: string | null
          paid_month?: string
          payment_date?: string
          payment_method?: string
          receipt_no?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reading_sessions: {
        Row: {
          ai_analysis: Json
          approved: boolean
          audio_path: string
          book_name: string
          created_at: string
          duration_sec: number
          id: string
          language: string
          student_class: string
          student_id: string | null
          student_name: string
          teacher_feedback: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json
          approved?: boolean
          audio_path: string
          book_name: string
          created_at?: string
          duration_sec?: number
          id?: string
          language?: string
          student_class: string
          student_id?: string | null
          student_name: string
          teacher_feedback?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json
          approved?: boolean
          audio_path?: string
          book_name?: string
          created_at?: string
          duration_sec?: number
          id?: string
          language?: string
          student_class?: string
          student_id?: string | null
          student_name?: string
          teacher_feedback?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          coaching_name: string
          code: string
          created_at: string
          expires_at: string | null
          id: string
          logo_url: string | null
          roll_number: string
          student_class: string
          student_name: string
          subjects: Json
          teacher_name: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          coaching_name: string
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          logo_url?: string | null
          roll_number: string
          student_class: string
          student_name: string
          subjects?: Json
          teacher_name?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          coaching_name?: string
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          logo_url?: string | null
          roll_number?: string
          student_class?: string
          student_name?: string
          subjects?: Json
          teacher_name?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          approved_at: string | null
          avg_score: number
          created_at: string
          earned_at: string
          id: string
          notes: string | null
          rule_id: string
          status: string
          student_id: string
          tests_count: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          avg_score?: number
          created_at?: string
          earned_at?: string
          id?: string
          notes?: string | null
          rule_id: string
          status?: string
          student_id: string
          tests_count?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          avg_score?: number
          created_at?: string
          earned_at?: string
          id?: string
          notes?: string | null
          rule_id?: string
          status?: string
          student_id?: string
          tests_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_claims_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "reward_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_claims_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_claims_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_rules: {
        Row: {
          active: boolean
          created_at: string
          cycle_days: number
          description: string | null
          id: string
          image_url: string | null
          min_score_percent: number
          min_tests: number
          sort_order: number
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cycle_days?: number
          description?: string | null
          id?: string
          image_url?: string | null
          min_score_percent?: number
          min_tests?: number
          sort_order?: number
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cycle_days?: number
          description?: string | null
          id?: string
          image_url?: string | null
          min_score_percent?: number
          min_tests?: number
          sort_order?: number
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          course: string | null
          created_at: string
          id: string
          login_number: string
          name: string
          roll_number: string
          status: string
          student_class: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          id?: string
          login_number: string
          name: string
          roll_number: string
          status?: string
          student_class: string
        }
        Update: {
          course?: string | null
          created_at?: string
          id?: string
          login_number?: string
          name?: string
          roll_number?: string
          status?: string
          student_class?: string
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          chapter: string
          created_at: string
          description: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          source: string
          student_class: string
          subject: string
          teacher_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chapter: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          id?: string
          source?: string
          student_class: string
          subject: string
          teacher_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          chapter?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          source?: string
          student_class?: string
          subject?: string
          teacher_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          answers: Json
          created_at: string
          evaluations: Json
          id: string
          score: number
          started_at: string
          student_id: string
          submitted_at: string | null
          test_id: string
          time_taken_sec: number
          total: number
        }
        Insert: {
          answers?: Json
          created_at?: string
          evaluations?: Json
          id?: string
          score?: number
          started_at?: string
          student_id: string
          submitted_at?: string | null
          test_id: string
          time_taken_sec?: number
          total?: number
        }
        Update: {
          answers?: Json
          created_at?: string
          evaluations?: Json
          id?: string
          score?: number
          started_at?: string
          student_id?: string
          submitted_at?: string | null
          test_id?: string
          time_taken_sec?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: string
          id: string
          marks: number
          options: Json | null
          q_no: number
          question: string
          section: string
          test_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty?: string
          id?: string
          marks?: number
          options?: Json | null
          q_no: number
          question: string
          section: string
          test_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: string
          id?: string
          marks?: number
          options?: Json | null
          q_no?: number
          question?: string
          section?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          chapter: string | null
          created_at: string
          discount_price: number | null
          id: string
          is_free: boolean
          language: string
          price: number
          status: string
          student_class: string
          subject: string
          time_limit_min: number
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          chapter?: string | null
          created_at?: string
          discount_price?: number | null
          id?: string
          is_free?: boolean
          language?: string
          price?: number
          status?: string
          student_class: string
          subject: string
          time_limit_min?: number
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          chapter?: string | null
          created_at?: string
          discount_price?: number | null
          id?: string
          is_free?: boolean
          language?: string
          price?: number
          status?: string
          student_class?: string
          subject?: string
          time_limit_min?: number
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      student_activity: {
        Row: {
          course: string | null
          created_at: string | null
          id: string | null
          is_active_30d: boolean | null
          login_number: string | null
          name: string | null
          roll_number: string | null
          status: string | null
          student_class: string | null
        }
        Insert: {
          course?: string | null
          created_at?: string | null
          id?: string | null
          is_active_30d?: never
          login_number?: string | null
          name?: string | null
          roll_number?: string | null
          status?: string | null
          student_class?: string | null
        }
        Update: {
          course?: string | null
          created_at?: string | null
          id?: string | null
          is_active_30d?: never
          login_number?: string | null
          name?: string | null
          roll_number?: string | null
          status?: string | null
          student_class?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
