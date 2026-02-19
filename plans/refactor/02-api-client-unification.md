# P1a — API 客戶端統一

> **優先順序：P1 — 高優先**  
> 30+ 個元件手動實現 fetch，造成錯誤處理不一致、難以全局修改（如加 retry 或 auth header）。

---

## 背景

專案已有 `src/lib/api/fetch-json.ts`，提供 `apiPost` 和 `apiFetchJson`，但只涵蓋 POST/GET 方法。
大量元件仍手動組裝 `fetch(url, { method, headers, body })`，導致：

- 錯誤處理各自為政（有些 check `res.ok`，有些不 check）
- `ApiError` 類別沒有被一致使用
- 未來如需加全域 auth token、retry 邏輯，需改 30+ 個地方

---

## 第一步：擴充 `lib/api/fetch-json.ts`

### 現況

```typescript
// src/lib/api/fetch-json.ts（現有）
export async function apiPost<T>(url: string, body: unknown): Promise<T> { ... }
export async function apiFetchJson<T>(url: string, init?: RequestInit): Promise<T> { ... }
export class ApiError extends Error { ... }
```

### 需新增

在 `src/lib/api/fetch-json.ts` 新增以下函式：

```typescript
/**
 * 發送 PATCH 請求並解析 JSON 回應。
 * 拋出 ApiError（包含 status code）於非 2xx 回應。
 */
export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * 發送 DELETE 請求。
 * 拋出 ApiError 於非 2xx 回應。
 * 若回應有 body 則解析，否則返回 undefined。
 */
export async function apiDelete<T = void>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

/**
 * 發送 PUT 請求並解析 JSON 回應。
 */
export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.json() as Promise<T>;
}
```

同時更新 `AGENTS.md` 的 Library Quick Reference 表格，加入新函式：

```markdown
| API Client | `import { apiPost, apiPatch, apiDelete, apiGet, ApiError } from '@/lib/api/fetch-json'` |
```

---

## 第二步：批量替換 raw fetch

### 受影響元件清單

以下元件需要將手動 fetch 替換為對應的 `api*` 函式：

#### 高影響元件（建議先處理）

**`src/components/post/PostActions.tsx`**

- 約第 127-133 行：`PATCH` 改狀態 → 替換為 `apiPatch`
- 約第 150-160 行：`PATCH` 取消刪除 → 替換為 `apiPatch`
- 約第 170-180 行：`DELETE` 刪除帖子 → 替換為 `apiDelete`

```typescript
// Before
const res = await fetch(`/api/posts/${postId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "PUBLISHED" }),
});
if (!res.ok) throw new Error("Failed to undelete post");

// After
await apiPatch(`/api/posts/${postId}`, { status: "PUBLISHED" });
```

**`src/components/board/BoardSettingsForm.tsx`**（4 個 raw fetch）

- Board 更新、封存、刪除等操作 → 替換為 `apiPatch` / `apiDelete`

**`src/components/board/BanActions.tsx`**

- 封禁/解除封禁 → 替換為 `apiPost` / `apiDelete`

**`src/components/board/BoardMemberManagement.tsx`**

- 成員管理 → 替換為對應方法

#### 中影響元件

**`src/app/settings/profile/profile-form.tsx`**

- 個人資料更新 → `apiPatch`

**`src/app/settings/avatar/avatar-form.tsx`**

- 注意：可能有 `FormData`（multipart），不適用 JSON 方法，需特別處理

**`src/app/login/login-form.tsx`** / **`src/app/register/register-form.tsx`**

- 登入/註冊 → `apiPost`

**`src/app/notifications/page.tsx`**

- 標記已讀 → `apiPatch`

**`src/components/board/BoardInfoCard.tsx`**

- 加入/離開 board → `apiPost` / `apiDelete`

**`src/components/board/CreateBoardForm.tsx`**

- 建立 board → `apiPost`

**`src/components/board/BoardLayout.tsx`**

- 相關操作 → 對應方法

**`src/components/board/UnarchiveButton.tsx`**

- 解封存 → `apiPatch`

**`src/components/post/PollDisplay.tsx`**

- 投票 → `apiPost`

**`src/components/ui/SafeHtml.tsx`**（若有 fetch）

- 確認並替換

### 注意事項

1. **FormData 請求**（圖片上傳等）**不使用** `apiPost`，保留原始 `fetch`，因為 Content-Type 需要是 `multipart/form-data`（由瀏覽器自動設定）。

2. **錯誤處理統一模式**：替換後，catch 區塊應捕獲 `ApiError`：

   ```typescript
   try {
     await apiPatch(url, body);
   } catch (err) {
     if (err instanceof ApiError) {
       setError(err.message);
     } else {
       setError("Unexpected error");
     }
   }
   ```

3. **401 處理**：如果 API 回應 401，考慮在 `fetch-json.ts` 的錯誤路徑中觸發 `useLoginModal` 的 `open()`（可在未來的 interceptor 中統一處理）。

---

## 第三步：更新 AGENTS.md

確認 `AGENTS.md` 中的 Library Quick Reference 更新為：

```markdown
| API Client | `import { apiPost, apiPatch, apiDelete, apiPut, ApiError } from '@/lib/api/fetch-json'` |
```

---

## 驗收標準

- [ ] `src/lib/api/fetch-json.ts` 新增 `apiPatch`, `apiDelete`, `apiPut` 函式。
- [ ] 所有標記的元件替換完畢，無殘留 `method: "PATCH"` / `method: "DELETE"` 的 raw fetch（圖片上傳除外）。
- [ ] 錯誤處理統一使用 `ApiError`。
- [ ] `pnpm test` 全部通過。
- [ ] 手動測試：帖子刪除、Board 設定更新、個人資料更新等操作正常。
