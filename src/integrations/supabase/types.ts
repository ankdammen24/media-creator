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
      albums: {
        Row: {
          album_type: Database["public"]["Enums"]["album_type"]
          artist_profile_id: string
          artwork_path: string | null
          created_at: string
          description: string | null
          genre: string | null
          id: string
          release_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          album_type?: Database["public"]["Enums"]["album_type"]
          artist_profile_id: string
          artwork_path?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          release_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          album_type?: Database["public"]["Enums"]["album_type"]
          artist_profile_id?: string
          artwork_path?: string | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          release_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_images: {
        Row: {
          artist_profile_id: string
          caption: string | null
          created_at: string
          credit: string | null
          id: string
          is_primary: boolean
          kind: Database["public"]["Enums"]["artist_image_kind"]
          sort_order: number
          storage_path: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["artist_image_visibility"]
        }
        Insert: {
          artist_profile_id: string
          caption?: string | null
          created_at?: string
          credit?: string | null
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["artist_image_kind"]
          sort_order?: number
          storage_path: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["artist_image_visibility"]
        }
        Update: {
          artist_profile_id?: string
          caption?: string | null
          created_at?: string
          credit?: string | null
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["artist_image_kind"]
          sort_order?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["artist_image_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "artist_images_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_ownership_log: {
        Row: {
          affected_albums: number
          affected_images: number
          affected_submissions: number
          artist_profile_id: string
          changed_by: string
          created_at: string
          from_user_id: string
          id: string
          reason: string | null
          to_user_id: string
        }
        Insert: {
          affected_albums?: number
          affected_images?: number
          affected_submissions?: number
          artist_profile_id: string
          changed_by: string
          created_at?: string
          from_user_id: string
          id?: string
          reason?: string | null
          to_user_id: string
        }
        Update: {
          affected_albums?: number
          affected_images?: number
          affected_submissions?: number
          artist_profile_id?: string
          changed_by?: string
          created_at?: string
          from_user_id?: string
          id?: string
          reason?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_ownership_log_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          amazon_music_url: string | null
          apple_music_url: string | null
          avatar_path: string | null
          bio: string | null
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          name: string
          spotify_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          x_url: string | null
        }
        Insert: {
          amazon_music_url?: string | null
          apple_music_url?: string | null
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          name: string
          spotify_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          x_url?: string | null
        }
        Update: {
          amazon_music_url?: string | null
          apple_music_url?: string | null
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          name?: string
          spotify_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          email_error: string | null
          email_status: string
          id: string
          language: Database["public"]["Enums"]["app_language"]
          read_at: string | null
          submission_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          email_error?: string | null
          email_status?: string
          id?: string
          language?: Database["public"]["Enums"]["app_language"]
          read_at?: string | null
          submission_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          email_error?: string | null
          email_status?: string
          id?: string
          language?: Database["public"]["Enums"]["app_language"]
          read_at?: string | null
          submission_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          preferred_language: Database["public"]["Enums"]["app_language"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      submission_artists: {
        Row: {
          artist_profile_id: string
          created_at: string
          is_primary: boolean
          position: number
          submission_id: string
        }
        Insert: {
          artist_profile_id: string
          created_at?: string
          is_primary?: boolean
          position?: number
          submission_id: string
        }
        Update: {
          artist_profile_id?: string
          created_at?: string
          is_primary?: boolean
          position?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_artists_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_artists_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          album_id: string | null
          approved_at: string | null
          approved_by: string | null
          artist_profile_id: string
          artwork_path: string
          audio_path: string
          azuracast_unique_id: string | null
          created_at: string
          description: string | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          title: string
          track_number: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          album_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          artist_profile_id: string
          artwork_path: string
          audio_path: string
          azuracast_unique_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_type: Database["public"]["Enums"]["media_type"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          title: string
          track_number?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          album_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          artist_profile_id?: string
          artwork_path?: string
          audio_path?: string
          azuracast_unique_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          title?: string
          track_number?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      album_type: "album" | "ep" | "single" | "compilation"
      app_language: "sv" | "en"
      app_role: "admin" | "moderator" | "user" | "artist"
      artist_image_kind: "avatar" | "cover" | "press"
      artist_image_visibility: "public" | "link_only"
      media_type: "music" | "podcast"
      submission_status: "pending_review" | "approved" | "rejected"
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
      album_type: ["album", "ep", "single", "compilation"],
      app_language: ["sv", "en"],
      app_role: ["admin", "moderator", "user", "artist"],
      artist_image_kind: ["avatar", "cover", "press"],
      artist_image_visibility: ["public", "link_only"],
      media_type: ["music", "podcast"],
      submission_status: ["pending_review", "approved", "rejected"],
    },
  },
} as const
