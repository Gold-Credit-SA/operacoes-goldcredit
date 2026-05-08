# API de Auditoria - Endpoints

Documentação completa da API de auditoria de consultas da plataforma GoldCredit.

## Base URL

```
https://cwjrkygliokjseprelax.supabase.co/functions/v1
```

## Autenticação

Todas as requisições devem incluir o header `Authorization` com o Bearer token (API Key fixa configurada como secret `AUDIT_API_KEY`).

```
Authorization: Bearer SUA_API_KEY
```

Requisições sem token ou com token inválido retornam `401 Unauthorized`.

---

## GET /audit-consultas

Lista todas as consultas realizadas na plataforma, com filtros e paginação. Retorna dados consolidados de `consulta_history` enriquecidos com informações do usuário responsável.

### URL

```
GET https://cwjrkygliokjseprelax.supabase.co/functions/v1/audit-consultas
```

### Query Parameters (todos opcionais)

| Parâmetro       | Tipo    | Descrição                                                                 | Exemplo                  |
|-----------------|---------|---------------------------------------------------------------------------|--------------------------|
| `from`          | string  | Data inicial (ISO 8601 - YYYY-MM-DD)                                      | `2026-05-01`             |
| `to`            | string  | Data final (ISO 8601 - YYYY-MM-DD)                                        | `2026-05-31`             |
| `platform`      | string  | Filtra por plataforma: `serasa`, `scr`, `agrisk`, `smart`                 | `agrisk`                 |
| `user_id`       | uuid    | UUID do usuário que realizou a consulta                                   | `ad3c4a45-...`           |
| `consulta_type` | string  | Tipo específico da consulta (ex: `serasa_basico`, `agrisk_consulta_cliente`) | `serasa_basico`          |
| `status`        | string  | Status da consulta: `success`, `error`, `pending`                         | `success`                |
| `page`          | number  | Página (default: `1`)                                                     | `1`                      |
| `page_size`     | number  | Itens por página (default: `50`, máximo: `500`)                           | `100`                    |

### Exemplo de Requisição

```bash
curl -H "Authorization: Bearer SUA_API_KEY" \
  "https://cwjrkygliokjseprelax.supabase.co/functions/v1/audit-consultas?from=2026-05-01&to=2026-05-31&platform=agrisk&page=1&page_size=100"
```

### Resposta de Sucesso (200)

```json
{
  "page": 1,
  "page_size": 100,
  "total": 245,
  "total_pages": 3,
  "filters": {
    "from": "2026-05-01",
    "to": "2026-05-31",
    "platform": "agrisk",
    "user_id": null,
    "consulta_type": null,
    "status": null
  },
  "items": [
    {
      "id": "uuid-da-consulta",
      "created_at": "2026-05-08T14:23:11.000Z",
      "platform": "agrisk",
      "platform_label": "AgRisk",
      "consulta_type": "agrisk_consulta_cliente",
      "consulta_label": "AgRisk - Consulta Cliente",
      "status": "success",
      "document": "12345678000190",
      "entity_name": "Empresa Exemplo LTDA",
      "user": {
        "id": "uuid-do-usuario",
        "name": "Renan Silva",
        "email": "renan@goldcreditsa.com.br"
      }
    }
  ]
}
```

### Possíveis Erros

| Código | Mensagem               | Causa                                       |
|--------|------------------------|---------------------------------------------|
| 401    | Unauthorized           | Token ausente ou inválido                   |
| 400    | Invalid query params   | Parâmetro mal formatado (data, uuid, etc.)  |
| 500    | Internal server error  | Erro inesperado no servidor                 |

---

## Plataformas Suportadas

| `platform` | Label   | Cor identificadora |
|------------|---------|--------------------|
| `serasa`   | Serasa  | Azul               |
| `scr`      | HBI/SCR | Verde              |
| `agrisk`   | AgRisk  | Âmbar              |
| `smart`    | Smart   | Vermelho           |

## Tipos de Consulta (`consulta_type`)

### Serasa
- `serasa_basico` - Serasa PF/PJ Básico
- `serasa_avancado` - Serasa PF/PJ Avançado
- `serasa_pme_relatorio_basico` - Serasa PME Básico
- `serasa_pme_relatorio_completo` - Serasa PME Completo
- `serasa_pj_analitico` - Serasa PJ Analítico

### HBI / SCR
- `scr` - Consulta SCR Bacen

### AgRisk
- `agrisk_cadastro` - Cadastro AgRisk (gratuito)
- `agrisk_consulta_cliente` - Consulta Cliente AgRisk

### Smart
- `smart_cedente` - Consulta Cedente Smart

---

## Notas

- A API retorna apenas metadados de auditoria, sem o payload completo dos relatórios.
- Ordenação padrão: `created_at` decrescente (mais recentes primeiro).
- Para baixar volumes grandes, itere por `page` até `page >= total_pages`.
- Custos por consulta NÃO são retornados nesta API (controle de custos é feito no app financeiro).
