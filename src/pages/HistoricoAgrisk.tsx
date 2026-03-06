import { Search } from 'lucide-react';
import { ConsultaHistoryPage } from '@/components/consultas/ConsultaHistoryPage';

export default function HistoricoAgrisk() {
  return (
    <ConsultaHistoryPage
      platform="agrisk"
      title="Histórico Agrisk"
      description="Consultas realizadas via Agrisk"
      icon={<Search className="h-6 w-6 text-primary" />}
    />
  );
}
