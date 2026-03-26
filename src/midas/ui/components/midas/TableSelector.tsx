import { useEffect, useState } from "react";
import {
  api,
  type CatalogInfo,
  type SchemaInfo,
  type TableInfo,
  type GenieRoom,
  type PermissionResult,
} from "@/lib/midas-api";
import {
  Database,
  Table2,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  X,
  Sparkles,
  FolderTree,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

type SourceMode = "catalog" | "genie";

export default function TableSelector({
  selected,
  onSelect,
  onNext,
  warehouseId,
}: {
  selected: TableInfo[];
  onSelect: (tables: TableInfo[]) => void;
  onNext: () => void;
  warehouseId: string;
}) {
  const [mode, setMode] = useState<SourceMode>("catalog");
  const [catalogs, setCatalogs] = useState<CatalogInfo[]>([]);
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [catalog, setCatalog] = useState("");
  const [schema, setSchema] = useState("");
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<GenieRoom[]>([]);
  const [roomId, setRoomId] = useState("");
  const [roomTables, setRoomTables] = useState<TableInfo[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomPermError, setRoomPermError] = useState(false);
  const [search, setSearch] = useState("");
  const [showSelected, setShowSelected] = useState(false);
  const [permChecking, setPermChecking] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, PermissionResult> | null>(null);
  const [permDismissed, setPermDismissed] = useState(false);

  useEffect(() => {
    api.getCatalogs().then(setCatalogs).catch(console.error);
  }, []);

  useEffect(() => {
    if (mode === "genie" && rooms.length === 0) {
      setRoomsLoading(true);
      api.getGenieRooms().then(setRooms).catch(console.error).finally(() => setRoomsLoading(false));
    }
  }, [mode]);

  useEffect(() => {
    if (!catalog) return;
    setSchema("");
    setTables([]);
    api.getSchemas(catalog).then(setSchemas).catch(console.error);
  }, [catalog]);

  useEffect(() => {
    if (!catalog || !schema) return;
    setLoading(true);
    api.getTables(catalog, schema).then(setTables).catch(console.error).finally(() => setLoading(false));
  }, [catalog, schema]);

  useEffect(() => {
    if (!roomId) return;
    setRoomLoading(true);
    setRoomPermError(false);
    api.getGenieRoomTables(roomId).then((detail) => {
      setRoomTables(detail.tables);
      if (detail.error === "needs_edit_permission") setRoomPermError(true);
    }).catch(console.error).finally(() => setRoomLoading(false));
  }, [roomId]);

  useEffect(() => {
    setPermissions(null);
    setPermDismissed(false);
  }, [selected]);

  const toggle = (t: TableInfo) => {
    const exists = selected.find((s) => s.full_name === t.full_name);
    if (exists) {
      onSelect(selected.filter((s) => s.full_name !== t.full_name));
    } else {
      onSelect([...selected, t]);
    }
  };

  const activeTables = mode === "genie" ? roomTables : tables;
  const isLoading = mode === "genie" ? roomLoading : loading;
  const showTables = mode === "genie" ? !!roomId : !!schema;

  const filtered = activeTables.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.comment.toLowerCase().includes(search.toLowerCase())
  );

  const runPermissionCheck = async () => {
    setPermChecking(true);
    try {
      const result = await api.checkPermissions(selected.map((t) => t.full_name), warehouseId);
      setPermissions(result);
    } catch (e) {
      console.error(e);
    } finally {
      setPermChecking(false);
    }
  };

  const blockedTables = permissions ? Object.entries(permissions).filter(([, p]) => !p.can_modify) : [];
  const allClear = permissions !== null && blockedTables.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg w-fit">
        <button onClick={() => setMode("catalog")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === "catalog" ? "bg-slate-700 text-amber-400 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
          <FolderTree size={15} /> Catalog
        </button>
        <button onClick={() => setMode("genie")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === "genie" ? "bg-slate-700 text-amber-400 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
          <Sparkles size={15} /> Genie Room
        </button>
      </div>

      {mode === "catalog" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Catalog</label>
            <div className="relative">
              <select value={catalog} onChange={(e) => setCatalog(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 appearance-none cursor-pointer focus:outline-none focus:border-amber-500">
                <option value="">Select a catalog...</option>
                {catalogs.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Schema</label>
            <div className="relative">
              <select value={schema} onChange={(e) => setSchema(e.target.value)} disabled={!catalog} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 appearance-none cursor-pointer focus:outline-none focus:border-amber-500 disabled:opacity-50">
                <option value="">Select a schema...</option>
                {schemas.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">Genie Room</label>
          {roomsLoading ? (
            <div className="flex items-center gap-2 py-3 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading rooms...</div>
          ) : (
            <div className="relative">
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 appearance-none cursor-pointer focus:outline-none focus:border-amber-500">
                <option value="">Select a Genie room...</option>
                {rooms.map((r) => <option key={r.space_id} value={r.space_id}>{r.title}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          )}
          {roomPermError && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-amber-950/40 border border-amber-700/50 rounded-lg">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-400">
                <span className="text-amber-400 font-medium">CAN EDIT required.</span> You need Edit access on this Genie space to import its tables. Ask the space owner to grant you Edit permission, or select tables manually from the Catalog tab.
              </p>
            </div>
          )}
        </div>
      )}

      {showTables && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-500" />
            <input type="text" placeholder="Search tables..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={24} className="animate-spin mr-2" /> Loading tables...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((t) => {
                const isSelected = selected.some((s) => s.full_name === t.full_name);
                return (
                  <button key={t.full_name} onClick={() => toggle(t)} className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${isSelected ? "border-amber-500 bg-amber-500/10" : "border-slate-700 bg-slate-800/50 hover:border-slate-600"}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-amber-500 border-amber-500" : "border-slate-600"}`}>
                      {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <Table2 size={16} className="text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.name}</div>
                      {t.comment && <div className="text-xs text-slate-500 truncate">{t.comment}</div>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">{t.table_type.replace("_", " ")}</span>
                    <span className="text-xs text-slate-500">{t.column_count} cols</span>
                  </button>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <div className="text-center py-8 text-slate-500"><Database size={32} className="mx-auto mb-2 opacity-50" /> No tables found</div>
              )}
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="pt-4 border-t border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setShowSelected(!showSelected)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 transition-colors">
              <span className="bg-amber-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{selected.length}</span>
              <span>table{selected.length > 1 ? "s" : ""} selected</span>
              {showSelected ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            </button>
            <div className="flex items-center gap-2">
              {!permissions && !permChecking && (
                <button onClick={runPermissionCheck} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors">
                  <Shield size={15} /> Check Permissions
                </button>
              )}
              {permChecking && <span className="flex items-center gap-2 px-4 py-2.5 text-slate-400 text-sm"><Loader2 size={15} className="animate-spin" /> Checking...</span>}
              <button onClick={onNext} disabled={permChecking} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">Next: Add Context</button>
            </div>
          </div>

          {permissions && !permDismissed && (
            <div className={`rounded-lg border p-3 ${allClear ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
              <div className="flex items-start gap-3">
                {allClear ? <ShieldCheck size={18} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  {allClear ? (
                    <p className="text-sm text-emerald-300">All tables have MODIFY privileges. You're good to go.</p>
                  ) : (
                    <>
                      <p className="text-sm text-amber-300 mb-2">{blockedTables.length} table{blockedTables.length > 1 ? "s" : ""} missing MODIFY privilege</p>
                      <div className="space-y-1">
                        {blockedTables.map(([fqn]) => (
                          <div key={fqn} className="flex items-center gap-2 text-xs text-slate-400"><ShieldX size={12} className="text-red-400 shrink-0" /><span className="truncate">{fqn}</span></div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => setPermDismissed(true)} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
              </div>
            </div>
          )}

          {showSelected && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg divide-y divide-slate-700/50">
              {selected.map((t) => (
                <div key={t.full_name} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Table2 size={14} className="text-slate-500 shrink-0" />
                  <span className="flex-1 text-slate-300 truncate">{t.full_name}</span>
                  {permissions && permissions[t.full_name] && (permissions[t.full_name].can_modify ? <ShieldCheck size={14} className="text-emerald-400 shrink-0" /> : <ShieldX size={14} className="text-red-400 shrink-0" />)}
                  <span className="text-xs text-slate-500">{t.column_count} cols</span>
                  <button onClick={() => onSelect(selected.filter((s) => s.full_name !== t.full_name))} className="text-slate-500 hover:text-red-400 transition-colors p-0.5"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
