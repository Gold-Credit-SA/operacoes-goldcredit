import { FileText, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { NotaFiscalXml } from '@/lib/xml-nfe-parser';

interface Props {
  notas: (NotaFiscalXml & { fileName: string })[];
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NotasImportadas({ notas }: Props) {
  const totalValor = notas.reduce((sum, n) => sum + n.valor, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {notas.length} nota{notas.length !== 1 ? 's' : ''} importada{notas.length !== 1 ? 's' : ''}
          </h3>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          Total: {formatCurrency(totalValor)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {notas.map((n, i) => (
          <div key={i} className="flex items-start gap-2.5 p-3 bg-muted/50 rounded-lg border border-border">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{n.fileName}</p>
              <p className="text-xs text-muted-foreground">
                NF {n.numero}{n.serie ? `/${n.serie}` : ''} · {formatCurrency(n.valor)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Sacado: {n.sacado.nome}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
