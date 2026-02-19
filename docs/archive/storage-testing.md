# Storage 測試說明

> 說明 Storage 測試的執行方式和清理機制

---

## 🧪 測試概覽

Storage 測試已整合進 Vitest，執行 `npm test` 會自動測試所有 Storage 功能。

### 測試內容

| 測試分類             | 測試數量 | 說明                      |
| -------------------- | -------- | ------------------------- |
| Bucket Configuration | 2        | 驗證 bucket 存在和配置    |
| File Operations      | 5        | 上傳、下載、列表、刪除    |
| Path Structure       | 2        | 用戶和 Persona 資料夾結構 |
| Storage Policies     | 2        | Service role 權限測試     |
| File Validation      | 2        | 檔案大小和類型驗證        |
| Bucket Info          | 1        | Bucket 配置檢查           |
| **總計**             | **14**   | -                         |

---

## 🚀 執行測試

```bash
# 執行所有測試（包括 storage）
npm test

# 只執行 storage 測試
npm test -- src/lib/supabase/__tests__/storage.test.ts

# Watch 模式
npm run test:watch
```

---

## 🧹 自動清理機制

### 清理流程

測試會自動清理所有上傳的檔案：

1. **追蹤上傳**: 每次成功上傳時，使用 `trackUpload(path)` 記錄檔案路徑
2. **批次刪除**: 測試結束時，以 10 個檔案為一批次刪除（Supabase 限制）
3. **錯誤處理**: 如果刪除失敗，會記錄錯誤但不影響測試結果

### 清理輸出範例

```
Cleaning up 15 test file(s)...
✓ Deleted 10 file(s) (batch 1)
✓ Deleted 5 file(s) (batch 2)
✅ Cleanup complete! Removed 15 test file(s)
```

---

## 📊 測試輸出

### 成功範例

```
stdout | src/lib/supabase/__tests__/storage.test.ts > Supabase Storage
Testing Storage Bucket: media
Bucket size limit: 10 MB

stdout | src/lib/supabase/__tests__/storage.test.ts > Supabase Storage > File Validation > should reject files exceeding size limit (10 MB)
Expected error for large file: The object exceeded the maximum allowed size

stdout | src/lib/supabase/__tests__/storage.test.ts > Supabase Storage
Cleaning up 15 test file(s)...
✓ Deleted 10 file(s) (batch 1)
✓ Deleted 5 file(s) (batch 2)
✅ Cleanup complete! Removed 15 test file(s)

✓ src/lib/supabase/__tests__/storage.test.ts (14 tests) 9406ms
  ✓ Supabase Storage > Bucket Configuration > should list all buckets 539ms
  ✓ Supabase Storage > Bucket Configuration > should have media bucket configured 307ms
  ✓ Supabase Storage > File Operations > should upload a text file 643ms
  ✓ Supabase Storage > File Operations > should upload an image file 716ms
  ✓ Supabase Storage > File Operations > should generate public URL for uploaded file 926ms
  ✓ Supabase Storage > File Operations > should list files in a folder 328ms
  ✓ Supabase Storage > File Operations > should delete a file 412ms
  ✓ Supabase Storage > Path Structure > should support user folder structure 938ms
  ✓ Supabase Storage > Path Structure > should support persona folder structure 379ms
  ✓ Supabase Storage > Storage Policies > should allow service role to upload to any path 593ms
  ✓ Supabase Storage > Storage Policies > should allow service role to delete any file 453ms
  ✓ Supabase Storage > File Validation > should reject files exceeding size limit (10 MB) 1344ms
  ✓ Supabase Storage > File Validation > should accept valid image types 1024ms
  ✓ Supabase Storage > Bucket Info > should have correct bucket configuration 242ms

Test Files  1 passed (1)
     Tests  14 passed (14)
```

---

## 🔧 測試配置

### Bucket 限制

| 設定              | 值                                           |
| ----------------- | -------------------------------------------- |
| Bucket 名稱       | `media`                                      |
| Public            | ✅ Yes                                       |
| 檔案大小限制      | 10 MB (10485760 bytes)                       |
| 允許的 MIME types | image/jpeg, image/png, image/webp, image/gif |

### 測試檔案

測試會上傳以下類型的檔案：

- 純文字檔 (`.txt`)
- PNG 圖片 (`.png`) - 1x1 像素測試圖片
- JPG 圖片 (`.jpg`)
- WebP 圖片 (`.webp`)
- GIF 圖片 (`.gif`)
- 大檔案 (11 MB) - 用於測試大小限制

---

## 🗂️ 測試路徑結構

測試會驗證以下路徑結構：

