import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { CedenteDetail } from '@/components/CedenteDetail';
import { getCedenteById } from '@/lib/api';
import { Cedente } from '@/types/cedente';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CedenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cedente, setCedente] = useState<Cedente | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCedente() {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        const result = await getCedenteById(parseInt(id, 10));
        if (result.success && result.data) {
          setCedente(result.data);
        } else {
          setError(result.error || 'Cedente não encontrado');
        }
      } catch (err) {
        setError('Erro de conexão. Verifique se o servidor backend está rodando.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCedente();
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container-app py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para lista
        </Button>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {cedente && (
          <div className="animate-fade-in">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                {cedente.cnpj ? (
                  <Building2 className="h-7 w-7 text-primary" />
                ) : (
                  <User className="h-7 w-7 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {cedente.razao_social || cedente.nome || `Cedente #${cedente.id}`}
                </h1>
                {(cedente.cnpj || cedente.cpf) && (
                  <p className="font-mono text-muted-foreground">
                    {cedente.cnpj || cedente.cpf}
                  </p>
                )}
              </div>
              {cedente.status && (
                <span className={`ml-auto rounded-full px-3 py-1 text-sm font-medium ${
                  cedente.status.toLowerCase() === 'ativo'
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {cedente.status}
                </span>
              )}
            </div>

            <CedenteDetail cedente={cedente} />
          </div>
        )}
      </main>
    </div>
  );
}
