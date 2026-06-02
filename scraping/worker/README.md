# Smart Scraper Worker

Worker que roda numa VPS dedicada, mantém uma sessão Playwright logada no portal
Smart Securities e expõe um endpoint HTTP `POST /scrape` para a edge function
`smart-scraper` (Supabase) baixar PDF de boleto/NF por título.

> **Para que serve:** a API v2 oficial do Smart não expõe download direto de
> boleto/NF por título. Este worker é solução tática até a Smart liberar essa
> rota — quando liberar, basta apontar a edge function para a API oficial.

---

## Arquitetura (resumo)

```
Lovable App
   │ supabase.functions.invoke("smart-scraper", { titulo_id, tipo })
   ▼
Edge Function "smart-scraper" (Supabase)
   │ valida JWT, resolve campos do título, checa cache, dedup lock
   │ POST /scrape  com Bearer <WORKER_TOKEN>
   ▼
Worker VPS (este repo)
   │ Playwright headless logado no portal Smart
   │ navega, baixa PDF, valida magic bytes, devolve base64
   ▼
Edge upload no Storage (bucket smart-anexos) → signed URL → resposta
```

Detalhes da divisão de responsabilidades estão em
`../README.md` (raiz da pasta `scraping`).

---

## Endpoints

### `GET /health`

Sem auth. Devolve:

```json
{
  "ok": true,
  "service": "smart-scraper-worker",
  "uptime_s": 1234,
  "queue": { "pending": 0, "waiting": 0, "inflight": 0, "concurrency": 2 }
}
```

### `POST /scrape`

Exige `Authorization: Bearer <WORKER_TOKEN>`.

**Request:**
```json
{
  "titulo_id": "12345",
  "tipo": "boleto",
  "nosso_numero": "000123456",
  "documento": "12345678900",
  "cedente_id": "abc",
  "cedente_documento": "12345678000199"
}
```

`tipo` deve ser `"boleto"` ou `"nf"`. Demais campos são opcionais (usados se o
portal Smart exigir contexto extra na navegação).

**Resposta OK (200):**
```json
{
  "success": true,
  "pdf_base64": "JVBERi0xLjQK...",
  "mime": "application/pdf",
  "bytes": 87234,
  "fetched_at": "2026-06-01T12:34:56.789Z"
}
```

**Resposta de erro (4xx/5xx):**
```json
{
  "success": false,
  "error_code": "TITULO_NAO_ENCONTRADO",
  "message": "Título 12345 não encontrado no portal"
}
```

Códigos possíveis:

| Código | HTTP | Significado |
|---|---|---|
| `BAD_REQUEST` | 400 | Payload inválido |
| `UNAUTHORIZED` | 401 | Bearer token ausente/errado |
| `TITULO_NAO_ENCONTRADO` | 404 | Portal não tem esse título |
| `LOGIN_FAILED` | 502 | Sessão Smart expirou/falhou |
| `PORTAL_OFFLINE` | 502 | Portal Smart indisponível |
| `PDF_INVALID` | 502 | Resposta não é PDF |
| `TIMEOUT` | 504 | Scrape ultrapassou `SCRAPE_TIMEOUT_MS` |
| `INTERNAL_ERROR` | 500 | Erro inesperado |

---

## Desenvolvimento local

```bash
cp .env.example .env
# preencha SMART_PORTAL_USER, SMART_PORTAL_PASS e WORKER_TOKEN

npm install
npm run playwright:install   # baixa chromium + dependências do SO
npm run dev                   # tsx watch, log pretty-printed
```

Teste o endpoint:
```bash
curl -X POST http://localhost:4000/scrape \
  -H "Authorization: Bearer <seu WORKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "titulo_id": "12345", "tipo": "boleto" }'
```

Para debugar visualmente, rode com `HEADLESS=false` no `.env`.

---

## Deploy em VPS Ubuntu 22.04

### 1. Pré-requisitos do SO

```bash
sudo apt update && sudo apt install -y curl ca-certificates git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Clonar e instalar

```bash
sudo mkdir -p /opt/scraper && sudo chown $USER /opt/scraper
cd /opt/scraper
git clone <URL_DESTE_REPO> .
# Se você só está clonando este subdiretório, ajuste conforme estrutura.
npm ci
npm run playwright:install    # instala chromium e libs do SO (~300MB)
npm run build
```

### 3. Configurar `.env`

```bash
cp .env.example .env
# Edite com vim/nano. NÃO commite o .env preenchido.
chmod 600 .env
```

### 4. Subir com PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup     # gera comando systemd; rode o que o pm2 imprimir
pm2 install pm2-logrotate    # rotação automática de logs
```

