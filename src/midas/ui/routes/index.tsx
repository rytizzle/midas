import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Stepper from "@/components/midas/Stepper";
import TableSelector from "@/components/midas/TableSelector";
import ContextInput from "@/components/midas/ContextInput";
import ProfilingView from "@/components/midas/ProfilingView";
import MetadataReview from "@/components/midas/MetadataReview";
import ApplyChanges from "@/components/midas/ApplyChanges";
import { api } from "@/lib/midas-api";
import type { TableInfo, ProfileResult, GeneratedMetadata, WarehouseInfo } from "@/lib/midas-api";
import { Sparkles, Database, User } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => <MidasApp />,
});

function MidasApp() {
  const [step, setStep] = useState(0);
  const [selectedTables, setSelectedTables] = useState<TableInfo[]>([]);
  const [context, setContext] = useState<{ blurb: string; docs: string; tableTemplate: string; columnTemplate: string }>({
    blurb: "",
    docs: "",
    tableTemplate: "",
    columnTemplate: "",
  });
  const [profiles, setProfiles] = useState<Record<string, ProfileResult> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, GeneratedMetadata> | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    api.getMe().then((u) => setUserEmail(u.email)).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchWarehouses = () => {
      api.getWarehouses().then((whs) => {
        setWarehouses(whs);
        setWarehouseId((prev) => {
          if (prev && whs.some((w) => w.id === prev)) return prev;
          const running = whs.find((w) => w.state === "RUNNING");
          return running ? running.id : whs.length > 0 ? whs[0].id : "";
        });
        setLoadingWarehouses(false);
      }).catch(() => setLoadingWarehouses(false));
    };
    fetchWarehouses();
    const interval = setInterval(fetchWarehouses, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles size={24} className="text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100">Midas</h1>
            <span className="text-sm text-slate-500">AI Metadata for Genie</span>
          </div>
          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <User size={12} />
                {userEmail}
              </span>
            )}
            <div className="flex items-center gap-2">
            <Database size={16} className="text-slate-400" />
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {loadingWarehouses && <option>Loading...</option>}
              {!loadingWarehouses && warehouses.length === 0 && <option>No warehouses available</option>}
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.state})
                </option>
              ))}
            </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!warehouseId && !loadingWarehouses ? (
          <div className="text-center py-16 text-slate-400">
            <Database size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No SQL warehouse available</p>
            <p className="text-sm mt-2">You need access to a SQL warehouse to use Midas.</p>
          </div>
        ) : (
          <>
            <Stepper current={step} onStep={setStep} />

            {step === 0 && (
              <TableSelector
                selected={selectedTables}
                onSelect={setSelectedTables}
                onNext={() => setStep(1)}
                warehouseId={warehouseId}
              />
            )}
            {step === 1 && (
              <ContextInput
                tables={selectedTables}
                context={context}
                onContext={setContext}
                onNext={() => setStep(2)}
                onBack={() => setStep(0)}
              />
            )}
            {step === 2 && (
              <ProfilingView
                tables={selectedTables}
                context={context}
                profiles={profiles}
                onProfiles={setProfiles}
                metadata={metadata}
                onMetadata={setMetadata}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
                warehouseId={warehouseId}
              />
            )}
            {step === 3 && metadata && (
              <MetadataReview
                tables={selectedTables}
                metadata={metadata}
                onMetadata={setMetadata}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && metadata && (
              <ApplyChanges
                tables={selectedTables}
                metadata={metadata}
                onBack={() => setStep(3)}
                warehouseId={warehouseId}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
