import { Cake, Plus, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Aniversariante {
  cpf_cnpj: string;
  nome: string;
  data_nascimento: string;
}

interface AniversariantesCardProps {
  aniversariantes: Aniversariante[];
  onAddBirthday: () => void;
  loading?: boolean;
}

export function AniversariantesCard({ aniversariantes, onAddBirthday, loading }: AniversariantesCardProps) {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cake className="h-5 w-5 text-amber-500" />
            Aniversariantes do Dia
            {aniversariantes.length > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {aniversariantes.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAddBirthday} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Cadastrar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : aniversariantes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum aniversariante hoje
          </p>
        ) : (
          <div className="space-y-2">
            {aniversariantes.map((a) => (
              <div
                key={a.cpf_cnpj}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900"
              >
                <div className="flex items-center gap-3">
                  <PartyPopper className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.cpf_cnpj}</p>
                  </div>
                </div>
                <span className="text-lg">🎂</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
