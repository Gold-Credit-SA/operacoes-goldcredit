import { useNavigate } from 'react-router-dom';
import { Eye, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Cedente } from '@/types/cedente';

interface CedentesTableProps {
  cedentes: Cedente[];
  isLoading: boolean;
}

function formatCnpjCpf(value: string | undefined): string {
  if (!value) return '-';
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 14) {
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  } else if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value;
}

export function CedentesTable({ cedentes, isLoading }: CedentesTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (cedentes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium text-foreground">Nenhum cedente encontrado</h3>
        <p className="text-muted-foreground">
          Importe um arquivo SQL para visualizar os cedentes
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-16">ID</TableHead>
            <TableHead>Nome / Razão Social</TableHead>
            <TableHead>CNPJ / CPF</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20 text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cedentes.map((cedente) => (
            <TableRow
              key={cedente.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(`/cedente/${cedente.id}`)}
            >
              <TableCell className="font-mono text-sm">{cedente.id}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {cedente.cnpj ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    {cedente.razao_social || cedente.nome || '-'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {formatCnpjCpf(cedente.cnpj || cedente.cpf)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {cedente.email || '-'}
              </TableCell>
              <TableCell className="text-sm">
                {cedente.cidade ? `${cedente.cidade}${cedente.estado ? `, ${cedente.estado}` : ''}` : '-'}
              </TableCell>
              <TableCell>
                {cedente.status && (
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    cedente.status.toLowerCase() === 'ativo' 
                      ? 'bg-success/10 text-success' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {cedente.status}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/cedente/${cedente.id}`);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
