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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cedente_birthdays: {
        Row: {
          cedente_cpf_cnpj: string
          cedente_nome: string
          created_at: string
          created_by: string
          data_nascimento: string
          id: string
        }
        Insert: {
          cedente_cpf_cnpj: string
          cedente_nome: string
          created_at?: string
          created_by: string
          data_nascimento: string
          id?: string
        }
        Update: {
          cedente_cpf_cnpj?: string
          cedente_nome?: string
          created_at?: string
          created_by?: string
          data_nascimento?: string
          id?: string
        }
        Relationships: []
      }
      consulta_clients: {
        Row: {
          agrisk_client_id: string | null
          basic_data: Json | null
          cpf_cnpj: string
          created_at: string
          created_by: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          agrisk_client_id?: string | null
          basic_data?: Json | null
          cpf_cnpj: string
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          agrisk_client_id?: string | null
          basic_data?: Json | null
          cpf_cnpj?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consulta_history: {
        Row: {
          cnpj: string
          consulta_label: string
          consulta_type: string
          consulted_by_name: string | null
          created_at: string
          entity_name: string | null
          id: string
          pdf_path: string | null
          platform: string
          result_data: Json | null
          status: string
          user_id: string
        }
        Insert: {
          cnpj: string
          consulta_label: string
          consulta_type: string
          consulted_by_name?: string | null
          created_at?: string
          entity_name?: string | null
          id?: string
          pdf_path?: string | null
          platform: string
          result_data?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          cnpj?: string
          consulta_label?: string
          consulta_type?: string
          consulted_by_name?: string | null
          created_at?: string
          entity_name?: string | null
          id?: string
          pdf_path?: string | null
          platform?: string
          result_data?: Json | null
          status?: string
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
      operacao_notas: {
        Row: {
          cedente_cpf_cnpj: string
          cedente_nome: string | null
          chave_acesso: string | null
          created_at: string
          created_by: string
          data_emissao: string | null
          id: string
          numero_nota: string | null
          sacado_cpf_cnpj: string
          sacado_id: string | null
          sacado_nome: string | null
          serie: string | null
          valor: number | null
          xml_filename: string | null
        }
        Insert: {
          cedente_cpf_cnpj: string
          cedente_nome?: string | null
          chave_acesso?: string | null
          created_at?: string
          created_by: string
          data_emissao?: string | null
          id?: string
          numero_nota?: string | null
          sacado_cpf_cnpj: string
          sacado_id?: string | null
          sacado_nome?: string | null
          serie?: string | null
          valor?: number | null
          xml_filename?: string | null
        }
        Update: {
          cedente_cpf_cnpj?: string
          cedente_nome?: string | null
          chave_acesso?: string | null
          created_at?: string
          created_by?: string
          data_emissao?: string | null
          id?: string
          numero_nota?: string | null
          sacado_cpf_cnpj?: string
          sacado_id?: string | null
          sacado_nome?: string | null
          serie?: string | null
          valor?: number | null
          xml_filename?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operacao_notas_sacado_id_fkey"
            columns: ["sacado_id"]
            isOneToOne: false
            referencedRelation: "sacados"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_assignments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cedente_cpf_cnpj: string
          cedente_nome: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cedente_cpf_cnpj: string
          cedente_nome?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cedente_cpf_cnpj?: string
          cedente_nome?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          must_change_password?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sacados: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf_cnpj: string
          created_at: string
          created_by: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj: string
          created_at?: string
          created_by: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string
          created_at?: string
          created_by?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
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
    }
    Enums: {
      app_role: "admin" | "user"
      assignment_status: "pending" | "approved" | "rejected"
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
      assignment_status: ["pending", "approved", "rejected"],
    },
  },
} as const