```
media/
├── test/
│   ├── {timestamp}-test.txt
│   ├── {timestamp}-test-image.png
│   ├── {timestamp}-public-url-test.txt
│   ├── {timestamp}-test.jpg
│   ├── {timestamp}-test.webp
│   └── {timestamp}-test.gif
│
├── test-user-id/
│   ├── posts/test-post.txt
│   ├── avatars/test-avatar.txt
│   └── boards/test-board.txt
│
├── personas/
│   ├── avatars/
│   │   ├── test-persona-avatar.txt
│   │   └── service-test.txt
│   └── posts/
│       └── test-persona-id/test-post.txt
│
└── random/
    └── path/
        └── to/file.txt
```

**所有檔案都會在測試結束時自動刪除！**

---

## ⚠️ 注意事項

### 測試環境要求

1. **環境變數**: 必須設定所有必要的環境變數

   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="eyJxxx..."
   SUPABASE_STORAGE_BUCKET="media"
   ```

2. **Bucket 存在**: `media` bucket 必須已在 Supabase 建立

3. **Storage Policies**: 必須已設定正確的 RLS policies

### 測試時間

- 完整測試需要約 **9-10 秒**
- 大部分時間花在網路請求上
- 清理流程約需 **1-2 秒**

### 失敗處理

如果測試失敗但檔案已上傳：

```bash
# 手動清理測試檔案
npm test -- src/lib/supabase/__tests__/storage.test.ts
```

或使用 SQL 清理：

```sql
-- 刪除所有 test/ 資料夾的檔案
delete from storage.objects
where bucket_id = 'media'
  and name like 'test/%';

-- 刪除測試用戶的檔案
delete from storage.objects
where bucket_id = 'media'
  and name like 'test-user-id/%';

-- 刪除 personas 測試檔案
delete from storage.objects
where bucket_id = 'media'
  and name like 'personas/avatars/test-%'
  or name like 'personas/avatars/service-%'
  or name like 'personas/posts/test-%';
```

---

## 📝 程式碼範例

### 追蹤上傳的檔案

```typescript
const uploadedFiles: string[] = [];

const trackUpload = (path: string) => {
  uploadedFiles.push(path);
};

// 使用範例
const testPath = `test/${Date.now()}-test.txt`;
const { data, error } = await supabase.storage.from("media").upload(testPath, "content");

if (!error) {
  trackUpload(testPath); // 記錄成功上傳的檔案
}
```

### 批次清理

```typescript
afterAll(async () => {
  if (uploadedFiles.length > 0) {
    console.log(`Cleaning up ${uploadedFiles.length} test file(s)...`);

    const batchSize = 10;
    for (let i = 0; i < uploadedFiles.length; i += batchSize) {
      const batch = uploadedFiles.slice(i, i + batchSize);
      const { error } = await supabase.storage.from("media").remove(batch);

      if (error) {
        console.error(`Failed to delete batch ${i / batchSize + 1}:`, error.message);
      } else {
        console.log(`✓ Deleted ${batch.length} file(s) (batch ${i / batchSize + 1})`);
      }
    }

    console.log(`✅ Cleanup complete! Removed ${uploadedFiles.length} test file(s)`);
  }
});
```

---

## 🔍 除錯

### 查看測試上傳的檔案

```sql
-- 列出所有測試檔案
select
  name,
  created_at,
  metadata->>'size' as size_bytes,
  metadata->>'mimetype' as mime_type
from storage.objects
where bucket_id = 'media'
  and (
    name like 'test/%'
    or name like 'test-user-id/%'
    or name like 'personas/avatars/test-%'
  )
order by created_at desc;
```

### 驗證清理結果

```sql
-- 檢查是否還有測試檔案殘留
select count(*) as remaining_test_files
from storage.objects
where bucket_id = 'media'
  and (
    name like 'test/%'
    or name like 'test-user-id/%'
    or name like 'personas/avatars/test-%'
    or name like 'personas/avatars/service-%'
  );
```

預期結果: `0` (沒有殘留的測試檔案)

---

## 📚 相關檔案

- 測試檔案: `src/lib/supabase/__tests__/storage.test.ts`
- Vitest 配置: `vitest.config.ts`
- 環境變數: `src/lib/env.ts`
- Admin Client: `src/lib/supabase/admin.ts`

---

## ✅ 檢查清單

測試通過時應該看到：

- [ ] 所有 14 個測試通過
- [ ] 大小限制測試正確拒絕 11 MB 檔案
- [ ] 清理訊息顯示刪除的檔案數量
- [ ] 測試時間在 10 秒內完成
- [ ] 無錯誤或警告訊息
