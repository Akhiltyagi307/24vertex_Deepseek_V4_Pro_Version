"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { z } from "zod";

import { fetchJson, isAbortError, type SentryTags } from "@/lib/http/fetch-json";

export type JsonResource<T> = {
	data: T | null;
	error: string | null;
	loading: boolean;
	/** Refetch on demand. Safe against out-of-order responses and unmount. */
	reload: () => void;
};

export type UseJsonResourceOptions<T> = {
	/** Validate the response body against this schema before exposing it. */
	schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
	/** When false, no request is made (e.g. gate on auth or an open panel). */
	enabled?: boolean;
	/** Server-seeded value; when present, the hook starts non-loading. */
	initialData?: T | null;
	/** Sentry tags for failure reporting (passed through to {@link fetchJson}). */
	report?: SentryTags;
};

/**
 * The standard way to GET JSON in a client component: an `AbortController` per
 * load, a request-id guard so a slow response can't overwrite a newer one, and
 * automatic abort on unmount / url change. Replaces the ad-hoc
 * `useEffect(() => { fetch(...).then(setState) }, [])` pattern that leaks
 * stale renders. For bespoke flows (the streak widget) call {@link fetchJson}
 * directly instead.
 */
export function useJsonResource<T>(
	url: string | null,
	options: UseJsonResourceOptions<T> = {},
): JsonResource<T> {
	const { schema, enabled = true, initialData = null, report } = options;

	const [data, setData] = useState<T | null>(initialData);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(enabled && url !== null && initialData == null);

	// Latest values without retriggering `load`'s identity (callers usually pass
	// inline object literals for schema/report, which change every render).
	const schemaRef = useRef(schema);
	schemaRef.current = schema;
	const reportRef = useRef(report);
	reportRef.current = report;

	const reqIdRef = useRef(0);
	const acRef = useRef<AbortController | null>(null);

	const load = useCallback(async () => {
		if (!url) return;
		const reqId = ++reqIdRef.current;
		acRef.current?.abort();
		const ac = new AbortController();
		acRef.current = ac;
		setLoading(true);
		setError(null);
		try {
			const result = await fetchJson<T>(url, {
				schema: schemaRef.current,
				signal: ac.signal,
				report: reportRef.current,
			});
			if (reqId !== reqIdRef.current) return;
			setData(result);
		} catch (err) {
			if (reqId !== reqIdRef.current || isAbortError(err)) return;
			setError(err instanceof Error ? err.message : "Request failed.");
		} finally {
			if (reqId === reqIdRef.current) setLoading(false);
		}
	}, [url]);

	useEffect(() => {
		if (!enabled || !url) return;
		void load();
		return () => {
			acRef.current?.abort();
		};
	}, [enabled, url, load]);

	const reload = useCallback(() => {
		void load();
	}, [load]);

	return { data, error, loading, reload };
}
