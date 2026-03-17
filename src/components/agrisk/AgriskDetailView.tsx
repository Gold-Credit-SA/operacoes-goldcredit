import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Database, FileText, Info, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Metadata keys to strip from display ───

const METADATA_KEYS = new Set([
  'statusCode', 'status_code', 'httpStatus', 'http_status',
  'requestStatus', 'queryStatus', 'ok', 'success',
  'completedAt', 'completed_at', 'createdAt', 'created_at', 'updatedAt', 'updated_at',
  'queryId', 'query_id', 'requestId', 'request_id',
  'taxId', 'tax_id', 'clientId', 'client_id',
  'companyId', 'company_id', '_id', 'id',
  'token', 'serviceKey', 'service_key',
]);

/** Keys whose value is a user-facing message (not data) */
const MESSAGE_KEYS = new Set(['message', 'msg', 'error', 'errorMessage', 'error_message', 'description']);

function isMetadataKey(key: string): boolean {
  return METADATA_KEYS.has(key);
}

// ─── Helpers ───

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('pt-BR').format(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) {
      try {
        return format(new Date(trimmed), 'dd/MM/yyyy');
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return JSON.stringify(value);
}

function getRootData(data: Record<string, unknown>): Record<string, unknown> {
  if (isPlainObject(data.details)) return data.details;
  if (isPlainObject(data.result)) return data.result;
  return data;
}

/** Extract user-facing messages from the data (e.g. "Cliente não possui dados") */
function extractMessages(data: Record<string, unknown>): string[] {
  const messages: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (MESSAGE_KEYS.has(key) && typeof value === 'string' && value.trim()) {
      messages.push(value.trim());
    }
  }
  return messages;
}

/** Filter out metadata and message keys, keep only real data */
function filterDataEntries(entries: [string, unknown][]): [string, unknown][] {
  return entries.filter(([key]) => !isMetadataKey(key) && !MESSAGE_KEYS.has(key));
}

/** Check if all items in an array are flat objects (no nested objects/arrays) */
function isTabularArray(items: unknown[]): items is Record<string, unknown>[] {
  if (items.length === 0) return false;
  return items.every(
    (item) =>
      isPlainObject(item) &&
      Object.values(item).every((v) => !isPlainObject(v) && !Array.isArray(v)),
  );
}

/** Get common keys from array of objects for table columns */
function getTableColumns(items: Record<string, unknown>[]): string[] {
  const keyFrequency = new Map<string, number>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (item[key] !== null && item[key] !== undefined && item[key] !== '') {
        keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1);
      }
    }
  }
  // Only show columns that appear in at least 30% of rows, max 8 columns
  const threshold = Math.max(1, Math.floor(items.length * 0.3));
  return Array.from(keyFrequency.entries())
    .filter(([, count]) => count >= threshold)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([key]) => key);
}

// ─── Field component ───

function DetailField({ label, value }: { label: string; value: unknown }) {
  const formatted = formatValue(value);
  const isLong = typeof formatted === 'string' && formatted.length > 80;

  return (
    <div className={cn(isLong && 'col-span-full')}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm text-foreground mt-0.5 break-words', isLong && 'whitespace-pre-wrap')}>{formatted}</p>
    </div>
  );
}

// ─── Tabular array (rendered as a clean table) ───

