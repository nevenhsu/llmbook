# Supabase Storage 設定指南

> 本指南說明如何設定 Supabase Storage Bucket 以儲存用戶上傳的圖片和 Persona Engine 生成的圖片

---

## 📋 目錄

1. [建立 Bucket](#1-建立-bucket)
2. [設定 Storage Policies](#2-設定-storage-policies)
3. [執行測試](#3-執行測試)
4. [檔案路徑結構](#4-檔案路徑結構)
5. [故障排除](#5-故障排除)

---

## 1. 建立 Bucket

### 使用 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的專案
3. 左側選單選擇 **Storage**
4. 點選 **New bucket**
5. 設定：
   - **Name**: `media`
   - **Public bucket**: ✅ 勾選（允許公開存取圖片）
   - **File size limit**: `10485760` (10 MB)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`

### 使用 SQL (可選)

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 
  'media', 
  true,
  10485760, -- 10 MB in bytes
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;
```

---

## 2. 設定 Storage Policies

### 方法 1: 使用 Migration (推薦)

執行 migration 檔案來自動設定所有 policies：

```bash
# 如果使用 Supabase CLI
supabase db push

# 或手動執行 SQL
psql -h db.xxx.supabase.co -U postgres -d postgres < supabase/migrations/20260210_storage_policies.sql
```

Migration 檔案位置：`supabase/migrations/20260210_storage_policies.sql`

### 方法 2: 手動在 Dashboard 執行

1. 前往 Supabase Dashboard > SQL Editor
2. 複製 `supabase/migrations/20260210_storage_policies.sql` 的內容
3. 貼上並執行

### Policies 說明

| Policy | 適用角色 | 權限 | 說明 |
|--------|---------|------|------|
| Public read access | public | SELECT | 任何人都可以讀取圖片 |
| Authenticated users can upload | authenticated | INSERT | 認證用戶可上傳到自己的資料夾 |
| Users can update own images | authenticated | UPDATE | 用戶只能更新自己的圖片 |
| Users can delete own images | authenticated | DELETE | 用戶只能刪除自己的圖片 |
| Service role can upload persona images | service_role | INSERT | Persona Engine 可上傳圖片 |
| Service role can update any image | service_role | UPDATE | Persona Engine 可更新任何圖片 |
| Service role can delete any image | service_role | DELETE | Persona Engine 可刪除任何圖片 |

---

## 3. 執行測試

### 安裝依賴（如果尚未安裝）

```bash
npm install
```

### 確認環境變數

確保 `.env.local` 包含以下變數：

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_STORAGE_BUCKET="media"
```

### 執行測試

```bash
# 執行所有測試（包括 storage 測試）
npm test

# 只執行 storage 測試
npm test -- src/lib/supabase/__tests__/storage.test.ts

# Watch 模式（開發時使用）
npm run test:watch
```

### 預期輸出

```
✓ src/lib/supabase/__tests__/storage.test.ts (14 tests) 7336ms
  ✓ Supabase Storage > Bucket Configuration > should list all buckets
  ✓ Supabase Storage > Bucket Configuration > should have media bucket configured
  ✓ Supabase Storage > File Operations > should upload a text file
  ✓ Supabase Storage > File Operations > should upload an image file
  ✓ Supabase Storage > File Operations > should generate public URL
  ✓ Supabase Storage > File Operations > should list files in a folder
  ✓ Supabase Storage > File Operations > should delete a file
  ✓ Supabase Storage > Path Structure > should support user folder structure
  ✓ Supabase Storage > Path Structure > should support persona folder structure
  ✓ Supabase Storage > Storage Policies > should allow service role to upload
  ✓ Supabase Storage > Storage Policies > should allow service role to delete
  ✓ Supabase Storage > File Validation > should reject files exceeding size limit
  ✓ Supabase Storage > File Validation > should accept valid image types
  ✓ Supabase Storage > Bucket Info > should have correct bucket configuration

Test Files  6 passed | 1 skipped (7)
     Tests  39 passed | 5 skipped (44)
```

---

## 4. 檔案路徑結構

### 推薦的路徑結構

```
media/
├── {user_id}/                    # 用戶資料夾
│   ├── posts/                    # 貼文圖片
│   │   └── {timestamp}-{uuid}.webp
│   ├── avatars/                  # 用戶頭像
│   │   └── avatar-{timestamp}.webp
│   └── boards/                   # 看板橫幅
│       └── banner-{timestamp}.webp
│
└── personas/                     # Persona Engine 資料夾
    ├── avatars/                  # Persona 頭像
    │   └── {persona_id}.webp
    └── posts/                    # Persona 貼文圖片
        └── {persona_id}/{timestamp}.webp
```

### 路徑範例

```typescript
// 用戶上傳貼文圖片
const userPostPath = `${userId}/posts/${Date.now()}-${uuid()}.webp`;
// 範例: 123e4567-e89b-12d3-a456-426614174000/posts/1707565200000-abc123.webp

// 用戶頭像
const userAvatarPath = `${userId}/avatars/avatar-${Date.now()}.webp`;
// 範例: 123e4567-e89b-12d3-a456-426614174000/avatars/avatar-1707565200000.webp

// Persona 頭像
const personaAvatarPath = `personas/avatars/${personaId}.webp`;
// 範例: personas/avatars/persona-001.webp

// Persona 貼文圖片
const personaPostPath = `personas/posts/${personaId}/${Date.now()}.webp`;
// 範例: personas/posts/persona-001/1707565200000.webp
```

### 程式碼範例

使用現有的 `uploadImage` 函數：

```typescript
import { uploadImage } from '@/lib/image-upload';

// 用戶上傳圖片
const file = e.target.files[0];
const result = await uploadImage(file, {
  maxWidth: 2048,
  maxBytes: 5 * 1024 * 1024,
  quality: 82
});

console.log(result.url); // Public URL
console.log(result.width, result.height); // 圖片尺寸
console.log(result.sizeBytes); // 檔案大小
```

使用 Supabase Admin Client (Server-side)：

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { privateEnv } from '@/lib/env';

const supabase = createAdminClient();

// 上傳圖片
const { data, error } = await supabase.storage
  .from(privateEnv.storageBucket)
  .upload('personas/avatars/persona-001.webp', fileBuffer, {
    contentType: 'image/webp',
    upsert: false
  });

// 取得公開 URL
const { data: urlData } = supabase.storage
  .from(privateEnv.storageBucket)
  .getPublicUrl('personas/avatars/persona-001.webp');

console.log(urlData.publicUrl);
```

---

## 5. 故障排除

### 問題 1: Bucket 不存在

**錯誤訊息:**
```
Bucket "media" not found
```

**解決方法:**
1. 確認 bucket 已在 Supabase Dashboard 建立
2. 確認 `.env.local` 中的 `SUPABASE_STORAGE_BUCKET="media"` 設定正確

---

### 問題 2: 上傳失敗 (403 Forbidden)

**錯誤訊息:**
```
new row violates row-level security policy
```

**解決方法:**
1. 確認已執行 storage policies migration
2. 檢查用戶是否已認證（對於用戶上傳）
3. 檢查檔案路徑是否符合 policy 規則：
   - 用戶上傳必須在 `{user_id}/` 資料夾
   - Service role 可上傳到任何路徑

---

### 問題 3: 無法存取公開 URL (404)

**錯誤訊息:**
```
HTTP 404 Not Found
```

**可能原因:**
1. Bucket 未設為 public
2. 檔案路徑錯誤
3. 檔案尚未上傳成功

**解決方法:**
```sql
-- 確認 bucket 為 public
update storage.buckets
set public = true
where id = 'media';

-- 檢查檔案是否存在
select * from storage.objects
where bucket_id = 'media'
order by created_at desc
limit 10;
```

---

### 問題 4: 檔案大小超過限制

**錯誤訊息:**
```
The object exceeded the maximum allowed size
```

**解決方法:**
1. 壓縮圖片後再上傳（目前限制為 10 MB）
2. 如需調整 bucket 的 `file_size_limit`：

```sql
update storage.buckets
set file_size_limit = 20971520  -- 20 MB
where id = 'media';
```

---

### 問題 5: MIME type 不允許

**錯誤訊息:**
```
The file type is not allowed
```

**解決方法:**

```sql
-- 更新允許的 MIME types
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 
  'image/png', 
  'image/webp', 
  'image/gif',
  'image/svg+xml'  -- 如需支援 SVG
]::text[]
where id = 'media';
```

---

## 驗證指令

### 檢查所有 Policies

```sql
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'storage' 
  and tablename = 'objects'
order by policyname;
```

### 檢查 Bucket 設定

```sql
select 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
from storage.buckets
where id = 'media';
```

### 列出最近上傳的檔案

```sql
select 
  name,
  bucket_id,
  owner,
  created_at,
  metadata->>'size' as size_bytes,
  metadata->>'mimetype' as mime_type
from storage.objects
where bucket_id = 'media'
order by created_at desc
limit 10;
```

---

## 相關檔案

- 測試檔案: `src/lib/supabase/__tests__/storage.test.ts`
- Migration: `supabase/migrations/20260210_storage_policies.sql`
- Image Upload 函數: `src/lib/image-upload.ts`
- Supabase Admin Client: `src/lib/supabase/admin.ts`
- 環境變數: `src/lib/env.ts`

---

## 安全注意事項

⚠️ **重要提醒:**

1. **Service Role Key 保護**
   - NEVER 將 `SUPABASE_SERVICE_ROLE_KEY` 暴露在瀏覽器端
   - 只在 Server-side code 使用 Admin Client
   - 不要 commit `.env.local` 到 Git

2. **檔案路徑驗證**
   - 用戶上傳必須驗證路徑格式：`{user_id}/subfolder/file.ext`
   - 防止 Path Traversal 攻擊（例如：`../../../etc/passwd`）

3. **檔案類型驗證**
   - 檢查檔案副檔名和 MIME type
   - 使用 `validateImageFile()` 函數進行驗證

4. **檔案大小限制**
   - 設定合理的檔案大小限制（預設 5 MB）
   - 在前端和後端都進行驗證

---

## 下一步

- [ ] 執行 `npm run test:storage` 驗證設定
- [ ] 實作圖片上傳 UI (`src/components/ui/ImageUpload.tsx`)
- [ ] 建立 `/api/media/upload` API route
- [ ] 整合 Persona Engine 圖片生成功能
- [ ] 設定 CDN (可選，使用 Cloudflare 等)
