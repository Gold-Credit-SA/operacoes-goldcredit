import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import { DtbEntry } from './scr-types';
import { formatCnpj, getRaizDocumento, formatDate, formatCurrency } from './scr-utils';

interface SCRHeaderProps {
  cdCli: string;
  dtbConsult: string;
  entityName: string;
  latestDtb: DtbEntry;
  totalOperacoes: number;
  riskClassification?: string;
}

export function SCRHeader({ cdCli, dtbConsult, entityName, latestDtb, totalOperacoes, riskClassification }: SCRHeaderProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          SCR - Sistema de Informações de Crédito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entityName && (
          <p className="text-lg font-bold text-foreground">{entityName}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">CPF/CNPJ:</span>
            <p className="font-mono font-medium">{formatCnpj(cdCli)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Raiz do documento:</span>
            <p className="font-mono font-medium">{getRaizDocumento(cdCli)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Período consultado:</span>
            <p className="font-medium">{dtbConsult}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Início do relacionamento:</span>
            <p className="font-medium">{formatDate(latestDtb.dtbIniRel)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Total de operações:</span>
            <p className="font-medium">{totalOperacoes}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Total de instituições:</span>
            <p className="font-medium">{latestDtb.qtdIfs}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Op. em discordância:</span>
            <p className="font-medium">{latestDtb.coobAss}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Op. sub judice:</span>
            <p className="font-medium">{latestDtb.coobRec}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Risco direto:</span>
            <p className="font-medium">{formatCurrency(0)}</p>
          </div>
          {riskClassification && (
            <div>
              <span className="text-muted-foreground">Classificação de risco:</span>
              <p className="font-medium">
                <Badge variant="outline" className="text-xs">{riskClassification}</Badge>
              </p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Doc. processados:</span>
            <p className="font-medium">{latestDtb.docProc}%</p>
          </div>
          <div>
            <span className="text-muted-foreground">Vol. processado:</span>
            <p className="font-medium">{latestDtb.volProc}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
