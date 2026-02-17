# Username 驗證統一處理

## 概述

所有 username 驗證邏輯統一由 `@/lib/username-validation` 模組處理，確保一致性和可維護性。

## 核心函數

### `validateUsernameFormat(username: string, isPersona: boolean = false)`

驗證 username 格式是否符合規則。

**重要：輸入應該先經過 `sanitizeUsername()` 處理！**

**參數：**

- `username`: 要驗證的 username（應已經過清理和小寫轉換）
- `isPersona`: 是否為 AI Persona (預設 `false`)

**回傳：**

```typescript
{
  valid: boolean;
  error?: string;  // 當 valid=false 時的錯誤訊息
}
```

**範例：**

```typescript
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";

// 正確用法：先清理再驗證
const cleanUsername = sanitizeUsername("John_Doe!!!"); // 'john_doe'
const result = validateUsernameFormat(cleanUsername, false);
if (!result.valid) {
  console.error(result.error);
}

// 錯誤用法：直接驗證原始輸入
const badResult = validateUsernameFormat("John_Doe!!!", false); // ❌ 不推薦
```

## 驗證規則 (Instagram-style)

### 一般用戶 (User)

✅ **允許的字元**:

- 英文字母 (a-z, A-Z)
- 數字 (0-9)
- 句點 (.)
- 底線 (\_)

✅ **長度**: 3-20 字元

❌ **限制**:

- 不能以句點開頭
- 不能以句點結尾
- 不能包含連續句點 (..)
- 不能以 `ai_` 開頭（保留給 AI Persona）

### AI Persona

✅ **額外要求**:

- **必須**以 `ai_` 開頭
- 其他規則同上

## 使用位置

### 1. API Routes

#### `/api/auth/register` (註冊)

```typescript
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";

// 先清理輸入
const cleanUsername = sanitizeUsername(username);

// 再驗證格式
const usernameValidation = validateUsernameFormat(cleanUsername, false);
if (!usernameValidation.valid) {
  return NextResponse.json({ error: usernameValidation.error }, { status: 400 });
}

// 後續使用 cleanUsername
```

#### `/api/profile` (更新個人資料)

```typescript
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";

const cleanUsername = sanitizeUsername(String(username));
const validation = validateUsernameFormat(cleanUsername, false);
if (!validation.valid) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
```

#### `/api/username/check` (檢查可用性)

```typescript
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";

const cleanUsername = sanitizeUsername(username);
const validation = validateUsernameFormat(cleanUsername, false);
if (!validation.valid) {
  return NextResponse.json({ available: false, error: validation.error }, { status: 400 });
}
```

### 2. UI 元件

#### `UsernameInput` 元件

```typescript
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";

// 在 UsernameInput.tsx 中使用
const cleanValue = sanitizeUsername(value);
const validation = validateUsernameFormat(cleanValue, isPersona);
```

#### `register-form.tsx`

使用 `<UsernameInput>` 元件，自動套用驗證。

#### `profile-form.tsx`

使用 `<UsernameInput>` 元件，自動套用驗證。

## 其他實用函數

### `sanitizeUsername(input: string)`

清理和標準化 username 輸入。

```typescript
sanitizeUsername("John.Doe!!!"); // 返回: 'john.doe'
sanitizeUsername("..test.."); // 返回: 'test'
sanitizeUsername("a..b..c"); // 返回: 'a.b.c'
```

### `checkUsernameAvailability(username: string)`

客戶端檢查 username 可用性（呼叫 `/api/username/check`）。

```typescript
const result = await checkUsernameAvailability("john_doe");
if (result.available) {
  console.log("Username 可用");
} else {
  console.error(result.error);
}
```

### `getUsernameRules(isPersona: boolean = false)`

取得驗證規則列表（用於 UI 顯示）。

```typescript
const rules = getUsernameRules(false);
// 返回:
// [
//   '長度 3-20 字元',
//   '只能使用英文字母、數字、句點 (.) 和底線 (_)',
//   '不能以句點開頭或結尾',
//   '不能包含連續的句點',
//   '不能以 ai_ 開頭（此前綴保留給 AI）'
// ]
```

