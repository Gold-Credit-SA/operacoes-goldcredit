import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
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
  return data;
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase">{label}</p>
      <p className="text-sm text-foreground mt-0.5 break-words">{formatValue(value)}</p>
    </div>
  );
}

function ObjectBlock({ title, value, depth = 0 }: { title: string; value: Record<string, unknown>; depth?: number }) {
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined);
  const scalarEntries = entries.filter(([, item]) => !Array.isArray(item) && !isPlainObject(item));
  const nestedEntries = entries.filter(([, item]) => Array.isArray(item) || isPlainObject(item));

  return (
    <Card className={cn(depth > 0 && 'border-dashed')}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <Badge variant="outline" className="text-[10px]">
            Objeto
          </Badge>
        </div>

        {scalarEntries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scalarEntries.map(([key, item]) => (
              <DetailField key={key} label={formatLabel(key)} value={item} />
            ))}
          </div>
        )}

        {nestedEntries.map(([key, item]) => (
          Array.isArray(item) ? (
            <ArrayBlock key={key} title={formatLabel(key)} items={item} depth={depth + 1} />
          ) : (
            <ObjectBlock key={key} title={formatLabel(key)} value={item as Record<string, unknown>} depth={depth + 1} />
          )
        ))}
      </CardContent>
    </Card>
  );
}

function ArrayBlock({ title, items, depth = 0 }: { title: string; items: unknown[]; depth?: number }) {
  return (
    <Card className={cn(depth > 0 && 'border-dashed')}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <Badge variant="secondary" className="text-[10px]">
            {items.length} item(ns)
          </Badge>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item retornado.</p>
        ) : (
          <ScrollArea className={cn(items.length > 4 && 'max-h-[420px]')}>
            <div className="space-y-3 pr-3">
              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Item {index + 1}
                    </p>
                    {!Array.isArray(item) && !isPlainObject(item) && (
                      <span className="text-sm text-foreground">{formatValue(item)}</span>
                    )}
                  </div>

                  {isPlainObject(item) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Object.entries(item)
                        .filter(([, child]) => child !== null && child !== undefined && !Array.isArray(child) && !isPlainObject(child))
                        .map(([key, child]) => (
                          <DetailField key={key} label={formatLabel(key)} value={child} />
                        ))}
                    </div>
                  )}

                  {isPlainObject(item) && Object.entries(item)
                    .filter(([, child]) => Array.isArray(child) || isPlainObject(child))
                    .map(([key, child]) => (
                      Array.isArray(child) ? (
                        <ArrayBlock key={key} title={formatLabel(key)} items={child} depth={depth + 1} />
                      ) : (
                        <ObjectBlock key={key} title={formatLabel(key)} value={child as Record<string, unknown>} depth={depth + 1} />
                      )
                    ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export function AgriskDetailView({
  data,
  title,
}: {
  data: Record<string, unknown>;
  title?: string;
}) {
  const root = getRootData(data);
  const entries = Object.entries(root).filter(([, value]) => value !== null && value !== undefined);
  const scalarEntries = entries.filter(([, value]) => !Array.isArray(value) && !isPlainObject(value));
  const structuredEntries = entries.filter(([, value]) => Array.isArray(value) || isPlainObject(value));

  return (
    <div className="space-y-4">
      {title && <h2 className="text-2xl font-bold text-foreground">{title}</h2>}

      {scalarEntries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {scalarEntries.map(([key, value]) => (
                <DetailField key={key} label={formatLabel(key)} value={value} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {structuredEntries.map(([key, value]) => (
        Array.isArray(value) ? (
          <ArrayBlock key={key} title={formatLabel(key)} items={value} />
        ) : (
          <ObjectBlock key={key} title={formatLabel(key)} value={value as Record<string, unknown>} />
        )
      ))}
    </div>
  );
}
