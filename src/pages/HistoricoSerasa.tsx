import { Search } from 'lucide-react';
import { ConsultaHistoryPage } from '@/components/consultas/ConsultaHistoryPage';

export default function HistoricoSerasa() {
  return (
    <ConsultaHistoryPage
      platform="serasa"
      title="Histórico Serasa"
      description="Consultas realizadas via Serasa Avançado"
      icon={<Search className="h-6 w-6 text-primary" />}
    />
  );
}
