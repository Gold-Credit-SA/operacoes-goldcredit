
# Dashboard do Gestor - Aniversariantes, Saldo Trustee e Cheques Devolvidos

## Visao Geral

Criar uma nova tela "Painel do Gestor" acessivel pela sidebar, exibindo tres paineis principais com informacoes da carteira do gestor logado:

1. **Aniversariantes do Dia** - cedentes que fazem aniversario hoje
2. **Saldo Trustee** - saldo de titulos trustee (tipo != 'C') por cedente
3. **Cheques Devolvidos** - cheques devolvidos dos cedentes da carteira

---

## 1. Aniversariantes do Dia

### Problema
A tabela `smartsecurities_cedentes` no banco externo **nao possui** campo de data de nascimento. Apenas `data_cadastro` e `primeira_operacao` estao disponiveis.

### Solucao
Criar uma tabela local `cedente_birthdays` onde gestores podem registrar manualmente a data de nascimento dos cedentes. A tela exibira os aniversariantes do dia automaticamente.

### Tabela `cedente_birthdays`
- `id` (uuid, PK)
- `cedente_cpf_cnpj` (text, unique) - vinculo com o cedente externo
- `cedente_nome` (text) - nome para exibicao
- `data_nascimento` (date) - data de nascimento
- `created_by` (uuid) - quem cadastrou
- `created_at` (timestamptz)

### RLS
- Qualquer usuario autenticado pode ler (para ver aniversariantes)
- Qualquer usuario autenticado pode inserir/atualizar/deletar

---

## 2. Saldo Trustee por Cedente

Consulta ao banco externo filtrando titulos em aberto onde `tipo != 'C'` (titulos trustee), agrupando por cedente e somando o valor. Apenas cedentes da carteira do gestor logado.

---

## 3. Cheques Devolvidos

Consulta ao banco externo buscando titulos em aberto onde o tipo contem 'CHQ' ou 'CHEQUE' e o motivo contem 'DEV' ou 'DEVOLV', agrupados por cedente. Apenas cedentes da carteira do gestor.

---

## Alteracoes Tecnicas

### Backend - Nova action na edge function `portfolio-data`

Adicionar action `gestor-dashboard` que retorna os tres conjuntos de dados em uma unica chamada:

```text
Request: { action: 'gestor-dashboard' }

Response: {
  aniversariantes: [{ cpf_cnpj, nome, data_nascimento }],
  saldoTrustee: [{ cpf_cnpj, nome, saldo_trustee }],
  chequesDevolvidos: [{ cpf_cnpj, nome, qtd_cheques, valor_total }]
}
```

A funcao:
1. Busca os cedentes aprovados da carteira do gestor
2. Consulta `cedente_birthdays` filtrando por dia/mes = hoje
3. Consulta o banco externo para saldo trustee (titulos em aberto tipo != 'C')
4. Consulta o banco externo para cheques devolvidos (tipo LIKE '%CHQ%' e motivo LIKE '%DEV%')

### Frontend - Nova pagina `src/pages/GestorDashboard.tsx`

Layout com tres cards principais:

- **Card Aniversariantes**: Lista de aniversariantes do dia com icone de bolo, nome e botao de parabens (visual). Botao para cadastrar nova data de nascimento abrindo um dialog.
- **Card Saldo Trustee**: Tabela compacta com cedente, saldo trustee e indicador visual.
- **Card Cheques Devolvidos**: Tabela com cedente, quantidade de cheques devolvidos, valor total e indicador de severidade.

### Navegacao

Adicionar item "Painel" na sidebar (antes do dropdown "Carteira"), com icone `LayoutDashboard`, rota `/painel`.

### Novos arquivos
- `src/pages/GestorDashboard.tsx` - Pagina principal do painel
- `src/components/painel/AniversariantesCard.tsx` - Card de aniversariantes
- `src/components/painel/SaldoTrusteeCard.tsx` - Card de saldo trustee
- `src/components/painel/ChequesCard.tsx` - Card de cheques devolvidos
- `src/components/painel/CadastrarAniversarioDialog.tsx` - Dialog para cadastrar data de nascimento

### Arquivos modificados
- `supabase/functions/portfolio-data/index.ts` - Nova action `gestor-dashboard`
- `src/components/layout/AppSidebar.tsx` - Novo item de navegacao
- `src/App.tsx` - Nova rota `/painel`

### Migracao SQL
```sql
CREATE TABLE public.cedente_birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedente_cpf_cnpj text NOT NULL UNIQUE,
  cedente_nome text NOT NULL,
  data_nascimento date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cedente_birthdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read birthdays"
  ON public.cedente_birthdays FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert birthdays"
  ON public.cedente_birthdays FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update birthdays"
  ON public.cedente_birthdays FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete birthdays"
  ON public.cedente_birthdays FOR DELETE
  TO authenticated USING (auth.uid() = created_by);
```
