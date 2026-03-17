import { useState, useRef } from 'react';
import { Upload, FileText, Send, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const TIPOS_DOCUMENTO = [
  { value: 'contrato-mae', label: 'Contrato Mãe', desc: 'Contrato de cedente com a securitizadora (início do relacionamento)' },
  { value: 'aditivo', label: 'Aditivo', desc: 'Resumo do que foi negociado, dados bancários e valor do deságio' },
  { value: 'carta-cessao', label: 'Carta de Cessão', desc: 'Formaliza a cessão do título para a Gold Credit' },
  { value: 'np', label: 'Nota Promissória (NP)', desc: 'Valor total da operação – cedente se responsabiliza pelo valor' },
  { value: 'duplicata', label: 'Duplicata', desc: 'Documento da negociação cedente × sacado (apenas para NF)' },
];

export default function AssinaturaDigital() {
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [cedenteName, setCedenteName] = useState('');
  const [cedenteCnpj, setCedenteCnpj] = useState('');
  const [observacao, setObservacao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async () => {
    if (!tipoDocumento || !cedenteName || !file) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSending(true);
    // Simulate sending
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    toast({ title: 'Documento enviado!', description: 'O cedente receberá o documento para assinatura.' });
    setTipoDocumento('');
    setCedenteName('');
    setCedenteCnpj('');
    setObservacao('');
    handleRemoveFile();
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

      {/* Cedente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Cedente</CardTitle>
          <CardDescription>Informe o cedente que receberá o documento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cedente-name">Nome / Razão Social *</Label>
              <Input
                id="cedente-name"
                placeholder="Nome do cedente"
                value={cedenteName}
                onChange={(e) => setCedenteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cedente-cnpj">CPF/CNPJ</Label>
              <Input
                id="cedente-cnpj"
                placeholder="00.000.000/0000-00"
                value={cedenteCnpj}
                onChange={(e) => setCedenteCnpj(e.target.value)}
              />
            </div>
          </div>
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
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
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
      <div className="flex justify-end">
        <Button
          size="lg"
          className="gap-2"
          onClick={handleSubmit}
          disabled={sending || !tipoDocumento || !cedenteName || !file}
        >
          {sending ? (
            <>Enviando...</>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar para Assinatura
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
