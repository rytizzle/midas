import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Stepper from "@/components/midas/Stepper";
import TableSelector from "@/components/midas/TableSelector";
import ContextInput from "@/components/midas/ContextInput";
import ProfilingView from "@/components/midas/ProfilingView";
import MetadataReview from "@/components/midas/MetadataReview";
import ApplyChanges from "@/components/midas/ApplyChanges";
import type { TableInfo, ProfileResult, GeneratedMetadata } from "@/lib/midas-api";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => <MidasApp />,
});

function MidasApp() {
  const [step, setStep] = useState(0);
  const [selectedTables, setSelectedTables] = useState<TableInfo[]>([]);
  const [context, setContext] = useState<{ blurb: string; docs: string }>({
    blurb: "",
    docs: "",
  });
  const [profiles, setProfiles] = useState<Record<string, ProfileResult> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, GeneratedMetadata> | null>(null);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Sparkles size={24} className="text-amber-400" />
          <h1 className="text-xl font-bold text-slate-100">Midas</h1>
          <span className="text-sm text-slate-500">AI Metadata for Genie</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Stepper current={step} onStep={setStep} />

        {step === 0 && (
          <TableSelector
            selected={selectedTables}
            onSelect={setSelectedTables}
            onNext={() => setStep(1)}
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
          />
        )}
      </main>
    </div>
  );
}