function TabularArraySection({ title, items }: { title: string; items: Record<string, unknown>[] }) {
  const columns = getTableColumns(items);
  const [open, setOpen] = useState(true);

  if (columns.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
              <Badge variant="secondary" className="text-[10px]">
                {items.length}
              </Badge>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <ScrollArea className={cn(items.length > 8 && 'max-h-[400px]')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-xs">{formatLabel(col)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-xs">
                          {formatValue(item[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Complex array (items have nested data) ───

function ComplexArraySection({ title, items, depth = 0 }: { title: string; items: unknown[]; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn(depth > 0 && 'border-dashed')}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
              <Badge variant="secondary" className="text-[10px]">
                {items.length}
              </Badge>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum item retornado.</p>
            ) : (
              <ScrollArea className={cn(items.length > 4 && 'max-h-[500px]')}>
                <div className="space-y-3 pr-2">
                  {items.map((item, index) => {
                    if (!isPlainObject(item)) {
                      return (
                        <div key={index} className="rounded-lg bg-muted/30 px-3 py-2">
                          <span className="text-xs text-muted-foreground mr-2">#{index + 1}</span>
                          <span className="text-sm text-foreground">{formatValue(item)}</span>
                        </div>
                      );
                    }

                    const entries = Object.entries(item).filter(([, v]) => v !== null && v !== undefined);
                    const scalarEntries = entries.filter(([, v]) => !Array.isArray(v) && !isPlainObject(v));
                    const nestedEntries = entries.filter(([, v]) => Array.isArray(v) || isPlainObject(v));

                    return (
                      <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            #{index + 1}
                          </Badge>
                          {/* Show a meaningful identifier if possible */}
                          {(item.name || item.Name || item.nome || item.title || item.Title || item.description) && (
                            <span className="text-sm font-medium text-foreground">
                              {formatValue(item.name || item.Name || item.nome || item.title || item.Title || item.description)}
                            </span>
                          )}
                        </div>

                        {scalarEntries.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {scalarEntries.map(([key, val]) => (
                              <DetailField key={key} label={formatLabel(key)} value={val} />
                            ))}
                          </div>
                        )}

                        {nestedEntries.map(([key, val]) =>
                          <RenderValue key={key} label={formatLabel(key)} value={val} depth={depth + 1} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Object section ───

function ObjectSection({ title, data, depth = 0 }: { title: string; data: Record<string, unknown>; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  const scalarEntries = entries.filter(([, v]) => !Array.isArray(v) && !isPlainObject(v));
  const nestedEntries = entries.filter(([, v]) => Array.isArray(v) || isPlainObject(v));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn(depth > 0 && 'border-dashed')}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {entries.length} campo(s)
              </Badge>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-5 space-y-4">
            {scalarEntries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {scalarEntries.map(([key, val]) => (
                  <DetailField key={key} label={formatLabel(key)} value={val} />
                ))}
              </div>
            )}

            {nestedEntries.map(([key, val]) =>
              <RenderValue key={key} label={formatLabel(key)} value={val} depth={depth + 1} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Smart renderer that picks the best component ───

function RenderValue({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (isTabularArray(value)) {
      return <TabularArraySection title={label} items={value} />;
    }
    return <ComplexArraySection title={label} items={value} depth={depth} />;
  }

  if (isPlainObject(value)) {
    return <ObjectSection title={label} data={value} depth={depth} />;
  }

  return null;
}

// ─── Main export ───

export function AgriskDetailView({
  data,
  title,
}: {
  data: Record<string, unknown>;
  title?: string;
}) {
  const root = getRootData(data);
  const messages = extractMessages(root);
  const allEntries = Object.entries(root).filter(([, value]) => value !== null && value !== undefined);
  const entries = filterDataEntries(allEntries);
  const scalarEntries = entries.filter(([, value]) => !Array.isArray(value) && !isPlainObject(value));
  const structuredEntries = entries.filter(([, value]) => Array.isArray(value) || isPlainObject(value));

  const hasData = scalarEntries.length > 0 || structuredEntries.length > 0;

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
        </div>
      )}

      {/* Show API messages as info banners */}
      {messages.map((msg, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">{msg}</p>
        </div>
      ))}

      {!hasData && messages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum dado retornado para esta consulta.</p>
        </div>
      )}

      {scalarEntries.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados Gerais</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {scalarEntries.map(([key, value]) => (
                <DetailField key={key} label={formatLabel(key)} value={value} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {structuredEntries.map(([key, value]) => (
        <RenderValue key={key} label={formatLabel(key)} value={value} depth={0} />
      ))}
    </div>
  );
}
