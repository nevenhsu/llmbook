# Bug 記錄 - BUG-002 (更新)

## 基本資訊

| 項目 | 內容 |
|------|------|
| **Bug ID** | BUG-002 |
| **發現日期** | 2026-02-08 |
| **嚴重程度** | P0 - 致命 |
| **測試項目** | 註冊流程 - 資料同步 |
| **標題** | Supabase Authentication 成功註冊後, profiles 沒有增加 doc |
| **狀態** | Open |

---

## 問題描述

註冊流程成功後，Supabase Auth 中有用戶資料，但 `profiles` 表沒有對應的記錄。導致後續功能（如顯示用戶名、頭像等）無法正常運作。

**根本原因**: 剛才移除了註冊表單中的 display_name 欄位，但後端邏輯仍嘗試寫入 profiles 表，而現在程式碼已跳過這個步驟。

---

## 重現步驟

1. 訪問 `/register`
2. 填寫 Email 和 Password（未填 Display Name）
3. 提交註冊
4. 檢查 Supabase Auth - 用戶已創建 ✓
5. 檢查 profiles 表 - 無對應記錄 ✗

---

## 期望結果

**架構調整**: 統一使用 Supabase Authentication 管理用戶基本資料，移除 profiles 表

- 將 `profiles.display_name` → 遷移到 Auth `user.user_metadata.display_name`
- 將 `profiles.avatar_url` → 遷移到 Auth `user.user_metadata.avatar_url`
- 將 `profiles.bio` → 遷移到 Auth `user.user_metadata.bio`
- 刪除 `profiles` 表
- 更新所有查詢 profiles 的程式碼

---

## 實際結果

- Auth 用戶已創建
- profiles 表無資料
- 系統依賴 profiles 表的查詢都會失敗

---

## 影響範圍

以下功能會受影響：
1. 顯示用戶名稱（顯示為 email 而非 display_name）
2. 用戶頭像顯示
3. 用戶個人資料頁
4. 帖子/評論的作者資訊顯示
5. 通知系統

---

## 解決方案選項

### 方案 A: 修復現有流程（快速修復）
在註冊時自動創建 profiles 記錄，display_name 預設為 email prefix

**優點**: 快速修復，不改架構
**缺點**: 維護兩份資料，技術債

### 方案 B: 遷移到 Supabase Auth（建議）
完全移除 profiles 表，統一使用 Auth metadata

**優點**: 
- 單一資料源
- 減少複雜度
- 符合 Supabase 最佳實踐

**缺點**: 
- 需要改動多個檔案
- 需要資料遷移腳本

---

## 相關程式碼

**註冊表單**: `src/app/register/register-form.tsx`
**Profiles 表**: `supabase/migrations/`
**Profiles 查詢**: 多個元件使用 `supabase.from('profiles').select()`

---

## 環境資訊

- **瀏覽器**: Chrome
- **設備**: 桌面

---

## 備註

這是一個架構層面的問題。建議採用方案 B（遷移到 Supabase Auth），但需要：
1. 評估影響範圍
2. 制定遷移計畫
3. 執行資料遷移
4. 更新所有相關程式碼

---

## 更新記錄

| 日期 | 動作 | 說明 |
|------|------|------|
| 2026-02-08 | 創建 | 初始記錄 |
| 2026-02-08 | 升級 | 從 P3 升級為 P0 |
| 2026-02-08 | 修復方案 | 創建 migration 009 自動創建 profile |

---

## 修復方案

已創建 migration 文件：`supabase/migrations/009_fix_profile_creation.sql`

### 方案: Database Trigger (推薦)

在 auth.users 上創建 trigger，當新用戶註冊時自動創建 profile 記錄。

**優點**:
- 不需要修改應用程式碼
- 即使從其他地方創建用戶也會生效
- 資料一致性由數據庫保證

**實現內容**:
1. 創建 `handle_new_user()` 函數
2. 設置 display_name 為 email 前綴（如 `user@example.com` → `user`）
3. 創建 trigger 在 INSERT 時自動執行
4. 回填現有無 profile 的用戶

### 執行步驟

```bash
# 1. 應用 migration
supabase db push

# 或手動執行 SQL
psql -d your_database -f supabase/migrations/009_fix_profile_creation.sql
```

### 關於架構遷移的建議

雖然可以將 profiles 遷移到 Auth metadata，但建議 **保留 profiles 表**，原因：
1. `posts` 表有外鍵約束 `references public.profiles(user_id)`
2. `karma` 等計算欄位不適合放在 Auth metadata
3. 查詢效率：profiles 表可以建索引，Auth metadata 需要額外查詢

**最佳實踐**: 保持現有架構，但確保 profile 自動創建。
