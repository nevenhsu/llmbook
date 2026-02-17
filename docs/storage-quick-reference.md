# Supabase Storage 快速參考

> 快速查閱常用的 Storage 操作

---

## 🚀 快速開始

### 1. 測試 Storage 設定

```bash
# 執行所有測試（包括 storage）
npm test

# 只執行 storage 測試
npm test -- src/lib/supabase/__tests__/storage.test.ts

# Watch 模式
npm run test:watch
```

### 2. 使用現有函數上傳圖片 (Browser)

```typescript
import { uploadImage } from "@/lib/image-upload";

const result = await uploadImage(file, {
  maxWidth: 2048,
  maxBytes: 5 * 1024 * 1024,
  quality: 82,
});

console.log(result.url); // Public URL
console.log(result.width); // 1920
console.log(result.height); // 1080
console.log(result.sizeBytes); // 245678
```

### 3. 使用 Admin Client (Server-side)

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { privateEnv } from "@/lib/env";

const supabase = createAdminClient();

// 上傳
const { data, error } = await supabase.storage
  .from(privateEnv.storageBucket)
  .upload("path/to/file.png", fileBuffer);

// 取得 Public URL
const { data: urlData } = supabase.storage
  .from(privateEnv.storageBucket)
  .getPublicUrl("path/to/file.png");

console.log(urlData.publicUrl);
```

---

## 📁 路徑結構範例

```typescript
// 用戶貼文圖片
`${userId}/posts/${Date.now()}-${uuid()}.webp`
// 123e4567-e89b-12d3-a456-426614174000/posts/1707565200000-abc123.webp

// 用戶頭像
`${userId}/avatars/avatar-${Date.now()}.webp`
// 123e4567-e89b-12d3-a456-426614174000/avatars/avatar-1707565200000.webp

// 看板橫幅
`${userId}/boards/banner-${boardId}-${Date.now()}.webp`
// 123e4567-e89b-12d3-a456-426614174000/boards/banner-board-001-1707565200000.webp

// Persona 頭像
`personas/avatars/${personaId}.webp`
// personas/avatars/persona-001.webp

// Persona 貼文圖片
`personas/posts/${personaId}/${Date.now()}.webp`;
// personas/posts/persona-001/1707565200000.webp
```

---

## 🔧 常用操作

### 上傳檔案

```typescript
const { data, error } = await supabase.storage
  .from("media")
  .upload("path/to/file.png", fileBuffer, {
    contentType: "image/png",
    upsert: false, // true = 覆蓋同名檔案
    cacheControl: "3600", // Cache 1 hour
  });

if (error) {
  console.error("Upload failed:", error.message);
} else {
  console.log("Uploaded:", data.path);
}
```

### 取得公開 URL

```typescript
const { data } = supabase.storage.from("media").getPublicUrl("path/to/file.png");

console.log(data.publicUrl);
// https://xxx.supabase.co/storage/v1/object/public/media/path/to/file.png
```

### 列出檔案

```typescript
const { data, error } = await supabase.storage.from("media").list("folder/path", {
  limit: 100,
  offset: 0,
  sortBy: { column: "created_at", order: "desc" },
});

data.forEach((file) => {
  console.log(file.name, file.metadata.size);
});
```

### 下載檔案

```typescript
const { data, error } = await supabase.storage.from("media").download("path/to/file.png");

if (data) {
  const blob = data;
  const url = URL.createObjectURL(blob);
  // Use the URL for <img> or download
}
```

### 刪除檔案

```typescript
// 刪除單一檔案
const { error } = await supabase.storage.from("media").remove(["path/to/file.png"]);

// 刪除多個檔案
const { error } = await supabase.storage
  .from("media")
  .remove(["path/to/file1.png", "path/to/file2.png", "path/to/file3.png"]);
```

### 移動/重新命名檔案

```typescript
const { data, error } = await supabase.storage
  .from("media")
  .move("old/path/file.png", "new/path/file.png");
```

### 複製檔案

```typescript
const { data, error } = await supabase.storage
  .from("media")
  .copy("source/path/file.png", "destination/path/file.png");
```

---

## 🔐 權限說明

### Public (任何人)

- ✅ 讀取所有圖片

### Authenticated (認證用戶)

- ✅ 上傳到自己的資料夾: `{user_id}/*`
- ✅ 更新自己的圖片: `{user_id}/*`
- ✅ 刪除自己的圖片: `{user_id}/*`
- ❌ 無法上傳到其他人的資料夾

### Service Role (Persona Engine)

- ✅ 上傳到任何路徑
- ✅ 更新任何圖片
- ✅ 刪除任何圖片

---

## ⚠️ 限制

| 限制          | 值       | 說明                 |
| ------------- | -------- | -------------------- |
| 檔案大小      | 10 MB    | 可在 Dashboard 調整  |
| MIME types    | image/\* | jpeg, png, webp, gif |
| Public bucket | Yes      | 允許公開存取         |

---

## 📝 環境變數

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="eyJxxx..."
SUPABASE_SERVICE_ROLE_KEY="eyJxxx..."        # ⚠️ Server-only
SUPABASE_STORAGE_BUCKET="media"
```

---

## 🐛 除錯指令

### 檢查 Bucket 設定

```sql
select * from storage.buckets where id = 'media';
```

### 檢查 Policies

```sql
select policyname, roles, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```

### 列出最近上傳的檔案

```sql
select name, created_at, metadata->>'size' as size_bytes
from storage.objects
where bucket_id = 'media'
order by created_at desc
limit 10;
```

### 刪除測試檔案

```sql
delete from storage.objects
where bucket_id = 'media'
  and name like 'test/%';
```

---

## 📚 相關檔案

| 檔案                                                | 說明             |
| --------------------------------------------------- | ---------------- |
| `src/lib/supabase/__tests__/storage.test.ts`        | Storage 測試     |
| `src/lib/image-upload.ts`                           | 圖片上傳函數     |
| `src/lib/supabase/admin.ts`                         | Admin Client     |
| `src/lib/env.ts`                                    | 環境變數         |
| `supabase/migrations/20260210_storage_policies.sql` | Storage Policies |
| `docs/storage-setup.md`                             | 完整設定指南     |

---

## 🎯 下一步

1. ✅ Storage bucket 已建立
2. ✅ Policies 已設定
3. ✅ 測試整合進 npm test
4. ⬜ 實作圖片上傳 API route
5. ⬜ 建立圖片上傳 UI 元件
6. ⬜ 整合 Persona Engine
