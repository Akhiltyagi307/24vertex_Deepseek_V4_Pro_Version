# Admin shared list loaders

Centralised pagination + filter parsing for admin list endpoints.

## Why

Before this module each admin list page repeated:

```ts
const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") ?? "25") || 25));
```

Twelve+ copies, no shared cap, one bug from an unbounded read. D17 of the
2026-05-17 admin audit asked for a shared helper. This module is it.

## Use it

```ts
import { parseAdminListQuery } from "@/lib/admin/loaders";
import { adminListResponse } from "@/lib/admin/response";
import { z } from "zod";

const ListQuery = z.object({
  q: z.string().optional(),
  status: z.enum(["draft", "scheduled", "sent"]).optional(),
}).strict();

export async function GET(request: NextRequest) {
  const { page, pageSize, offset, filters } = parseAdminListQuery(
    request.nextUrl.searchParams,
    ListQuery,
  );
  // …query DB with .limit(pageSize).offset(offset)…
  return adminListResponse({ data: rows, total, page, pageSize });
}
```

## Migration order

1. `app/api/admin/audit/route.ts`
2. `app/api/admin/billing/coupons/route.ts`
3. `app/api/admin/communications/broadcasts/route.ts`
4. `app/api/admin/curriculum/context-chunks/route.ts`
5. `app/api/admin/users/teachers/route.ts`

The remaining list endpoints can adopt the helper opportunistically.
