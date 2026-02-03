-- Drop todas as tabelas de negócio (dados agora vêm do banco externo)
-- Mantendo apenas estrutura para usuários do sistema

DROP TABLE IF EXISTS titulos_quitados_suspeita_fraude CASCADE;
DROP TABLE IF EXISTS titulos_recomprados CASCADE;
DROP TABLE IF EXISTS titulos_prorrogados CASCADE;
DROP TABLE IF EXISTS titulos_quitados CASCADE;
DROP TABLE IF EXISTS titulos_em_aberto CASCADE;
DROP TABLE IF EXISTS receita_por_cedente CASCADE;
DROP TABLE IF EXISTS operacoes_individualizadas CASCADE;
DROP TABLE IF EXISTS cedentes_completo CASCADE;
DROP TABLE IF EXISTS cedentes CASCADE;
DROP TABLE IF EXISTS contas_bancarias CASCADE;
DROP TABLE IF EXISTS controladores CASCADE;
DROP TABLE IF EXISTS estados_civis CASCADE;
DROP TABLE IF EXISTS fontes_captacao CASCADE;
DROP TABLE IF EXISTS gerentes CASCADE;
DROP TABLE IF EXISTS grupos_analise_vadu CASCADE;
DROP TABLE IF EXISTS operadores CASCADE;
DROP TABLE IF EXISTS paginations CASCADE;
DROP TABLE IF EXISTS regimes_tributarios CASCADE;