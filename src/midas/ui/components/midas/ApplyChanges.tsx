import { useState } from "react";
import { api, type TableInfo, type GeneratedMetadata, type ApplyResult } from "@/lib/midas-api";
import { CheckCircle2, XCircle, Loader2, Undo2, AlertTriangle, Rocket } from "lucide-react";

export default function ApplyChanges({
  tables, metadata, onBack,
}: {
  tables: TableInfo[];
  metadata: Record<string, GeneratedMetadata>;
  onBack: () => void;
}) {
  const [results, setResults] = useState<ApplyResult[] | null>(null);
  const [undoResults, setUndoResults] = useState<ApplyResult[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const totalChanges = Object.entries(metadata).reduce((sum, [, m]) => {
    let count = m.table_comment ? 1 : 0;
    count += Object.keys(m.columns).length;
    return sum + count;
  }, 0);

  const handleApply = async () => {
    setApplying(true);
    setShowConfirm(false);
    try {
      const changes: Record<string, { table_comment: string; columns: Record<string, { description: string }> }> = {};
      const currentMeta: Record<string, { comment: string; columns: Record<string, { comment: string }> }> = {};
      const tableMap = Object.fromEntries(tables.map((t) => [t.full_name, t]));

      for (const [fqn, m] of Object.entries(metadata)) {
        changes[fqn] = { table_comment: m.table_comment, columns: m.columns };
        const t = tableMap[fqn];
        const colMeta: Record<string, { comment: string }> = {};
        if (t?.columns) t.columns.forEach((c) => { colMeta[c.name] = { comment: c.comment || "" }; });
        currentMeta[fqn] = { comment: t?.comment || "", columns: colMeta };
      }

      const res = await api.applyChanges(changes, currentMeta);
      setResults(res);
    } catch (e) { console.error(e); }
    finally { setApplying(false); }
  };

  const handleUndo = async () => {
    setUndoing(true);
    try {
      const res = await api.undoChanges(Object.keys(metadata));
      setUndoResults(res);
    } catch (e) { console.error(e); }
    finally { setUndoing(false); }
  };

  const successCount = results?.filter((r) => r.status === "success").length ?? 0;
  const errorCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="space-y-6">
      {!results && !applying && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
          <Rocket size={48} className="mx-auto mb-4 text-amber-400" />
          <h3 className="text-lg font-medium mb-2">Ready to Apply</h3>
          <p className="text-slate-400 text-sm mb-4">{totalChanges} metadata change{totalChanges > 1 ? "s" : ""} across {Object.keys(metadata).length} table{Object.keys(metadata).length > 1 ? "s" : ""}</p>

          <div className="text-left max-w-md mx-auto space-y-2 mb-6">
            {Object.entries(metadata).map(([fqn, m]) => (
              <div key={fqn} className="text-sm text-slate-400">
                <span className="font-mono text-xs text-slate-300">{fqn}</span>: {m.table_comment ? 1 : 0} table comment + {Object.keys(m.columns).length} column descriptions
              </div>
            ))}
          </div>

          {!showConfirm ? (
            <button onClick={() => setShowConfirm(true)} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors">Apply Changes</button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-400 text-sm"><AlertTriangle size={16} /> This will execute ALTER TABLE statements. Continue?</div>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleApply} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">Confirm & Apply</button>
              </div>
            </div>
          )}
        </div>
      )}

      {applying && (
        <div className="text-center py-12">
          <Loader2 size={48} className="mx-auto mb-4 text-amber-400 animate-spin" />
          <p className="text-slate-400">Applying metadata changes...</p>
        </div>
      )}

      {results && !undoResults && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={20} /><span className="font-medium">{successCount} succeeded</span></div>
            {errorCount > 0 && <div className="flex items-center gap-2 text-red-400"><XCircle size={20} /><span className="font-medium">{errorCount} failed</span></div>}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg divide-y divide-slate-700/50">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {r.status === "success" ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> : <XCircle size={16} className="text-red-400 shrink-0" />}
                <span className="font-mono text-xs text-slate-300">{r.table}</span>
                <span className="text-slate-500">{r.type === "table_comment" ? "table comment" : `column: ${r.column}`}</span>
                {r.error && <span className="text-xs text-red-400 truncate max-w-xs">{r.error}</span>}
              </div>
            ))}
          </div>

          <button onClick={handleUndo} disabled={undoing} className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2">
            {undoing && <Loader2 size={16} className="animate-spin" />} <Undo2 size={16} /> Undo All Changes
          </button>
        </div>
      )}

      {undoResults && (
        <div className="bg-slate-800/50 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-3"><Undo2 size={16} /><span className="font-medium">Changes Reverted</span></div>
          <div className="space-y-1">
            {undoResults.map((r, i) => (
              <div key={i} className="text-sm text-slate-400 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                {r.table} - {r.type === "table_comment" ? "table comment" : r.column} ({r.status})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button onClick={onBack} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">Back</button>
      </div>
    </div>
  );
}
