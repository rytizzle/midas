import { useState, useEffect } from "react";
import type { TableInfo, GeneratedMetadata } from "@/lib/midas-api";
import { ChevronDown, ChevronRight, Pencil, MinusCircle } from "lucide-react";

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
  const [expanded, setExpanded] = useState<string>("");
  const [rejected, setRejected] = useState<Record<string, Record<string, boolean>>>({});
  // Track which textareas are expanded for longer editing
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});

  useEffect(() => { setLocal(metadata); }, [metadata]);

  const updateTableComment = (fqn: string, comment: string) => {
    setLocal((prev) => ({ ...prev, [fqn]: { ...prev[fqn], table_comment: comment } }));
    setRejected((prev) => ({ ...prev, [fqn]: { ...prev[fqn], _table: false } }));
  };

  const updateColDesc = (fqn: string, col: string, desc: string) => {
    setLocal((prev) => ({
      ...prev,
      [fqn]: { ...prev[fqn], columns: { ...prev[fqn].columns, [col]: { ...prev[fqn].columns[col], description: desc } } },
    }));
    setRejected((prev) => ({ ...prev, [fqn]: { ...prev[fqn], [col]: false } }));
  };

  const toggleRejectCol = (fqn: string, col: string) => {
    setRejected((prev) => {
      const tbl = prev[fqn] || {};
      return { ...prev, [fqn]: { ...tbl, [col]: !tbl[col] } };
    });
  };

  const toggleRejectTable = (fqn: string) => {
    setRejected((prev) => {
      const tbl = prev[fqn] || {};
      return { ...prev, [fqn]: { ...tbl, _table: !tbl._table } };
    });
  };

  const toggleExpandCell = (key: string) => {
    setExpandedCells((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    const filtered: Record<string, GeneratedMetadata> = {};
    for (const [fqn, meta] of Object.entries(local)) {
      const rej = rejected[fqn] || {};
      const cols: Record<string, { description: string }> = {};
      for (const [col, data] of Object.entries(meta.columns)) {
        if (!rej[col]) cols[col] = data;
      }
      filtered[fqn] = {
        table_comment: rej._table ? "" : meta.table_comment,
        columns: cols,
      };
    }
    onMetadata(filtered);
    onNext();
  };

  const excludedCount = Object.values(rejected).reduce(
    (sum, tbl) => sum + Object.values(tbl).filter(Boolean).length, 0
  );

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
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-400">Table Comment</label>
                      {meta.table_comment && (
                        <button
                          onClick={() => toggleRejectTable(fqn)}
                          className={`text-xs px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${(rejected[fqn] || {})._table ? "bg-red-900/40 text-red-400 border border-red-800" : "bg-slate-700 text-slate-400 hover:bg-red-900/30 hover:text-red-400"}`}
                        >
                          <MinusCircle size={12} />
                          {(rejected[fqn] || {})._table ? "Excluded" : "Do Not Include"}
                        </button>
                      )}
                    </div>
                    {currentComment && <div className="text-xs text-slate-500">Current: {currentComment}</div>}
                    <div className={`relative ${(rejected[fqn] || {})._table ? "opacity-30" : ""}`}>
                      <textarea value={meta.table_comment} onChange={(e) => updateTableComment(fqn, e.target.value)} rows={3} disabled={(rejected[fqn] || {})._table} className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-y disabled:cursor-not-allowed ${meta.table_comment !== currentComment ? (currentComment ? "border-amber-500/50" : "border-emerald-500/50") : "border-slate-700"}`} />
                      <Pencil size={12} className="absolute top-2 right-2 text-slate-600" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Column Descriptions</label>
                    <div className="space-y-2">
                      {Object.entries(meta.columns).map(([colName, colData]) => {
                        const currentCol = table?.columns?.find((c) => c.name === colName);
                        const currentDesc = currentCol?.comment || "";
                        const proposed = colData.description;
                        const isNew = !currentDesc && proposed;
                        const isChanged = currentDesc && proposed && currentDesc !== proposed;
                        const isRejected = (rejected[fqn] || {})[colName] || false;
                        const cellKey = `${fqn}:${colName}`;
                        const isCellExpanded = expandedCells[cellKey] || false;
                        const borderColor = isRejected ? "border-red-800/50" : isNew ? "border-emerald-500/50" : isChanged ? "border-amber-500/50" : "border-slate-700";

                        return (
                          <div key={colName} className={`rounded-lg border ${borderColor} ${isRejected ? "opacity-40" : ""} transition-opacity`}>
                            <div className="flex items-start gap-3 p-3">
                              <div className="shrink-0 pt-1">
                                <code className="text-xs bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">{colName}</code>
                                {currentDesc && <div className="text-[10px] text-slate-600 mt-1 max-w-[140px] truncate" title={currentDesc}>Current: {currentDesc}</div>}
                                {!currentDesc && <div className="text-[10px] text-slate-600 mt-1 italic">no current</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <textarea
                                  value={proposed}
                                  onChange={(e) => updateColDesc(fqn, colName, e.target.value)}
                                  rows={isCellExpanded ? 4 : 2}
                                  disabled={isRejected}
                                  className={`w-full bg-slate-900 border ${borderColor} rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 disabled:cursor-not-allowed ${isCellExpanded ? "resize-y" : "resize-none"}`}
                                />
                                <button
                                  onClick={() => toggleExpandCell(cellKey)}
                                  className="text-[10px] text-slate-600 hover:text-slate-400 mt-0.5"
                                >
                                  {isCellExpanded ? "Collapse" : "Expand"}
                                </button>
                              </div>
                              <button
                                onClick={() => toggleRejectCol(fqn, colName)}
                                className={`shrink-0 mt-1 p-1.5 rounded transition-colors ${isRejected ? "bg-red-900/40 text-red-400" : "text-slate-600 hover:text-red-400 hover:bg-red-900/20"}`}
                                title={isRejected ? "Include again" : "Do not include"}
                              >
                                <MinusCircle size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> New</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Changed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> Unchanged</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Excluded</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button onClick={onBack} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">Back</button>
        <div className="flex items-center gap-3">
          {excludedCount > 0 && <span className="text-xs text-red-400">{excludedCount} excluded</span>}
          <button onClick={handleNext} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors">Next: Apply Changes</button>
        </div>
      </div>
    </div>
  );
}
