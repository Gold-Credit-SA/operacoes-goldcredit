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
      cedentes: {
        Row: {
          agencia: string | null
          banco: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          data_cadastro: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: number
          nome: string | null
          razao_social: string | null
          status: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: number
          nome?: string | null
          razao_social?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: number
          nome?: string | null
          razao_social?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cedentes_completo: {
        Row: {
          advalorem: number | null
          bloqueado: string | null
          captador: string | null
          cep: string | null
          cidade: string | null
          controlador: string | null
          cpf_cnpj: string | null
          created_at: string
          data_cadastro: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          email: string | null
          endereco: string | null
          fator: number | null
          fonte_captacao: string | null
          gerente: string | null
          grupo_economico: string | null
          id: number
          id_cedente: string | null
          limite_boleto_especial: number | null
          limite_boleto_especial_tranche: number | null
          limite_boleto_garantido: number | null
          limite_comissaria: number | null
          limite_global: number | null
          limite_operacao_clean: number | null
          limite_tranche: number | null
          nome: string | null
          operador: string | null
          primeira_operacao: string | null
          risco_atual: number | null
          saldo: number | null
          setor: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          vencimento_contrato: string | null
        }
        Insert: {
          advalorem?: number | null
          bloqueado?: string | null
          captador?: string | null
          cep?: string | null
          cidade?: string | null
          controlador?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_cadastro?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          email?: string | null
          endereco?: string | null
          fator?: number | null
          fonte_captacao?: string | null
          gerente?: string | null
          grupo_economico?: string | null
          id?: number
          id_cedente?: string | null
          limite_boleto_especial?: number | null
          limite_boleto_especial_tranche?: number | null
          limite_boleto_garantido?: number | null
          limite_comissaria?: number | null
          limite_global?: number | null
          limite_operacao_clean?: number | null
          limite_tranche?: number | null
          nome?: string | null
          operador?: string | null
          primeira_operacao?: string | null
          risco_atual?: number | null
          saldo?: number | null
          setor?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          vencimento_contrato?: string | null
        }
        Update: {
          advalorem?: number | null
          bloqueado?: string | null
          captador?: string | null
          cep?: string | null
          cidade?: string | null
          controlador?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_cadastro?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          email?: string | null
          endereco?: string | null
          fator?: number | null
          fonte_captacao?: string | null
          gerente?: string | null
          grupo_economico?: string | null
          id?: number
          id_cedente?: string | null
          limite_boleto_especial?: number | null
          limite_boleto_especial_tranche?: number | null
          limite_boleto_garantido?: number | null
          limite_comissaria?: number | null
          limite_global?: number | null
          limite_operacao_clean?: number | null
          limite_tranche?: number | null
          nome?: string | null
          operador?: string | null
          primeira_operacao?: string | null
          risco_atual?: number | null
          saldo?: number | null
          setor?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          vencimento_contrato?: string | null
        }
        Relationships: []
      }
      contas_bancarias: {
        Row: {
          cpf_cnpj_cedente_escrow: string | null
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          escrow: number | null
          id: number
          nome_cedente_escrow: string | null
          num_carteiras: string | null
          num_conta: string | null
          updated_at: string
        }
        Insert: {
          cpf_cnpj_cedente_escrow?: string | null
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          escrow?: number | null
          id?: number
          nome_cedente_escrow?: string | null
          num_carteiras?: string | null
          num_conta?: string | null
          updated_at?: string
        }
        Update: {
          cpf_cnpj_cedente_escrow?: string | null
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          escrow?: number | null
          id?: number
          nome_cedente_escrow?: string | null
          num_carteiras?: string | null
          num_conta?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      controladores: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_controlador: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_controlador?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_controlador?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estados_civis: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_estado_civil: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_estado_civil?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_estado_civil?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fontes_captacao: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_fonte_captacao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_fonte_captacao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_fonte_captacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gerentes: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_gerente: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_gerente?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_gerente?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grupos_analise_vadu: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_grupo_analise_vadu: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_grupo_analise_vadu?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_grupo_analise_vadu?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      operacoes_individualizadas: {
        Row: {
          captador: string | null
          cedente: string | null
          conta_pagto: string | null
          cpf_cnpj_cedente: string | null
          created_at: string
          cred_cedente: number | null
          data: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          etapa: string | null
          finalizacao: string | null
          id: number
          inicio: string | null
          iss: number | null
          nfse: string | null
          operacao: string | null
          operador: string | null
          pagamento_operacao: string | null
          prazo_medio: number | null
          updated_at: string
          valor_bruto: number | null
          valor_iof: number | null
          valor_liquido: number | null
          valor_pagto_operacao: number | null
          valor_pendencia: number | null
          valor_receita: number | null
          valor_recompra_repass: number | null
          valor_saldo: number | null
          valor_tarifa: number | null
          valor_taxa: number | null
        }
        Insert: {
          captador?: string | null
          cedente?: string | null
          conta_pagto?: string | null
          cpf_cnpj_cedente?: string | null
          created_at?: string
          cred_cedente?: number | null
          data?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          etapa?: string | null
          finalizacao?: string | null
          id?: number
          inicio?: string | null
          iss?: number | null
          nfse?: string | null
          operacao?: string | null
          operador?: string | null
          pagamento_operacao?: string | null
          prazo_medio?: number | null
          updated_at?: string
          valor_bruto?: number | null
          valor_iof?: number | null
          valor_liquido?: number | null
          valor_pagto_operacao?: number | null
          valor_pendencia?: number | null
          valor_receita?: number | null
          valor_recompra_repass?: number | null
          valor_saldo?: number | null
          valor_tarifa?: number | null
          valor_taxa?: number | null
        }
        Update: {
          captador?: string | null
          cedente?: string | null
          conta_pagto?: string | null
          cpf_cnpj_cedente?: string | null
          created_at?: string
          cred_cedente?: number | null
          data?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          etapa?: string | null
          finalizacao?: string | null
          id?: number
          inicio?: string | null
          iss?: number | null
          nfse?: string | null
          operacao?: string | null
          operador?: string | null
          pagamento_operacao?: string | null
          prazo_medio?: number | null
          updated_at?: string
          valor_bruto?: number | null
          valor_iof?: number | null
          valor_liquido?: number | null
          valor_pagto_operacao?: number | null
          valor_pendencia?: number | null
          valor_receita?: number | null
          valor_recompra_repass?: number | null
          valor_saldo?: number | null
          valor_tarifa?: number | null
          valor_taxa?: number | null
        }
        Relationships: []
      }
      operadores: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_operador: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_operador?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_operador?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paginations: {
        Row: {
          created_at: string
          dev_created_at: string | null
          dev_updated_at: string | null
          id: number
          page: string | null
          tabela: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dev_created_at?: string | null
          dev_updated_at?: string | null
          id?: number
          page?: string | null
          tabela?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dev_created_at?: string | null
          dev_updated_at?: string | null
          id?: number
          page?: string | null
          tabela?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receita_por_cedente: {
        Row: {
          captador: string | null
          cedente: string | null
          cpf_cnpj: string | null
          created_at: string
          data_pagamento: string | null
          desagio: number | null
          desconto: number | null
          despesas_bancarias: number | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          juros: number | null
          modalidade: string | null
          multas: number | null
          operador: string | null
          porcentagem: number | null
          tarifas: number | null
          taxa: number | null
          taxas_administrativas: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          captador?: string | null
          cedente?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_pagamento?: string | null
          desagio?: number | null
          desconto?: number | null
          despesas_bancarias?: number | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          juros?: number | null
          modalidade?: string | null
          multas?: number | null
          operador?: string | null
          porcentagem?: number | null
          tarifas?: number | null
          taxa?: number | null
          taxas_administrativas?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          captador?: string | null
          cedente?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_pagamento?: string | null
          desagio?: number | null
          desconto?: number | null
          despesas_bancarias?: number | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          juros?: number | null
          modalidade?: string | null
          multas?: number | null
          operador?: string | null
          porcentagem?: number | null
          tarifas?: number | null
          taxa?: number | null
          taxas_administrativas?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      regimes_tributarios: {
        Row: {
          created_at: string
          descricao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          id_regime_tributario: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_regime_tributario?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          id_regime_tributario?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      titulos_em_aberto: {
        Row: {
          cedente: string | null
          conf: string | null
          conta: string | null
          cpf_cnpj_cedente: string | null
          cpf_cnpj_sacado: string | null
          cr: string | null
          created_at: string
          data_emissao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          documento: string | null
          etapa: string | null
          historico: string | null
          id: number
          id_titulo: string | null
          id_titulo_original: string | null
          m: string | null
          motivo: string | null
          nosso_numero: string | null
          op: string | null
          original: string | null
          sacado: string | null
          situacao: string | null
          tipo: string | null
          updated_at: string
          valor: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_tarifas: number | null
          valor_total: number | null
          vencimento: string | null
        }
        Insert: {
          cedente?: string | null
          conf?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          cr?: string | null
          created_at?: string
          data_emissao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          documento?: string | null
          etapa?: string | null
          historico?: string | null
          id?: number
          id_titulo?: string | null
          id_titulo_original?: string | null
          m?: string | null
          motivo?: string | null
          nosso_numero?: string | null
          op?: string | null
          original?: string | null
          sacado?: string | null
          situacao?: string | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_tarifas?: number | null
          valor_total?: number | null
          vencimento?: string | null
        }
        Update: {
          cedente?: string | null
          conf?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          cr?: string | null
          created_at?: string
          data_emissao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          documento?: string | null
          etapa?: string | null
          historico?: string | null
          id?: number
          id_titulo?: string | null
          id_titulo_original?: string | null
          m?: string | null
          motivo?: string | null
          nosso_numero?: string | null
          op?: string | null
          original?: string | null
          sacado?: string | null
          situacao?: string | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_tarifas?: number | null
          valor_total?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      titulos_prorrogados: {
        Row: {
          cedente: string | null
          conf: string | null
          conta: string | null
          cpf_cnpj_cedente: string | null
          cpf_cnpj_sacado: string | null
          created_at: string
          data_prorrogacao: number | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          emissao: string | null
          etapa: string | null
          id: number
          iof: number | null
          juros: number | null
          m: string | null
          multa: number | null
          numero: string | null
          sacado: string | null
          tarifas: number | null
          tipo: string | null
          updated_at: string
          valor_face: number | null
          valor_face_anterior: number | null
          vencimento: string | null
          vencimento_anterior: string | null
        }
        Insert: {
          cedente?: string | null
          conf?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          data_prorrogacao?: number | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          emissao?: string | null
          etapa?: string | null
          id?: number
          iof?: number | null
          juros?: number | null
          m?: string | null
          multa?: number | null
          numero?: string | null
          sacado?: string | null
          tarifas?: number | null
          tipo?: string | null
          updated_at?: string
          valor_face?: number | null
          valor_face_anterior?: number | null
          vencimento?: string | null
          vencimento_anterior?: string | null
        }
        Update: {
          cedente?: string | null
          conf?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          data_prorrogacao?: number | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          emissao?: string | null
          etapa?: string | null
          id?: number
          iof?: number | null
          juros?: number | null
          m?: string | null
          multa?: number | null
          numero?: string | null
          sacado?: string | null
          tarifas?: number | null
          tipo?: string | null
          updated_at?: string
          valor_face?: number | null
          valor_face_anterior?: number | null
          vencimento?: string | null
          vencimento_anterior?: string | null
        }
        Relationships: []
      }
      titulos_quitados: {
        Row: {
          agencia_cobradora: string | null
          banco_cobrador: string | null
          categoria: string | null
          cedente: string | null
          classe_risco: string | null
          conta: string | null
          cpf_cnpj_cedente: string | null
          cpf_cnpj_sacado: string | null
          created_at: string
          data_custodia: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          emissao: string | null
          id: number
          m: string | null
          motivo_devolucao: string | null
          nosso_numero: string | null
          numero: string | null
          observacao: string | null
          op: string | null
          op_de_pagamento: string | null
          original: string | null
          quitacao: string | null
          sacado: string | null
          situacao: string | null
          status: string | null
          tipo: string | null
          tipo_quitacao: string | null
          updated_at: string
          valor_desconto: number | null
          valor_face: number | null
          valor_juros: number | null
          valor_liquidado: number | null
          valor_multa: number | null
          valor_tar_dev_cheque: number | null
          valor_tar_recompra: number | null
          valor_tarifas: number | null
          valor_total: number | null
          vencimento: string | null
        }
        Insert: {
          agencia_cobradora?: string | null
          banco_cobrador?: string | null
          categoria?: string | null
          cedente?: string | null
          classe_risco?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          data_custodia?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          emissao?: string | null
          id?: number
          m?: string | null
          motivo_devolucao?: string | null
          nosso_numero?: string | null
          numero?: string | null
          observacao?: string | null
          op?: string | null
          op_de_pagamento?: string | null
          original?: string | null
          quitacao?: string | null
          sacado?: string | null
          situacao?: string | null
          status?: string | null
          tipo?: string | null
          tipo_quitacao?: string | null
          updated_at?: string
          valor_desconto?: number | null
          valor_face?: number | null
          valor_juros?: number | null
          valor_liquidado?: number | null
          valor_multa?: number | null
          valor_tar_dev_cheque?: number | null
          valor_tar_recompra?: number | null
          valor_tarifas?: number | null
          valor_total?: number | null
          vencimento?: string | null
        }
        Update: {
          agencia_cobradora?: string | null
          banco_cobrador?: string | null
          categoria?: string | null
          cedente?: string | null
          classe_risco?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          data_custodia?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          emissao?: string | null
          id?: number
          m?: string | null
          motivo_devolucao?: string | null
          nosso_numero?: string | null
          numero?: string | null
          observacao?: string | null
          op?: string | null
          op_de_pagamento?: string | null
          original?: string | null
          quitacao?: string | null
          sacado?: string | null
          situacao?: string | null
          status?: string | null
          tipo?: string | null
          tipo_quitacao?: string | null
          updated_at?: string
          valor_desconto?: number | null
          valor_face?: number | null
          valor_juros?: number | null
          valor_liquidado?: number | null
          valor_multa?: number | null
          valor_tar_dev_cheque?: number | null
          valor_tar_recompra?: number | null
          valor_tarifas?: number | null
          valor_total?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      titulos_quitados_suspeita_fraude: {
        Row: {
          agencia_cobradora: string | null
          banco_cobrador: string | null
          cedente: string | null
          cpf_cnpj_cedente: string | null
          cpf_cnpj_sacado: string | null
          created_at: string
          criticas: string | null
          data_quitacao: string | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          id: number
          localidade_sacado: string | null
          numero_documento: string | null
          praca_pagamento: string | null
          sacado: string | null
          updated_at: string
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          agencia_cobradora?: string | null
          banco_cobrador?: string | null
          cedente?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          criticas?: string | null
          data_quitacao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          localidade_sacado?: string | null
          numero_documento?: string | null
          praca_pagamento?: string | null
          sacado?: string | null
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          agencia_cobradora?: string | null
          banco_cobrador?: string | null
          cedente?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          criticas?: string | null
          data_quitacao?: string | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          id?: number
          localidade_sacado?: string | null
          numero_documento?: string | null
          praca_pagamento?: string | null
          sacado?: string | null
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      titulos_recomprados: {
        Row: {
          categoria: string | null
          cedente: string | null
          classe_risco: string | null
          conta: string | null
          cpf_cnpj_cedente: string | null
          cpf_cnpj_sacado: string | null
          created_at: string
          desconto: number | null
          dev_created_at: string | null
          dev_id: number | null
          dev_updated_at: string | null
          emissao: string | null
          id: number
          juros: number | null
          liquidado: number | null
          m: string | null
          motivo: string | null
          multa: number | null
          nosso_numero: string | null
          numero: string | null
          observacao: string | null
          op: string | null
          op_de_pagamento: string | null
          recompra: string | null
          sacado: string | null
          situacao: string | null
          tarifa: number | null
          tipo: string | null
          total: number | null
          updated_at: string
          valor_face: number | null
          vencimento: string | null
        }
        Insert: {
          categoria?: string | null
          cedente?: string | null
          classe_risco?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          desconto?: number | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          emissao?: string | null
          id?: number
          juros?: number | null
          liquidado?: number | null
          m?: string | null
          motivo?: string | null
          multa?: number | null
          nosso_numero?: string | null
          numero?: string | null
          observacao?: string | null
          op?: string | null
          op_de_pagamento?: string | null
          recompra?: string | null
          sacado?: string | null
          situacao?: string | null
          tarifa?: number | null
          tipo?: string | null
          total?: number | null
          updated_at?: string
          valor_face?: number | null
          vencimento?: string | null
        }
        Update: {
          categoria?: string | null
          cedente?: string | null
          classe_risco?: string | null
          conta?: string | null
          cpf_cnpj_cedente?: string | null
          cpf_cnpj_sacado?: string | null
          created_at?: string
          desconto?: number | null
          dev_created_at?: string | null
          dev_id?: number | null
          dev_updated_at?: string | null
          emissao?: string | null
          id?: number
          juros?: number | null
          liquidado?: number | null
          m?: string | null
          motivo?: string | null
          multa?: number | null
          nosso_numero?: string | null
          numero?: string | null
          observacao?: string | null
          op?: string | null
          op_de_pagamento?: string | null
          recompra?: string | null
          sacado?: string | null
          situacao?: string | null
          tarifa?: number | null
          tipo?: string | null
          total?: number | null
          updated_at?: string
          valor_face?: number | null
          vencimento?: string | null
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