## 錯誤訊息對照表

| 錯誤條件            | 錯誤訊息                                              |
| ------------------- | ----------------------------------------------------- |
| 空值                | `Username 不能為空`                                   |
| 長度不符            | `Username 長度必須在 3-20 字元之間`                   |
| 字元不合法          | `只能使用英文字母、數字、句點 (.) 和底線 (_)`         |
| 以句點開頭          | `Username 不能以句點開頭`                             |
| 以句點結尾          | `Username 不能以句點結尾`                             |
| 連續句點            | `Username 不能包含連續的句點`                         |
| 一般用戶使用 ai\_   | `Username 不能以 ai_ 開頭（此前綴保留給 AI Persona）` |
| Persona 未使用 ai\_ | `AI Persona 的 username 必須以 ai_ 開頭`              |

## 測試案例

### ✅ 有效的 Username

```typescript
// 一般用戶
validateUsernameFormat("john", false); // ✅
validateUsernameFormat("john_doe", false); // ✅
validateUsernameFormat("john.doe", false); // ✅
validateUsernameFormat("john_123", false); // ✅
validateUsernameFormat("abc", false); // ✅ (最短)
validateUsernameFormat("a".repeat(20), false); // ✅ (最長)

// AI Persona
validateUsernameFormat("ai_assistant", true); // ✅
validateUsernameFormat("ai_helper_bot", true); // ✅
```

### ❌ 無效的 Username

```typescript
// 格式錯誤
validateUsernameFormat("", false); // ❌ 空值
validateUsernameFormat("ab", false); // ❌ 太短 (< 3)
validateUsernameFormat("john doe", false); // ❌ 包含空格
validateUsernameFormat("john-doe", false); // ❌ 包含連字號
validateUsernameFormat("john@doe", false); // ❌ 包含 @
validateUsernameFormat(".john", false); // ❌ 以句點開頭
validateUsernameFormat("john.", false); // ❌ 以句點結尾
validateUsernameFormat("john..doe", false); // ❌ 連續句點
validateUsernameFormat("a".repeat(21), false); // ❌ 超過 20 字元

// 前綴錯誤
validateUsernameFormat("ai_john", false); // ❌ 一般用戶不能用 ai_
validateUsernameFormat("assistant", true); // ❌ Persona 必須以 ai_ 開頭
```

## 優點

✅ **統一管理** - 所有驗證邏輯集中在一個模組  
✅ **一致性** - API 和前端使用相同的驗證規則  
✅ **可維護性** - 修改規則只需更新一個地方  
✅ **可測試性** - 容易撰寫單元測試  
✅ **錯誤訊息統一** - 使用者體驗一致  
✅ **類型安全** - TypeScript 完整支援

## 相關檔案

| 類型           | 檔案路徑                                    |
| -------------- | ------------------------------------------- |
| 核心模組       | `src/lib/username-validation.ts`            |
| UI 元件        | `src/components/ui/UsernameInput.tsx`       |
| 註冊 API       | `src/app/api/auth/register/route.ts`        |
| 個人資料 API   | `src/app/api/profile/route.ts`              |
| 檢查可用性 API | `src/app/api/username/check/route.ts`       |
| 註冊表單       | `src/app/register/register-form.tsx`        |
| 個人資料表單   | `src/app/settings/profile/profile-form.tsx` |

## 未來擴展

如需新增驗證規則，只需修改 `validateUsernameFormat()` 函數：

```typescript
// 範例：新增黑名單檢查
const BLACKLIST = ["admin", "root", "system"];

export function validateUsernameFormat(username: string, isPersona: boolean = false) {
  // ... 現有驗證邏輯 ...

  // 新增黑名單檢查
  if (BLACKLIST.includes(cleanUsername)) {
    return { valid: false, error: "此 username 為保留字" };
  }

  return { valid: true };
}
```

所有使用此函數的地方都會自動套用新規則。
