export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      analysis_runs: {
        Row: {
          breakdown: Json;
          created_at: string;
          id: string;
          previous_draw_ids: string[];
          strategy_count: number;
          target_date: string;
          target_session: string;
          top_numbers: Json;
          top_pairs: Json;
          trigger: string;
        };
        Insert: {
          breakdown?: Json;
          created_at?: string;
          id?: string;
          previous_draw_ids?: string[];
          strategy_count?: number;
          target_date: string;
          target_session: string;
          top_numbers?: Json;
          top_pairs?: Json;
          trigger?: string;
        };
        Update: {
          breakdown?: Json;
          created_at?: string;
          id?: string;
          previous_draw_ids?: string[];
          strategy_count?: number;
          target_date?: string;
          target_session?: string;
          top_numbers?: Json;
          top_pairs?: Json;
          trigger?: string;
        };
        Relationships: [];
      };
      backtests: {
        Row: {
          created_at: string;
          date_from: string;
          date_to: string;
          id: string;
          label: string | null;
          results: Json;
          strategy_ids: string[];
        };
        Insert: {
          created_at?: string;
          date_from: string;
          date_to: string;
          id?: string;
          label?: string | null;
          results?: Json;
          strategy_ids?: string[];
        };
        Update: {
          created_at?: string;
          date_from?: string;
          date_to?: string;
          id?: string;
          label?: string | null;
          results?: Json;
          strategy_ids?: string[];
        };
        Relationships: [];
      };
      lottery_games: {
        Row: {
          active: boolean;
          bankers_count: number;
          code: string;
          country: string;
          created_at: string;
          game_name: string;
          id: string;
          number_range_max: number;
          number_range_min: number;
          numbers_drawn: number;
        };
        Insert: {
          active?: boolean;
          bankers_count?: number;
          code: string;
          country?: string;
          created_at?: string;
          game_name: string;
          id?: string;
          number_range_max: number;
          number_range_min?: number;
          numbers_drawn: number;
        };
        Update: {
          active?: boolean;
          bankers_count?: number;
          code?: string;
          country?: string;
          created_at?: string;
          game_name?: string;
          id?: string;
          number_range_max?: number;
          number_range_min?: number;
          numbers_drawn?: number;
        };
        Relationships: [];
      };
      lottery_draws: {
        Row: {
          created_at: string;
          draw_date: string;
          draw_number: number;
          game_id: string;
          id: string;
          source: string | null;
          winning_numbers: number[];
        };
        Insert: {
          created_at?: string;
          draw_date: string;
          draw_number: number;
          game_id: string;
          id?: string;
          source?: string | null;
          winning_numbers: number[];
        };
        Update: {
          created_at?: string;
          draw_date?: string;
          draw_number?: number;
          game_id?: string;
          id?: string;
          source?: string | null;
          winning_numbers?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "lottery_draws_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
        ];
      };
      lottery_predictions: {
        Row: {
          bankers: number[];
          composite_score: Json;
          created_at: string;
          draw_id: string | null;
          explanation: Json;
          game_id: string;
          id: string;
          predicted_numbers: number[];
          status: string;
          strategy_scores: Json;
          target_draw_number: number;
        };
        Insert: {
          bankers: number[];
          composite_score?: Json;
          created_at?: string;
          draw_id?: string | null;
          explanation?: Json;
          game_id: string;
          id?: string;
          predicted_numbers: number[];
          status?: string;
          strategy_scores?: Json;
          target_draw_number: number;
        };
        Update: {
          bankers?: number[];
          composite_score?: Json;
          created_at?: string;
          draw_id?: string | null;
          explanation?: Json;
          game_id?: string;
          id?: string;
          predicted_numbers?: number[];
          status?: string;
          strategy_scores?: Json;
          target_draw_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_predictions_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "lottery_draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lottery_predictions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
        ];
      };
      lottery_prediction_results: {
        Row: {
          actual_numbers: number[];
          banker_hits: number;
          created_at: string;
          id: string;
          matched_numbers: number[];
          prediction_id: string;
          total_hits: number;
        };
        Insert: {
          actual_numbers: number[];
          banker_hits: number;
          created_at?: string;
          id?: string;
          matched_numbers?: number[];
          prediction_id: string;
          total_hits: number;
        };
        Update: {
          actual_numbers?: number[];
          banker_hits?: number;
          created_at?: string;
          id?: string;
          matched_numbers?: number[];
          prediction_id?: string;
          total_hits?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_prediction_results_prediction_id_fkey";
            columns: ["prediction_id"];
            isOneToOne: true;
            referencedRelation: "lottery_predictions";
            referencedColumns: ["id"];
          },
        ];
      };
      research_reports: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error: string | null;
          findings: Json | null;
          id: string;
          manus_task_id: string | null;
          manus_task_url: string | null;
          our_model_snapshot: Json;
          prompt: string;
          raw_message: string | null;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          findings?: Json | null;
          id?: string;
          manus_task_id?: string | null;
          manus_task_url?: string | null;
          our_model_snapshot?: Json;
          prompt: string;
          raw_message?: string | null;
          status?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          findings?: Json | null;
          id?: string;
          manus_task_id?: string | null;
          manus_task_url?: string | null;
          our_model_snapshot?: Json;
          prompt?: string;
          raw_message?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      lottery_ingest_runs: {
        Row: {
          detail: Json;
          error: string | null;
          finished_at: string | null;
          found: number;
          game_id: string;
          id: string;
          inserted: number;
          provider: string;
          skipped: number;
          started_at: string;
          status: string;
        };
        Insert: {
          detail?: Json;
          error?: string | null;
          finished_at?: string | null;
          found?: number;
          game_id: string;
          id?: string;
          inserted?: number;
          provider: string;
          skipped?: number;
          started_at?: string;
          status?: string;
        };
        Update: {
          detail?: Json;
          error?: string | null;
          finished_at?: string | null;
          found?: number;
          game_id?: string;
          id?: string;
          inserted?: number;
          provider?: string;
          skipped?: number;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_ingest_runs_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
        ];
      };
      lottery_backtests: {
        Row: {
          created_at: string;
          date_from: string;
          date_to: string;
          game_id: string;
          id: string;
          label: string | null;
          results: Json;
        };
        Insert: {
          created_at?: string;
          date_from: string;
          date_to: string;
          game_id: string;
          id?: string;
          label?: string | null;
          results?: Json;
        };
        Update: {
          created_at?: string;
          date_from?: string;
          date_to?: string;
          game_id?: string;
          id?: string;
          label?: string | null;
          results?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_backtests_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
        ];
      };
      draws: {
        Row: {
          booster: number | null;
          created_at: string;
          draw_date: string;
          drawn_at: string | null;
          id: string;
          imported_at: string;
          n1: number;
          n2: number;
          n3: number;
          n4: number;
          n5: number;
          n6: number;
          provider: string | null;
          session: string;
          session_verified: boolean;
          source: string | null;
          verified_at: string | null;
        };
        Insert: {
          booster?: number | null;
          created_at?: string;
          draw_date: string;
          drawn_at?: string | null;
          id?: string;
          imported_at?: string;
          n1: number;
          n2: number;
          n3: number;
          n4: number;
          n5: number;
          n6: number;
          provider?: string | null;
          session: string;
          session_verified?: boolean;
          source?: string | null;
          verified_at?: string | null;
        };
        Update: {
          booster?: number | null;
          created_at?: string;
          draw_date?: string;
          drawn_at?: string | null;
          id?: string;
          imported_at?: string;
          n1?: number;
          n2?: number;
          n3?: number;
          n4?: number;
          n5?: number;
          n6?: number;
          provider?: string | null;
          session?: string;
          session_verified?: boolean;
          source?: string | null;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      ingest_runs: {
        Row: {
          detail: Json;
          error: string | null;
          finished_at: string | null;
          found: number;
          id: string;
          inserted: number;
          mode: string;
          provider: string;
          rejected: number;
          retry_count: number;
          skipped: number;
          started_at: string;
          status: string;
        };
        Insert: {
          detail?: Json;
          error?: string | null;
          finished_at?: string | null;
          found?: number;
          id?: string;
          inserted?: number;
          mode: string;
          provider: string;
          rejected?: number;
          retry_count?: number;
          skipped?: number;
          started_at?: string;
          status?: string;
        };
        Update: {
          detail?: Json;
          error?: string | null;
          finished_at?: string | null;
          found?: number;
          id?: string;
          inserted?: number;
          mode?: string;
          provider?: string;
          rejected?: number;
          retry_count?: number;
          skipped?: number;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      predictions: {
        Row: {
          actual: Json | null;
          banker: number | null;
          bankers: Json;
          created_at: string;
          draw_id: string | null;
          generated_at: string;
          graded_at: string | null;
          grading: Json | null;
          history_depth: number;
          id: string;
          learning: Json;
          locked_at: string;
          matched_count: number;
          outcome: string | null;
          pool: Json;
          rows: Json;
          sequence: Json;
          session_state: string;
          status: string;
          strategy_count: number;
          strategy_version: string | null;
          target_date: string;
          target_session: string;
        };
        Insert: {
          actual?: Json | null;
          banker?: number | null;
          bankers?: Json;
          created_at?: string;
          draw_id?: string | null;
          generated_at?: string;
          graded_at?: string | null;
          grading?: Json | null;
          history_depth?: number;
          id?: string;
          learning?: Json;
          locked_at?: string;
          matched_count?: number;
          outcome?: string | null;
          pool?: Json;
          rows?: Json;
          sequence?: Json;
          session_state?: string;
          status?: string;
          strategy_count?: number;
          strategy_version?: string | null;
          target_date: string;
          target_session: string;
        };
        Update: {
          actual?: Json | null;
          banker?: number | null;
          bankers?: Json;
          created_at?: string;
          draw_id?: string | null;
          generated_at?: string;
          graded_at?: string | null;
          grading?: Json | null;
          history_depth?: number;
          id?: string;
          learning?: Json;
          locked_at?: string;
          matched_count?: number;
          outcome?: string | null;
          pool?: Json;
          rows?: Json;
          sequence?: Json;
          session_state?: string;
          status?: string;
          strategy_count?: number;
          strategy_version?: string | null;
          target_date?: string;
          target_session?: string;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
        ];
      };
      strategies: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          enabled: boolean;
          id: string;
          name: string;
          notes: string | null;
          params: Json;
          rule_type: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          name: string;
          notes?: string | null;
          params?: Json;
          rule_type: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          name?: string;
          notes?: string | null;
          params?: Json;
          rule_type?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [];
      };
      strategy_performance: {
        Row: {
          avg_matches: number;
          computed_at: string;
          id: string;
          matches: number;
          pair_matches: number;
          score: number;
          strategy_id: string;
          tests: number;
          window_label: string;
        };
        Insert: {
          avg_matches?: number;
          computed_at?: string;
          id?: string;
          matches?: number;
          pair_matches?: number;
          score?: number;
          strategy_id: string;
          tests?: number;
          window_label?: string;
        };
        Update: {
          avg_matches?: number;
          computed_at?: string;
          id?: string;
          matches?: number;
          pair_matches?: number;
          score?: number;
          strategy_id?: string;
          tests?: number;
          window_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "strategy_performance_strategy_id_fkey";
            columns: ["strategy_id"];
            isOneToOne: false;
            referencedRelation: "strategies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
