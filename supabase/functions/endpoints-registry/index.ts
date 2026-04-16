import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOCS_HUB_URL = 'https://rduexosgbfxrmxjpbshk.supabase.co/functions/v1/endpoints-update';
const SISTEMA = 'financeiro';
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

interface EndpointField {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

interface EndpointDefinition {
  sistema: string;
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth?: string;
  fields?: EndpointField[];
  example_payload?: Record<string, unknown>;
}

async function sendToHub(endpoint: EndpointDefinition, apiKey: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(DOCS_HUB_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(endpoint),
      });

      const body = await res.text();

      if (res.ok) {
        try {
          return { success: true, data: JSON.parse(body) };
        } catch {
          return { success: true, data: body };
        }
      }

      lastError = `HTTP ${res.status}: ${body}`;
      console.error(`[endpoints-registry] Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[endpoints-registry] Attempt ${attempt}/${MAX_RETRIES} network error: ${lastError}`);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }

  return { success: false, error: lastError };
}

// All platform endpoints registry
function getAllEndpoints(): EndpointDefinition[] {
  return [
    // ========== ADMIN USERS ==========
    {
      sistema: SISTEMA, label: 'Admin Users - Listar', method: 'POST', path: '/functions/v1/admin-users',
      description: 'Lista todos os usuários do sistema com seus perfis e roles.',
      auth: 'Bearer token (master admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list' },
      ], example_payload: { action: 'list' },
    },
    {
      sistema: SISTEMA, label: 'Admin Users - Criar', method: 'POST', path: '/functions/v1/admin-users',
      description: 'Cria um novo usuário no sistema com perfil e role.',
      auth: 'Bearer token (master admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: create' },
        { name: 'email', type: 'string', required: true, desc: 'Email do novo usuário' },
        { name: 'name', type: 'string', required: true, desc: 'Nome do usuário' },
        { name: 'password', type: 'string', required: true, desc: 'Senha inicial' },
        { name: 'role', type: 'string', required: false, desc: 'Role: admin ou user (default: user)' },
      ], example_payload: { action: 'create', email: 'user@email.com', name: 'João', password: '123456', role: 'user' },
    },
    {
      sistema: SISTEMA, label: 'Admin Users - Atualizar', method: 'POST', path: '/functions/v1/admin-users',
      description: 'Atualiza nome, senha ou role de um usuário existente.',
      auth: 'Bearer token (master admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: update' },
        { name: 'userId', type: 'string', required: true, desc: 'ID do usuário' },
        { name: 'name', type: 'string', required: false, desc: 'Novo nome' },
        { name: 'password', type: 'string', required: false, desc: 'Nova senha (força troca no login)' },
        { name: 'role', type: 'string', required: false, desc: 'Nova role' },
      ], example_payload: { action: 'update', userId: 'uuid', name: 'Novo Nome' },
    },
    {
      sistema: SISTEMA, label: 'Admin Users - Excluir', method: 'POST', path: '/functions/v1/admin-users',
      description: 'Exclui um usuário do sistema (cascata: perfil e roles).',
      auth: 'Bearer token (master admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: delete' },
        { name: 'userId', type: 'string', required: true, desc: 'ID do usuário a excluir' },
      ], example_payload: { action: 'delete', userId: 'uuid' },
    },

    // ========== EXTERNAL DB ==========
    {
      sistema: SISTEMA, label: 'External DB - Test Connection', method: 'POST', path: '/functions/v1/external-db',
      description: 'Testa conectividade com o banco de dados externo Smart Securities.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: test-connection' },
      ], example_payload: { action: 'test-connection' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Listar Tabelas', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista todas as tabelas disponíveis no banco externo.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list-tables' },
      ], example_payload: { action: 'list-tables' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Descrever Tabela', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna estrutura de colunas de uma tabela do banco externo.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: describe-table' },
        { name: 'filters', type: 'object', required: false, desc: '{ table: "nome_tabela" }' },
      ], example_payload: { action: 'describe-table', filters: { table: 'smartsecurities_cedentes' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Listar Cedentes', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista cedentes do banco externo com busca opcional por nome ou CPF/CNPJ.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: cedentes-list' },
        { name: 'filters', type: 'object', required: false, desc: '{ search: "termo" }' },
      ], example_payload: { action: 'cedentes-list', filters: { search: 'empresa' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Detalhe Cedente', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna dados completos de um cedente: operações, títulos, receitas, recompras e suspeita de fraude.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: cedente-info' },
        { name: 'filters', type: 'object', required: true, desc: '{ cpf_cnpj: "12345678000190" }' },
      ], example_payload: { action: 'cedente-info', filters: { cpf_cnpj: '12345678000190' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Estatísticas Gerais', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna contagens e totais de todas as tabelas do banco externo.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: stats' },
      ], example_payload: { action: 'stats' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Operações', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista operações individualizadas com filtros por cedente e período.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: operacoes' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, dataInicio, dataFim }' },
      ], example_payload: { action: 'operacoes', filters: { cedente: 'empresa' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Receitas', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista receitas por cedente com filtros de período.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: receitas' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, dataInicio, dataFim }' },
      ], example_payload: { action: 'receitas' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Títulos em Aberto', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista títulos em aberto com filtros por cedente, sacado e período.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: titulos-aberto' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, sacado, dataInicio, dataFim }' },
      ], example_payload: { action: 'titulos-aberto' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Cedentes Detalhados', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista cedentes com filtros avançados por nome e UF.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: cedentes-detalhes' },
        { name: 'filters', type: 'object', required: false, desc: '{ nome, uf }' },
      ], example_payload: { action: 'cedentes-detalhes', filters: { uf: 'SP' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Resumo por Período', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna operações agrupadas por mês (bruto, líquido, receita).',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: resumo-por-periodo' },
      ], example_payload: { action: 'resumo-por-periodo' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Top Cedentes', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna ranking dos 20 maiores cedentes por volume operado.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: top-cedentes' },
      ], example_payload: { action: 'top-cedentes' },
    },
    {
      sistema: SISTEMA, label: 'External DB - Listar Sacados', method: 'POST', path: '/functions/v1/external-db',
      description: 'Lista sacados agrupados com exposição total, número de cedentes e títulos em aberto.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: sacados-list' },
        { name: 'filters', type: 'object', required: false, desc: '{ search: "termo" }' },
      ], example_payload: { action: 'sacados-list', filters: { search: 'empresa' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Detalhe Sacado', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna dados completos de um sacado: títulos abertos/quitados, cedentes vinculados, fraude e recompras.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: sacado-detail' },
        { name: 'filters', type: 'object', required: true, desc: '{ cpf_cnpj: "12345678000190" }' },
      ], example_payload: { action: 'sacado-detail', filters: { cpf_cnpj: '12345678000190' } },
    },
    {
      sistema: SISTEMA, label: 'External DB - Sócios por Cedente', method: 'POST', path: '/functions/v1/external-db',
      description: 'Retorna sócios/contatos vinculados a um cedente pelo nome da empresa.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: socios-por-cedente' },
        { name: 'filters', type: 'object', required: true, desc: '{ nome_cedente: "Empresa XYZ" }' },
      ], example_payload: { action: 'socios-por-cedente', filters: { nome_cedente: 'Empresa XYZ' } },
    },

    // ========== DASHBOARD DATA ==========
    {
      sistema: SISTEMA, label: 'Dashboard - Estatísticas', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Retorna KPIs do dashboard: contagens e totais de cedentes, operações, receitas e títulos.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: stats' },
      ], example_payload: { action: 'stats' },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Cedentes', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Lista cedentes do dashboard interno com nome, CPF/CNPJ, gerente e operador.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: cedentes-list' },
      ], example_payload: { action: 'cedentes-list' },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Operações', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Lista operações do dashboard com sinalização de formalização (GoldSign).',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: operacoes' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, dataInicio, dataFim, etapa }' },
      ], example_payload: { action: 'operacoes', filters: { etapa: 'formalização' } },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Receitas', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Lista receitas por cedente do dashboard com filtros de período.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: receitas' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, dataInicio, dataFim }' },
      ], example_payload: { action: 'receitas' },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Títulos em Aberto', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Lista títulos em aberto (tipo C) com filtros por cedente, sacado e situação.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: titulos-aberto' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, sacado, dataInicio, dataFim, situacao }' },
      ], example_payload: { action: 'titulos-aberto' },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Títulos Quitados', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Lista títulos quitados do dashboard com filtros de período.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: titulos-quitados' },
        { name: 'filters', type: 'object', required: false, desc: '{ cedente, dataInicio, dataFim }' },
      ], example_payload: { action: 'titulos-quitados' },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Cedentes Detalhados', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Lista cedentes com filtros avançados (nome, cidade, UF, gerente).',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: cedentes-detalhes' },
        { name: 'filters', type: 'object', required: false, desc: '{ nome, cidade, uf, gerente }' },
      ], example_payload: { action: 'cedentes-detalhes', filters: { uf: 'SP' } },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Resumo por Período', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Retorna operações agrupadas por mês do dashboard interno.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: resumo-por-periodo' },
      ], example_payload: { action: 'resumo-por-periodo' },
    },
    {
      sistema: SISTEMA, label: 'Dashboard - Top Cedentes', method: 'POST', path: '/functions/v1/dashboard-data',
      description: 'Retorna ranking dos 20 maiores cedentes por volume no dashboard interno.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: top-cedentes' },
      ], example_payload: { action: 'top-cedentes' },
    },

    // ========== CEDENTE INFO ==========
    {
      sistema: SISTEMA, label: 'Cedente Info - Listar', method: 'POST', path: '/functions/v1/cedente-info',
      description: 'Lista cedentes com busca por nome ou CPF/CNPJ, incluindo limites e risco.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list' },
        { name: 'search', type: 'string', required: false, desc: 'Termo de busca' },
      ], example_payload: { action: 'list', search: 'empresa' },
    },
    {
      sistema: SISTEMA, label: 'Cedente Info - Detalhe Completo', method: 'POST', path: '/functions/v1/cedente-info',
      description: 'Retorna análise completa do cedente: métricas, limites, liquidez, concentração, comportamento 90 dias, confirmação e fraude.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: detail' },
        { name: 'cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ do cedente' },
      ], example_payload: { action: 'detail', cpf_cnpj: '12345678000190' },
    },

    // ========== PORTFOLIO DATA ==========
    {
      sistema: SISTEMA, label: 'Portfolio - Listar Atribuições', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Lista atribuições de cedentes a gestores (admin vê todas, gestor vê as próprias).',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list-assignments' },
        { name: 'status', type: 'string', required: false, desc: 'Filtro: pending, approved, rejected' },
      ], example_payload: { action: 'list-assignments', status: 'approved' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Solicitar Vínculo', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Solicita vinculação de um cedente à carteira de um gestor (status: pending).',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: request-assignment' },
        { name: 'cedente_cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ do cedente' },
        { name: 'user_id', type: 'string', required: false, desc: 'ID do gestor (default: usuário logado)' },
      ], example_payload: { action: 'request-assignment', cedente_cpf_cnpj: '12345678000190' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Aprovar Vínculo', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Aprova uma solicitação de vinculação cedente-gestor (admin only).',
      auth: 'Bearer token (admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: approve-assignment' },
        { name: 'assignment_id', type: 'string', required: true, desc: 'ID da atribuição' },
      ], example_payload: { action: 'approve-assignment', assignment_id: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Rejeitar Vínculo', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Rejeita uma solicitação de vinculação com motivo obrigatório (admin only).',
      auth: 'Bearer token (admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: reject-assignment' },
        { name: 'assignment_id', type: 'string', required: true, desc: 'ID da atribuição' },
        { name: 'rejection_reason', type: 'string', required: true, desc: 'Motivo da recusa' },
      ], example_payload: { action: 'reject-assignment', assignment_id: 'uuid', rejection_reason: 'Limite excedido' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Remover Vínculo', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Remove permanentemente uma atribuição cedente-gestor (admin only).',
      auth: 'Bearer token (admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: remove-assignment' },
        { name: 'assignment_id', type: 'string', required: true, desc: 'ID da atribuição' },
      ], example_payload: { action: 'remove-assignment', assignment_id: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Minha Carteira', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Retorna cedentes da carteira do gestor logado com métricas de limite, risco e inatividade.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: my-portfolio' },
      ], example_payload: { action: 'my-portfolio' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Visão Geral', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Visão consolidada de todas as carteiras (admin) ou carteira pessoal.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: portfolio-overview' },
      ], example_payload: { action: 'portfolio-overview' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Listar Todos Cedentes', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Lista todos os cedentes do banco externo marcando quais já estão na carteira do gestor.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list-cedentes-all' },
      ], example_payload: { action: 'list-cedentes-all' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Buscar Cedentes', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Busca cedentes por nome ou CPF/CNPJ para adição à carteira.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: search-cedentes' },
        { name: 'cedente_cpf_cnpj', type: 'string', required: false, desc: 'Termo de busca (nome ou CPF/CNPJ)' },
      ], example_payload: { action: 'search-cedentes', cedente_cpf_cnpj: 'empresa' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Sugerir por Gerente', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Sugere cedentes para o gestor baseado na correspondência do campo gerente no banco externo.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: suggest-by-gerente' },
      ], example_payload: { action: 'suggest-by-gerente' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Auto-Assign por Gerente', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Vincula automaticamente cedentes a gestores pela correspondência de nomes (admin only).',
      auth: 'Bearer token (admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: auto-assign-by-gerente' },
      ], example_payload: { action: 'auto-assign-by-gerente' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Métricas Avançadas', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Retorna dashboard analítico com KPIs, rankings, HHI, evolução mensal e recomendações.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: portfolio-advanced-metrics' },
        { name: 'periodo_meses', type: 'number', required: false, desc: 'Período em meses (default: 6)' },
        { name: 'data_inicio', type: 'string', required: false, desc: 'Data início (YYYY-MM-DD)' },
        { name: 'data_fim', type: 'string', required: false, desc: 'Data fim (YYYY-MM-DD)' },
      ], example_payload: { action: 'portfolio-advanced-metrics', periodo_meses: 6 },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Admin Overview', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Visão administrativa de todos os gestores com contagens de cedentes e pendências.',
      auth: 'Bearer token (admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: admin-overview' },
      ], example_payload: { action: 'admin-overview' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio - Dashboard Gestor', method: 'POST', path: '/functions/v1/portfolio-data',
      description: 'Dashboard completo do gestor: BI, aniversariantes, inadimplência, saldos, cheques e métricas.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: gestor-dashboard' },
        { name: 'data_inicio', type: 'string', required: false, desc: 'Data início para filtro' },
        { name: 'data_fim', type: 'string', required: false, desc: 'Data fim para filtro' },
      ], example_payload: { action: 'gestor-dashboard' },
    },

    // ========== GIRO CARTEIRA ==========
    {
      sistema: SISTEMA, label: 'Giro Carteira - Listar Todos', method: 'POST', path: '/functions/v1/giro-carteira',
      description: 'Lista todos os cedentes com limite, risco, última operação e dias inativos para análise de giro.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list-all' },
      ], example_payload: { action: 'list-all' },
    },
    {
      sistema: SISTEMA, label: 'Giro Carteira - Análise em Lote', method: 'POST', path: '/functions/v1/giro-carteira',
      description: 'Análise determinística de saúde financeira de múltiplos cedentes com score, alertas e classificação.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: analyze-batch' },
        { name: 'cedentes', type: 'array', required: true, desc: 'Array de cedentes com cpf_cnpj, limite_global, risco_atual' },
      ], example_payload: { action: 'analyze-batch', cedentes: [{ cpf_cnpj: '12345678000190', limite_global: 100000, risco_atual: 50000 }] },
    },

    // ========== AGRISK ==========
    {
      sistema: SISTEMA, label: 'AgRisk - Listar Produtos', method: 'POST', path: '/functions/v1/agrisk-query',
      description: 'Lista todos os produtos disponíveis na API AgRisk com preços.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: list-products' },
      ], example_payload: { action: 'list-products' },
    },
    {
      sistema: SISTEMA, label: 'AgRisk - Registrar Cliente', method: 'POST', path: '/functions/v1/agrisk-query',
      description: 'Registra ou busca cliente na AgRisk por CPF/CNPJ, retornando dados cadastrais e contatos.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: register-client' },
        { name: 'taxId', type: 'string', required: true, desc: 'CPF ou CNPJ' },
      ], example_payload: { action: 'register-client', taxId: '12345678000190' },
    },
    {
      sistema: SISTEMA, label: 'AgRisk - Buscar Detalhes Existentes', method: 'POST', path: '/functions/v1/agrisk-query',
      description: 'Recupera resultados de consultas já realizadas para um cliente AgRisk (sem custo).',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: fetch-existing-details' },
        { name: 'clientId', type: 'string', required: true, desc: 'ID do cliente AgRisk' },
        { name: 'queryId', type: 'string', required: false, desc: 'ID da query específica' },
      ], example_payload: { action: 'fetch-existing-details', clientId: 'abc123' },
    },
    {
      sistema: SISTEMA, label: 'AgRisk - Detalhe Processo Judicial', method: 'POST', path: '/functions/v1/agrisk-query',
      description: 'Retorna detalhes de um processo judicial específico de um cliente AgRisk.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: fetch-lawsuit-detail' },
        { name: 'clientId', type: 'string', required: true, desc: 'ID do cliente AgRisk' },
        { name: 'lawsuitId', type: 'string', required: true, desc: 'ID do processo judicial' },
      ], example_payload: { action: 'fetch-lawsuit-detail', clientId: 'abc123', lawsuitId: 'xyz789' },
    },
    {
      sistema: SISTEMA, label: 'AgRisk - Executar Consulta', method: 'POST', path: '/functions/v1/agrisk-query',
      description: 'Executa consulta AgRisk paga: consulta_cliente, restritivos, endividamento, cpr, imoveis, veicular, armazens.',
      auth: 'Bearer token (header)', fields: [
        { name: 'taxId', type: 'string', required: true, desc: 'CPF ou CNPJ' },
        { name: 'consultaType', type: 'string', required: true, desc: 'Tipo: consulta_cliente, restritivos, endividamento, cpr, imoveis_simples, imoveis_car, patrimonio_veicular, armazens' },
      ], example_payload: { taxId: '12345678000190', consultaType: 'consulta_cliente' },
    },
    {
      sistema: SISTEMA, label: 'AgRisk - Proxy de Arquivo', method: 'GET', path: '/functions/v1/agrisk-query',
      description: 'Proxy para download de arquivos/certificados da AgRisk (PDFs).',
      auth: 'Bearer token (header)', fields: [
        { name: 'file', type: 'string', required: true, desc: 'Caminho do arquivo (query param)' },
      ],
    },

    // ========== GOLDSIGN ==========
    {
      sistema: SISTEMA, label: 'GoldSign Proxy', method: 'POST', path: '/functions/v1/goldsign-proxy',
      description: 'Proxy para API GoldSign de assinatura digital. Suporta GET e POST via query param target.',
      auth: 'Bearer token (header)', fields: [
        { name: 'target', type: 'string', required: true, desc: 'Path da API GoldSign (query param). Ex: /api/envelopes' },
      ],
    },
    {
      sistema: SISTEMA, label: 'GoldSign Proxy (GET)', method: 'GET', path: '/functions/v1/goldsign-proxy',
      description: 'Proxy GET para API GoldSign. Útil para listar envelopes e buscar status.',
      auth: 'Bearer token (header)', fields: [
        { name: 'target', type: 'string', required: true, desc: 'Path da API GoldSign (query param)' },
      ],
    },
    {
      sistema: SISTEMA, label: 'GoldSign Settings - Consultar', method: 'POST', path: '/functions/v1/goldsign-settings',
      description: 'Retorna configurações atuais do certificado digital ICP-Brasil vinculado.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: get' },
      ], example_payload: { action: 'get' },
    },
    {
      sistema: SISTEMA, label: 'GoldSign Settings - Vincular Certificado', method: 'POST', path: '/functions/v1/goldsign-settings',
      description: 'Vincula um certificado digital ICP-Brasil para assinatura da empresa (master admin only).',
      auth: 'Bearer token (master admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: set' },
        { name: 'gold_credit_cert_document', type: 'string', required: true, desc: 'CPF/CNPJ do certificado' },
        { name: 'gold_credit_cert_subject_cn', type: 'string', required: false, desc: 'CN do certificado' },
        { name: 'gold_credit_cert_serial_number', type: 'string', required: false, desc: 'Número serial' },
        { name: 'gold_credit_cert_tipo', type: 'string', required: false, desc: 'Tipo: PF ou PJ' },
        { name: 'gold_credit_cert_issuer_cn', type: 'string', required: false, desc: 'Emissor do certificado' },
      ], example_payload: { action: 'set', gold_credit_cert_document: '12345678000190' },
    },
    {
      sistema: SISTEMA, label: 'GoldSign Settings - Desvincular Certificado', method: 'POST', path: '/functions/v1/goldsign-settings',
      description: 'Remove o certificado digital vinculado (master admin only).',
      auth: 'Bearer token (master admin)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: clear' },
      ], example_payload: { action: 'clear' },
    },

    // ========== CONSULTAS EXTERNAS ==========
    {
      sistema: SISTEMA, label: 'HBI SCR - Consultar', method: 'POST', path: '/functions/v1/hbi-scr',
      description: 'Consulta SCR (Sistema de Informações de Crédito do Bacen) via API HBI com autenticação JWT.',
      auth: 'Bearer token (header)', fields: [
        { name: 'cpfCnpj', type: 'string', required: true, desc: 'CPF ou CNPJ para consulta SCR' },
        { name: 'dataBase', type: 'string', required: false, desc: 'Data base (YYYY-MM-DD). Default: mês atual' },
      ], example_payload: { cpfCnpj: '12345678000190' },
    },
    {
      sistema: SISTEMA, label: 'Serasa Report - Consultar', method: 'POST', path: '/functions/v1/serasa-report',
      description: 'Consulta relatórios Serasa PF/PJ: básico, avançado com score, analítico com ACPH.',
      auth: 'Bearer token (header)', fields: [
        { name: 'document', type: 'string', required: true, desc: 'CPF ou CNPJ' },
        { name: 'consultaId', type: 'string', required: true, desc: 'Tipo: serasa_basico_pf, serasa_avancado_top_score_pf, serasa_basico_pj, serasa_avancado_pj' },
        { name: 'scoreModel', type: 'string', required: false, desc: 'Modelo de score (ex: HRLD para PF)' },
        { name: 'optionalFeatures', type: 'string', required: false, desc: 'Features opcionais Serasa' },
        { name: 'federalUnit', type: 'string', required: false, desc: 'UF para filtro (PF)' },
      ], example_payload: { document: '12345678000190', consultaId: 'serasa_basico_pj' },
    },

    // ========== ANÁLISES IA ==========
    {
      sistema: SISTEMA, label: 'Analyze Cedente', method: 'POST', path: '/functions/v1/analyze-cedente',
      description: 'Gera análise de IA sobre um cedente com base em métricas operacionais, liquidez, concentração e comportamento.',
      auth: 'Bearer token (header)', fields: [
        { name: 'cedenteData', type: 'object', required: true, desc: 'Dados compilados do cedente (métricas, títulos, operações)' },
      ], example_payload: { cedenteData: { cedente: { nome: 'Empresa XYZ' } } },
    },
    {
      sistema: SISTEMA, label: 'Analyze Client Summary', method: 'POST', path: '/functions/v1/analyze-client-summary',
      description: 'Gera compilação de IA consolidando todas as consultas de um cliente (Smart, Serasa, SCR, AgRisk).',
      auth: 'Bearer token (header)', fields: [
        { name: 'clientData', type: 'object', required: true, desc: 'Dados e consultas do cliente' },
      ], example_payload: { clientData: {} },
    },
    {
      sistema: SISTEMA, label: 'Analyze Credit Operation', method: 'POST', path: '/functions/v1/analyze-credit-operation',
      description: 'Análise de crédito completa para operação de securitização com documentos, SCR e Serasa.',
      auth: 'Bearer token (header)', fields: [
        { name: 'sessionId', type: 'string', required: true, desc: 'ID da sessão de análise' },
      ], example_payload: { sessionId: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Analyze Document', method: 'POST', path: '/functions/v1/analyze-document',
      description: 'Extrai e analisa dados de documentos financeiros (VADU, SCR, Serasa, balanços) via IA.',
      auth: 'Bearer token (header)', fields: [
        { name: 'documentContent', type: 'string', required: true, desc: 'Conteúdo extraído do documento (texto ou base64)' },
        { name: 'documentType', type: 'string', required: false, desc: 'Tipo do documento' },
      ], example_payload: { documentContent: 'texto do documento', documentType: 'balanco' },
    },
    {
      sistema: SISTEMA, label: 'Credit Analysis Chat', method: 'POST', path: '/functions/v1/credit-analysis-chat',
      description: 'Chat interativo de IA para análise de crédito com histórico persistente por sessão.',
      auth: 'Bearer token (header)', fields: [
        { name: 'sessionId', type: 'string', required: true, desc: 'ID da sessão de análise' },
        { name: 'message', type: 'string', required: true, desc: 'Mensagem do analista' },
      ], example_payload: { sessionId: 'uuid', message: 'Qual o risco desse cedente?' },
    },

    // ========== INFRAESTRUTURA ==========
    {
      sistema: SISTEMA, label: 'Bootstrap Master', method: 'POST', path: '/functions/v1/bootstrap-master',
      description: 'Inicializa o usuário master admin do sistema na primeira execução.',
      auth: 'x-api-key (header)', fields: [
        { name: 'password', type: 'string', required: true, desc: 'Senha do master admin (min 6 chars)' },
      ], example_payload: { password: 'senhaSegura123' },
    },
    {
      sistema: SISTEMA, label: 'Complete Initial Password Change', method: 'POST', path: '/functions/v1/complete-initial-password-change',
      description: 'Marca must_change_password=false após a primeira troca de senha obrigatória.',
      auth: 'Bearer token (header)', fields: [],
    },
    {
      sistema: SISTEMA, label: 'Import CSV', method: 'POST', path: '/functions/v1/import-csv',
      description: 'Importa dados via CSV para tabelas do sistema interno (cedentes, operações, títulos, receitas).',
      auth: 'Bearer token (header)', fields: [
        { name: 'csvContent', type: 'string', required: true, desc: 'Conteúdo do CSV em texto' },
        { name: 'tableName', type: 'string', required: true, desc: 'Tabela destino (ex: cedentes_completo, titulos_em_aberto)' },
      ], example_payload: { csvContent: 'col1,col2\nval1,val2', tableName: 'cedentes_completo' },
    },
    {
      sistema: SISTEMA, label: 'Process SQL', method: 'POST', path: '/functions/v1/process-sql',
      description: 'Executa comandos SQL (MySQL convertido para PostgreSQL) no banco interno para migração de dados.',
      auth: 'Bearer token (header)', fields: [
        { name: 'sql', type: 'string', required: true, desc: 'SQL a executar (pode ser MySQL, será convertido)' },
        { name: 'chunk_index', type: 'number', required: false, desc: 'Índice do chunk (para envios parciais)' },
        { name: 'total_chunks', type: 'number', required: false, desc: 'Total de chunks' },
      ], example_payload: { sql: 'INSERT INTO cedentes_completo (nome) VALUES ("teste")' },
    },
    {
      sistema: SISTEMA, label: 'Process Email Queue', method: 'POST', path: '/functions/v1/process-email-queue',
      description: 'Processa fila de emails transacionais pendentes com controle de rate limit e DLQ.',
      auth: 'x-api-key (header)', fields: [],
    },

    // ========== SUPABASE REST API — PROFILES ==========
    {
      sistema: SISTEMA, label: 'Profiles - Listar', method: 'GET', path: '/rest/v1/profiles',
      description: 'Lista perfis de usuários. Suporta filtros por user_id, email via query params.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'select', type: 'string', required: false, desc: 'Colunas a retornar (ex: id,name,email)' },
        { name: 'user_id', type: 'string', required: false, desc: 'Filtro eq: user_id=eq.uuid' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Profiles - Criar', method: 'POST', path: '/rest/v1/profiles',
      description: 'Cria um novo perfil de usuário.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: true, desc: 'ID do auth.user' },
        { name: 'email', type: 'string', required: true, desc: 'Email do usuário' },
        { name: 'name', type: 'string', required: true, desc: 'Nome do usuário' },
      ], example_payload: { user_id: 'uuid', email: 'user@email.com', name: 'João' },
    },
    {
      sistema: SISTEMA, label: 'Profiles - Atualizar', method: 'PATCH', path: '/rest/v1/profiles',
      description: 'Atualiza campos do perfil (name, email, must_change_password). Requer filtro user_id.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: true, desc: 'Filtro: user_id=eq.uuid (query param)' },
        { name: 'name', type: 'string', required: false, desc: 'Novo nome' },
        { name: 'must_change_password', type: 'boolean', required: false, desc: 'Flag de troca obrigatória' },
      ], example_payload: { name: 'Novo Nome' },
    },
    {
      sistema: SISTEMA, label: 'Profiles - Excluir', method: 'DELETE', path: '/rest/v1/profiles',
      description: 'Remove perfil de usuário. Requer filtro user_id.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: true, desc: 'Filtro: user_id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — USER ROLES ==========
    {
      sistema: SISTEMA, label: 'User Roles - Listar', method: 'GET', path: '/rest/v1/user_roles',
      description: 'Lista roles de usuários com filtro por user_id e/ou role.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: false, desc: 'Filtro: user_id=eq.uuid' },
        { name: 'role', type: 'string', required: false, desc: 'Filtro: role=eq.admin' },
      ],
    },
    {
      sistema: SISTEMA, label: 'User Roles - Criar', method: 'POST', path: '/rest/v1/user_roles',
      description: 'Atribui uma role (admin/user) a um usuário.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: true, desc: 'ID do usuário' },
        { name: 'role', type: 'string', required: true, desc: 'admin ou user' },
      ], example_payload: { user_id: 'uuid', role: 'user' },
    },
    {
      sistema: SISTEMA, label: 'User Roles - Atualizar', method: 'PATCH', path: '/rest/v1/user_roles',
      description: 'Atualiza a role de um usuário. Requer filtro por id ou user_id.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'role', type: 'string', required: true, desc: 'Nova role: admin ou user' },
      ], example_payload: { role: 'admin' },
    },
    {
      sistema: SISTEMA, label: 'User Roles - Excluir', method: 'DELETE', path: '/rest/v1/user_roles',
      description: 'Remove uma role de um usuário. Requer filtro por id.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — CONSULTA CLIENTS ==========
    {
      sistema: SISTEMA, label: 'Consulta Clients - Listar', method: 'GET', path: '/rest/v1/consulta_clients',
      description: 'Lista clientes cadastrados com filtros por cpf_cnpj, name, created_by.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cpf_cnpj', type: 'string', required: false, desc: 'Filtro: cpf_cnpj=eq.12345678000190' },
        { name: 'created_by', type: 'string', required: false, desc: 'Filtro por criador' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Consulta Clients - Criar', method: 'POST', path: '/rest/v1/consulta_clients',
      description: 'Cadastra novo cliente com CPF/CNPJ para consultas.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cpf_cnpj', type: 'string', required: true, desc: 'CPF ou CNPJ' },
        { name: 'name', type: 'string', required: false, desc: 'Nome do cliente' },
        { name: 'created_by', type: 'string', required: true, desc: 'ID do usuário criador' },
      ], example_payload: { cpf_cnpj: '12345678000190', name: 'Empresa XYZ', created_by: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Consulta Clients - Atualizar', method: 'PATCH', path: '/rest/v1/consulta_clients',
      description: 'Atualiza dados do cliente (nome, basic_data, agrisk_client_id).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
        { name: 'name', type: 'string', required: false, desc: 'Novo nome' },
        { name: 'basic_data', type: 'object', required: false, desc: 'Dados básicos atualizados' },
        { name: 'agrisk_client_id', type: 'string', required: false, desc: 'ID do cliente AgRisk' },
      ], example_payload: { name: 'Novo Nome' },
    },
    {
      sistema: SISTEMA, label: 'Consulta Clients - Excluir', method: 'DELETE', path: '/rest/v1/consulta_clients',
      description: 'Remove um cliente cadastrado.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — CONSULTA HISTORY ==========
    {
      sistema: SISTEMA, label: 'Consulta History - Listar', method: 'GET', path: '/rest/v1/consulta_history',
      description: 'Lista histórico de consultas com filtros por cnpj, platform, consulta_type, user_id.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cnpj', type: 'string', required: false, desc: 'Filtro por CNPJ' },
        { name: 'platform', type: 'string', required: false, desc: 'Filtro: serasa, hbi, agrisk, smart' },
        { name: 'order', type: 'string', required: false, desc: 'Ordenação: created_at.desc' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Consulta History - Registrar', method: 'POST', path: '/rest/v1/consulta_history',
      description: 'Registra uma nova consulta no histórico.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cnpj', type: 'string', required: true, desc: 'CPF/CNPJ consultado' },
        { name: 'consulta_type', type: 'string', required: true, desc: 'Tipo da consulta' },
        { name: 'consulta_label', type: 'string', required: true, desc: 'Label amigável' },
        { name: 'platform', type: 'string', required: true, desc: 'serasa, hbi, agrisk, smart' },
        { name: 'user_id', type: 'string', required: true, desc: 'ID do usuário' },
        { name: 'result_data', type: 'object', required: false, desc: 'Dados da consulta (JSON)' },
        { name: 'entity_name', type: 'string', required: false, desc: 'Nome da entidade consultada' },
      ], example_payload: { cnpj: '12345678000190', consulta_type: 'serasa_basico_pj', consulta_label: 'Serasa Básico PJ', platform: 'serasa', user_id: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Consulta History - Atualizar', method: 'PATCH', path: '/rest/v1/consulta_history',
      description: 'Atualiza consulta no histórico (status, result_data, pdf_path).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
        { name: 'status', type: 'string', required: false, desc: 'Novo status' },
        { name: 'result_data', type: 'object', required: false, desc: 'Dados atualizados' },
        { name: 'pdf_path', type: 'string', required: false, desc: 'Caminho do PDF no storage' },
      ], example_payload: { status: 'completed', result_data: {} },
    },
    {
      sistema: SISTEMA, label: 'Consulta History - Excluir', method: 'DELETE', path: '/rest/v1/consulta_history',
      description: 'Remove uma consulta do histórico.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — CREDIT ANALYSIS ==========
    {
      sistema: SISTEMA, label: 'Credit Analysis Sessions - Listar', method: 'GET', path: '/rest/v1/credit_analysis_sessions',
      description: 'Lista sessões de análise de crédito com filtros por client_id, created_by.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'client_id', type: 'string', required: false, desc: 'Filtro por cliente' },
        { name: 'created_by', type: 'string', required: false, desc: 'Filtro por criador' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Credit Analysis Sessions - Criar', method: 'POST', path: '/rest/v1/credit_analysis_sessions',
      description: 'Cria nova sessão de análise de crédito.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'client_id', type: 'string', required: true, desc: 'ID do cliente' },
        { name: 'client_cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ' },
        { name: 'created_by', type: 'string', required: true, desc: 'ID do analista' },
        { name: 'client_name', type: 'string', required: false, desc: 'Nome do cliente' },
        { name: 'documents', type: 'object', required: false, desc: 'Documentos importados (JSON)' },
      ], example_payload: { client_id: 'uuid', client_cpf_cnpj: '12345678000190', created_by: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Credit Analysis Sessions - Atualizar', method: 'PATCH', path: '/rest/v1/credit_analysis_sessions',
      description: 'Atualiza sessão (documentos, análise inicial, consultas, dados cedente).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
        { name: 'documents', type: 'object', required: false, desc: 'Documentos atualizados' },
        { name: 'initial_analysis', type: 'object', required: false, desc: 'Análise inicial da IA' },
        { name: 'client_consultations', type: 'object', required: false, desc: 'Consultas vinculadas' },
      ], example_payload: { documents: [], initial_analysis: {} },
    },
    {
      sistema: SISTEMA, label: 'Credit Analysis Sessions - Excluir', method: 'DELETE', path: '/rest/v1/credit_analysis_sessions',
      description: 'Remove sessão de análise e mensagens associadas (cascade).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Credit Analysis Messages - Listar', method: 'GET', path: '/rest/v1/credit_analysis_messages',
      description: 'Lista mensagens de uma sessão de análise de crédito.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'session_id', type: 'string', required: true, desc: 'Filtro: session_id=eq.uuid' },
        { name: 'order', type: 'string', required: false, desc: 'Ordenação: created_at.asc' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Credit Analysis Messages - Criar', method: 'POST', path: '/rest/v1/credit_analysis_messages',
      description: 'Adiciona mensagem ao chat de análise de crédito.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'session_id', type: 'string', required: true, desc: 'ID da sessão' },
        { name: 'role', type: 'string', required: true, desc: 'user ou assistant' },
        { name: 'content', type: 'string', required: true, desc: 'Conteúdo da mensagem' },
      ], example_payload: { session_id: 'uuid', role: 'user', content: 'Qual o risco?' },
    },

    // ========== SUPABASE REST API — OPERACAO NOTAS ==========
    {
      sistema: SISTEMA, label: 'Operação Notas - Listar', method: 'GET', path: '/rest/v1/operacao_notas',
      description: 'Lista notas fiscais importadas para operação, com filtros por cedente e sacado.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cedente_cpf_cnpj', type: 'string', required: false, desc: 'Filtro por cedente' },
        { name: 'created_by', type: 'string', required: false, desc: 'Filtro por criador' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Operação Notas - Criar', method: 'POST', path: '/rest/v1/operacao_notas',
      description: 'Importa nota fiscal para operação.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cedente_cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ do cedente' },
        { name: 'sacado_cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ do sacado' },
        { name: 'created_by', type: 'string', required: true, desc: 'ID do usuário' },
        { name: 'numero_nota', type: 'string', required: false, desc: 'Número da NF' },
        { name: 'valor', type: 'number', required: false, desc: 'Valor da nota' },
        { name: 'data_emissao', type: 'string', required: false, desc: 'Data de emissão' },
        { name: 'chave_acesso', type: 'string', required: false, desc: 'Chave de acesso NFe' },
      ], example_payload: { cedente_cpf_cnpj: '12345678000190', sacado_cpf_cnpj: '98765432000110', created_by: 'uuid', valor: 15000 },
    },
    {
      sistema: SISTEMA, label: 'Operação Notas - Atualizar', method: 'PATCH', path: '/rest/v1/operacao_notas',
      description: 'Atualiza dados de uma nota importada.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ], example_payload: { valor: 20000 },
    },
    {
      sistema: SISTEMA, label: 'Operação Notas - Excluir', method: 'DELETE', path: '/rest/v1/operacao_notas',
      description: 'Remove nota fiscal de uma operação.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — SACADOS ==========
    {
      sistema: SISTEMA, label: 'Sacados - Listar', method: 'GET', path: '/rest/v1/sacados',
      description: 'Lista sacados cadastrados com filtros por cpf_cnpj e nome.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cpf_cnpj', type: 'string', required: false, desc: 'Filtro por CPF/CNPJ' },
        { name: 'created_by', type: 'string', required: false, desc: 'Filtro por criador' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Sacados - Criar', method: 'POST', path: '/rest/v1/sacados',
      description: 'Cadastra novo sacado com dados de contato e endereço.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cpf_cnpj', type: 'string', required: true, desc: 'CPF ou CNPJ' },
        { name: 'nome', type: 'string', required: true, desc: 'Nome/Razão social' },
        { name: 'created_by', type: 'string', required: true, desc: 'ID do usuário' },
        { name: 'email', type: 'string', required: false, desc: 'Email' },
        { name: 'telefone', type: 'string', required: false, desc: 'Telefone' },
        { name: 'endereco', type: 'string', required: false, desc: 'Endereço' },
        { name: 'cidade', type: 'string', required: false, desc: 'Cidade' },
        { name: 'estado', type: 'string', required: false, desc: 'UF' },
        { name: 'cep', type: 'string', required: false, desc: 'CEP' },
      ], example_payload: { cpf_cnpj: '12345678000190', nome: 'Sacado LTDA', created_by: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Sacados - Atualizar', method: 'PATCH', path: '/rest/v1/sacados',
      description: 'Atualiza dados de um sacado (nome, contato, endereço).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ], example_payload: { nome: 'Novo Nome', email: 'novo@email.com' },
    },
    {
      sistema: SISTEMA, label: 'Sacados - Excluir', method: 'DELETE', path: '/rest/v1/sacados',
      description: 'Remove um sacado cadastrado.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — PORTFOLIO ASSIGNMENTS ==========
    {
      sistema: SISTEMA, label: 'Portfolio Assignments - Listar', method: 'GET', path: '/rest/v1/portfolio_assignments',
      description: 'Lista atribuições de carteira com filtros por user_id, status, cedente.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: false, desc: 'Filtro por gestor' },
        { name: 'status', type: 'string', required: false, desc: 'Filtro: pending, approved, rejected' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Portfolio Assignments - Criar', method: 'POST', path: '/rest/v1/portfolio_assignments',
      description: 'Cria nova atribuição cedente-gestor.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'user_id', type: 'string', required: true, desc: 'ID do gestor' },
        { name: 'cedente_cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ do cedente' },
        { name: 'requested_by', type: 'string', required: true, desc: 'ID do solicitante' },
      ], example_payload: { user_id: 'uuid', cedente_cpf_cnpj: '12345678000190', requested_by: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio Assignments - Atualizar', method: 'PATCH', path: '/rest/v1/portfolio_assignments',
      description: 'Atualiza status de atribuição (approved, rejected) com motivo.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
        { name: 'status', type: 'string', required: false, desc: 'Novo status' },
        { name: 'rejection_reason', type: 'string', required: false, desc: 'Motivo da recusa' },
      ], example_payload: { status: 'approved' },
    },
    {
      sistema: SISTEMA, label: 'Portfolio Assignments - Excluir', method: 'DELETE', path: '/rest/v1/portfolio_assignments',
      description: 'Remove atribuição de carteira permanentemente.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — CEDENTE BIRTHDAYS ==========
    {
      sistema: SISTEMA, label: 'Cedente Birthdays - Listar', method: 'GET', path: '/rest/v1/cedente_birthdays',
      description: 'Lista aniversários de cedentes cadastrados.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'created_by', type: 'string', required: false, desc: 'Filtro por criador' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Cedente Birthdays - Criar', method: 'POST', path: '/rest/v1/cedente_birthdays',
      description: 'Cadastra aniversário de um cedente.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'cedente_cpf_cnpj', type: 'string', required: true, desc: 'CPF/CNPJ do cedente' },
        { name: 'cedente_nome', type: 'string', required: true, desc: 'Nome do cedente' },
        { name: 'data_nascimento', type: 'string', required: true, desc: 'Data de nascimento (YYYY-MM-DD)' },
        { name: 'created_by', type: 'string', required: true, desc: 'ID do usuário' },
      ], example_payload: { cedente_cpf_cnpj: '12345678000190', cedente_nome: 'João', data_nascimento: '1990-05-15', created_by: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'Cedente Birthdays - Excluir', method: 'DELETE', path: '/rest/v1/cedente_birthdays',
      description: 'Remove registro de aniversário de cedente.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'string', required: true, desc: 'Filtro: id=eq.uuid (query param)' },
      ],
    },

    // ========== SUPABASE REST API — GOLDSIGN SETTINGS ==========
    {
      sistema: SISTEMA, label: 'GoldSign Settings - Listar (REST)', method: 'GET', path: '/rest/v1/goldsign_settings',
      description: 'Consulta configurações de certificado digital via REST direto.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'id', type: 'number', required: false, desc: 'Filtro: id=eq.1' },
      ],
    },

    // ========== SUPABASE REST API — EMAIL ==========
    {
      sistema: SISTEMA, label: 'Email Send Log - Listar', method: 'GET', path: '/rest/v1/email_send_log',
      description: 'Lista log de emails enviados com filtros por status e template.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'status', type: 'string', required: false, desc: 'Filtro: sent, failed, bounced' },
        { name: 'template_name', type: 'string', required: false, desc: 'Filtro por template' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Suppressed Emails - Listar', method: 'GET', path: '/rest/v1/suppressed_emails',
      description: 'Lista emails suprimidos (bounce, unsubscribe).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'email', type: 'string', required: false, desc: 'Filtro por email' },
      ],
    },

    // ========== SUPABASE STORAGE ==========
    {
      sistema: SISTEMA, label: 'Storage - Upload PDF Consulta', method: 'POST', path: '/storage/v1/object/consulta-pdfs',
      description: 'Upload de PDF de consulta para o bucket privado consulta-pdfs.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'file', type: 'binary', required: true, desc: 'Arquivo PDF (multipart/form-data)' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Storage - Download PDF Consulta', method: 'GET', path: '/storage/v1/object/consulta-pdfs',
      description: 'Download de PDF de consulta do bucket privado.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'path', type: 'string', required: true, desc: 'Caminho do arquivo no bucket' },
      ],
    },
    {
      sistema: SISTEMA, label: 'Storage - Excluir PDF Consulta', method: 'DELETE', path: '/storage/v1/object/consulta-pdfs',
      description: 'Remove PDF de consulta do bucket.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'path', type: 'string', required: true, desc: 'Caminho do arquivo no bucket' },
      ],
    },

    // ========== SUPABASE AUTH ==========
    {
      sistema: SISTEMA, label: 'Auth - Login', method: 'POST', path: '/auth/v1/token?grant_type=password',
      description: 'Autenticação de usuário com email e senha. Retorna JWT access_token e refresh_token.',
      auth: 'apikey (header)', fields: [
        { name: 'email', type: 'string', required: true, desc: 'Email do usuário' },
        { name: 'password', type: 'string', required: true, desc: 'Senha' },
      ], example_payload: { email: 'user@email.com', password: 'senha123' },
    },
    {
      sistema: SISTEMA, label: 'Auth - Refresh Token', method: 'POST', path: '/auth/v1/token?grant_type=refresh_token',
      description: 'Renova access_token usando refresh_token.',
      auth: 'apikey (header)', fields: [
        { name: 'refresh_token', type: 'string', required: true, desc: 'Refresh token atual' },
      ], example_payload: { refresh_token: 'rt_xxx' },
    },
    {
      sistema: SISTEMA, label: 'Auth - Logout', method: 'POST', path: '/auth/v1/logout',
      description: 'Invalida sessão do usuário.',
      auth: 'Bearer token + apikey (header)', fields: [],
    },
    {
      sistema: SISTEMA, label: 'Auth - Get User', method: 'GET', path: '/auth/v1/user',
      description: 'Retorna dados do usuário autenticado.',
      auth: 'Bearer token + apikey (header)', fields: [],
    },
    {
      sistema: SISTEMA, label: 'Auth - Update User', method: 'PUT', path: '/auth/v1/user',
      description: 'Atualiza dados do usuário autenticado (senha, email, user_metadata).',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'password', type: 'string', required: false, desc: 'Nova senha' },
        { name: 'email', type: 'string', required: false, desc: 'Novo email' },
        { name: 'data', type: 'object', required: false, desc: 'user_metadata' },
      ], example_payload: { password: 'novaSenha123' },
    },

    // ========== SUPABASE RPC ==========
    {
      sistema: SISTEMA, label: 'RPC - has_role', method: 'POST', path: '/rest/v1/rpc/has_role',
      description: 'Verifica se usuário possui determinada role (admin/user). Security definer.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: '_user_id', type: 'string', required: true, desc: 'UUID do usuário' },
        { name: '_role', type: 'string', required: true, desc: 'admin ou user' },
      ], example_payload: { _user_id: 'uuid', _role: 'admin' },
    },
    {
      sistema: SISTEMA, label: 'RPC - is_master_admin', method: 'POST', path: '/rest/v1/rpc/is_master_admin',
      description: 'Verifica se usuário é master admin. Security definer.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: '_user_id', type: 'string', required: true, desc: 'UUID do usuário' },
      ], example_payload: { _user_id: 'uuid' },
    },
    {
      sistema: SISTEMA, label: 'RPC - enqueue_email', method: 'POST', path: '/rest/v1/rpc/enqueue_email',
      description: 'Enfileira email na fila PGMQ para envio assíncrono.',
      auth: 'Bearer token + apikey (header)', fields: [
        { name: 'queue_name', type: 'string', required: true, desc: 'Nome da fila (ex: email_queue)' },
        { name: 'payload', type: 'object', required: true, desc: 'Payload do email (to, subject, html)' },
      ], example_payload: { queue_name: 'email_queue', payload: { to: 'user@email.com', subject: 'Teste' } },
    },

    // ========== ENDPOINTS REGISTRY ==========
    {
      sistema: SISTEMA, label: 'Endpoints Registry - Registrar Todos', method: 'POST', path: '/functions/v1/endpoints-registry',
      description: 'Registra todos os endpoints da plataforma no hub de documentação centralizado.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: false, desc: 'Valor fixo: register-all (default)' },
      ], example_payload: { action: 'register-all' },
    },
    {
      sistema: SISTEMA, label: 'Endpoints Registry - Registrar Único', method: 'POST', path: '/functions/v1/endpoints-registry',
      description: 'Registra um endpoint específico no hub de documentação.',
      auth: 'Bearer token (header)', fields: [
        { name: 'action', type: 'string', required: true, desc: 'Valor fixo: register-single' },
        { name: 'endpoint', type: 'object', required: true, desc: 'Definição completa do endpoint' },
      ], example_payload: { action: 'register-single', endpoint: { sistema: 'financeiro', label: 'Novo Endpoint', method: 'POST', path: '/path', description: 'Desc' } },
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const docsApiKey = Deno.env.get('DOCS_API_KEY');
    if (!docsApiKey) {
      return new Response(JSON.stringify({ error: 'DOCS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'register-all';

    if (action === 'register-single' && body.endpoint) {
      const result = await sendToHub(body.endpoint, docsApiKey);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Register endpoints sequentially one-by-one with controlled pacing
    const endpoints = getAllEndpoints();
    const results: { label: string; success: boolean; error?: string }[] = [];

    // Support offset param to resume from where we left off
    const startFrom = typeof body.offset === 'number' ? body.offset : 0;
    const maxCount = typeof body.limit === 'number' ? body.limit : 25;
    const subset = endpoints.slice(startFrom, startFrom + maxCount);

    for (const ep of subset) {
      const result = await sendToHub(ep, docsApiKey);
      results.push({ label: ep.label, success: result.success, error: result.error });
      // Small delay between each request
      await new Promise(r => setTimeout(r, 200));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalEndpoints = endpoints.length;

    console.log(`[endpoints-registry] Batch offset=${startFrom} limit=${maxCount}: ${successCount}/${subset.length} OK. Total endpoints: ${totalEndpoints}`);

    return new Response(JSON.stringify({
      success: failCount === 0,
      total: totalEndpoints,
      batch_size: subset.length,
      offset: startFrom,
      next_offset: startFrom + maxCount < totalEndpoints ? startFrom + maxCount : null,
      registered: successCount,
      failed: failCount,
      details: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[endpoints-registry] Error: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