Logs: `pm2 logs smart-scraper-worker --lines 200`

### 5. Nginx + HTTPS

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/scraper.conf
sudo vim /etc/nginx/sites-available/scraper.conf
# ajuste server_name pro seu domínio

sudo ln -s /etc/nginx/sites-available/scraper.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d scraper.goldcreditcapital.com.br
```

### 6. (Recomendado) Firewall + allowlist

Apenas a Supabase fala com o worker. Limite o acesso à VPS:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                    # ssh
sudo ufw allow 80/tcp                    # http (certbot renewal)
sudo ufw allow 443/tcp                   # https
sudo ufw enable
```

E, se possível, no `nginx.conf` libere IP só do range de saída do Supabase
(descomente o bloco `allow/deny` no exemplo).

---

## Manutenção

### Quando o portal Smart mudar de layout

O scraping vai quebrar. Existem **4 pontos de manutenção** no código,
todos comentados com `PONTO DE MANUTENÇÃO #N`:

1. `src/session.ts` — seletores do formulário de login
2. `src/scraper.ts` — fluxo de download de boleto
3. `src/scraper.ts` — fluxo de download de NF
4. `src/scraper.ts` — URL pattern da página de título

Para descobrir os seletores novos:

```bash
# numa máquina com display (não na VPS)
npm install
HEADLESS=false npx playwright codegen https://www.smartsecurities.com.br
```

O `codegen` grava cada clique como código Playwright. Cole o relevante nos
4 pontos acima.

### Quando a Smart liberar boleto/NF na API v2 oficial

1. No Supabase, altere `cobranca_settings.smart_pdf_source` de `'scraper'`
   para `'official'`.
2. A edge function `smart-scraper` passa a chamar a edge `smart-api` (que já
   tem ação `boleto-pdf`/`nf-pdf` em stub) — basta implementar a chamada real
   à API oficial lá.
3. Pode desligar o worker (`pm2 stop smart-scraper-worker`). Deixa o código
   no repo por garantia (rollback rápido).

### 2FA no portal

Se a Smart ativar 2FA, o login vai quebrar silenciosamente. O worker já
retorna `LOGIN_FAILED` nesse caso. Para suportar TOTP futuro, adicione um
campo `SMART_PORTAL_TOTP_SECRET` no `.env` e use `speakeasy` para gerar o
código no método `performLogin` de `session.ts`.

### Teste de carga

Antes de ir pra produção, valide vazamento de memória:

```bash
# 50 PDFs sequenciais, dois por vez
for i in $(seq 1 50); do
  curl -s -X POST http://localhost:4000/scrape \
    -H "Authorization: Bearer $WORKER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{ \"titulo_id\": \"$i\", \"tipo\": \"boleto\" }" > /dev/null &
  [ $((i % 2)) -eq 0 ] && wait
done
wait
pm2 logs smart-scraper-worker --lines 5
# Verifique no `pm2 monit` que RSS estabiliza, não cresce indefinidamente.
```

---

## Segurança

- ✅ Bearer token de 32+ chars em `Authorization` (comparação constant-time)
- ✅ Credenciais do portal em `.env` chmod 600, fora do git
- ✅ `pino` redacta `Authorization`, cookies e PDFs base64 nos logs
- ✅ HTTPS obrigatório via Nginx
- ✅ Nada de service_role do Supabase aqui — worker não fala com DB
- ⚠️ Se a VPS for comprometida, atacante tem acesso ao usuário/senha do portal
  Smart. Usar conta dedicada ao robô, com permissão mínima possível.

---

## Estrutura

```
src/
  index.ts       Express bootstrap, rotas
  auth.ts        Bearer token middleware
  config.ts      Parse e validação de .env (zod)
  logger.ts      Pino com redaction
  validator.ts   Magic bytes / sanity check de PDF
  session.ts     Lifecycle do browser + sessão Smart
  scraper.ts     Lógica de navegação e download
  queue.ts       p-queue + dedup in-flight
```
