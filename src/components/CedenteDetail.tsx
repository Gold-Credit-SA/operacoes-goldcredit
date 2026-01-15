import { Cedente } from '@/types/cedente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, User, Mail, Phone, MapPin, Landmark, Calendar } from 'lucide-react';

interface CedenteDetailProps {
  cedente: Cedente;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    id: 'ID',
    nome: 'Nome',
    razao_social: 'Razão Social',
    cnpj: 'CNPJ',
    cpf: 'CPF',
    email: 'E-mail',
    telefone: 'Telefone',
    endereco: 'Endereço',
    cidade: 'Cidade',
    estado: 'Estado',
    cep: 'CEP',
    banco: 'Banco',
    agencia: 'Agência',
    conta: 'Conta',
    status: 'Status',
    data_cadastro: 'Data de Cadastro',
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
  };
  
  return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getIcon(key: string) {
  if (key.includes('email')) return <Mail className="h-4 w-4" />;
  if (key.includes('telefone') || key.includes('phone')) return <Phone className="h-4 w-4" />;
  if (key.includes('endereco') || key.includes('cidade') || key.includes('cep')) return <MapPin className="h-4 w-4" />;
  if (key.includes('banco') || key.includes('agencia') || key.includes('conta')) return <Landmark className="h-4 w-4" />;
  if (key.includes('data') || key.includes('created') || key.includes('updated')) return <Calendar className="h-4 w-4" />;
  if (key.includes('cnpj') || key.includes('razao')) return <Building2 className="h-4 w-4" />;
  return <User className="h-4 w-4" />;
}

export function CedenteDetail({ cedente }: CedenteDetailProps) {
  const entries = Object.entries(cedente).filter(([key]) => key !== 'id');

  // Group fields by category
  const basicFields = ['nome', 'razao_social', 'cnpj', 'cpf', 'status'];
  const contactFields = ['email', 'telefone', 'phone'];
  const addressFields = ['endereco', 'cidade', 'estado', 'cep'];
  const bankFields = ['banco', 'agencia', 'conta'];
  
  const categorize = (key: string) => {
    if (basicFields.some(f => key.includes(f))) return 'basic';
    if (contactFields.some(f => key.includes(f))) return 'contact';
    if (addressFields.some(f => key.includes(f))) return 'address';
    if (bankFields.some(f => key.includes(f))) return 'bank';
    return 'other';
  };

  const groupedEntries = entries.reduce((acc, [key, value]) => {
    const category = categorize(key);
    if (!acc[category]) acc[category] = [];
    acc[category].push([key, value]);
    return acc;
  }, {} as Record<string, [string, unknown][]>);

  const categoryTitles: Record<string, string> = {
    basic: 'Informações Básicas',
    contact: 'Contato',
    address: 'Endereço',
    bank: 'Dados Bancários',
    other: 'Outras Informações',
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Object.entries(groupedEntries).map(([category, fields]) => (
        <Card key={category} className="animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              {categoryTitles[category]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map(([key, value]) => (
              <div key={key} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {getIcon(key)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatLabel(key)}
                  </p>
                  <p className="mt-0.5 break-words font-medium text-foreground">
                    {formatValue(value)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
