import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SqlUpload } from '@/components/SqlUpload';
import { CsvImport } from '@/components/CsvImport';
import { SearchInput } from '@/components/SearchInput';
import { CedentesTable } from '@/components/CedentesTable';
import { getCedentes } from '@/lib/api';
import { Cedente } from '@/types/cedente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertCircle, FolderOpen } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Index() {
  const [cedentes, setCedentes] = useState<Cedente[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCedentes = useCallback(async (searchTerm?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getCedentes(searchTerm);
      if (result.success && result.data) {
        setCedentes(result.data);
      } else {
        setError(result.error || 'Erro ao carregar cedentes');
        setCedentes([]);
      }
    } catch (err) {
      setError('Erro ao carregar cedentes.');
      setCedentes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCedentes();
  }, [fetchCedentes]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCedentes(search);
    }, 300);

    return () => clearTimeout(debounce);
  }, [search, fetchCedentes]);

  const handleUploadSuccess = () => {
    fetchCedentes(search);
  };

  return (
    <MainLayout title="Importação" subtitle="Importe arquivos CSV ou SQL para o sistema">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Upload Section */}
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-card border border-border">
              <TabsTrigger value="csv" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">CSV</TabsTrigger>
              <TabsTrigger value="sql" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">SQL</TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="mt-4">
              <CsvImport onImportSuccess={handleUploadSuccess} />
            </TabsContent>
            <TabsContent value="sql" className="mt-4">
              <SqlUpload onUploadSuccess={handleUploadSuccess} />
            </TabsContent>
          </Tabs>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-base font-semibold">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  Cedentes
                  {cedentes.length > 0 && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {cedentes.length}
                    </span>
                  )}
                </CardTitle>
              </div>
              <div className="mt-4">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar cedentes..."
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && (
                <Alert variant="destructive" className="m-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <CedentesTable cedentes={cedentes} isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
