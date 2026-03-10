import { useState, useEffect } from "react";
import type { TableInfo, GeneratedMetadata } from "@/lib/midas-api";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

export default function MetadataReview({
  tables, metadata, onMetadata, onNext, onBack,
}: {
  tables: TableInfo[];
  metadata: Record<string, GeneratedMetadata>;
  onMetadata: (m: Record<string, GeneratedMetadata>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [local, setLocal] = useState(metadata);
  const [expanded, setExpanded] = useState<string>(Object.keys(metadata)[0] || "");

  useEffect(() => { setLocal(metadata); }, [metadata]);

  const updateTableComment = (fqn: string, comment: string) => {
    setLocal((prev) => ({ ...prev, [fqn]: { ...prev[fqn], table_comment: comment } }));
  };

  const updateColDesc = (fqn: string, col: string, desc: string) => {
    setLocal((prev) => ({
      ...prev,
      [fqn]: { ...prev[fqn], columns: { ...prev[fqn].columns, [col]: { ...prev[fqn].columns[col], description: desc } } },
    }));
  };

  const handleNext = () => { onMetadata(local); onNext(); };

  const tableMap = Object.fromEntries(tables.map((t) => [t.full_name, t]));

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">Review and edit the AI-generated metadata before applying.</p>

      <div className="space-y-3">
        {Object.entries(local).map(([fqn, meta]) => {
          const table = tableMap[fqn];
          const currentComment = table?.comment || "";
          const isExpanded = expanded === fqn;

          return (
            <div key={fqn} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? "" : fqn)} className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors">
                <span className="font-medium text-sm">{fqn}</span>
                {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-700 p-4 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Table Comment</label>
                    {currentComment && <div className="text-xs text-slate-500">Current: {currentComment}</div>}
                    <div className="relative">
                      <textarea value={meta.table_comment} onChange={(e) => updateTableComment(fqn, e.target.value)} rows={2} className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none ${meta.table_comment !== currentComment ? (currentComment ? "border-amber-500/50" : "border-emerald-500/50") : "border-slate-700"}`} />
                      <Pencil size={12} className="absolute top-2 right-2 text-slate-600" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Column Descriptions</label>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-slate-500 text-left"><th className="pb-2 pr-4 font-medium w-40">Column</th><th className="pb-2 pr-4 font-medium w-32">Current</th><th className="pb-2 font-medium">Proposed</th></tr></thead>
                        <tbody>
                          {Object.entries(meta.columns).map(([colName, colData]) => {
                            const currentCol = table?.columns?.find((c) => c.name === colName);
                            const currentDesc = currentCol?.comment || "";
                            const proposed = colData.description;
                            const isNew = !currentDesc && proposed;
                            const isChanged = currentDesc && proposed && currentDesc !== proposed;
                            return (
                              <tr key={colName} className="border-t border-slate-700/50">
                                <td className="py-2 pr-4"><code className="text-xs bg-slate-900 px-1.5 py-0.5 rounded">{colName}</code></td>
                                <td className="py-2 pr-4 text-xs text-slate-500 max-w-32 truncate">{currentDesc || <span className="italic">none</span>}</td>
                                <td className="py-2"><textarea value={proposed} onChange={(e) => updateColDesc(fqn, colName, e.target.value)} rows={1} className={`w-full bg-slate-900 border rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none ${isNew ? "border-emerald-500/50" : isChanged ? "border-amber-500/50" : "border-slate-700"}`} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> New</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Changed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> Unchanged</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button onClick={onBack} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors">Next: Apply Changes</button>
      </div>
    </div>
  );
}
