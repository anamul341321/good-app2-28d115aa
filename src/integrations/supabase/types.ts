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
      admin_credits: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          password_hash: string | null
          updated_at: string
        }
        Insert: {
          id: string
          password_hash?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          password_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      bonus_settings: {
        Row: {
          bkash_enabled: boolean
          bkash_off_message: string | null
          first_verify_bonus: number
          first_verify_mining_mode: boolean
          id: string
          nagad_enabled: boolean
          nagad_off_message: string | null
          promo_active: boolean
          promo_end_at: string | null
          promo_first_verify_bonus: number | null
          promo_referrer_bonus: number | null
          promo_reverify_bonus: number | null
          promo_start_at: string | null
          promo_title: string | null
          recharge_enabled: boolean
          recharge_off_message: string | null
          referrer_bonus: number
          reverify_bonus: number
          updated_at: string
          usdt_enabled: boolean
          usdt_off_message: string | null
          usdt_rate_bdt: number
          withdraw_enabled: boolean
          withdraw_off_message: string | null
          withdraw_off_until: string | null
        }
        Insert: {
          bkash_enabled?: boolean
          bkash_off_message?: string | null
          first_verify_bonus?: number
          first_verify_mining_mode?: boolean
          id?: string
          nagad_enabled?: boolean
          nagad_off_message?: string | null
          promo_active?: boolean
          promo_end_at?: string | null
          promo_first_verify_bonus?: number | null
          promo_referrer_bonus?: number | null
          promo_reverify_bonus?: number | null
          promo_start_at?: string | null
          promo_title?: string | null
          recharge_enabled?: boolean
          recharge_off_message?: string | null
          referrer_bonus?: number
          reverify_bonus?: number
          updated_at?: string
          usdt_enabled?: boolean
          usdt_off_message?: string | null
          usdt_rate_bdt?: number
          withdraw_enabled?: boolean
          withdraw_off_message?: string | null
          withdraw_off_until?: string | null
        }
        Update: {
          bkash_enabled?: boolean
          bkash_off_message?: string | null
          first_verify_bonus?: number
          first_verify_mining_mode?: boolean
          id?: string
          nagad_enabled?: boolean
          nagad_off_message?: string | null
          promo_active?: boolean
          promo_end_at?: string | null
          promo_first_verify_bonus?: number | null
          promo_referrer_bonus?: number | null
          promo_reverify_bonus?: number | null
          promo_start_at?: string | null
          promo_title?: string | null
          recharge_enabled?: boolean
          recharge_off_message?: string | null
          referrer_bonus?: number
          reverify_bonus?: number
          updated_at?: string
          usdt_enabled?: boolean
          usdt_off_message?: string | null
          usdt_rate_bdt?: number
          withdraw_enabled?: boolean
          withdraw_off_message?: string | null
          withdraw_off_until?: string | null
        }
        Relationships: []
      }
      bonus_vouchers: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_vouchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_verify_otps: {
        Row: {
          attempts: number
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
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
          bonus_amount: number
          effective_task_count: number
          is_active: boolean
          last_credited_at: string | null
          qualifying_referees: number
          referral_accrued: number
          user_id: string
          withdrawn_amount: number
        }
        Insert: {
          accrued_amount?: number
          activated_at?: string | null
          admin_forced_active?: boolean
          bonus_amount?: number
          effective_task_count?: number
          is_active?: boolean
          last_credited_at?: string | null
          qualifying_referees?: number
          referral_accrued?: number
          user_id: string
          withdrawn_amount?: number
        }
        Update: {
          accrued_amount?: number
          activated_at?: string | null
          admin_forced_active?: boolean
          bonus_amount?: number
          effective_task_count?: number
          is_active?: boolean
          last_credited_at?: string | null
          qualifying_referees?: number
          referral_accrued?: number
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
      password_reset_otps: {
        Row: {
          attempts: number
          channel: string
          code: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          channel?: string
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          bonus_first_verify_claimed: boolean
          bonus_first_verify_self_claimed: boolean
          bonus_reverify_claimed: boolean
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          district: string | null
          email: string | null
          email_verified: boolean
          email_verified_at: string | null
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
          onboarded_at: string | null
          phone_number: string | null
          post_office: string | null
          referral_code: string
          referral_unlock_override: boolean
          referred_by: string | null
          telegram_user_id: number | null
          tg_link_skipped: boolean
          thana_upazila: string | null
          uid_seq: number | null
          village_area: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bonus_first_verify_claimed?: boolean
          bonus_first_verify_self_claimed?: boolean
          bonus_reverify_claimed?: boolean
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          district?: string | null
          email?: string | null
          email_verified?: boolean
          email_verified_at?: string | null
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
          onboarded_at?: string | null
          phone_number?: string | null
          post_office?: string | null
          referral_code: string
          referral_unlock_override?: boolean
          referred_by?: string | null
          telegram_user_id?: number | null
          tg_link_skipped?: boolean
          thana_upazila?: string | null
          uid_seq?: number | null
          village_area?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bonus_first_verify_claimed?: boolean
          bonus_first_verify_self_claimed?: boolean
          bonus_reverify_claimed?: boolean
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          district?: string | null
          email?: string | null
          email_verified?: boolean
          email_verified_at?: string | null
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
          onboarded_at?: string | null
          phone_number?: string | null
          post_office?: string | null
          referral_code?: string
          referral_unlock_override?: boolean
          referred_by?: string | null
          telegram_user_id?: number | null
          tg_link_skipped?: boolean
          thana_upazila?: string | null
          uid_seq?: number | null
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
      recharges: {
        Row: {
          amount: number
          connection_type: string
          created_at: string
          error_message: string | null
          id: string
          mobile: string
          operator: string
          provider_ref: string | null
          provider_response: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          connection_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          mobile: string
          operator: string
          provider_ref?: string | null
          provider_response?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          connection_type?: string
          created_at?: string
          error_message?: string | null
          id?: string
          mobile?: string
          operator?: string
          provider_ref?: string | null
          provider_response?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recharges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_reset_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          requested_by: string | null
          resolved_at: string | null
          slots: number[]
          status: string
          tg_chat_id: string | null
          tg_message_id: number | null
          tg_user_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          slots?: number[]
          status?: string
          tg_chat_id?: string | null
          tg_message_id?: number | null
          tg_user_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          slots?: number[]
          status?: string
          tg_chat_id?: string | null
          tg_message_id?: number | null
          tg_user_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_reset_backups: {
        Row: {
          attempts: Json
          created_at: string
          id: string
          reset_by: string | null
          restored_at: string | null
          slot: number
          snapshot: Json
          task_id: string
          user_id: string
        }
        Insert: {
          attempts?: Json
          created_at?: string
          id?: string
          reset_by?: string | null
          restored_at?: string | null
          slot: number
          snapshot: Json
          task_id: string
          user_id: string
        }
        Update: {
          attempts?: Json
          created_at?: string
          id?: string
          reset_by?: string | null
          restored_at?: string | null
          slot?: number
          snapshot?: Json
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          done_at: string | null
          face_label: string | null
          face_photo_url: string | null
          id: string
          initial_verify_at: string | null
          last_reverified_at: string | null
          last_whitelist_check_at: string | null
          reverify_count: number
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
          last_reverified_at?: string | null
          last_whitelist_check_at?: string | null
          reverify_count?: number
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
          last_reverified_at?: string | null
          last_whitelist_check_at?: string | null
          reverify_count?: number
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
      tg_ban_requests: {
        Row: {
          app_user_id: string | null
          created_at: string
          evidence: string | null
          full_name: string | null
          id: string
          matched_uid: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tg_user_id: number | null
          username: string | null
        }
        Insert: {
          app_user_id?: string | null
          created_at?: string
          evidence?: string | null
          full_name?: string | null
          id?: string
          matched_uid?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tg_user_id?: number | null
          username?: string | null
        }
        Update: {
          app_user_id?: string | null
          created_at?: string
          evidence?: string | null
          full_name?: string | null
          id?: string
          matched_uid?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tg_user_id?: number | null
          username?: string | null
        }
        Relationships: []
      }
      tg_bot_settings: {
        Row: {
          admin_chat_id: string | null
          admin_mention: string | null
          ask_slot_message: string
          ask_uid_message: string
          auto_block_enabled: boolean
          auto_reply_enabled: boolean
          banned_words: string[]
          block_threshold: number
          created_at: string
          default_video_url: string | null
          delete_bad_messages: boolean
          enabled: boolean
          escalate_enabled: boolean
          group_chat_id: string | null
          id: string
          moderation_enabled: boolean
          persona: string
          photo_analysis_enabled: boolean
          photo_privacy_enabled: boolean
          quote_reply: boolean
          reply_variety: boolean
          rules: string
          slot_reset_enabled: boolean
          smart_mode: boolean
          support_username: string
          uid_lookup_enabled: boolean
          updated_at: string
          warn_threshold: number
          welcome_enabled: boolean
          welcome_message: string | null
        }
        Insert: {
          admin_chat_id?: string | null
          admin_mention?: string | null
          ask_slot_message?: string
          ask_uid_message?: string
          auto_block_enabled?: boolean
          auto_reply_enabled?: boolean
          banned_words?: string[]
          block_threshold?: number
          created_at?: string
          default_video_url?: string | null
          delete_bad_messages?: boolean
          enabled?: boolean
          escalate_enabled?: boolean
          group_chat_id?: string | null
          id?: string
          moderation_enabled?: boolean
          persona?: string
          photo_analysis_enabled?: boolean
          photo_privacy_enabled?: boolean
          quote_reply?: boolean
          reply_variety?: boolean
          rules?: string
          slot_reset_enabled?: boolean
          smart_mode?: boolean
          support_username?: string
          uid_lookup_enabled?: boolean
          updated_at?: string
          warn_threshold?: number
          welcome_enabled?: boolean
          welcome_message?: string | null
        }
        Update: {
          admin_chat_id?: string | null
          admin_mention?: string | null
          ask_slot_message?: string
          ask_uid_message?: string
          auto_block_enabled?: boolean
          auto_reply_enabled?: boolean
          banned_words?: string[]
          block_threshold?: number
          created_at?: string
          default_video_url?: string | null
          delete_bad_messages?: boolean
          enabled?: boolean
          escalate_enabled?: boolean
          group_chat_id?: string | null
          id?: string
          moderation_enabled?: boolean
          persona?: string
          photo_analysis_enabled?: boolean
          photo_privacy_enabled?: boolean
          quote_reply?: boolean
          reply_variety?: boolean
          rules?: string
          slot_reset_enabled?: boolean
          smart_mode?: boolean
          support_username?: string
          uid_lookup_enabled?: boolean
          updated_at?: string
          warn_threshold?: number
          welcome_enabled?: boolean
          welcome_message?: string | null
        }
        Relationships: []
      }
      tg_faq: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          image_path: string | null
          is_active: boolean
          keywords: string[]
          priority: number
          topic: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          keywords?: string[]
          priority?: number
          topic: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          keywords?: string[]
          priority?: number
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      tg_messages: {
        Row: {
          action: string | null
          bot_reply: string | null
          chat_id: number
          created_at: string
          full_name: string | null
          has_photo: boolean
          matched_uid: string | null
          message_id: number | null
          text: string | null
          tg_user_id: number | null
          update_id: number
          username: string | null
          verdict: string | null
        }
        Insert: {
          action?: string | null
          bot_reply?: string | null
          chat_id: number
          created_at?: string
          full_name?: string | null
          has_photo?: boolean
          matched_uid?: string | null
          message_id?: number | null
          text?: string | null
          tg_user_id?: number | null
          update_id: number
          username?: string | null
          verdict?: string | null
        }
        Update: {
          action?: string | null
          bot_reply?: string | null
          chat_id?: number
          created_at?: string
          full_name?: string | null
          has_photo?: boolean
          matched_uid?: string | null
          message_id?: number | null
          text?: string | null
          tg_user_id?: number | null
          update_id?: number
          username?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      tg_offenders: {
        Row: {
          app_user_id: string | null
          blocked: boolean
          blocked_at: string | null
          blocked_reason: string | null
          chat_id: number | null
          created_at: string
          full_name: string | null
          known_uid: string | null
          last_offense_at: string
          last_reason: string | null
          note: string | null
          tg_user_id: number
          unblocked_at: string | null
          username: string | null
          warn_count: number
        }
        Insert: {
          app_user_id?: string | null
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          chat_id?: number | null
          created_at?: string
          full_name?: string | null
          known_uid?: string | null
          last_offense_at?: string
          last_reason?: string | null
          note?: string | null
          tg_user_id: number
          unblocked_at?: string | null
          username?: string | null
          warn_count?: number
        }
        Update: {
          app_user_id?: string | null
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          chat_id?: number | null
          created_at?: string
          full_name?: string | null
          known_uid?: string | null
          last_offense_at?: string
          last_reason?: string | null
          note?: string | null
          tg_user_id?: number
          unblocked_at?: string | null
          username?: string | null
          warn_count?: number
        }
        Relationships: []
      }
      tg_sessions: {
        Row: {
          app_user_id: string | null
          chat_id: number
          created_at: string
          data: Json
          expires_at: string
          id: string
          intent: string
          step: string
          tg_user_id: number
          uid: string | null
          updated_at: string
        }
        Insert: {
          app_user_id?: string | null
          chat_id: number
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          intent: string
          step: string
          tg_user_id: number
          uid?: string | null
          updated_at?: string
        }
        Update: {
          app_user_id?: string | null
          chat_id?: number
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          intent?: string
          step?: string
          tg_user_id?: number
          uid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tg_videos: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          note: string | null
          priority: number
          topic: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          note?: string | null
          priority?: number
          topic: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          note?: string | null
          priority?: number
          topic?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      tg_voices: {
        Row: {
          audio_path: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          note: string | null
          priority: number
          topic: string
          updated_at: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          note?: string | null
          priority?: number
          topic: string
          updated_at?: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          note?: string | null
          priority?: number
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_sender_id_fkey"
            columns: ["sender_id"]
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
      user_debts: {
        Row: {
          amount: number
          claim_from_number: string | null
          claim_note: string | null
          claimed_at: string | null
          created_at: string
          id: string
          message: string | null
          payment_number: string
          provider: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          claim_from_number?: string | null
          claim_note?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          payment_number: string
          provider: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          claim_from_number?: string | null
          claim_note?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          payment_number?: string
          provider?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
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
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist_runs: {
        Row: {
          batch_size: number
          batches_done: number
          error_message: string | null
          finished_at: string | null
          flipped: number
          heartbeat_at: string
          id: string
          lease_token: string | null
          lease_until: string | null
          pending_checked: number
          pending_cursor: string | null
          pending_promoted: number
          pending_total: number
          phase: string
          restored: number
          started_at: string
          status: string
          wallet_cursor: string | null
          wallets_checked: number
          wallets_total: number
        }
        Insert: {
          batch_size?: number
          batches_done?: number
          error_message?: string | null
          finished_at?: string | null
          flipped?: number
          heartbeat_at?: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          pending_checked?: number
          pending_cursor?: string | null
          pending_promoted?: number
          pending_total?: number
          phase?: string
          restored?: number
          started_at?: string
          status?: string
          wallet_cursor?: string | null
          wallets_checked?: number
          wallets_total?: number
        }
        Update: {
          batch_size?: number
          batches_done?: number
          error_message?: string | null
          finished_at?: string | null
          flipped?: number
          heartbeat_at?: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          pending_checked?: number
          pending_cursor?: string | null
          pending_promoted?: number
          pending_total?: number
          phase?: string
          restored?: number
          started_at?: string
          status?: string
          wallet_cursor?: string | null
          wallets_checked?: number
          wallets_total?: number
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          paid_by: string | null
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
          paid_by?: string | null
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
          paid_by?: string | null
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
      claim_reverify_bonus: { Args: { _user_id: string }; Returns: number }
      claim_whitelist_run: {
        Args: { _lease_token: string; _run_id: string }
        Returns: boolean
      }
      create_recharge_request: {
        Args: {
          _amount: number
          _connection_type: string
          _mobile: string
          _operator: string
          _user: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_whitelist_cron_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_recharge_result: {
        Args: {
          _error: string
          _provider_ref: string
          _provider_response: Json
          _recharge_id: string
          _status: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      send_balance_transfer: {
        Args: {
          _amount: number
          _note: string
          _sender: string
          _target: string
        }
        Returns: Json
      }
      settle_mining: { Args: { _user_id: string }; Returns: undefined }
      transition_task_whitelist: {
        Args: { _is_whitelisted: boolean; _task_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      task_status: "empty" | "verified" | "done"
      wallet_provider: "bkash" | "nagad" | "usdt"
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
      wallet_provider: ["bkash", "nagad", "usdt"],
      withdrawal_status: ["pending", "paid", "rejected"],
    },
  },
} as const
