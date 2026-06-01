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
      cobranca_acordos: {
        Row: {
          cedente_cpf_cnpj: string | null
          cedente_nome: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          desconto: number
          id: string
          observacao: string | null
          parcelas: Json
          primeiro_vencimento: string
          qtd_parcelas: number
          sacado_cpf_cnpj: string
          sacado_nome: string | null
          status: string
          titulos_originais: Json
          updated_at: string
          valor_acordo: number
          valor_original: number
        }
        Insert: {
          cedente_cpf_cnpj?: string | null
          cedente_nome?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          desconto?: number
          id?: string
          observacao?: string | null
          parcelas?: Json
          primeiro_vencimento: string
          qtd_parcelas?: number
          sacado_cpf_cnpj: string
          sacado_nome?: string | null
          status?: string
          titulos_originais?: Json
          updated_at?: string
          valor_acordo: number
          valor_original: number
        }
        Update: {
          cedente_cpf_cnpj?: string | null
          cedente_nome?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          desconto?: number
          id?: string
          observacao?: string | null
          parcelas?: Json
          primeiro_vencimento?: string
          qtd_parcelas?: number
          sacado_cpf_cnpj?: string
          sacado_nome?: string | null
          status?: string
          titulos_originais?: Json
          updated_at?: string
          valor_acordo?: number
          valor_original?: number
        }
        Relationships: []
      }
      cobranca_envios: {
        Row: {
          assunto: string | null
          canal: string
          cedente_cpf_cnpj: string | null
          cedente_nome: string | null
          created_at: string
          dias_atraso: number | null
          email_destinatario: string | null
          error_message: string | null
          evolution_response: Json | null
          id: string
          mensagem: string
          numero_titulo: string | null
          sacado_cpf_cnpj: string
          sacado_nome: string | null
          status: string
          telefone: string
          user_id: string
          user_name: string | null
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          assunto?: string | null
          canal?: string
          cedente_cpf_cnpj?: string | null
          cedente_nome?: string | null
          created_at?: string
          dias_atraso?: number | null
          email_destinatario?: string | null
          error_message?: string | null
          evolution_response?: Json | null
          id?: string
          mensagem: string
          numero_titulo?: string | null
          sacado_cpf_cnpj: string
          sacado_nome?: string | null
          status?: string
          telefone: string
          user_id: string
          user_name?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          assunto?: string | null
          canal?: string
          cedente_cpf_cnpj?: string | null
          cedente_nome?: string | null
          created_at?: string
          dias_atraso?: number | null
          email_destinatario?: string | null
          error_message?: string | null
          evolution_response?: Json | null
          id?: string
          mensagem?: string
          numero_titulo?: string | null
          sacado_cpf_cnpj?: string
          sacado_nome?: string | null
          status?: string
          telefone?: string
          user_id?: string
          user_name?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      cobranca_notas: {
        Row: {
          cedente_cpf_cnpj: string | null
          conteudo: string
          created_at: string
          created_by: string
          created_by_name: string | null
          id: string
          numero_titulo: string | null
          sacado_cpf_cnpj: string
        }
        Insert: {
          cedente_cpf_cnpj?: string | null
          conteudo: string
          created_at?: string
          created_by: string
          created_by_name?: string | null
          id?: string
          numero_titulo?: string | null
          sacado_cpf_cnpj: string
        }
        Update: {
          cedente_cpf_cnpj?: string | null
          conteudo?: string
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          id?: string
          numero_titulo?: string | null
          sacado_cpf_cnpj?: string
        }
        Relationships: []
      }
      cobranca_promessas: {
        Row: {
          cedente_cpf_cnpj: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          cumprida: boolean
          data_prometida: string
          id: string
          numero_titulo: string | null
          observacao: string | null
          sacado_cpf_cnpj: string
          updated_at: string
          valor_prometido: number | null
        }
        Insert: {
          cedente_cpf_cnpj?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          cumprida?: boolean
          data_prometida: string
          id?: string
          numero_titulo?: string | null
          observacao?: string | null
          sacado_cpf_cnpj: string
          updated_at?: string
          valor_prometido?: number | null
        }
        Update: {
          cedente_cpf_cnpj?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          cumprida?: boolean
          data_prometida?: string
          id?: string
          numero_titulo?: string | null
          observacao?: string | null
          sacado_cpf_cnpj?: string
          updated_at?: string
          valor_prometido?: number | null
        }
        Relationships: []
      }
      cobranca_regua: {
        Row: {
          ativo: boolean
          canal: string
          created_at: string
          created_by: string
          dias_max: number | null
          dias_min: number
          id: string
          nome: string
          ordem: number
          template_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          created_at?: string
          created_by: string
          dias_max?: number | null
          dias_min: number
          id?: string
          nome: string
          ordem?: number
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          created_by?: string
          dias_max?: number | null
          dias_min?: number
          id?: string
          nome?: string
          ordem?: number
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_regua_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cobranca_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_templates: {
        Row: {
          assunto: string | null
          canal: string
          created_at: string
          created_by: string
          id: string
          mensagem: string
          nome: string
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          canal?: string
          created_at?: string
          created_by: string
          id?: string
          mensagem: string
          nome: string
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          canal?: string
          created_at?: string
          created_by?: string
          id?: string
          mensagem?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_titulo_status: {
        Row: {
          cedente_cpf_cnpj: string
          created_at: string
          id: string
          numero_titulo: string
          proximo_contato_at: string | null
          sacado_cpf_cnpj: string | null
          sacado_nome: string | null
          status: Database["public"]["Enums"]["cobranca_status"]
          ultimo_contato_at: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          cedente_cpf_cnpj: string
          created_at?: string
          id?: string
          numero_titulo: string
          proximo_contato_at?: string | null
          sacado_cpf_cnpj?: string | null
          sacado_nome?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          ultimo_contato_at?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          cedente_cpf_cnpj?: string
          created_at?: string
          id?: string
          numero_titulo?: string
          proximo_contato_at?: string | null
          sacado_cpf_cnpj?: string | null
          sacado_nome?: string | null
          status?: Database["public"]["Enums"]["cobranca_status"]
          ultimo_contato_at?: string | null
          updated_at?: string
          updated_by?: string
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
      credit_analysis_feedback: {
        Row: {
          cedente_cpf_cnpj: string | null
          cedente_nome: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          decisao_final: string
          finalidade: string | null
          ia_decisao: string | null
          ia_parecer: string | null
          ia_risco: string | null
          id: string
          observacoes: string | null
          parecer_gestor: string
          resultado_observacao: string | null
          resultado_real: string | null
          sacados: Json | null
          session_id: string
          updated_at: string
        }
        Insert: {
          cedente_cpf_cnpj?: string | null
          cedente_nome?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          decisao_final: string
          finalidade?: string | null
          ia_decisao?: string | null
          ia_parecer?: string | null
          ia_risco?: string | null
          id?: string
          observacoes?: string | null
          parecer_gestor: string
          resultado_observacao?: string | null
          resultado_real?: string | null
          sacados?: Json | null
          session_id: string
          updated_at?: string
        }
        Update: {
          cedente_cpf_cnpj?: string | null
          cedente_nome?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          decisao_final?: string
          finalidade?: string | null
          ia_decisao?: string | null
          ia_parecer?: string | null
          ia_risco?: string | null
          id?: string
          observacoes?: string | null
          parecer_gestor?: string
          resultado_observacao?: string | null
          resultado_real?: string | null
          sacados?: Json | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_analysis_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_analysis_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "credit_analysis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_analysis_sessions: {
        Row: {
          cedente_cpf_cnpj: string | null
          cedente_data: Json | null
          cedente_nome: string | null
          client_consultations: Json | null
          client_cpf_cnpj: string
          client_id: string
          client_name: string | null
          created_at: string
          created_by: string
          documents: Json | null
          id: string
          initial_analysis: Json | null
          sacados: Json | null
          updated_at: string
        }
        Insert: {
          cedente_cpf_cnpj?: string | null
          cedente_data?: Json | null
          cedente_nome?: string | null
          client_consultations?: Json | null
          client_cpf_cnpj: string
          client_id: string
          client_name?: string | null
          created_at?: string
          created_by: string
          documents?: Json | null
          id?: string
          initial_analysis?: Json | null
          sacados?: Json | null
          updated_at?: string
        }
        Update: {
          cedente_cpf_cnpj?: string | null
          cedente_data?: Json | null
          cedente_nome?: string | null
          client_consultations?: Json | null
          client_cpf_cnpj?: string
          client_id?: string
          client_name?: string | null
          created_at?: string
          created_by?: string
          documents?: Json | null
          id?: string
          initial_analysis?: Json | null
          sacados?: Json | null
          updated_at?: string
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
      entity_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          created_by_name: string | null
          entity_cpf_cnpj: string
          entity_name: string | null
          entity_type: Database["public"]["Enums"]["entity_note_type"]
          id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          created_by_name?: string | null
          entity_cpf_cnpj: string
          entity_name?: string | null
          entity_type: Database["public"]["Enums"]["entity_note_type"]
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          entity_cpf_cnpj?: string
          entity_name?: string | null
          entity_type?: Database["public"]["Enums"]["entity_note_type"]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      goldsign_settings: {
        Row: {
          created_at: string
          gold_credit_cert_document: string | null
          gold_credit_cert_issuer_cn: string | null
          gold_credit_cert_linked_at: string | null
          gold_credit_cert_linked_by: string | null
          gold_credit_cert_linked_by_email: string | null
          gold_credit_cert_serial_number: string | null
          gold_credit_cert_subject_cn: string | null
          gold_credit_cert_tipo: string | null
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gold_credit_cert_document?: string | null
          gold_credit_cert_issuer_cn?: string | null
          gold_credit_cert_linked_at?: string | null
          gold_credit_cert_linked_by?: string | null
          gold_credit_cert_linked_by_email?: string | null
          gold_credit_cert_serial_number?: string | null
          gold_credit_cert_subject_cn?: string | null
          gold_credit_cert_tipo?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gold_credit_cert_document?: string | null
          gold_credit_cert_issuer_cn?: string | null
          gold_credit_cert_linked_at?: string | null
          gold_credit_cert_linked_by?: string | null
          gold_credit_cert_linked_by_email?: string | null
          gold_credit_cert_serial_number?: string | null
          gold_credit_cert_subject_cn?: string | null
          gold_credit_cert_tipo?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      nfe_eventos: {
        Row: {
          chave_acesso: string
          created_at: string
          data_evento: string | null
          descricao: string | null
          id: string
          payload: Json | null
          tipo_evento: string | null
        }
        Insert: {
          chave_acesso: string
          created_at?: string
          data_evento?: string | null
          descricao?: string | null
          id?: string
          payload?: Json | null
          tipo_evento?: string | null
        }
        Update: {
          chave_acesso?: string
          created_at?: string
          data_evento?: string | null
          descricao?: string | null
          id?: string
          payload?: Json | null
          tipo_evento?: string | null
        }
        Relationships: []
      }
      nfe_monitoramento: {
        Row: {
          chave_acesso: string
          created_at: string
          descricao: string | null
          id: string
          solicitacao_id: string | null
          status: string
          ultima_consulta_em: string | null
          ultimo_resultado: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chave_acesso: string
          created_at?: string
          descricao?: string | null
          id?: string
          solicitacao_id?: string | null
          status?: string
          ultima_consulta_em?: string | null
          ultimo_resultado?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chave_acesso?: string
          created_at?: string
          descricao?: string | null
          id?: string
          solicitacao_id?: string | null
          status?: string
          ultima_consulta_em?: string | null
          ultimo_resultado?: Json | null
          updated_at?: string
          user_id?: string
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
      scr_query_jobs: {
        Row: {
          base_date_final: string | null
          base_date_initial: string | null
          consulta_type: string
          created_at: string
          doc_id: string
          error_code: string | null
          error_message: string | null
          hbi_uuid_query: string | null
          id: string
          last_polled_at: string | null
          parsed_response: Json | null
          raw_response: Json | null
          status: string
          trace_id: string | null
          updated_at: string
          user_id: string | null
          uuid_type_scr: string | null
        }
        Insert: {
          base_date_final?: string | null
          base_date_initial?: string | null
          consulta_type: string
          created_at?: string
          doc_id: string
          error_code?: string | null
          error_message?: string | null
          hbi_uuid_query?: string | null
          id?: string
          last_polled_at?: string | null
          parsed_response?: Json | null
          raw_response?: Json | null
          status?: string
          trace_id?: string | null
          updated_at?: string
          user_id?: string | null
          uuid_type_scr?: string | null
        }
        Update: {
          base_date_final?: string | null
          base_date_initial?: string | null
          consulta_type?: string
          created_at?: string
          doc_id?: string
          error_code?: string | null
          error_message?: string | null
          hbi_uuid_query?: string | null
          id?: string
          last_polled_at?: string | null
          parsed_response?: Json | null
          raw_response?: Json | null
          status?: string
          trace_id?: string | null
          updated_at?: string
          user_id?: string | null
          uuid_type_scr?: string | null
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
      cobranca_status:
        | "em_dia"
        | "notificado"
        | "em_negociacao"
        | "acordo"
        | "protestado"
        | "quitado"
        | "incobravel"
      entity_note_type: "cliente" | "cedente" | "sacado"
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
      cobranca_status: [
        "em_dia",
        "notificado",
        "em_negociacao",
        "acordo",
        "protestado",
        "quitado",
        "incobravel",
      ],
      entity_note_type: ["cliente", "cedente", "sacado"],
    },
  },
} as const
