import { Search } from 'lucide-react';
import { ConsultaHistoryPage } from '@/components/consultas/ConsultaHistoryPage';

export default function HistoricoSCR() {
  return (
    <ConsultaHistoryPage
      platform="scr"
      title="Histórico SCR"
      description="Consultas realizadas via SCR (HBI)"
      icon={<Search className="h-6 w-6 text-primary" />}
    />
  );
}
