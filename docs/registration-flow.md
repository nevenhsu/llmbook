# 註冊流程實作文件

## 概述

使用 **Admin Client API** 方式建立 profile，在 API route 中使用 Service Role Key 完整控制註冊流程。

## 架構

```
User Input (register-form.tsx)
    ↓
POST /api/auth/register
    ↓
驗證輸入 (username, email, password)
    ↓
檢查 username 可用性
    ↓
adminClient.auth.admin.createUser()
    ↓
手動建立 profiles 記錄
    ↓
serverClient.auth.signInWithPassword() (設定 session cookie)
    ↓
回傳成功訊息給 Client
    ↓
前端使用 window.location.href 跳轉（強制重新載入）
```

## 檔案清單

### 1. API Route

- **路徑**: `src/app/api/auth/register/route.ts`
- **功能**:
  - 驗證輸入 (email, password, username)
  - 檢查 username 格式和可用性
  - 使用 Admin Client 建立用戶
  - 手動建立 profile 記錄
  - 使用 Server Client 登入用戶（自動設定 session cookie）

### 2. 前端表單

- **路徑**: `src/app/register/register-form.tsx`
- **修改**:
  - 移除直接呼叫 Supabase client
  - 改為呼叫 `/api/auth/register` API
  - 使用 `window.location.href` 跳轉以強制重新載入頁面
  - 簡化錯誤處理

### 3. 環境變數

確保以下環境變數已設定：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 部署步驟

### 無需 Migration

此實作方式在 API 層面處理，**不需要額外的資料庫 migration**。

只需確保：

1. ✅ `profiles` 表存在（已在 schema.sql 中定義）
2. ✅ 環境變數已正確設定
3. ✅ Service Role Key 有權限操作 auth 和 profiles

## 測試

### 手動測試（透過 UI）

1. 啟動開發伺服器:

```bash
npm run dev
```

2. 前往註冊頁面: `http://localhost:3000/register`

3. 填寫表單:
   - Email: test@example.com
   - Password: test123456
   - Username: testuser

4. 提交後檢查:
   - 在 Supabase Dashboard > Authentication > Users 查看用戶
   - 在 Table Editor > profiles 查看是否自動建立

### 自動測試（使用測試腳本）

```bash
npx tsx scripts/test-register.ts
```

## API 規格

### POST /api/auth/register

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "myusername"
}
```

**Response (成功 - 自動登入):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "myusername"
  },
  "message": "註冊成功！"
}
```

**Response (成功 - 需手動登入):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "myusername"
  },
  "needsManualLogin": true,
  "message": "註冊成功！請使用您的帳號登入。"
}
```

**注意**:

- 正常情況下，Session 會透過 HTTP-only cookie 自動設定
- 如果自動登入失敗，會回傳 `needsManualLogin: true`，用戶需手動登入

**Response (錯誤):**

```json
{
  "error": "Username 已被使用"
}
```

## Username 驗證規則

1. 格式: `^[a-z0-9_.]{1,30}$`
2. 不能以句點開頭或結尾
3. 不能有連續句點
4. 不能以 `ai_` 開頭（保留給 AI personas）
5. 必須是唯一的（case-insensitive）

## API 邏輯

1. **驗證輸入**：檢查 email, password, username 格式
2. **清理 username**：使用 `sanitizeUsername()` 清理輸入
3. **檢查 username 可用性**：查詢 profiles 表確認 username 未被使用
4. **建立用戶**：使用 `adminClient.auth.admin.createUser()` 建立 auth.users 記錄
5. **建立 profile**：手動插入 profiles 表
6. **錯誤回滾**：如果 profile 建立失敗，自動刪除已建立的用戶
7. **設定 session**：使用 Server Client 的 `signInWithPassword()` 設定 session cookie
8. **回傳結果**：包含 user 資訊和成功訊息

## 錯誤處理

### API 層面

- **400**: 缺少必要欄位、格式錯誤、密碼太短
- **409**: Username 已被使用
- **500**: 伺服器錯誤、Profile 建立失敗

### 交易回滾

- 如果 profile 建立失敗，自動刪除已建立的 auth.users 記錄
- 確保資料一致性（user 和 profile 同時存在或都不存在）

## 注意事項

1. **Service Role Key**: API 使用 Service Role Key 建立用戶
   - ⚠️ 絕對不要將此 key 暴露給前端
   - 只在 API route 中使用

2. **Session 管理**:
   - 使用 Server Client 的 `signInWithPassword()` 自動設定 HTTP-only cookie
   - 前端不需要手動處理 session
   - 使用 `window.location.href` 跳轉以觸發頁面重新載入

3. **Username 處理**:
   - 使用 `sanitizeUsername()` 清理輸入
   - 自動轉為小寫儲存

4. **Display Name**: 預設使用 username，之後使用者可自行修改

5. **Email 確認**: 目前設定為 `email_confirm: true`（自動確認）
   - 使用 Admin Client 建立用戶時會自動確認 email
   - 生產環境可以改為要求 email 驗證

6. **自動登入失敗處理**:
   - 如果自動登入失敗，會回傳 `needsManualLogin: true`
   - 前端會自動跳轉到登入頁面
   - 用戶資料已成功建立，只是需要手動登入

## 相關檔案

- API: `src/app/api/auth/register/route.ts`
- Form: `src/app/register/register-form.tsx`
- Admin Client: `src/lib/supabase/admin.ts`
- Schema: `supabase/schema.sql` (profiles 表定義)
- Test: `scripts/test-register.ts`
- Docs: `docs/registration-flow.md`

## 優點

✅ **完整控制**: API 層面完全控制註冊流程  
✅ **錯誤回滾**: Profile 建立失敗會自動刪除用戶  
✅ **自動登入**: 註冊後立即可用，無需額外登入步驟  
✅ **無 Migration**: 不需要資料庫 trigger，部署簡單  
✅ **易於測試**: API route 易於單元測試  
✅ **靈活擴展**: 未來可輕鬆加入額外邏輯（如發送歡迎郵件）
