import { useState } from "react";
import { api, type TableInfo, type ProfileResult, type GeneratedMetadata } from "@/lib/midas-api";
import { BarChart3, Loader2, Sparkles, ChevronDown, ChevronRight } from "lucide-react";

export default function ProfilingView({
  tables, context, profiles, onProfiles, metadata, onMetadata, onNext, onBack, warehouseId,
}: {
  tables: TableInfo[];
  context: { blurb: string; docs: string };
  profiles: Record<string, ProfileResult> | null;
  onProfiles: (p: Record<string, ProfileResult>) => void;
  metadata: Record<string, GeneratedMetadata> | null;
  onMetadata: (m: Record<string, GeneratedMetadata>) => void;
  onNext: () => void;
  onBack: () => void;
  warehouseId: string;
}) {
  const [profiling, setProfiling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleProfile = async () => {
    setProfiling(true);
    try {
      const result = await api.profileTables(tables.map((t) => t.full_name), warehouseId);
      onProfiles(result);
    } catch (e) { console.error(e); }
    finally { setProfiling(false); }
  };

  const handleGenerate = async () => {
    if (!profiles) return;
    setGenerating(true);
    try {
      const result = await api.generateMetadata(profiles, context);
      onMetadata(result);
      onNext();
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      {!profiles && (
        <div className="text-center py-12">
          <BarChart3 size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 mb-2">Profile your tables to analyze column statistics and sample data</p>
          <p className="text-slate-500 text-sm mb-6">This may take a few minutes depending on the number of tables.</p>
          <button onClick={handleProfile} disabled={profiling} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2">
            {profiling && <Loader2 size={18} className="animate-spin" />}
            {profiling ? "Profiling..." : "Start Profiling"}
          </button>
        </div>
      )}

      {profiles && (
        <div className="space-y-4">
          <h3 className="font-medium text-slate-300">Profiling Results</h3>
          {Object.entries(profiles).map(([fqn, profile]) => (
            <div key={fqn} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(expanded === fqn ? null : fqn)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <BarChart3 size={16} className="text-amber-400" />
                  <span className="font-medium text-sm">{fqn}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">{profile.row_count.toLocaleString()} rows</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">{profile.columns.length} columns</span>
                </div>
                {expanded === fqn ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              </button>
              {expanded === fqn && (
                <div className="border-t border-slate-700 p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-left">
                          <th className="pb-2 pr-4 font-medium">Column</th>
                          <th className="pb-2 pr-4 font-medium">Type</th>
                          <th className="pb-2 pr-4 font-medium">Distinct</th>
                          <th className="pb-2 pr-4 font-medium">Null %</th>
                          <th className="pb-2 font-medium">Sample Values</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {profile.columns.map((col) => (
                          <tr key={col.name} className="border-t border-slate-700/50">
                            <td className="py-2 pr-4 font-mono text-xs">{col.name}</td>
                            <td className="py-2 pr-4 text-xs text-slate-400">{col.type}</td>
                            <td className="py-2 pr-4 text-xs">{col.distinct_count}</td>
                            <td className="py-2 pr-4 text-xs">{col.null_pct}%</td>
                            <td className="py-2 text-xs text-slate-400 max-w-xs truncate">{col.sample_values?.join(", ") || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {profile.sample_rows.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Sample Rows</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-slate-500">{Object.keys(profile.sample_rows[0]).map((k) => <th key={k} className="pb-1 pr-3 text-left font-medium">{k}</th>)}</tr></thead>
                          <tbody className="text-slate-400">
                            {profile.sample_rows.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-t border-slate-700/30">{Object.values(row).map((v, j) => <td key={j} className="py-1 pr-3 max-w-32 truncate">{String(v ?? "")}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button onClick={onBack} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">Back</button>
        {profiles && !metadata && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">AI generation may take up to a minute per table</span>
            <button onClick={handleGenerate} disabled={generating} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2">
              {generating && <Loader2 size={18} className="animate-spin" />}
              <Sparkles size={16} /> {generating ? "Generating..." : "Generate Metadata"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
