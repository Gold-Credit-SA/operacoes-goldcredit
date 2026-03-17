import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Send, X, Search, Loader2, Building2, Link2, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const TIPOS_DOCUMENTO = [
  { value: 'contrato-mae', label: 'Contrato Mãe', desc: 'Contrato de cedente com a securitizadora (início do relacionamento)' },
  { value: 'aditivo', label: 'Aditivo', desc: 'Resumo do que foi negociado, dados bancários e valor do deságio' },
  { value: 'carta-cessao', label: 'Carta de Cessão', desc: 'Formaliza a cessão do título para a Gold Credit' },
  { value: 'np', label: 'Nota Promissória (NP)', desc: 'Valor total da operação – cedente se responsabiliza pelo valor' },
  { value: 'duplicata', label: 'Duplicata', desc: 'Documento da negociação cedente × sacado (apenas para NF)' },
];

interface CedenteResult {
  nome: string;
  cpf_cnpj: string;
  cidade?: string;
  uf?: string;
}

export default function AssinaturaDigital() {
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [cedenteName, setCedenteName] = useState('');
  const [cedenteCnpj, setCedenteCnpj] = useState('');
  const [observacao, setObservacao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cedente search state
  const [cedenteSearch, setCedenteSearch] = useState('');
  const [cedenteResults, setCedenteResults] = useState<CedenteResult[]>([]);
  const [searchingCedente, setSearchingCedente] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cedenteSelected, setCedenteSelected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchCedentes = useCallback(async (term: string) => {
    if (term.length < 2) { setCedenteResults([]); return; }
    setSearchingCedente(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-data', {
        body: { action: 'search-cedentes', cedente_cpf_cnpj: term },
      });
      if (!error && data?.success && Array.isArray(data.cedentes)) {
        setCedenteResults(data.cedentes.map((r: any) => ({
          nome: r.nome || '',
          cpf_cnpj: r.cpf_cnpj || '',
          cidade: r.cidade || '',
          uf: r.uf || '',
        })));
      } else {
        setCedenteResults([]);
      }
    } catch {
      setCedenteResults([]);
    } finally {
      setSearchingCedente(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setCedenteSearch(value);
    setCedenteSelected(false);
    setShowDropdown(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCedentes(value), 400);
  };

  const handleSelectCedente = (c: CedenteResult) => {
    setCedenteName(c.nome);
    setCedenteCnpj(c.cpf_cnpj);
    setCedenteSearch(c.nome);
    setCedenteSelected(true);
    setShowDropdown(false);
  };

  const handleClearCedente = () => {
    setCedenteName('');
    setCedenteCnpj('');
    setCedenteSearch('');
    setCedenteSelected(false);
    setCedenteResults([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 20 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande', description: 'O limite é 20MB.', variant: 'destructive' });
        return;
      }
      setFile(selected);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Result state
  const [signLink, setSignLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const handleSubmit = async () => {
    if (!tipoDocumento || !cedenteName || !file) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSending(true);
    setSignLink('');
    setLinkCopied(false);

    try {
      const formData = new FormData();
      formData.append('tipo_documento', tipoDocumento);
      formData.append('cedente_nome', cedenteName);
      formData.append('cedente_cpf_cnpj', cedenteCnpj);
      formData.append('observacao', observacao);
      formData.append('arquivo', file);

      const res = await fetch(`${BACKEND_URL}/api/assinatura/criar`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Erro ${res.status}`);
      }

      const data = await res.json();
      const token = data.token || data.token_acesso;
      if (!token) throw new Error('Token não retornado pelo servidor.');

      const link = `${window.location.origin}/assinar/${token}`;
      setSignLink(link);

      toast({ title: 'Documento enviado com sucesso!', description: 'O link de assinatura foi gerado.' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar documento', description: e.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(signLink);
      setLinkCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleNewDocument = () => {
    setTipoDocumento('');
    handleClearCedente();
    setObservacao('');
    handleRemoveFile();
    setSignLink('');
    setLinkCopied(false);
  };

  const selectedTipo = TIPOS_DOCUMENTO.find((t) => t.value === tipoDocumento);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura Digital</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe o documento e selecione o cedente para enviar para assinatura
        </p>
      </div>

      {/* Tipo do documento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Tipo do Documento</CardTitle>
          <CardDescription>Selecione o tipo de documento a ser enviado</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTipo && (
            <p className="mt-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
              {selectedTipo.desc}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cedente – autocomplete search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Cedente</CardTitle>
          <CardDescription>Pesquise e selecione o cedente cadastrado no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={dropdownRef} className="relative">
            <Label htmlFor="cedente-search">Buscar cedente *</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="cedente-search"
                placeholder="Digite nome ou CPF/CNPJ do cedente..."
                value={cedenteSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => cedenteSearch.length >= 2 && !cedenteSelected && setShowDropdown(true)}
                className="pl-9 pr-9"
              />
              {searchingCedente && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {cedenteSelected && (
                <button
                  onClick={handleClearCedente}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && !cedenteSelected && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-auto">
                {cedenteSearch.length < 2 ? (
                  <p className="p-3 text-xs text-muted-foreground">Digite ao menos 2 caracteres...</p>
                ) : searchingCedente ? (
                  <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                  </div>
                ) : cedenteResults.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Nenhum cedente encontrado.</p>
                ) : (
                  cedenteResults.map((c, i) => (
                    <button
                      key={`${c.cpf_cnpj}-${i}`}
                      onClick={() => handleSelectCedente(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors flex items-start gap-3 border-b border-border last:border-0"
                    >
                      <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.cpf_cnpj}
                          {c.cidade && ` · ${c.cidade}`}
                          {c.uf && `/${c.uf}`}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected cedente info */}
          {cedenteSelected && cedenteName && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{cedenteName}</p>
                <p className="text-xs text-muted-foreground">{cedenteCnpj}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Documento</CardTitle>
          <CardDescription>Faça o upload do documento (PDF, máx. 20MB)</CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Clique para selecionar ou arraste o arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">PDF até 20MB</p>
              </div>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 border border-border rounded-lg p-4 bg-muted/30">
              <FileText className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Observações (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Adicione uma observação ao envio..."
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      {!signLink && (
        <div className="flex justify-end">
          <Button
            size="lg"
            className="gap-2"
            onClick={handleSubmit}
            disabled={sending || !tipoDocumento || !cedenteName || !file}
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="h-4 w-4" /> Enviar para Assinatura</>
            )}
          </Button>
        </div>
      )}

      {/* Link de assinatura gerado */}
      {signLink && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Documento enviado com sucesso!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Copie o link abaixo e envie para o cedente assinar digitalmente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-background border border-border rounded-md px-3 py-2.5 flex items-center gap-2 min-w-0">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate select-all">{signLink}</span>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleCopyLink}>
                {linkCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {linkCopied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                <a href={signLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir
                </a>
              </Button>
            </div>

            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={handleNewDocument} className="text-muted-foreground">
                Enviar outro documento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
