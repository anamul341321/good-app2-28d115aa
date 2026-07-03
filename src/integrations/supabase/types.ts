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
      announcements: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
        }
        Relationships: []
      }
      mining_claims: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mining_state: {
        Row: {
          accrued_amount: number
          activated_at: string | null
          admin_forced_active: boolean
          effective_task_count: number
          is_active: boolean
          last_credited_at: string | null
          qualifying_referees: number
          user_id: string
          withdrawn_amount: number
        }
        Insert: {
          accrued_amount?: number
          activated_at?: string | null
          admin_forced_active?: boolean
          effective_task_count?: number
          is_active?: boolean
          last_credited_at?: string | null
          qualifying_referees?: number
          user_id: string
          withdrawn_amount?: number
        }
        Update: {
          accrued_amount?: number
          activated_at?: string | null
          admin_forced_active?: boolean
          effective_task_count?: number
          is_active?: boolean
          last_credited_at?: string | null
          qualifying_referees?: number
          user_id?: string
          withdrawn_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "mining_state_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          district: string | null
          email: string | null
          father_name: string | null
          full_address: string | null
          id: string
          kyc_nid_back_url: string | null
          kyc_nid_front_url: string | null
          kyc_photo_url: string | null
          kyc_verified: boolean
          kyc_verified_at: string | null
          mother_name: string | null
          nid_number: string | null
          phone_number: string | null
          post_office: string | null
          referral_code: string
          referred_by: string | null
          thana_upazila: string | null
          village_area: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          district?: string | null
          email?: string | null
          father_name?: string | null
          full_address?: string | null
          id: string
          kyc_nid_back_url?: string | null
          kyc_nid_front_url?: string | null
          kyc_photo_url?: string | null
          kyc_verified?: boolean
          kyc_verified_at?: string | null
          mother_name?: string | null
          nid_number?: string | null
          phone_number?: string | null
          post_office?: string | null
          referral_code: string
          referred_by?: string | null
          thana_upazila?: string | null
          village_area?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          district?: string | null
          email?: string | null
          father_name?: string | null
          full_address?: string | null
          id?: string
          kyc_nid_back_url?: string | null
          kyc_nid_front_url?: string | null
          kyc_photo_url?: string | null
          kyc_verified?: boolean
          kyc_verified_at?: string | null
          mother_name?: string | null
          nid_number?: string | null
          phone_number?: string | null
          post_office?: string | null
          referral_code?: string
          referred_by?: string | null
          thana_upazila?: string | null
          village_area?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          done_at: string | null
          face_label: string | null
          face_photo_url: string | null
          id: string
          initial_verify_at: string | null
          last_whitelist_check_at: string | null
          reverify_due_at: string | null
          slot: number
          status: Database["public"]["Enums"]["task_status"]
          user_id: string
          wallet_address: string | null
          wallet_private_key: string | null
          whitelist_ok: boolean
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          face_label?: string | null
          face_photo_url?: string | null
          id?: string
          initial_verify_at?: string | null
          last_whitelist_check_at?: string | null
          reverify_due_at?: string | null
          slot: number
          status?: Database["public"]["Enums"]["task_status"]
          user_id: string
          wallet_address?: string | null
          wallet_private_key?: string | null
          whitelist_ok?: boolean
        }
        Update: {
          created_at?: string
          done_at?: string | null
          face_label?: string | null
          face_photo_url?: string | null
          id?: string
          initial_verify_at?: string | null
          last_whitelist_check_at?: string | null
          reverify_due_at?: string | null
          slot?: number
          status?: Database["public"]["Enums"]["task_status"]
          user_id?: string
          wallet_address?: string | null
          wallet_private_key?: string | null
          whitelist_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unverified_attempts: {
        Row: {
          created_at: string
          face_label: string | null
          face_photo_url: string | null
          id: string
          kind: string
          reason: string | null
          slot: number | null
          task_id: string | null
          user_id: string
          wallet_address: string | null
          wallet_private_key: string | null
        }
        Insert: {
          created_at?: string
          face_label?: string | null
          face_photo_url?: string | null
          id?: string
          kind?: string
          reason?: string | null
          slot?: number | null
          task_id?: string | null
          user_id: string
          wallet_address?: string | null
          wallet_private_key?: string | null
        }
        Update: {
          created_at?: string
          face_label?: string | null
          face_photo_url?: string | null
          id?: string
          kind?: string
          reason?: string | null
          slot?: number | null
          task_id?: string | null
          user_id?: string
          wallet_address?: string | null
          wallet_private_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unverified_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          number: string
          provider: Database["public"]["Enums"]["wallet_provider"]
          user_id: string
        }
        Insert: {
          created_at?: string
          number: string
          provider: Database["public"]["Enums"]["wallet_provider"]
          user_id: string
        }
        Update: {
          created_at?: string
          number?: string
          provider?: Database["public"]["Enums"]["wallet_provider"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
          wallet_number: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
          wallet_number: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["wallet_provider"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
          wallet_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_whitelist_cron_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      settle_mining: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      task_status: "empty" | "verified" | "done"
      wallet_provider: "bkash" | "nagad"
      withdrawal_status: "pending" | "paid" | "rejected"
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
    Enums: {
      app_role: ["admin", "user"],
      task_status: ["empty", "verified", "done"],
      wallet_provider: ["bkash", "nagad"],
      withdrawal_status: ["pending", "paid", "rejected"],
    },
  },
} as const
