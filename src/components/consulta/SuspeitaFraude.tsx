import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateBR } from '@/lib/utils';

interface SuspeitaFraudeItem {
  id: number;
  sacado: string | null;
  cpf_cnpj_sacado: string | null;
  numero_documento: string | null;
  valor: number | null;
  vencimento: string | null;
  data_quitacao: string | null;
  criticas: string | null;
  banco_cobrador: string | null;
  agencia_cobradora: string | null;
  praca_pagamento: string | null;
  localidade_sacado: string | null;
}

interface SuspeitaFraudeProps {
  suspeitasFraude: SuspeitaFraudeItem[];
}

const ITEMS_PER_PAGE = 5;

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(date: string | null) {
  return formatDateBR(date, '-');
}

export function SuspeitaFraude({ suspeitasFraude }: SuspeitaFraudeProps) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!suspeitasFraude || suspeitasFraude.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <ShieldAlert className="h-5 w-5" />
            Suspeita de Fraude
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-600 dark:text-green-400 text-sm">
            Nenhum título com suspeita de fraude encontrado para este cedente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalValor = suspeitasFraude.reduce((acc, item) => acc + (item.valor || 0), 0);
  const totalPages = Math.ceil(suspeitasFraude.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = suspeitasFraude.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Suspeita de Fraude
          </div>
          <Badge variant="destructive" className="text-sm">
            {suspeitasFraude.length} {suspeitasFraude.length === 1 ? 'título' : 'títulos'} • {formatCurrency(totalValor)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-red-200 dark:border-red-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-red-100/50 dark:bg-red-900/30">
                <TableHead className="text-red-700 dark:text-red-400">Sacado</TableHead>
                <TableHead className="text-red-700 dark:text-red-400">Documento</TableHead>
                <TableHead className="text-red-700 dark:text-red-400 text-right">Valor</TableHead>
                <TableHead className="text-red-700 dark:text-red-400">Vencimento</TableHead>
                <TableHead className="text-red-700 dark:text-red-400">Quitação</TableHead>
                <TableHead className="text-red-700 dark:text-red-400">Críticas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-red-100/30 dark:hover:bg-red-900/20">
                  <TableCell>
                    <div>
                      <div className="font-medium text-foreground truncate max-w-[200px]" title={item.sacado || '-'}>
                        {item.sacado || '-'}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.cpf_cnpj_sacado || '-'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.numero_documento || '-'}</TableCell>
                  <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(item.valor)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(item.vencimento)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(item.data_quitacao)}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate text-sm text-red-600 dark:text-red-400" title={item.criticas || '-'}>
                      {item.criticas || '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, suspeitasFraude.length)} de {suspeitasFraude.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
