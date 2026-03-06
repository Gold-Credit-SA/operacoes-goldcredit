

## Plano: PDF SCR idêntico ao modal — captura direta do DOM

### Problema
O PDF atual renderiza os componentes em um container off-screen, mas o `html2canvas` não captura corretamente os estilos Tailwind CSS (variáveis CSS, bordas de cards, cores, fontes). O resultado fica sem formatação.

### Solução
Mudar a abordagem: em vez de re-renderizar componentes em um container oculto, **capturar diretamente o conteúdo do modal já renderizado na tela**. Isso garante que o PDF seja pixel-perfect com o que o usuário vê.

### Mudanças

**1. `SCRDetailView.tsx` — adicionar ref ao container do conteúdo**
- Envolver todo o conteúdo (exceto o botão de PDF) em um `div` com `ref`
- Passar esse `ref` para o `SCRPdfExport` via prop

**2. `SCRPdfExport.tsx` — capturar o DOM real em vez de re-renderizar**
- Receber `contentRef: React.RefObject<HTMLDivElement>` como prop
- No `generatePdf`, usar `html2canvas(contentRef.current)` diretamente sobre o conteúdo já visível na tela
- Remover toda a lógica de `createRoot`, container off-screen e render de componentes React
- Manter a lógica de multi-page slicing (já funciona bem)
- Adicionar cabeçalho "Gerado em: ..." como texto no jsPDF antes do conteúdo capturado
- Configurar `html2canvas` com `scrollY: -window.scrollY` para capturar corretamente mesmo com scroll

### Resultado
- O PDF será uma cópia exata do modal, com todos os estilos, gráficos e tabelas
- Código mais simples (sem re-renderização de componentes)
- Sem dependência de timing para esperar animações do Recharts (já renderizados)

### Arquivos a editar
- `src/components/analise-operacao/SCRDetailView.tsx`
- `src/components/analise-operacao/scr/SCRPdfExport.tsx`

