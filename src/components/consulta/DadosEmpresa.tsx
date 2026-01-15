import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, MapPin, User, Calendar } from 'lucide-react';

interface DadosEmpresaProps {
  cedente: {
    nome: string | null;
    cpf_cnpj: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    email: string | null;
    telefone: string | null;
    gerente: string | null;
    operador: string | null;
    bloqueado: string | null;
    setor: string | null;
  };
  resumo: {
    primeiraOperacao: string | null;
    ultimaOperacao: string | null;
    totalOperacoes: number;
  };
}

const formatDate = (date: string | null) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

export function DadosEmpresa({ cedente, resumo }: DadosEmpresaProps) {
  const isBlocked = cedente.bloqueado === 'S';

  return (
    <Card className="border-t-4 border-t-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Informações da Empresa
          </CardTitle>
          <Badge variant={isBlocked ? 'destructive' : 'default'} className="text-xs">
            {isBlocked ? 'BLOQUEADO' : 'ATIVO'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Dados Básicos */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {cedente.nome || 'Nome não informado'}
              </h3>
              <p className="text-sm font-mono text-muted-foreground">
                {cedente.cpf_cnpj || 'CPF/CNPJ não informado'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {cedente.endereco && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{cedente.endereco}</p>
                    <p className="text-sm text-muted-foreground">
                      {[cedente.cidade, cedente.uf].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                </div>
              )}

              {cedente.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{cedente.email}</span>
                </div>
              )}

              {cedente.telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{cedente.telefone}</span>
                </div>
              )}

              {cedente.setor && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{cedente.setor}</span>
                </div>
              )}
            </div>
          </div>

          {/* Informações de Relacionamento */}
          <div className="space-y-3 border-l border-border pl-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente desde</p>
                <p className="text-sm font-semibold">{formatDate(resumo.primeiraOperacao)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Última operação</p>
                <p className="text-sm font-semibold">{formatDate(resumo.ultimaOperacao)}</p>
              </div>
            </div>

            {cedente.gerente && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Gerente</p>
                  <p className="text-sm font-semibold">{cedente.gerente}</p>
                </div>
              </div>
            )}

            {cedente.operador && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Operador</p>
                  <p className="text-sm font-semibold">{cedente.operador}</p>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Total de operações</p>
              <p className="text-lg font-bold text-primary">{resumo.totalOperacoes}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
