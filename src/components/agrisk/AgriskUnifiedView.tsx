import { useEffect, useMemo, useState } from 'react';
import { Leaf, ShieldAlert, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConsultaClienteDetailView } from '@/components/clientes/ConsultaClienteDetailView';
import { AgriskDetailView } from '@/components/agrisk/AgriskDetailView';

type TopicStatus = 'consulted' | 'not_consulted';

type TopicItem = {
  key: string;
  label: string;
  status: TopicStatus;
  data: Record<string, unknown> | null;
  summary: string;
};

type TopicSection = {
  key: string;
  label: string;
  icon: any;
  items: TopicItem[];
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function detectConsultaType(data: Record<string, any>, consultaType?: string): string | null {
  if (consultaType) return consultaType;

  const code = typeof data?.product?.code === 'string' ? normalizeText(data.product.code) : '';
  if (code.includes('consulta-cliente')) return 'consulta_cliente';
  if (code.includes('credit-restrictive') || code.includes('restritivo')) return 'restritivos';
  if (code === 'scr' || code.includes('endividamento')) return 'endividamento';
  if (code === 'cpr') return 'cpr';
  if (code.includes('pesquisa-imoveis')) return 'imoveis_simples';
  if (code === 'car') return 'imoveis_car';
  if (code.includes('vehicle-assets') || code.includes('veicular')) return 'patrimonio_veicular';

  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function buildSummary(data: Record<string, unknown> | null): string {
  if (!data) return 'Não consultado nesta execução.';

  const items = Array.isArray((data as any).items) ? (data as any).items.length : null;
  if (typeof items === 'number') return `${items} item(ns) retornado(s).`;

  const keys = Object.keys(data);
  return keys.length > 0 ? `${keys.length} bloco(s) de dados retornado(s).` : 'Consulta realizada.';
}

function buildSections(rawData: Record<string, any>, consultaType?: string): TopicSection[] {
  const details = toRecord(rawData?.details) || rawData;
  const type = detectConsultaType(rawData, consultaType);

  const consultaClienteData =
    type === 'consulta_cliente' ||
    details.clientData ||
    details.contacts ||
    details.lawsuits ||
    details.compliance ||
    details.groups_family ||
    details.groups_economic
      ? rawData
      : null;

  const restritivosData = type === 'restritivos' ? details : toRecord(details.restritivos);
  const endividamentoData = type === 'endividamento' ? details : toRecord(details.scr);
  const cprData = type === 'cpr' ? details : toRecord(details.cpr);
  const imoveisSimplesData =
    type === 'imoveis_simples'
      ? details
      : (details.rural || details.urban || details.ruralDetails)
        ? {
            rural: details.rural || null,
            urban: details.urban || null,
            ruralDetails: details.ruralDetails || [],
          }
        : null;
  const imoveisCarData = type === 'imoveis_car' ? details : null;
  const patrimonioVeicularData = type === 'patrimonio_veicular' ? details : null;

  return [
    {
      key: 'cliente',
      label: 'Cliente',
      icon: UserRound,
      items: [
        {
          key: 'consulta_cliente',
          label: 'Consulta Cliente',
          status: consultaClienteData ? 'consulted' : 'not_consulted',
          data: consultaClienteData,
          summary: buildSummary(consultaClienteData),
        },
      ],
    },
    {
      key: 'patrimonio',
      label: 'Patrimônio',
      icon: Leaf,
      items: [
        {
          key: 'patrimonio_veicular',
          label: 'Patrimônio Veicular',
          status: patrimonioVeicularData ? 'consulted' : 'not_consulted',
          data: patrimonioVeicularData,
          summary: buildSummary(patrimonioVeicularData),
        },
      ],
    },
    {
      key: 'imoveis',
      label: 'Imóveis Rurais',
      icon: Leaf,
      items: [
        {
          key: 'imoveis_simples',
          label: 'Pesquisa de Imóveis - Simples',
          status: imoveisSimplesData ? 'consulted' : 'not_consulted',
          data: imoveisSimplesData,
          summary: buildSummary(imoveisSimplesData),
        },
        {
          key: 'imoveis_car',
          label: 'Pesquisa Imóveis - CAR',
          status: imoveisCarData ? 'consulted' : 'not_consulted',
          data: imoveisCarData,
          summary: buildSummary(imoveisCarData),
        },
      ],
    },
  ];
}

export function AgriskUnifiedView({
  data,
  agriskClientId,
  consultaType,
}: {
  data: Record<string, unknown>;
  agriskClientId?: string | null;
  consultaType?: string | null;
}) {
  const sections = useMemo(() => buildSections(data as Record<string, any>, consultaType || undefined), [data, consultaType]);
  const allItems = sections.flatMap((section) => section.items);
  const initialKey = allItems.find((item) => item.status === 'consulted')?.key || allItems[0]?.key || null;
  const [selectedKey, setSelectedKey] = useState<string | null>(initialKey);
  const selectedItem = allItems.find((item) => item.key === selectedKey) || allItems[0] || null;

  useEffect(() => {
    setSelectedKey(initialKey);
  }, [initialKey]);

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-bold text-foreground">{section.label}</h3>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {section.items.map((item) => {
                const isActive = selectedKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    className={cn(
                      'text-left rounded-xl border p-4 transition-colors',
                      isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-base font-semibold text-foreground">{item.label}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-semibold',
                          item.status === 'consulted'
                            ? 'border-green-500/40 text-green-600 bg-green-50'
                            : 'border-amber-500/40 text-amber-700 bg-amber-50',
                        )}
                      >
                        {item.status === 'consulted' ? 'CONSULTADO' : 'NÃO CONSULTADO'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Detalhamento</p>
              <h3 className="text-xl font-bold text-foreground">{selectedItem?.label || 'AgRisk'}</h3>
            </div>
            {selectedItem?.status === 'consulted' ? (
              <Badge className="bg-green-100 text-green-700 border-0">Consulta carregada</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-0">Não consultado</Badge>
            )}
          </div>

          {!selectedItem || selectedItem.status !== 'consulted' || !selectedItem.data ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
              <ShieldAlert className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm">Esse tópico não foi consultado nesta execução.</p>
            </div>
          ) : selectedItem.key === 'consulta_cliente' ? (
            <ConsultaClienteDetailView data={selectedItem.data as Record<string, any>} agriskClientId={agriskClientId} />
          ) : (
            <AgriskDetailView data={selectedItem.data} title={selectedItem.label} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
