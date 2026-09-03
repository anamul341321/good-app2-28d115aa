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
      ad_views: {
        Row: {
          created_at: string
          cycle_month: string
          id: string
          kind: string
          user_id: string
          view_day: string
        }
        Insert: {
          created_at?: string
          cycle_month?: string
          id?: string
          kind?: string
          user_id: string
          view_day?: string
        }
        Update: {
          created_at?: string
          cycle_month?: string
          id?: string
          kind?: string
          user_id?: string
          view_day?: string
        }
        Relationships: []
      }
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
      admin_push_targets: {
        Row: {
          created_at: string
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          label?: string | null
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
      ai_answer_cache: {
        Row: {
          answer: string
          created_at: string
          hits: number
          qhash: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          hits?: number
          qhash: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          hits?: number
          qhash?: string
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_keys: {
        Row: {
          active: boolean
          api_key: string
          calls: number
          created_at: string
          exhausted_until: string | null
          id: string
          label: string | null
          last_error: string | null
          last_used_at: string | null
        }
        Insert: {
          active?: boolean
          api_key: string
          calls?: number
          created_at?: string
          exhausted_until?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_used_at?: string | null
        }
        Update: {
          active?: boolean
          api_key?: string
          calls?: number
          created_at?: string
          exhausted_until?: string | null
          id?: string
          label?: string | null
          last_error?: string | null
          last_used_at?: string | null
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
      auto_engage_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_engage_actions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_engage_jobs: {
        Row: {
          comments_done: number
          created_at: string
          finished: boolean
          last_run_at: string | null
          likes_done: number
          owner_id: string
          post_id: string
          quality: number
          sentiment: string
          target_likes: number
        }
        Insert: {
          comments_done?: number
          created_at?: string
          finished?: boolean
          last_run_at?: string | null
          likes_done?: number
          owner_id: string
          post_id: string
          quality?: number
          sentiment?: string
          target_likes?: number
        }
        Update: {
          comments_done?: number
          created_at?: string
          finished?: boolean
          last_run_at?: string | null
          likes_done?: number
          owner_id?: string
          post_id?: string
          quality?: number
          sentiment?: string
          target_likes?: number
        }
        Relationships: [
          {
            foreignKeyName: "auto_engage_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_audit: {
        Row: {
          accrued_after: number
          accrued_before: number
          actor: string | null
          balance_after: number
          balance_before: number
          bonus_after: number
          bonus_before: number
          created_at: string
          delta: number
          id: string
          note: string | null
          source: string
          user_id: string
          withdrawn_after: number
          withdrawn_before: number
        }
        Insert: {
          accrued_after?: number
          accrued_before?: number
          actor?: string | null
          balance_after?: number
          balance_before?: number
          bonus_after?: number
          bonus_before?: number
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          source?: string
          user_id: string
          withdrawn_after?: number
          withdrawn_before?: number
        }
        Update: {
          accrued_after?: number
          accrued_before?: number
          actor?: string | null
          balance_after?: number
          balance_before?: number
          bonus_after?: number
          bonus_before?: number
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          source?: string
          user_id?: string
          withdrawn_after?: number
          withdrawn_before?: number
        }
        Relationships: []
      }
      balance_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          source_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      bonus_settings: {
        Row: {
          ads_appopen_enabled: boolean
          ads_banner_enabled: boolean
          ads_banner_unit: string | null
          ads_enabled: boolean
          ads_interstitial_unit: string | null
          ads_rewarded_enabled: boolean
          ads_rewarded_unit: string | null
          ads_test_mode: boolean | null
          apk_url: string | null
          apk_version: string | null
          auto_payout_enabled: boolean
          auto_payout_kyc_only: boolean
          auto_payout_max: number
          bkash_enabled: boolean
          bkash_off_message: string | null
          bonus_enabled: boolean
          bonus_enabled_at: string | null
          email_otp_enabled: boolean
          face_verify_enabled: boolean
          face_verify_off_message: string | null
          first_verify_bonus: number
          first_verify_enabled: boolean
          first_verify_mining_mode: boolean
          first_verify_off_message: string | null
          force_update_enabled: boolean
          force_update_message: string | null
          force_update_web: boolean
          id: string
          maintenance_enabled: boolean
          maintenance_message: string | null
          min_app_version: string | null
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
          signup_off_message: string | null
          test_apk_url: string | null
          test_apk_version: string | null
          updated_at: string
          usdt_enabled: boolean
          usdt_off_message: string | null
          usdt_rate_bdt: number
          withdraw_enabled: boolean
          withdraw_off_message: string | null
          withdraw_off_until: string | null
        }
        Insert: {
          ads_appopen_enabled?: boolean
          ads_banner_enabled?: boolean
          ads_banner_unit?: string | null
          ads_enabled?: boolean
          ads_interstitial_unit?: string | null
          ads_rewarded_enabled?: boolean
          ads_rewarded_unit?: string | null
          ads_test_mode?: boolean | null
          apk_url?: string | null
          apk_version?: string | null
          auto_payout_enabled?: boolean
          auto_payout_kyc_only?: boolean
          auto_payout_max?: number
          bkash_enabled?: boolean
          bkash_off_message?: string | null
          bonus_enabled?: boolean
          bonus_enabled_at?: string | null
          email_otp_enabled?: boolean
          face_verify_enabled?: boolean
          face_verify_off_message?: string | null
          first_verify_bonus?: number
          first_verify_enabled?: boolean
          first_verify_mining_mode?: boolean
          first_verify_off_message?: string | null
          force_update_enabled?: boolean
          force_update_message?: string | null
          force_update_web?: boolean
          id?: string
          maintenance_enabled?: boolean
          maintenance_message?: string | null
          min_app_version?: string | null
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
          signup_off_message?: string | null
          test_apk_url?: string | null
          test_apk_version?: string | null
          updated_at?: string
          usdt_enabled?: boolean
          usdt_off_message?: string | null
          usdt_rate_bdt?: number
          withdraw_enabled?: boolean
          withdraw_off_message?: string | null
          withdraw_off_until?: string | null
        }
        Update: {
          ads_appopen_enabled?: boolean
          ads_banner_enabled?: boolean
          ads_banner_unit?: string | null
          ads_enabled?: boolean
          ads_interstitial_unit?: string | null
          ads_rewarded_enabled?: boolean
          ads_rewarded_unit?: string | null
          ads_test_mode?: boolean | null
          apk_url?: string | null
          apk_version?: string | null
          auto_payout_enabled?: boolean
          auto_payout_kyc_only?: boolean
          auto_payout_max?: number
          bkash_enabled?: boolean
          bkash_off_message?: string | null
          bonus_enabled?: boolean
          bonus_enabled_at?: string | null
          email_otp_enabled?: boolean
          face_verify_enabled?: boolean
          face_verify_off_message?: string | null
          first_verify_bonus?: number
          first_verify_enabled?: boolean
          first_verify_mining_mode?: boolean
          first_verify_off_message?: string | null
          force_update_enabled?: boolean
          force_update_message?: string | null
          force_update_web?: boolean
          id?: string
          maintenance_enabled?: boolean
          maintenance_message?: string | null
          min_app_version?: string | null
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
          signup_off_message?: string | null
          test_apk_url?: string | null
          test_apk_version?: string | null
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
      broadcast_campaigns: {
        Row: {
          created_at: string | null
          error_message: string | null
          failed_count: number | null
          id: string
          last_processed_id: string | null
          sent_count: number | null
          status: string
          target: string
          target_uids: string[] | null
          text: string
          total_users: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          failed_count?: number | null
          id?: string
          last_processed_id?: string | null
          sent_count?: number | null
          status?: string
          target: string
          target_uids?: string[] | null
          text: string
          total_users?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          failed_count?: number | null
          id?: string
          last_processed_id?: string | null
          sent_count?: number | null
          status?: string
          target?: string
          target_uids?: string[] | null
          text?: string
          total_users?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      broadcast_logs: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          error: string | null
          id: string
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          status: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          accepted_at: string | null
          answer: Json | null
          call_type: string
          callee_id: string
          caller_id: string
          created_at: string
          ended_at: string | null
          ended_reason: string | null
          id: string
          offer: Json | null
          ringing_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          answer?: Json | null
          call_type: string
          callee_id: string
          caller_id: string
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          offer?: Json | null
          ringing_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          answer?: Json | null
          call_type?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          offer?: Json | null
          ringing_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_used: boolean
          product_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_used?: boolean
          product_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_used?: boolean
          product_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "card_products"
            referencedColumns: ["id"]
          },
        ]
      }
      card_products: {
        Row: {
          amount_label: string
          card_type: Database["public"]["Enums"]["app_card_type"]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          operator: Database["public"]["Enums"]["app_operator"]
          selling_price: number
          updated_at: string
          validity: string | null
        }
        Insert: {
          amount_label: string
          card_type: Database["public"]["Enums"]["app_card_type"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          operator: Database["public"]["Enums"]["app_operator"]
          selling_price?: number
          updated_at?: string
          validity?: string | null
        }
        Update: {
          amount_label?: string
          card_type?: Database["public"]["Enums"]["app_card_type"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          operator?: Database["public"]["Enums"]["app_operator"]
          selling_price?: number
          updated_at?: string
          validity?: string | null
        }
        Relationships: []
      }
      celo_sweep_jobs: {
        Row: {
          created_at: string
          cursor: number
          dust: number
          empty_count: number
          error_message: string | null
          failed: number
          heartbeat_at: string
          id: string
          keys: string[]
          log: Json
          sent: number
          status: string
          to_address: string
          total_celo: number
          total_keys: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor?: number
          dust?: number
          empty_count?: number
          error_message?: string | null
          failed?: number
          heartbeat_at?: string
          id?: string
          keys: string[]
          log?: Json
          sent?: number
          status?: string
          to_address: string
          total_celo?: number
          total_keys?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor?: number
          dust?: number
          empty_count?: number
          error_message?: string | null
          failed?: number
          heartbeat_at?: string
          id?: string
          keys?: string[]
          log?: Json
          sent?: number
          status?: string
          to_address?: string
          total_celo?: number
          total_keys?: number
          updated_at?: string
        }
        Relationships: []
      }
      channel_subscriptions: {
        Row: {
          channel_user_id: string
          created_at: string
          id: string
          subscriber_user_id: string
        }
        Insert: {
          channel_user_id: string
          created_at?: string
          id?: string
          subscriber_user_id: string
        }
        Update: {
          channel_user_id?: string
          created_at?: string
          id?: string
          subscriber_user_id?: string
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          group_id: string
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_ad_views: {
        Row: {
          coins: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coin_telegram_claims: {
        Row: {
          claimed_at: string
          id: string
          tg_user_id: number | null
          user_id: string
          username_lc: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          tg_user_id?: number | null
          user_id: string
          username_lc: string
        }
        Update: {
          claimed_at?: string
          id?: string
          tg_user_id?: number | null
          user_id?: string
          username_lc?: string
        }
        Relationships: []
      }
      coin_wallets: {
        Row: {
          balance: number
          created_at: string
          telegram_joined: boolean
          telegram_joined_at: string | null
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          telegram_joined?: boolean
          telegram_joined_at?: string | null
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          telegram_joined?: boolean
          telegram_joined_at?: string | null
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_activity: {
        Row: {
          day: string
          seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          day: string
          seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          day?: string
          seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      face_signups: {
        Row: {
          attempts: number
          created_at: string
          display_name: string
          face_photo_url: string | null
          id: string
          phone_number: string
          status: string
          user_id: string | null
          verified_at: string | null
          wallet_address: string
          wallet_private_key: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          display_name: string
          face_photo_url?: string | null
          id?: string
          phone_number: string
          status?: string
          user_id?: string | null
          verified_at?: string | null
          wallet_address: string
          wallet_private_key: string
        }
        Update: {
          attempts?: number
          created_at?: string
          display_name?: string
          face_photo_url?: string | null
          id?: string
          phone_number?: string
          status?: string
          user_id?: string | null
          verified_at?: string | null
          wallet_address?: string
          wallet_private_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_signups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_notifications: {
        Row: {
          content: string | null
          created_at: string
          from_user_id: string | null
          id: string
          is_read: boolean
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_links: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friend_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          group_id: string | null
          id: string
          kind: string
          media_meta: Json | null
          media_url: string | null
          read_at: string | null
          receiver_id: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          media_meta?: Json | null
          media_url?: string | null
          read_at?: string | null
          receiver_id?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          media_meta?: Json | null
          media_url?: string | null
          read_at?: string | null
          receiver_id?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_messages_group_fk"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "friend_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_claims: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          note: string | null
          referral_amount: number
          self_amount: number
          user_id: string
        }
        Insert: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          referral_amount?: number
          self_amount?: number
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          referral_amount?: number
          self_amount?: number
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
          mining_unlocked: number
          mining_withdrawn: number
          qualifying_referees: number
          referral_accrued: number
          referral_units: number
          self_mining_accrued: number
          self_qualified: boolean
          self_slots: number
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
          mining_unlocked?: number
          mining_withdrawn?: number
          qualifying_referees?: number
          referral_accrued?: number
          referral_units?: number
          self_mining_accrued?: number
          self_qualified?: boolean
          self_slots?: number
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
          mining_unlocked?: number
          mining_withdrawn?: number
          qualifying_referees?: number
          referral_accrued?: number
          referral_units?: number
          self_mining_accrued?: number
          self_qualified?: boolean
          self_slots?: number
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
      post_comments: {
        Row: {
          body: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          parent_comment_id: string | null
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string | null
          comments_count: number
          content: string | null
          created_at: string
          edited_at: string | null
          id: string
          image_url: string | null
          likes_count: number
          media_type: string | null
          media_urls: string[] | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          views_count: number
          visibility: string
        }
        Insert: {
          body?: string | null
          comments_count?: number
          content?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number
          media_type?: string | null
          media_urls?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          views_count?: number
          visibility?: string
        }
        Update: {
          body?: string | null
          comments_count?: number
          content?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number
          media_type?: string | null
          media_urls?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          views_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance_frozen: boolean
          balance_frozen_at: string | null
          balance_frozen_reason: string | null
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          bonus_first_verify_claimed: boolean
          bonus_first_verify_self_claimed: boolean
          bonus_reverify_claimed: boolean
          cover_url: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          district: string | null
          email: string | null
          email_reset_at: string | null
          email_verified: boolean
          email_verified_at: string | null
          father_name: string | null
          full_address: string | null
          gender: string | null
          id: string
          is_verified_badge: boolean
          kyc_nid_back_url: string | null
          kyc_nid_front_url: string | null
          kyc_photo_url: string | null
          kyc_verified: boolean
          kyc_verified_at: string | null
          last_active_at: string | null
          last_reels_seen_at: string | null
          mother_name: string | null
          nid_number: string | null
          onboarded_at: string | null
          phone_number: string | null
          post_office: string | null
          referral_code: string
          referral_unlock_override: boolean
          referred_by: string | null
          referrer_bonus_paid_at: string | null
          telegram_user_id: number | null
          tg_link_skipped: boolean
          thana_upazila: string | null
          uid_seq: number | null
          village_area: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance_frozen?: boolean
          balance_frozen_at?: string | null
          balance_frozen_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          bonus_first_verify_claimed?: boolean
          bonus_first_verify_self_claimed?: boolean
          bonus_reverify_claimed?: boolean
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          district?: string | null
          email?: string | null
          email_reset_at?: string | null
          email_verified?: boolean
          email_verified_at?: string | null
          father_name?: string | null
          full_address?: string | null
          gender?: string | null
          id: string
          is_verified_badge?: boolean
          kyc_nid_back_url?: string | null
          kyc_nid_front_url?: string | null
          kyc_photo_url?: string | null
          kyc_verified?: boolean
          kyc_verified_at?: string | null
          last_active_at?: string | null
          last_reels_seen_at?: string | null
          mother_name?: string | null
          nid_number?: string | null
          onboarded_at?: string | null
          phone_number?: string | null
          post_office?: string | null
          referral_code: string
          referral_unlock_override?: boolean
          referred_by?: string | null
          referrer_bonus_paid_at?: string | null
          telegram_user_id?: number | null
          tg_link_skipped?: boolean
          thana_upazila?: string | null
          uid_seq?: number | null
          village_area?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance_frozen?: boolean
          balance_frozen_at?: string | null
          balance_frozen_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          bonus_first_verify_claimed?: boolean
          bonus_first_verify_self_claimed?: boolean
          bonus_reverify_claimed?: boolean
          cover_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          district?: string | null
          email?: string | null
          email_reset_at?: string | null
          email_verified?: boolean
          email_verified_at?: string | null
          father_name?: string | null
          full_address?: string | null
          gender?: string | null
          id?: string
          is_verified_badge?: boolean
          kyc_nid_back_url?: string | null
          kyc_nid_front_url?: string | null
          kyc_photo_url?: string | null
          kyc_verified?: boolean
          kyc_verified_at?: string | null
          last_active_at?: string | null
          last_reels_seen_at?: string | null
          mother_name?: string | null
          nid_number?: string | null
          onboarded_at?: string | null
          phone_number?: string | null
          post_office?: string | null
          referral_code?: string
          referral_unlock_override?: boolean
          referred_by?: string | null
          referrer_bonus_paid_at?: string | null
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
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recharges: {
        Row: {
          amount: number
          connection_type: string
          created_at: string
          error_message: string | null
          fee_amount: number | null
          id: string
          mobile: string
          operator: string
          provider_ref: string | null
          provider_response: Json | null
          status: string
          total_deducted: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          connection_type?: string
          created_at?: string
          error_message?: string | null
          fee_amount?: number | null
          id?: string
          mobile: string
          operator: string
          provider_ref?: string | null
          provider_response?: Json | null
          status?: string
          total_deducted?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          connection_type?: string
          created_at?: string
          error_message?: string | null
          fee_amount?: number | null
          id?: string
          mobile?: string
          operator?: string
          provider_ref?: string | null
          provider_response?: Json | null
          status?: string
          total_deducted?: number | null
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
      reverify_reminders: {
        Row: {
          due_at: string
          id: string
          sent_at: string
          slot: number
          task_id: string
          user_id: string
          window_label: string
        }
        Insert: {
          due_at: string
          id?: string
          sent_at?: string
          slot: number
          task_id: string
          user_id: string
          window_label: string
        }
        Update: {
          due_at?: string
          id?: string
          sent_at?: string
          slot?: number
          task_id?: string
          user_id?: string
          window_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "reverify_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_claims: {
        Row: {
          bonus_amount: number
          claimed_at: string | null
          created_at: string
          id: string
          mining_amount: number
          slot: number
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          bonus_amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          mining_amount?: number
          slot: number
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          bonus_amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          mining_amount?: number
          slot?: number
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_claims_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          media_type: string
          media_url: string | null
          music_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          media_type?: string
          media_url?: string | null
          music_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          media_type?: string
          media_url?: string | null
          music_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_user_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_user_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
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
          locked_mined: number
          reverify_count: number
          reverify_due_at: string | null
          slot: number
          status: Database["public"]["Enums"]["task_status"]
          user_id: string
          wallet_address: string | null
          wallet_private_key: string | null
          whitelist_ok: boolean
          whitelist_renew_count: number
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
          locked_mined?: number
          reverify_count?: number
          reverify_due_at?: string | null
          slot: number
          status?: Database["public"]["Enums"]["task_status"]
          user_id: string
          wallet_address?: string | null
          wallet_private_key?: string | null
          whitelist_ok?: boolean
          whitelist_renew_count?: number
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
          locked_mined?: number
          reverify_count?: number
          reverify_due_at?: string | null
          slot?: number
          status?: Database["public"]["Enums"]["task_status"]
          user_id?: string
          wallet_address?: string | null
          wallet_private_key?: string | null
          whitelist_ok?: boolean
          whitelist_renew_count?: number
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
          download_notice: string | null
          download_url: string | null
          enabled: boolean
          escalate_enabled: boolean
          group_chat_id: string | null
          id: string
          kyc_enabled: boolean
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
          voice_reply_enabled: boolean
          voice_text_enabled: boolean
          warn_threshold: number
          website_url: string | null
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
          download_notice?: string | null
          download_url?: string | null
          enabled?: boolean
          escalate_enabled?: boolean
          group_chat_id?: string | null
          id?: string
          kyc_enabled?: boolean
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
          voice_reply_enabled?: boolean
          voice_text_enabled?: boolean
          warn_threshold?: number
          website_url?: string | null
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
          download_notice?: string | null
          download_url?: string | null
          enabled?: boolean
          escalate_enabled?: boolean
          group_chat_id?: string | null
          id?: string
          kyc_enabled?: boolean
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
          voice_reply_enabled?: boolean
          voice_text_enabled?: boolean
          warn_threshold?: number
          website_url?: string | null
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
      tg_reply_cache: {
        Row: {
          created_at: string
          hits: number
          id: string
          question: string
          question_key: string
          reply: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hits?: number
          id?: string
          question: string
          question_key: string
          reply: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hits?: number
          id?: string
          question?: string
          question_key?: string
          reply?: string
          updated_at?: string
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
      tiktok_videos: {
        Row: {
          added_by: string
          caption: string | null
          category: string
          created_at: string
          id: string
          is_active: boolean
          video_id: string
          video_url: string
        }
        Insert: {
          added_by?: string
          caption?: string | null
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          video_id: string
          video_url: string
        }
        Update: {
          added_by?: string
          caption?: string | null
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          video_id?: string
          video_url?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          fee_amount: number | null
          id: string
          note: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_amount?: number | null
          id?: string
          note?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_amount?: number | null
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
      user_devices: {
        Row: {
          approval_requested_at: string | null
          approval_state: string | null
          created_at: string
          device_id: string
          id: string
          label: string | null
          last_seen_at: string
          otp_trust_expires_at: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          approval_requested_at?: string | null
          approval_state?: string | null
          created_at?: string
          device_id: string
          id?: string
          label?: string | null
          last_seen_at?: string
          otp_trust_expires_at?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          approval_requested_at?: string | null
          approval_state?: string | null
          created_at?: string
          device_id?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          otp_trust_expires_at?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notices: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string | null
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
      wallet_onchain_scan: {
        Row: {
          celo_in_external: boolean
          in_senders: Json
          nonce: number
          pristine: boolean
          scanned_at: string
          token_in_count: number
          token_out_count: number
          wallet_address: string
        }
        Insert: {
          celo_in_external?: boolean
          in_senders?: Json
          nonce?: number
          pristine?: boolean
          scanned_at?: string
          token_in_count?: number
          token_out_count?: number
          wallet_address: string
        }
        Update: {
          celo_in_external?: boolean
          in_senders?: Json
          nonce?: number
          pristine?: boolean
          scanned_at?: string
          token_in_count?: number
          token_out_count?: number
          wallet_address?: string
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
          fee_refunded: boolean
          id: string
          paid_by: string | null
          payout_message: string | null
          payout_provider: string | null
          payout_requested_at: string | null
          payout_status: string | null
          payout_trxid: string | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          reject_proof_path: string | null
          reject_reason: string | null
          src_main: number
          src_mining: number
          src_referral: number
          status: Database["public"]["Enums"]["withdrawal_status"]
          tg_chat_id: string | null
          tg_message_id: number | null
          user_id: string
          wallet_number: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          fee_refunded?: boolean
          id?: string
          paid_by?: string | null
          payout_message?: string | null
          payout_provider?: string | null
          payout_requested_at?: string | null
          payout_status?: string | null
          payout_trxid?: string | null
          processed_at?: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          reject_proof_path?: string | null
          reject_reason?: string | null
          src_main?: number
          src_mining?: number
          src_referral?: number
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tg_chat_id?: string | null
          tg_message_id?: number | null
          user_id: string
          wallet_number: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          fee_refunded?: boolean
          id?: string
          paid_by?: string | null
          payout_message?: string | null
          payout_provider?: string | null
          payout_requested_at?: string | null
          payout_status?: string | null
          payout_trxid?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["wallet_provider"]
          reject_proof_path?: string | null
          reject_reason?: string | null
          src_main?: number
          src_mining?: number
          src_referral?: number
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tg_chat_id?: string | null
          tg_message_id?: number | null
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
      assert_coin_self: { Args: { _user_id: string }; Returns: undefined }
      auto_engage_pick_users: {
        Args: { p_action: string; p_limit: number; p_post_id: string }
        Returns: {
          user_id: string
        }[]
      }
      award_coin_event: {
        Args: { _event: string; _reference_id?: string; _user_id: string }
        Returns: Json
      }
      claim_ad_coins: { Args: { _user_id: string }; Returns: Json }
      claim_all_slot_mining: { Args: { _user_id: string }; Returns: Json }
      claim_daily_checkin: { Args: { _user_id: string }; Returns: Json }
      claim_mining_earnings: { Args: { _user_id: string }; Returns: Json }
      claim_mining_to_main: { Args: { _user_id: string }; Returns: Json }
      claim_reverify_bonus: { Args: { _user_id: string }; Returns: number }
      claim_slot_mining: {
        Args: { _task_id: string; _user_id: string }
        Returns: Json
      }
      claim_slot_reward: {
        Args: { _task_id: string; _user_id: string }
        Returns: Json
      }
      claim_telegram_join: { Args: { _user_id: string }; Returns: Json }
      claim_watch_coins: {
        Args: { _seconds: number; _user_id: string }
        Returns: Json
      }
      claim_welcome_bonuses: { Args: { _user_id: string }; Returns: Json }
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
      create_withdrawal_request_atomic: {
        Args: {
          _admin_note: string
          _gross: number
          _payout: number
          _provider: Database["public"]["Enums"]["wallet_provider"]
          _user_id: string
          _wallet_number: string
        }
        Returns: Json
      }
      credit_bonus_balance:
        | { Args: { _amount: number; _user_id: string }; Returns: undefined }
        | {
            Args: {
              _amount: number
              _metadata?: Json
              _source_id?: string
              _type?: string
              _user_id: string
            }
            Returns: undefined
          }
      delete_expired_stories: { Args: never; Returns: number }
      expire_unanswered_calls: { Args: never; Returns: number }
      get_ad_coin_status: { Args: { _user_id: string }; Returns: Json }
      get_coin_summary: { Args: { _user_id: string }; Returns: Json }
      get_daily_activity: { Args: { _user_id: string }; Returns: Json }
      get_daily_checkin: { Args: { _user_id: string }; Returns: Json }
      get_user_balance_breakdown: { Args: { _user_id: string }; Returns: Json }
      get_whitelist_cron_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_view: { Args: { _post_id: string }; Returns: number }
      is_group_admin: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
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
      purchase_card: {
        Args: { _product_id: string; _user_id: string }
        Returns: Json
      }
      record_ad_view: {
        Args: {
          _ads_per_boost?: number
          _daily_limit?: number
          _max_boosts?: number
        }
        Returns: Json
      }
      revert_slot_claim_on_unwhitelist: {
        Args: { _task_id: string; _user_id: string }
        Returns: Json
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
      spend_locked_mining: {
        Args: { _amount: number; _user_id: string }
        Returns: number
      }
      touch_daily_activity: {
        Args: { _seconds: number; _user_id: string }
        Returns: Json
      }
      touch_presence: { Args: never; Returns: undefined }
      transition_task_whitelist: {
        Args: { _is_whitelisted: boolean; _task_id: string }
        Returns: string
      }
    }
    Enums: {
      app_card_type: "Minute" | "Internet"
      app_operator: "GP" | "Robi" | "Airtel" | "Banglalink" | "Other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_card_type: ["Minute", "Internet"],
      app_operator: ["GP", "Robi", "Airtel", "Banglalink", "Other"],
      app_role: ["admin", "user"],
      task_status: ["empty", "verified", "done"],
      wallet_provider: ["bkash", "nagad", "usdt"],
      withdrawal_status: ["pending", "paid", "rejected"],
    },
  },
} as const
