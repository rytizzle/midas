const BASE = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export interface CatalogInfo {
  name: string;
  comment: string;
}
export interface SchemaInfo {
  name: string;
  comment: string;
}
export interface ColumnInfo {
  name: string;
  type: string;
  comment: string;
}
export interface TableInfo {
  name: string;
  full_name: string;
  table_type: string;
  comment: string;
  columns: ColumnInfo[];
  column_count: number;
}
export interface ProfileResult {
  table: string;
  row_count: number;
  columns: {
    name: string;
    type: string;
    distinct_count: number;
    null_pct: number;
    sample_values: string[];
  }[];
  sample_rows: Record<string, unknown>[];
}
export interface GeneratedMetadata {
  table_comment: string;
  columns: Record<string, { description: string }>;
}
export interface ApplyResult {
  table: string;
  type: string;
  column?: string;
  status: string;
  error?: string;
}

export interface ExtractPdfResult {
  filename: string;
  text: string;
  page_count: number;
}
export interface ExtractUrlResult {
  url: string;
  text: string;
}

export interface GenieRoom {
  space_id: string;
  title: string;
  description: string;
}
export interface GenieRoomDetail extends GenieRoom {
  tables: TableInfo[];
}
export interface PermissionResult {
  can_modify: boolean;
  error?: string;
}

export const api = {
  getGenieRooms: () => request<GenieRoom[]>("/api/genie/rooms"),
  getGenieRoomTables: (spaceId: string) =>
    request<GenieRoomDetail>(`/api/genie/rooms/${encodeURIComponent(spaceId)}/tables`),
  checkPermissions: (tables: string[]) =>
    request<Record<string, PermissionResult>>("/api/catalog/check-permissions", {
      method: "POST",
      body: JSON.stringify({ tables }),
    }),
  extractPdf: async (file: File): Promise<ExtractPdfResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/documents/extract-pdf`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
  },
  extractUrl: (url: string) =>
    request<ExtractUrlResult>("/api/documents/extract-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  getCatalogs: () => request<CatalogInfo[]>("/api/catalog/catalogs"),
  getSchemas: (catalog: string) =>
    request<SchemaInfo[]>(`/api/catalog/schemas?catalog=${encodeURIComponent(catalog)}`),
  getTables: (catalog: string, schema: string) =>
    request<TableInfo[]>(
      `/api/catalog/tables?catalog=${encodeURIComponent(catalog)}&schema=${encodeURIComponent(schema)}`
    ),
  profileTables: (tables: string[]) =>
    request<Record<string, ProfileResult>>("/api/profiling/profile", {
      method: "POST",
      body: JSON.stringify({ tables }),
    }),
  generateMetadata: (tables: Record<string, ProfileResult>, context: { blurb: string; docs: string }) =>
    request<Record<string, GeneratedMetadata>>("/api/metadata/generate", {
      method: "POST",
      body: JSON.stringify({ tables, context }),
    }),
  applyChanges: (
    changes: Record<string, { table_comment: string; columns: Record<string, { description: string }> }>,
    currentMetadata: Record<string, { comment: string; columns: Record<string, { comment: string }> }>
  ) =>
    request<ApplyResult[]>("/api/apply/execute", {
      method: "POST",
      body: JSON.stringify({ changes, current_metadata: currentMetadata }),
    }),
  undoChanges: (tables: string[]) =>
    request<ApplyResult[]>("/api/apply/undo", {
      method: "POST",
      body: JSON.stringify({ tables }),
    }),
};
