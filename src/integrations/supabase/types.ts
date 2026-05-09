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
      chef_preferences: {
        Row: {
          chef_name: string
          chef_slug: string | null
          created_at: string
          id: string
          is_custom: boolean
          user_id: string
        }
        Insert: {
          chef_name: string
          chef_slug?: string | null
          created_at?: string
          id?: string
          is_custom?: boolean
          user_id: string
        }
        Update: {
          chef_name?: string
          chef_slug?: string | null
          created_at?: string
          id?: string
          is_custom?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chef_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuisine_preferences: {
        Row: {
          created_at: string
          cuisine_name: string
          cuisine_slug: string | null
          id: string
          is_custom: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          cuisine_name: string
          cuisine_slug?: string | null
          id?: string
          is_custom?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          cuisine_name?: string
          cuisine_slug?: string | null
          id?: string
          is_custom?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuisine_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_sessions: {
        Row: {
          clarified_ingredients: Json | null
          cooked_for: string[] | null
          created_at: string
          detected_ingredients: Json | null
          id: string
          modifier: string | null
          photo_urls: string[]
          status: string
          surprise_for_session: number | null
          time_budget: string | null
          user_id: string
        }
        Insert: {
          clarified_ingredients?: Json | null
          cooked_for?: string[] | null
          created_at?: string
          detected_ingredients?: Json | null
          id?: string
          modifier?: string | null
          photo_urls?: string[]
          status?: string
          surprise_for_session?: number | null
          time_budget?: string | null
          user_id: string
        }
        Update: {
          clarified_ingredients?: Json | null
          cooked_for?: string[] | null
          created_at?: string
          detected_ingredients?: Json | null
          id?: string
          modifier?: string | null
          photo_urls?: string[]
          status?: string
          surprise_for_session?: number | null
          time_budget?: string | null
          user_id?: string
        }
        Relationships: []
      }
      kitchen_profiles: {
        Row: {
          appliances: string[]
          created_at: string
          default_acid: string | null
          default_fat: string | null
          id: string
          stove_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appliances?: string[]
          created_at?: string
          default_acid?: string | null
          default_fat?: string | null
          id?: string
          stove_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appliances?: string[]
          created_at?: string
          default_acid?: string | null
          default_fat?: string | null
          id?: string
          stove_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          always_stocked: boolean
          category: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          always_stocked?: boolean
          category: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          always_stocked?: boolean
          category?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          comfort_food_tag: string | null
          created_at: string
          dietary_constraints: string[]
          dislikes: string[]
          id: string
          name: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comfort_food_tag?: string | null
          created_at?: string
          dietary_constraints?: string[]
          dislikes?: string[]
          id?: string
          name: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comfort_food_tag?: string | null
          created_at?: string
          dietary_constraints?: string[]
          dislikes?: string[]
          id?: string
          name?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portrait_corrections: {
        Row: {
          applied_to_field: string | null
          correction_text: string
          created_at: string
          id: string
          observation_text: string | null
          user_id: string
        }
        Insert: {
          applied_to_field?: string | null
          correction_text: string
          created_at?: string
          id?: string
          observation_text?: string | null
          user_id: string
        }
        Update: {
          applied_to_field?: string | null
          correction_text?: string
          created_at?: string
          id?: string
          observation_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      preference_questions: {
        Row: {
          axis: string
          category_scope: string | null
          created_at: string
          external_id: number
          id: string
          option_a_label: string
          option_a_signal: string
          option_b_label: string
          option_b_signal: string
          question: string
        }
        Insert: {
          axis: string
          category_scope?: string | null
          created_at?: string
          external_id: number
          id?: string
          option_a_label: string
          option_a_signal: string
          option_b_label: string
          option_b_signal: string
          question: string
        }
        Update: {
          axis?: string
          category_scope?: string | null
          created_at?: string
          external_id?: number
          id?: string
          option_a_label?: string
          option_a_signal?: string
          option_b_label?: string
          option_b_signal?: string
          question?: string
        }
        Relationships: []
      }
      preference_signals: {
        Row: {
          axis: string | null
          created_at: string
          id: string
          metadata: Json
          signal_text: string
          signal_weight: number
          source: string
          user_id: string
        }
        Insert: {
          axis?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          signal_text: string
          signal_weight?: number
          source: string
          user_id: string
        }
        Update: {
          axis?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          signal_text?: string
          signal_weight?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          dietary_preference: string
          display_name: string | null
          id: string
          kitchen_voice: string | null
          onboarding_complete: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dietary_preference?: string
          display_name?: string | null
          id: string
          kitchen_voice?: string | null
          onboarding_complete?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dietary_preference?: string
          display_name?: string | null
          id?: string
          kitchen_voice?: string | null
          onboarding_complete?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recipe_voice_lines: {
        Row: {
          created_at: string
          id: string
          intro_line: string | null
          recipe_id: string
          success_line: string | null
          voice_character: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro_line?: string | null
          recipe_id: string
          success_line?: string | null
          voice_character: string
        }
        Update: {
          created_at?: string
          id?: string
          intro_line?: string | null
          recipe_id?: string
          success_line?: string | null
          voice_character?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_voice_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          body: Json | null
          chef_inspiration: string | null
          cooked_at: string | null
          cooked_for: string[] | null
          created_at: string
          cuisine: string | null
          difficulty: string | null
          id: string
          image_path: string | null
          is_wildcard: boolean
          notes: string | null
          position: number | null
          rating: number | null
          session_id: string | null
          time_estimate_minutes: number | null
          title: string | null
          updated_at: string
          user_id: string
          wildcard_rationale: string | null
        }
        Insert: {
          body?: Json | null
          chef_inspiration?: string | null
          cooked_at?: string | null
          cooked_for?: string[] | null
          created_at?: string
          cuisine?: string | null
          difficulty?: string | null
          id?: string
          image_path?: string | null
          is_wildcard?: boolean
          notes?: string | null
          position?: number | null
          rating?: number | null
          session_id?: string | null
          time_estimate_minutes?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
          wildcard_rationale?: string | null
        }
        Update: {
          body?: Json | null
          chef_inspiration?: string | null
          cooked_at?: string | null
          cooked_for?: string[] | null
          created_at?: string
          cuisine?: string | null
          difficulty?: string | null
          id?: string
          image_path?: string | null
          is_wildcard?: boolean
          notes?: string | null
          position?: number | null
          rating?: number | null
          session_id?: string | null
          time_estimate_minutes?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
          wildcard_rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fridge_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      taste_portraits: {
        Row: {
          created_at: string
          cuisine_patterns: Json
          flavor_preferences: Json
          id: string
          last_synthesis_at: string | null
          next_synthesis_due_after_ratings: number | null
          notable_observations: Json
          people_patterns: Json
          seasonal_patterns: Json
          surprise_tolerance: number
          synthesis_count: number
          technique_preferences: Json
          time_patterns: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuisine_patterns?: Json
          flavor_preferences?: Json
          id?: string
          last_synthesis_at?: string | null
          next_synthesis_due_after_ratings?: number | null
          notable_observations?: Json
          people_patterns?: Json
          seasonal_patterns?: Json
          surprise_tolerance?: number
          synthesis_count?: number
          technique_preferences?: Json
          time_patterns?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuisine_patterns?: Json
          flavor_preferences?: Json
          id?: string
          last_synthesis_at?: string | null
          next_synthesis_due_after_ratings?: number | null
          notable_observations?: Json
          people_patterns?: Json
          seasonal_patterns?: Json
          surprise_tolerance?: number
          synthesis_count?: number
          technique_preferences?: Json
          time_patterns?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
