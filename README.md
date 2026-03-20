# Operacoes GoldCredit

Aplicacao principal desenvolvida no Lovable. Este modulo concentra o frontend web do sistema e tambem edge functions de apoio para CRUD, consultas, integracoes e partes do fluxo operacional.

## Escopo atual do modulo

Hoje este projeto vai alem da consulta de cedentes. Ele inclui, entre outros, os seguintes dominios:

- autenticacao e perfis
- painel operacional
- clientes
- cedentes e consultas
- carteira e metricas
- historicos de consultas
- documentos e assinatura digital
- configuracoes administrativas
- edge functions de apoio no Supabase

## Rotas relevantes

- `/login`
- `/painel`
- `/consulta`
- `/clientes`
- `/consultas`
- `/contratos/documentos`
- `/contratos/assinatura-digital`
- `/assinar/:token`
- `/assinar-operacao/:token`
- `/admin`

## Tecnologias

- React
- TypeScript
- Vite
- TanStack Query
- Supabase
- Tailwind CSS
- shadcn/ui

## Integracoes principais

- Supabase para autenticacao, dados e edge functions
- backend de assinatura via `VITE_BACKEND_URL`
- app local de assinatura via `VITE_LOCAL_SIGNER_URL`

## Desenvolvimento local

```bash
cd operacoes-goldcredit
npm install
npm run dev
```

## Variaveis importantes

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_BACKEND_URL`
- `VITE_LOCAL_SIGNER_URL`

## Documentacao complementar

Para entender o sistema como um todo, consulte a documentacao central em `../docs/`.
