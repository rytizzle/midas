import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface ApplyRequest {
    changes: Record<string, unknown>;
    current_metadata: Record<string, unknown>;
    warehouse_id: string;
}
export interface Body_extract_pdf_api_documents_extract_pdf_post {
    file: string;
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface GenerateRequest {
    context: Record<string, unknown>;
    tables: Record<string, unknown>;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface LinkRequest {
    catalog: string;
    schema_name: string;
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface PermissionCheckRequest {
    tables: string[];
    warehouse_id: string;
}
export interface ProfileRequest {
    tables: string[];
    warehouse_id: string;
}
export interface UndoRequest {
    previous_state: Record<string, unknown>;
    warehouse_id: string;
}
export interface UrlRequest {
    url: string;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface Apply_changes_api_apply_execute_postParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const apply_changes_api_apply_execute_post = async (data: ApplyRequest, params?: Apply_changes_api_apply_execute_postParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/apply/execute", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useApply_changes_api_apply_execute_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: Apply_changes_api_apply_execute_postParams;
        data: ApplyRequest;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>apply_changes_api_apply_execute_post(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface Undo_changes_api_apply_undo_postParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const undo_changes_api_apply_undo_post = async (data: UndoRequest, params?: Undo_changes_api_apply_undo_postParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/apply/undo", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useUndo_changes_api_apply_undo_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: Undo_changes_api_apply_undo_postParams;
        data: UndoRequest;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>undo_changes_api_apply_undo_post(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface List_catalogs_api_catalog_catalogs_getParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const list_catalogs_api_catalog_catalogs_get = async (params?: List_catalogs_api_catalog_catalogs_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/catalog/catalogs", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const list_catalogs_api_catalog_catalogs_getKey = (params?: List_catalogs_api_catalog_catalogs_getParams)=>{
    return [
        "/api/catalog/catalogs",
        params
    ] as const;
};
export function useList_catalogs_api_catalog_catalogs_get<TData = {
    data: unknown;
}>(options?: {
    params?: List_catalogs_api_catalog_catalogs_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: list_catalogs_api_catalog_catalogs_getKey(options?.params),
        queryFn: ()=>list_catalogs_api_catalog_catalogs_get(options?.params),
        ...options?.query
    });
}
export function useList_catalogs_api_catalog_catalogs_getSuspense<TData = {
    data: unknown;
}>(options?: {
    params?: List_catalogs_api_catalog_catalogs_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: list_catalogs_api_catalog_catalogs_getKey(options?.params),
        queryFn: ()=>list_catalogs_api_catalog_catalogs_get(options?.params),
        ...options?.query
    });
}
export interface Check_permissions_api_catalog_check_permissions_postParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const check_permissions_api_catalog_check_permissions_post = async (data: PermissionCheckRequest, params?: Check_permissions_api_catalog_check_permissions_postParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/catalog/check-permissions", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useCheck_permissions_api_catalog_check_permissions_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: Check_permissions_api_catalog_check_permissions_postParams;
        data: PermissionCheckRequest;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>check_permissions_api_catalog_check_permissions_post(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface Get_current_user_api_catalog_me_getParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const get_current_user_api_catalog_me_get = async (params?: Get_current_user_api_catalog_me_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/catalog/me", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const get_current_user_api_catalog_me_getKey = (params?: Get_current_user_api_catalog_me_getParams)=>{
    return [
        "/api/catalog/me",
        params
    ] as const;
};
export function useGet_current_user_api_catalog_me_get<TData = {
    data: unknown;
}>(options?: {
    params?: Get_current_user_api_catalog_me_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: get_current_user_api_catalog_me_getKey(options?.params),
        queryFn: ()=>get_current_user_api_catalog_me_get(options?.params),
        ...options?.query
    });
}
export function useGet_current_user_api_catalog_me_getSuspense<TData = {
    data: unknown;
}>(options?: {
    params?: Get_current_user_api_catalog_me_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: get_current_user_api_catalog_me_getKey(options?.params),
        queryFn: ()=>get_current_user_api_catalog_me_get(options?.params),
        ...options?.query
    });
}
export interface List_schemas_api_catalog_schemas_getParams {
    catalog: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const list_schemas_api_catalog_schemas_get = async (params: List_schemas_api_catalog_schemas_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const searchParams = new URLSearchParams();
    if (params.catalog != null) searchParams.set("catalog", String(params.catalog));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/catalog/schemas?${queryString}` : "/api/catalog/schemas";
    const res = await fetch(url, {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const list_schemas_api_catalog_schemas_getKey = (params?: List_schemas_api_catalog_schemas_getParams)=>{
    return [
        "/api/catalog/schemas",
        params
    ] as const;
};
export function useList_schemas_api_catalog_schemas_get<TData = {
    data: unknown;
}>(options: {
    params: List_schemas_api_catalog_schemas_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: list_schemas_api_catalog_schemas_getKey(options.params),
        queryFn: ()=>list_schemas_api_catalog_schemas_get(options.params),
        ...options?.query
    });
}
export function useList_schemas_api_catalog_schemas_getSuspense<TData = {
    data: unknown;
}>(options: {
    params: List_schemas_api_catalog_schemas_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: list_schemas_api_catalog_schemas_getKey(options.params),
        queryFn: ()=>list_schemas_api_catalog_schemas_get(options.params),
        ...options?.query
    });
}
export interface List_tables_api_catalog_tables_getParams {
    catalog: string;
    schema: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const list_tables_api_catalog_tables_get = async (params: List_tables_api_catalog_tables_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const searchParams = new URLSearchParams();
    if (params.catalog != null) searchParams.set("catalog", String(params.catalog));
    if (params.schema != null) searchParams.set("schema", String(params.schema));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/catalog/tables?${queryString}` : "/api/catalog/tables";
    const res = await fetch(url, {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const list_tables_api_catalog_tables_getKey = (params?: List_tables_api_catalog_tables_getParams)=>{
    return [
        "/api/catalog/tables",
        params
    ] as const;
};
export function useList_tables_api_catalog_tables_get<TData = {
    data: unknown;
}>(options: {
    params: List_tables_api_catalog_tables_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: list_tables_api_catalog_tables_getKey(options.params),
        queryFn: ()=>list_tables_api_catalog_tables_get(options.params),
        ...options?.query
    });
}
export function useList_tables_api_catalog_tables_getSuspense<TData = {
    data: unknown;
}>(options: {
    params: List_tables_api_catalog_tables_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: list_tables_api_catalog_tables_getKey(options.params),
        queryFn: ()=>list_tables_api_catalog_tables_get(options.params),
        ...options?.query
    });
}
export interface List_warehouses_api_catalog_warehouses_getParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const list_warehouses_api_catalog_warehouses_get = async (params?: List_warehouses_api_catalog_warehouses_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/catalog/warehouses", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const list_warehouses_api_catalog_warehouses_getKey = (params?: List_warehouses_api_catalog_warehouses_getParams)=>{
    return [
        "/api/catalog/warehouses",
        params
    ] as const;
};
export function useList_warehouses_api_catalog_warehouses_get<TData = {
    data: unknown;
}>(options?: {
    params?: List_warehouses_api_catalog_warehouses_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: list_warehouses_api_catalog_warehouses_getKey(options?.params),
        queryFn: ()=>list_warehouses_api_catalog_warehouses_get(options?.params),
        ...options?.query
    });
}
export function useList_warehouses_api_catalog_warehouses_getSuspense<TData = {
    data: unknown;
}>(options?: {
    params?: List_warehouses_api_catalog_warehouses_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: list_warehouses_api_catalog_warehouses_getKey(options?.params),
        queryFn: ()=>list_warehouses_api_catalog_warehouses_get(options?.params),
        ...options?.query
    });
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export const extract_pdf_api_documents_extract_pdf_post = async (data: FormData, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/documents/extract-pdf", {
        ...options,
        method: "POST",
        headers: {
            ...options?.headers
        },
        body: data
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useExtract_pdf_api_documents_extract_pdf_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, FormData>;
}) {
    return useMutation({
        mutationFn: (data)=>extract_pdf_api_documents_extract_pdf_post(data),
        ...options?.mutation
    });
}
export const extract_url_api_documents_extract_url_post = async (data: UrlRequest, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/documents/extract-url", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useExtract_url_api_documents_extract_url_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, UrlRequest>;
}) {
    return useMutation({
        mutationFn: (data)=>extract_url_api_documents_extract_url_post(data),
        ...options?.mutation
    });
}
export interface List_rooms_api_genie_rooms_getParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const list_rooms_api_genie_rooms_get = async (params?: List_rooms_api_genie_rooms_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/genie/rooms", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const list_rooms_api_genie_rooms_getKey = (params?: List_rooms_api_genie_rooms_getParams)=>{
    return [
        "/api/genie/rooms",
        params
    ] as const;
};
export function useList_rooms_api_genie_rooms_get<TData = {
    data: unknown;
}>(options?: {
    params?: List_rooms_api_genie_rooms_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: list_rooms_api_genie_rooms_getKey(options?.params),
        queryFn: ()=>list_rooms_api_genie_rooms_get(options?.params),
        ...options?.query
    });
}
export function useList_rooms_api_genie_rooms_getSuspense<TData = {
    data: unknown;
}>(options?: {
    params?: List_rooms_api_genie_rooms_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: list_rooms_api_genie_rooms_getKey(options?.params),
        queryFn: ()=>list_rooms_api_genie_rooms_get(options?.params),
        ...options?.query
    });
}
export interface Link_room_api_genie_rooms__space_id__link_postParams {
    space_id: string;
}
export const link_room_api_genie_rooms__space_id__link_post = async (params: Link_room_api_genie_rooms__space_id__link_postParams, data: LinkRequest, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch(`/api/genie/rooms/${params.space_id}/link`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useLink_room_api_genie_rooms__space_id__link_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: Link_room_api_genie_rooms__space_id__link_postParams;
        data: LinkRequest;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>link_room_api_genie_rooms__space_id__link_post(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface Get_room_tables_api_genie_rooms__space_id__tables_getParams {
    space_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const get_room_tables_api_genie_rooms__space_id__tables_get = async (params: Get_room_tables_api_genie_rooms__space_id__tables_getParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch(`/api/genie/rooms/${params.space_id}/tables`, {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const get_room_tables_api_genie_rooms__space_id__tables_getKey = (params?: Get_room_tables_api_genie_rooms__space_id__tables_getParams)=>{
    return [
        "/api/genie/rooms/{space_id}/tables",
        params
    ] as const;
};
export function useGet_room_tables_api_genie_rooms__space_id__tables_get<TData = {
    data: unknown;
}>(options: {
    params: Get_room_tables_api_genie_rooms__space_id__tables_getParams;
    query?: Omit<UseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: get_room_tables_api_genie_rooms__space_id__tables_getKey(options.params),
        queryFn: ()=>get_room_tables_api_genie_rooms__space_id__tables_get(options.params),
        ...options?.query
    });
}
export function useGet_room_tables_api_genie_rooms__space_id__tables_getSuspense<TData = {
    data: unknown;
}>(options: {
    params: Get_room_tables_api_genie_rooms__space_id__tables_getParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: unknown;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: get_room_tables_api_genie_rooms__space_id__tables_getKey(options.params),
        queryFn: ()=>get_room_tables_api_genie_rooms__space_id__tables_get(options.params),
        ...options?.query
    });
}
export const generate_metadata_api_metadata_generate_post = async (data: GenerateRequest, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/metadata/generate", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useGenerate_metadata_api_metadata_generate_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, GenerateRequest>;
}) {
    return useMutation({
        mutationFn: (data)=>generate_metadata_api_metadata_generate_post(data),
        ...options?.mutation
    });
}
export interface Profile_tables_api_profiling_profile_postParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const profile_tables_api_profiling_profile_post = async (data: ProfileRequest, params?: Profile_tables_api_profiling_profile_postParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/profiling/profile", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useProfile_tables_api_profiling_profile_post(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: Profile_tables_api_profiling_profile_postParams;
        data: ProfileRequest;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>profile_tables_api_profiling_profile_post(vars.data, vars.params),
        ...options?.mutation
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
