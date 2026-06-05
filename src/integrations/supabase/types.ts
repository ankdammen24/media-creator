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
          distribution_platforms: string[]
          external_catalog_source: string | null
          genre: string | null
          id: string
          internal_notes: string | null
          label: string | null
          language: string | null
          metadata_imported_at: string | null
          podcast_category: string | null
          previously_released: boolean
          published_at: string | null
          release_date: string | null
          rights_accepted_at: string | null
          secondary_genre: string | null
          status: Database["public"]["Enums"]["release_status"]
          submitted_at: string | null
          title: string
          upc: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          album_type?: Database["public"]["Enums"]["album_type"]
          artist_profile_id: string
          artwork_path?: string | null
          created_at?: string
          description?: string | null
          distribution_platforms?: string[]
          external_catalog_source?: string | null
          genre?: string | null
          id?: string
          internal_notes?: string | null
          label?: string | null
          language?: string | null
          metadata_imported_at?: string | null
          podcast_category?: string | null
          previously_released?: boolean
          published_at?: string | null
          release_date?: string | null
          rights_accepted_at?: string | null
          secondary_genre?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          submitted_at?: string | null
          title: string
          upc?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          album_type?: Database["public"]["Enums"]["album_type"]
          artist_profile_id?: string
          artwork_path?: string | null
          created_at?: string
          description?: string | null
          distribution_platforms?: string[]
          external_catalog_source?: string | null
          genre?: string | null
          id?: string
          internal_notes?: string | null
          label?: string | null
          language?: string | null
          metadata_imported_at?: string | null
          podcast_category?: string | null
          previously_released?: boolean
          published_at?: string | null
          release_date?: string | null
          rights_accepted_at?: string | null
          secondary_genre?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          submitted_at?: string | null
          title?: string
          upc?: string | null
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
          {
            foreignKeyName: "albums_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["artist_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          owner_user_id: string | null
          revoked_at: string | null
          scopes: string[]
          type: Database["public"]["Enums"]["api_key_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          owner_user_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          type: Database["public"]["Enums"]["api_key_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          owner_user_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          type?: Database["public"]["Enums"]["api_key_type"]
        }
        Relationships: []
      }
      approvals: {
        Row: {
          album_id: string | null
          decided_at: string
          decided_by: string
          decision: string
          id: string
          reason: string | null
          submission_id: string | null
        }
        Insert: {
          album_id?: string | null
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          reason?: string | null
          submission_id?: string | null
        }
        Update: {
          album_id?: string | null
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          reason?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["album_id"]
          },
          {
            foreignKeyName: "approvals_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["track_id"]
          },
          {
            foreignKeyName: "approvals_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
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
          {
            foreignKeyName: "artist_images_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["artist_id"]
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
          {
            foreignKeyName: "artist_ownership_log_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["artist_id"]
          },
        ]
      }
      artist_profiles: {
        Row: {
          amazon_music_url: string | null
          apple_music_url: string | null
          approval_status: Database["public"]["Enums"]["artist_approval_status"]
          avatar_path: string | null
          bio: string | null
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spotify_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          x_url: string | null
        }
        Insert: {
          amazon_music_url?: string | null
          apple_music_url?: string | null
          approval_status?: Database["public"]["Enums"]["artist_approval_status"]
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spotify_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          x_url?: string | null
        }
        Update: {
          amazon_music_url?: string | null
          apple_music_url?: string | null
          approval_status?: Database["public"]["Enums"]["artist_approval_status"]
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spotify_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      audio_processing_logs: {
        Row: {
          created_at: string
          created_by: string | null
          event: string
          id: string
          level: string
          message: string
          payload: Json
          submission_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event: string
          id?: string
          level?: string
          message: string
          payload?: Json
          submission_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event?: string
          id?: string
          level?: string
          message?: string
          payload?: Json
          submission_id?: string | null
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          album_title_raw: string | null
          applied_changes: Json | null
          artist_name_raw: string | null
          created_at: string
          id: string
          isrc_raw: string | null
          match_status: string
          matched_album_id: string | null
          matched_artist_id: string | null
          matched_submission_id: string | null
          notes: string | null
          proposed_changes: Json
          row_index: number | null
          run_id: string
          sheet_name: string | null
          track_title_raw: string | null
          upc_raw: string | null
        }
        Insert: {
          album_title_raw?: string | null
          applied_changes?: Json | null
          artist_name_raw?: string | null
          created_at?: string
          id?: string
          isrc_raw?: string | null
          match_status?: string
          matched_album_id?: string | null
          matched_artist_id?: string | null
          matched_submission_id?: string | null
          notes?: string | null
          proposed_changes?: Json
          row_index?: number | null
          run_id: string
          sheet_name?: string | null
          track_title_raw?: string | null
          upc_raw?: string | null
        }
        Update: {
          album_title_raw?: string | null
          applied_changes?: Json | null
          artist_name_raw?: string | null
          created_at?: string
          id?: string
          isrc_raw?: string | null
          match_status?: string
          matched_album_id?: string | null
          matched_artist_id?: string | null
          matched_submission_id?: string | null
          notes?: string | null
          proposed_changes?: Json
          row_index?: number | null
          run_id?: string
          sheet_name?: string | null
          track_title_raw?: string | null
          upc_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          filename: string | null
          id: string
          source: string
          status: string
          summary: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          filename?: string | null
          id?: string
          source?: string
          status?: string
          summary?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          filename?: string | null
          id?: string
          source?: string
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      media_files: {
        Row: {
          album_id: string | null
          artist_profile_id: string | null
          bucket: string
          checksum: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          kind: string
          metadata: Json
          mime_type: string | null
          owner_id: string
          path: string
          size_bytes: number | null
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          album_id?: string | null
          artist_profile_id?: string | null
          bucket: string
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind: string
          metadata?: Json
          mime_type?: string | null
          owner_id: string
          path: string
          size_bytes?: number | null
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          album_id?: string | null
          artist_profile_id?: string | null
          bucket?: string
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          owner_id?: string
          path?: string
          size_bytes?: number | null
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_files_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["album_id"]
          },
          {
            foreignKeyName: "media_files_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["artist_id"]
          },
          {
            foreignKeyName: "media_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["track_id"]
          },
          {
            foreignKeyName: "media_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
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
      playback_events: {
        Row: {
          azuracast_played_at: string | null
          azuracast_song_id: string | null
          event_type: Database["public"]["Enums"]["playback_event_type"]
          id: string
          occurred_at: string
          session_id: string | null
          source: string | null
          submission_id: string
          user_id: string | null
        }
        Insert: {
          azuracast_played_at?: string | null
          azuracast_song_id?: string | null
          event_type: Database["public"]["Enums"]["playback_event_type"]
          id?: string
          occurred_at?: string
          session_id?: string | null
          source?: string | null
          submission_id: string
          user_id?: string | null
        }
        Update: {
          azuracast_played_at?: string | null
          azuracast_song_id?: string | null
          event_type?: Database["public"]["Enums"]["playback_event_type"]
          id?: string
          occurred_at?: string
          session_id?: string | null
          source?: string | null
          submission_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playback_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["track_id"]
          },
          {
            foreignKeyName: "playback_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          display_name: string | null
          id: string
          is_disabled: boolean
          notification_prefs: Json
          preferred_language: Database["public"]["Enums"]["app_language"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          display_name?: string | null
          id?: string
          is_disabled?: boolean
          notification_prefs?: Json
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          display_name?: string | null
          id?: string
          is_disabled?: boolean
          notification_prefs?: Json
          preferred_language?: Database["public"]["Enums"]["app_language"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      radio_import_runs: {
        Row: {
          completed_at: string | null
          error: string | null
          id: string
          source: string
          spins_inserted: number
          spins_skipped: number
          started_at: string
          status: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          id?: string
          source?: string
          spins_inserted?: number
          spins_skipped?: number
          started_at?: string
          status?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          id?: string
          source?: string
          spins_inserted?: number
          spins_skipped?: number
          started_at?: string
          status?: string
          window_end?: string | null
          window_start?: string | null
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
            foreignKeyName: "submission_artists_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["artist_id"]
          },
          {
            foreignKeyName: "submission_artists_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["track_id"]
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
          ai_generated: boolean
          album_id: string | null
          approved_at: string | null
          approved_by: string | null
          artist_profile_id: string
          artwork_path: string
          atmos_audio_path: string | null
          audio_master_path: string | null
          audio_path: string
          audio_web_path: string | null
          azuracast_file_id: number | null
          azuracast_song_id: string | null
          azuracast_sync_error: string | null
          azuracast_synced_at: string | null
          azuracast_unique_id: string | null
          created_at: string
          description: string | null
          dolby_atmos_available: boolean
          duration_seconds: number | null
          episode_number: number | null
          episode_type: Database["public"]["Enums"]["podcast_episode_type"]
          explicit: boolean
          external_catalog_source: string | null
          featured_artists: string[]
          guests: string[]
          hosts: string[]
          id: string
          instrumental: boolean
          isrc: string | null
          loudness_i: number | null
          loudness_lra: number | null
          loudness_lufs: number | null
          loudness_tp: number | null
          media_type: Database["public"]["Enums"]["media_type"]
          metadata_imported_at: string | null
          preview_start_seconds: number | null
          processed_at: string | null
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["audio_processing_status"]
          producers: string[]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_publish_at: string | null
          season_number: number | null
          songwriters: string[]
          status: Database["public"]["Enums"]["submission_status"]
          title: string
          track_number: number | null
          upc: string | null
          updated_at: string
          user_id: string
          version: string | null
        }
        Insert: {
          ai_generated?: boolean
          album_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          artist_profile_id: string
          artwork_path: string
          atmos_audio_path?: string | null
          audio_master_path?: string | null
          audio_path: string
          audio_web_path?: string | null
          azuracast_file_id?: number | null
          azuracast_song_id?: string | null
          azuracast_sync_error?: string | null
          azuracast_synced_at?: string | null
          azuracast_unique_id?: string | null
          created_at?: string
          description?: string | null
          dolby_atmos_available?: boolean
          duration_seconds?: number | null
          episode_number?: number | null
          episode_type?: Database["public"]["Enums"]["podcast_episode_type"]
          explicit?: boolean
          external_catalog_source?: string | null
          featured_artists?: string[]
          guests?: string[]
          hosts?: string[]
          id?: string
          instrumental?: boolean
          isrc?: string | null
          loudness_i?: number | null
          loudness_lra?: number | null
          loudness_lufs?: number | null
          loudness_tp?: number | null
          media_type: Database["public"]["Enums"]["media_type"]
          metadata_imported_at?: string | null
          preview_start_seconds?: number | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["audio_processing_status"]
          producers?: string[]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_publish_at?: string | null
          season_number?: number | null
          songwriters?: string[]
          status?: Database["public"]["Enums"]["submission_status"]
          title: string
          track_number?: number | null
          upc?: string | null
          updated_at?: string
          user_id: string
          version?: string | null
        }
        Update: {
          ai_generated?: boolean
          album_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          artist_profile_id?: string
          artwork_path?: string
          atmos_audio_path?: string | null
          audio_master_path?: string | null
          audio_path?: string
          audio_web_path?: string | null
          azuracast_file_id?: number | null
          azuracast_song_id?: string | null
          azuracast_sync_error?: string | null
          azuracast_synced_at?: string | null
          azuracast_unique_id?: string | null
          created_at?: string
          description?: string | null
          dolby_atmos_available?: boolean
          duration_seconds?: number | null
          episode_number?: number | null
          episode_type?: Database["public"]["Enums"]["podcast_episode_type"]
          explicit?: boolean
          external_catalog_source?: string | null
          featured_artists?: string[]
          guests?: string[]
          hosts?: string[]
          id?: string
          instrumental?: boolean
          isrc?: string | null
          loudness_i?: number | null
          loudness_lra?: number | null
          loudness_lufs?: number | null
          loudness_tp?: number | null
          media_type?: Database["public"]["Enums"]["media_type"]
          metadata_imported_at?: string | null
          preview_start_seconds?: number | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["audio_processing_status"]
          producers?: string[]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_publish_at?: string | null
          season_number?: number | null
          songwriters?: string[]
          status?: Database["public"]["Enums"]["submission_status"]
          title?: string
          track_number?: number | null
          upc?: string | null
          updated_at?: string
          user_id?: string
          version?: string | null
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
            foreignKeyName: "submissions_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["album_id"]
          },
          {
            foreignKeyName: "submissions_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_artist_profile_id_fkey"
            columns: ["artist_profile_id"]
            isOneToOne: false
            referencedRelation: "published_tracks_view"
            referencedColumns: ["artist_id"]
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
      published_tracks_view: {
        Row: {
          album_artwork_path: string | null
          album_id: string | null
          album_title: string | null
          approved_at: string | null
          artist_avatar_path: string | null
          artist_id: string | null
          artist_name: string | null
          created_at: string | null
          duration_seconds: number | null
          explicit: boolean | null
          featured_artists: string[] | null
          genre: string | null
          isrc: string | null
          label: string | null
          media_type: Database["public"]["Enums"]["media_type"] | null
          preview_path: string | null
          release_date: string | null
          title: string | null
          track_artwork_path: string | null
          track_id: string | null
          track_number: number | null
          upc: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_user_disabled: {
        Args: { _disabled: boolean; _target_user: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      self_approve_artist_account: {
        Args: {
          _artist_profile_id?: string
          _bio?: string
          _mode: string
          _name?: string
          _user_id: string
          _website?: string
        }
        Returns: {
          id: string
          name: string
        }[]
      }
    }
    Enums: {
      album_type: "album" | "ep" | "single" | "compilation" | "podcast_show"
      api_key_type: "user" | "service"
      app_language: "sv" | "en"
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "artist"
        | "super_admin"
        | "creator"
      artist_approval_status: "pending" | "approved" | "rejected"
      artist_image_kind: "avatar" | "cover" | "press"
      artist_image_visibility: "public" | "link_only"
      audio_processing_status:
        | "pending"
        | "processing"
        | "done"
        | "failed"
        | "skipped"
      media_type: "music" | "podcast"
      playback_event_type: "play" | "completed_30s" | "radio_spin"
      podcast_episode_type: "full" | "trailer" | "bonus"
      release_status:
        | "draft"
        | "uploaded"
        | "under_review"
        | "approved"
        | "rejected"
        | "published"
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
      album_type: ["album", "ep", "single", "compilation", "podcast_show"],
      api_key_type: ["user", "service"],
      app_language: ["sv", "en"],
      app_role: [
        "admin",
        "moderator",
        "user",
        "artist",
        "super_admin",
        "creator",
      ],
      artist_approval_status: ["pending", "approved", "rejected"],
      artist_image_kind: ["avatar", "cover", "press"],
      artist_image_visibility: ["public", "link_only"],
      audio_processing_status: [
        "pending",
        "processing",
        "done",
        "failed",
        "skipped",
      ],
      media_type: ["music", "podcast"],
      playback_event_type: ["play", "completed_30s", "radio_spin"],
      podcast_episode_type: ["full", "trailer", "bonus"],
      release_status: [
        "draft",
        "uploaded",
        "under_review",
        "approved",
        "rejected",
        "published",
      ],
      submission_status: ["pending_review", "approved", "rejected"],
    },
  },
} as const
