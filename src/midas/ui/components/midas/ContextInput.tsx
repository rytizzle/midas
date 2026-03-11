import { useState, useEffect, useRef } from "react";
import { api, type TableInfo } from "@/lib/midas-api";
import { FileText, Table2, Upload, Globe, Loader2, CheckCircle2, XCircle, LayoutTemplate } from "lucide-react";

interface Source {
  name: string;
  type: "pdf" | "url";
  status: "loading" | "done" | "error";
}

const PRESET_TEMPLATES: { name: string; description: string; table: string; column: string }[] = [
  {
    name: "None",
    description: "Free-form AI-generated descriptions",
    table: "",
    column: "",
  },
  {
    name: "Genie-Optimized",
    description: "Structured for Databricks Genie text-to-SQL",
    table: [
      "General Description - What this table contains and its primary purpose",
      "Business Value - Why this data matters and who uses it",
      "Key Relationships - Related tables and common join patterns",
      "Filters & Segments - Common filtering dimensions and how users typically slice this data",
    ].join("\n"),
    column: "Definition and business meaning. Include typical value ranges or categories where relevant.",
  },
  {
    name: "Data Governance",
    description: "Focused on lineage, compliance, and data quality",
    table: [
      "General Description - What this table contains",
      "Data Source - Where the data originates (upstream system or pipeline)",
      "Update Frequency - How often the data refreshes (real-time, hourly, daily, etc.)",
      "Data Owner - Team or role responsible for this data",
      "Sensitivity - Classification level (public, internal, confidential, restricted)",
    ].join("\n"),
    column: "Business definition. Note any data quality considerations, valid value ranges, or sensitivity classification.",
  },
  {
    name: "Business Glossary",
    description: "Non-technical descriptions for business stakeholders",
    table: [
      "What is this? - Plain-language explanation a non-technical user would understand",
      "Business Value - How this data supports business decisions",
      "Example Use Cases - Typical questions this data can answer",
    ].join("\n"),
    column: "Plain-language explanation of what this field means in business terms. Avoid technical jargon.",
  },
];

export default function ContextInput({
  tables,
  context,
  onContext,
  onNext,
  onBack,
}: {
  tables: TableInfo[];
  context: { blurb: string; docs: string; tableTemplate: string; columnTemplate: string };
  onContext: (ctx: { blurb: string; docs: string; tableTemplate: string; columnTemplate: string }) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [blurb, setBlurb] = useState(context.blurb);
  const [docs, setDocs] = useState(context.docs);
  const [tableTemplate, setTableTemplate] = useState(context.tableTemplate);
  const [columnTemplate, setColumnTemplate] = useState(context.columnTemplate);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const match = PRESET_TEMPLATES.find((p) => p.table === context.tableTemplate && p.column === context.columnTemplate);
    return match?.name || (context.tableTemplate || context.columnTemplate ? "Custom" : "None");
  });
  const [sources, setSources] = useState<Source[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBlurb(context.blurb);
    setDocs(context.docs);
    setTableTemplate(context.tableTemplate);
    setColumnTemplate(context.columnTemplate);
  }, [context]);

  const handlePresetChange = (name: string) => {
    setSelectedPreset(name);
    if (name === "Custom") return;
    const preset = PRESET_TEMPLATES.find((p) => p.name === name);
    if (preset) {
      setTableTemplate(preset.table);
      setColumnTemplate(preset.column);
    }
  };

  const handleNext = () => {
    onContext({ blurb, docs, tableTemplate, columnTemplate });
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
        <div className="flex items-center gap-2"><LayoutTemplate size={16} className="text-amber-400" /><h3 className="font-medium">Description Template</h3></div>
        <p className="text-sm text-slate-400">Choose a template to structure how AI generates descriptions. The AI will follow this format for every table and column.</p>

        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((p) => (
            <button
              key={p.name}
              onClick={() => handlePresetChange(p.name)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedPreset === p.name ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => handlePresetChange("Custom")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedPreset === "Custom" ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
          >
            Custom
          </button>
        </div>

        {selectedPreset !== "None" && (
          <div className="space-y-4">
            {PRESET_TEMPLATES.find((p) => p.name === selectedPreset)?.description && (
              <p className="text-xs text-slate-500 italic">{PRESET_TEMPLATES.find((p) => p.name === selectedPreset)?.description}</p>
            )}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Table comment template</label>
              <textarea
                value={tableTemplate}
                onChange={(e) => { setTableTemplate(e.target.value); setSelectedPreset("Custom"); }}
                placeholder={"General Description - ...\nBusiness Value - ...\nKey Relationships - ..."}
                rows={5}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500 resize-y"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Column description template</label>
              <textarea
                value={columnTemplate}
                onChange={(e) => { setColumnTemplate(e.target.value); setSelectedPreset("Custom"); }}
                placeholder="Definition and business meaning. Include typical values where relevant."
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500 resize-y"
              />
            </div>
          </div>
        )}
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
