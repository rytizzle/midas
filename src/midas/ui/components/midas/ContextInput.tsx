import { useState, useEffect, useRef } from "react";
import { api, type TableInfo } from "@/lib/midas-api";
import { FileText, Table2, Upload, Globe, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Source {
  name: string;
  type: "pdf" | "url";
  status: "loading" | "done" | "error";
}

export default function ContextInput({
  tables,
  context,
  onContext,
  onNext,
  onBack,
}: {
  tables: TableInfo[];
  context: { blurb: string; docs: string };
  onContext: (ctx: { blurb: string; docs: string }) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [blurb, setBlurb] = useState(context.blurb);
  const [docs, setDocs] = useState(context.docs);
  const [sources, setSources] = useState<Source[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBlurb(context.blurb);
    setDocs(context.docs);
  }, [context]);

  const handleNext = () => {
    onContext({ blurb, docs });
    onNext();
  };

  const handlePdfUpload = async (file: File) => {
    const name = file.name;
    setSources((prev) => [...prev, { name, type: "pdf", status: "loading" }]);
    setPdfLoading(true);
    try {
      const result = await api.extractPdf(file);
      setDocs((prev) => prev + `\n\n--- PDF: ${result.filename} (${result.page_count} pages) ---\n${result.text}`);
      setSources((prev) => prev.map((s) => (s.name === name && s.status === "loading" ? { ...s, status: "done" } : s)));
    } catch {
      setSources((prev) => prev.map((s) => (s.name === name && s.status === "loading" ? { ...s, status: "error" } : s)));
    } finally {
      setPdfLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setSources((prev) => [...prev, { name: url, type: "url", status: "loading" }]);
    setUrlLoading(true);
    setUrlInput("");
    try {
      const result = await api.extractUrl(url);
      setDocs((prev) => prev + `\n\n--- URL: ${result.url} ---\n${result.text}`);
      setSources((prev) => prev.map((s) => (s.name === url && s.status === "loading" ? { ...s, status: "done" } : s)));
    } catch {
      setSources((prev) => prev.map((s) => (s.name === url && s.status === "loading" ? { ...s, status: "error" } : s)));
    } finally {
      setUrlLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">Provide high-level context about these tables to help the AI generate better metadata.</p>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-medium text-slate-400">Selected Tables</h3>
        <div className="flex flex-wrap gap-2">
          {tables.map((t) => (
            <span key={t.full_name} className="inline-flex items-center gap-1.5 text-xs bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md">
              <Table2 size={12} className="text-slate-500" /> {t.name} <span className="text-slate-500">{t.column_count} cols</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2"><FileText size={16} className="text-amber-400" /><h3 className="font-medium">Data Context</h3></div>
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Description (optional)</label>
          <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="e.g., These are gold-layer tables for tracking velocity, bug rates, and sprint health..." rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Additional docs (optional)</label>
          <textarea value={docs} onChange={(e) => setDocs(e.target.value)} placeholder="Paste any additional documentation..." rows={8} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 resize-none" />
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-3">
          <h4 className="text-sm font-medium text-slate-400">Import from documents</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePdfUpload(file); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} disabled={pdfLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-600 border-dashed rounded-lg text-sm text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors disabled:opacity-50">
                {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {pdfLoading ? "Extracting..." : "Upload PDF"}
              </button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()} placeholder="https://..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500" />
              <button onClick={handleUrlFetch} disabled={urlLoading || !urlInput.trim()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5">
                {urlLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Fetch
              </button>
            </div>
          </div>

          {sources.length > 0 && (
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                  {s.status === "loading" && <Loader2 size={12} className="animate-spin text-amber-400" />}
                  {s.status === "done" && <CheckCircle2 size={12} className="text-emerald-400" />}
                  {s.status === "error" && <XCircle size={12} className="text-red-400" />}
                  <span className={s.type === "pdf" ? "font-medium" : ""}>{s.name}</span>
                  <span className="text-slate-600">{s.type.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button onClick={onBack} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors">Next: Profile & Generate</button>
      </div>
    </div>
  );
}
