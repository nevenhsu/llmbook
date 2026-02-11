# 登入流程說明

## 概述

登入功能支援使用 **Email** 或 **Username** 登入。

## 架構

```
User Input (login-form.tsx)
    ↓
POST /api/auth/login
    ↓
檢查 identifier 是 email 或 username
    ↓
如果是 username → 查詢 profiles 取得 user_id → 取得 email
    ↓
使用 email 和 password 登入
    ↓
設定 session cookie
    ↓
回傳成功訊息
    ↓
前端跳轉到首頁（強制重新載入）
```

## API 規格

### POST /api/auth/login

**Request Body:**
```json
{
  "identifier": "user@example.com",  // 或 "myusername"
  "password": "password123"
}
```

**Response (成功):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "message": "登入成功！"
}
```

**Response (失敗):**
```json
{
  "error": "Email/Username 或密碼錯誤"
}
```

**Status Codes:**
- `200`: 登入成功
- `400`: 缺少必要欄位
- `401`: Email/Username 或密碼錯誤
- `500`: 伺服器錯誤

## 邏輯流程

### 1. 判斷輸入類型

```typescript
const isEmail = identifier.includes('@');
```

- 包含 `@` → 視為 email
- 不包含 `@` → 視為 username

### 2. Username 轉換為 Email

如果輸入是 username：

1. 查詢 `profiles` 表取得 `user_id`
```sql
SELECT user_id FROM profiles 
WHERE LOWER(username) = LOWER('myusername')
```

2. 使用 Admin Client 取得 email
```typescript
const { data: { user } } = await adminClient.auth.admin.getUserById(user_id);
email = user.email;
```

### 3. 使用 Email 登入

```typescript
const { data } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

### 4. 設定 Session

使用 Server Client 自動設定 HTTP-only cookie。

## 安全性

### 錯誤訊息統一

無論是 email 不存在、username 不存在，還是密碼錯誤，都回傳相同的錯誤訊息：

```
"Email/Username 或密碼錯誤"
```

這樣可以避免洩漏用戶是否存在的資訊。

### Username 查詢

- 使用 case-insensitive 比對 (`ilike`)
- 自動 trim 和轉小寫

## 使用範例

### 使用 Email 登入

```typescript
await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    identifier: 'user@example.com',
    password: 'password123',
  }),
});
```

### 使用 Username 登入

```typescript
await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    identifier: 'myusername',
    password: 'password123',
  }),
});
```

## 前端實作

### login-form.tsx

**修改內容：**
- ✅ 欄位名從 `email` 改為 `identifier`
- ✅ Input type 從 `email` 改為 `text`
- ✅ Placeholder: "Email 或 Username"
- ✅ 使用 `window.location.href` 跳轉

**關鍵程式碼：**
```typescript
const [identifier, setIdentifier] = useState("");

// 提交表單
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ identifier, password }),
});

// 登入成功後跳轉
if (response.ok) {
  window.location.href = '/';
}
```

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `src/app/api/auth/login/route.ts` | Login API |
| `src/app/login/login-form.tsx` | 登入表單 |
| `docs/login-flow.md` | 本文件 |

## 優點

✅ **彈性** - 用戶可以選擇使用 email 或 username  
✅ **安全** - 統一的錯誤訊息，不洩漏用戶存在資訊  
✅ **簡單** - 用戶不需要記住用哪個註冊的  
✅ **一致** - 與註冊流程使用相同的 session 管理方式  
