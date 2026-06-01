import { lazy, Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, Send, Settings2, Handshake, History } from "lucide-react";

const DashboardTab = lazy(() => import("@/components/cobranca/DashboardTab"));
const SugestoesTab = lazy(() => import("@/components/cobranca/SugestoesTab"));
const ReguaTab = lazy(() => import("@/components/cobranca/ReguaTab"));
const AcordosTab = lazy(() => import("@/components/cobranca/AcordosTab"));
const HistoricoTab = lazy(() => import("@/components/cobranca/HistoricoTab"));

const Loading = () => (
  <div className="space-y-3 p-6">
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

export default function Cobranca() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cobrança</h1>
        <p className="text-muted-foreground">
          Acompanhe inadimplência, dispare cobranças e gerencie acordos.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="sugestoes"><Send className="h-4 w-4 mr-2" />Cobrar</TabsTrigger>
          <TabsTrigger value="regua"><Settings2 className="h-4 w-4 mr-2" />Régua</TabsTrigger>
          <TabsTrigger value="acordos"><Handshake className="h-4 w-4 mr-2" />Acordos</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <Suspense fallback={<Loading />}>
            <DashboardTab onCobrarAgora={() => setTab("sugestoes")} />
          </Suspense>
        </TabsContent>
        <TabsContent value="sugestoes" className="mt-6">
          <Suspense fallback={<Loading />}><SugestoesTab /></Suspense>
        </TabsContent>
        <TabsContent value="regua" className="mt-6">
          <Suspense fallback={<Loading />}><ReguaTab /></Suspense>
        </TabsContent>
        <TabsContent value="acordos" className="mt-6">
          <Suspense fallback={<Loading />}><AcordosTab /></Suspense>
        </TabsContent>
        <TabsContent value="historico" className="mt-6">
          <Suspense fallback={<Loading />}><HistoricoTab /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
