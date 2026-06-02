# Deploy do Smart Scraper Worker numa VPS Hostinger

Guia passo a passo, do zero, pra rodar o worker numa VPS da Hostinger.
**Diferente do `README.md` genérico** — aqui foca em onde clicar no painel
da Hostinger (hPanel), o que escolher e o que ignorar.

> Tempo total estimado: **40 minutos** se você nunca fez antes.

---

## 0) Antes de começar — o que ter em mãos

- [ ] Credenciais da conta robô no portal Smart (`SMART_PORTAL_USER` + `SMART_PORTAL_PASS`)
- [ ] O `WORKER_TOKEN` (gerado pelo Claude na sessão de setup, mesmo valor
      que será cadastrado como `SMART_SCRAPER_TOKEN` na Supabase via Lovable)
- [ ] Um subdomínio livre (ex: `scraper.goldcreditcapital.com.br`).
      Se o domínio principal é gerenciado pela Hostinger, o DNS já está lá.
      Caso contrário, você ajusta no painel do seu registrar (Registro.br,
      Cloudflare, etc).

---

## 1) Comprar o VPS na Hostinger

1. Acesse [hostinger.com.br](https://www.hostinger.com.br) → **VPS Hosting**
2. Escolha um plano com **no mínimo 4 GB RAM** (Playwright + chromium pesa).
   Recomendação: **KVM 2** ou superior (8 GB RAM).
   - Plano com 1 GB RAM **não funciona** — chromium é morto por OOM Killer.
3. **Localização do servidor**: Brasil (São Paulo) se disponível, senão
   Miami. Importa pra latência da Supabase (que está em us-east/us-west).
4. **Sistema operacional**: escolha `Ubuntu 22.04 LTS` (NÃO use Ubuntu 24,
   alguns pacotes do Playwright ainda quebram nele).
5. **Hostname**: `scraper` (ou nome de sua preferência)
6. **Chave SSH (RECOMENDADO)**: cole sua chave pública SSH agora.
   Se não tiver, pule e use senha root (Hostinger envia por e-mail).

Após criar, anote o **IP público IPv4** que aparece no hPanel
(em `VPS → seu VPS → Detalhes`).

---

## 2) Liberar portas no firewall da Hostinger

A Hostinger tem um firewall próprio **além** do firewall do Ubuntu.
Se não liberar, vai parecer que a VPS está offline.

1. hPanel → **VPS** → seu VPS → **Segurança** → **Firewall**
2. Garanta que estas portas estão liberadas para `0.0.0.0/0`:

| Porta | Protocolo | Pra quê |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (Let's Encrypt usa) |
| 443 | TCP | HTTPS (tráfego da edge function chega aqui) |

Se você sabe o range de saída da Supabase Cloud, troque o `0.0.0.0/0` da
porta 443 pelo range deles. Aumenta segurança. Range em:
[supabase.com/docs/guides/platform/network-restrictions](https://supabase.com/docs/guides/platform/network-restrictions)

---

## 3) Configurar DNS

### Se o domínio é gerenciado pela Hostinger

1. hPanel → **Domínios** → seu domínio → **Editor de zona DNS**
2. Adicione um registro:

| Tipo | Nome | Conteúdo | TTL |
|---|---|---|---|
| A | `scraper` | `<IP da VPS>` | 3600 |

3. Aguarde ~5 min pra propagar. Teste com:
   ```bash
   dig scraper.goldcreditcapital.com.br +short
   ```
   Deve retornar o IP da VPS.

### Se o domínio é gerenciado em outro lugar

Crie o registro `A` apontando `scraper.seu-dominio.com.br` para o IP da VPS
no painel do seu registrar (Registro.br, Cloudflare, etc).

---

## 4) Acessar a VPS via SSH

```bash
ssh root@<IP da VPS>
# se setou chave SSH, conecta direto
# se setou senha, vai pedir a senha (no e-mail da Hostinger)
```

Primeira coisa: atualizar o sistema.

```bash
apt update && apt upgrade -y
```

(opcional) criar usuário não-root pra rodar o worker:

```bash
adduser scraper
usermod -aG sudo scraper
mkdir -p /home/scraper/.ssh
cp ~/.ssh/authorized_keys /home/scraper/.ssh/
chown -R scraper:scraper /home/scraper/.ssh
chmod 700 /home/scraper/.ssh
chmod 600 /home/scraper/.ssh/authorized_keys
# Loga como scraper a partir daqui: ssh scraper@<IP>
```

> Os próximos passos assumem que você está como `root` ou usando `sudo`.

---

## 5) Instalar Node 20, Nginx, Certbot, PM2

Tudo numa linha:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git
npm install -g pm2
```

Confira:
```bash
node --version    # v20.x
npm --version
nginx -v
pm2 --version
```

---

## 6) Clonar o repositório e instalar o worker

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/Gold-Credit-SA/operacoes-goldcredit.git
cd operacoes-goldcredit/scraping/worker

npm ci
npm run playwright:install    # baixa chromium + deps do SO (~300 MB)
npm run build                 # compila TS pra dist/
```

Se `playwright:install` reclamar de falta de pacote, rode:
```bash
npx playwright install-deps chromium
```

---

## 7) Configurar o `.env` do worker

```bash
cp .env.example .env
nano .env
```

Preencha **apenas estas linhas** (deixa o resto como default):

```
WORKER_TOKEN=<o token gerado pelo Claude>
SMART_PORTAL_USER=robo@goldcreditsa.com.br
SMART_PORTAL_PASS=<senha da conta robô>
```

Salve (`Ctrl+O`, Enter, `Ctrl+X`) e **proteja o arquivo**:

```bash
chmod 600 .env
```

---

## 8) Subir o worker com PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup       # imprime um comando — copie e rode ele
pm2 install pm2-logrotate    # rotação automática de logs
```

Confira:
```bash
pm2 status
pm2 logs smart-scraper-worker --lines 30
```

Você deve ver linhas tipo:
```
smart-scraper-worker listening { port: 4000, env: 'production', ... }
launching chromium
session ready                  ← se aparece esse, login no Smart funcionou
initial smart portal login OK
```

Se aparecer `initial portal login failed`:
- A senha do Smart pode estar errada
- Ou os **seletores do form de login** (`session.ts`) precisam ser ajustados
  pro HTML real do portal — ver seção "Quando o portal mudar" no `README.md`.

---

## 9) Configurar o Nginx + HTTPS

```bash
cp /opt/operacoes-goldcredit/scraping/worker/nginx.conf.example /etc/nginx/sites-available/scraper.conf
nano /etc/nginx/sites-available/scraper.conf
# substitua `scraper.goldcreditcapital.com.br` pelo seu subdomínio real
```

Ative e teste:
```bash
ln -s /etc/nginx/sites-available/scraper.conf /etc/nginx/sites-enabled/
nginx -t           # deve dizer "syntax is ok" e "test is successful"
systemctl reload nginx
```

Gere o certificado HTTPS:
```bash
certbot --nginx -d scraper.goldcreditcapital.com.br
# Aceita os termos, coloca seu e-mail.
# Aceita a opção de redirecionar HTTP → HTTPS (escolha 2).
```

Teste se está respondendo:
```bash
curl -i https://scraper.goldcreditcapital.com.br/health
# Esperado: HTTP/2 200 + JSON com queue stats
```

Se retornar 502 → o worker não está rodando (cheque `pm2 status`).
Se conexão expira → firewall da Hostinger não liberou 443 (passo 2).

---

## 10) Apontar a Supabase pro worker

No painel **Lovable** → Project Settings → Secrets, **atualize** o secret:

```
SMART_SCRAPER_URL = https://scraper.goldcreditcapital.com.br
```

(antes você tinha cadastrado um placeholder, agora coloca a URL real).

Teste end-to-end invocando a edge function:

```bash
# do seu computador local (com o anon key da Supabase)
curl -X POST https://cwjrkygliokjseprelax.supabase.co/functions/v1/smart-scraper \
  -H "Authorization: Bearer <JWT de um usuário logado>" \
  -H "Content-Type: application/json" \
  -d '{ "titulo_id": "123", "tipo": "boleto" }'
```

Resposta esperada (se o título existe no Smart):
```json
{ "success": true, "signed_url": "https://...", "expires_at": "...", "from_cache": false }
```

---

## 11) Snapshot pra rollback rápido

Antes de mexer em produção real, tire um snapshot:

1. hPanel → **VPS** → seu VPS → **Snapshots** → **Criar snapshot**
2. Nome: `scraper-pronto-inicial`

Se algo quebrar depois, em 5 min você restaura.

---

## 12) Monitoramento básico

A Hostinger já mostra CPU/RAM/disco no hPanel. Pra alertar quando o worker
cair:

- **Uptime Robot** (free): cria monitor HTTP em `https://scraper.../health`,
  intervalo 5 min, alerta por e-mail/Telegram.
- `pm2 monit` na VPS via SSH pra ver tudo ao vivo.

---

## Atalhos úteis (decorar)

```bash
# ver status do worker
pm2 status

# ver logs ao vivo
pm2 logs smart-scraper-worker

# restart sem downtime
pm2 reload smart-scraper-worker

# atualizar código (depois de push novo no GitHub)
cd /opt/operacoes-goldcredit
git pull
cd scraping/worker
npm ci && npm run build
pm2 reload smart-scraper-worker

# checar saúde
curl -s http://localhost:4000/health | jq

# ver consumo de RAM/CPU
pm2 monit
```

---

## Problemas comuns

| Sintoma | Causa provável | Resolução |
|---|---|---|
| `pm2 logs` mostra `Error: ENOMEM` | RAM insuficiente | Upgrade do plano Hostinger pra 4 GB+ |
| `LOGIN_FAILED` no primeiro scrape | Senha errada OU seletores do portal mudaram | Cheque senha; rode `playwright codegen` local pra capturar seletores novos |
| `502 Bad Gateway` no `/scrape` | Worker caiu | `pm2 restart smart-scraper-worker`, depois `pm2 logs` pra ver causa |
| Certbot falha com "challenge timed out" | DNS ainda não propagou OU porta 80 bloqueada | `dig +short scraper.dominio.com.br` e cheque firewall da Hostinger |
| `503 WORKER_NOT_CONFIGURED` na edge | Faltou `SMART_SCRAPER_URL` ou `SMART_SCRAPER_TOKEN` nos secrets | Cadastrar/atualizar no painel Lovable |
| `signed_url` retorna 404 | Bucket `smart-anexos` não foi criado | Confirmar que migration rodou (`smart_anexos_cache` table existe) |

---

## Custo estimado mensal

| Item | Custo |
|---|---|
| VPS Hostinger KVM 2 (8 GB RAM) | ~R$ 85/mês |
| Domínio (se ainda não tem) | ~R$ 50/ano = R$ 4/mês |
| Certificado SSL Let's Encrypt | grátis |
| Uptime Robot (free) | grátis |
| **Total** | **~R$ 90/mês** |
