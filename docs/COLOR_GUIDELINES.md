# 顏色使用規範

## 🎨 原則

**統一使用 DaisyUI theme 顏色，避免自定義顏色類別**

所有顏色都由 `globals.css` 中的 theme 定義，確保 light/dark theme 切換時自動適配。

---

## 📋 允許使用的顏色類別

### 背景色 (Background)

| 類別 | 用途 | 範例 |
|------|------|------|
| `bg-base-100` | 主要卡片背景 | Post card, sidebar |
| `bg-base-200` | 頁面背景 | Body background |
| `bg-base-300` | 次要背景、輸入框 | Input, hover state |
| `bg-primary` | 品牌主色 (upvote 橙) | Primary button |
| `bg-secondary` | 次要色 (downvote 藍) | Secondary button |
| `bg-accent` | 強調色 (連結藍) | Accent button |
| `bg-neutral` | 中性色 (灰) | Divider, border |
| `bg-info` | 資訊色 | Info badge |
| `bg-success` | 成功色 | Success message |
| `bg-warning` | 警告色 | Warning message |
| `bg-error` | 錯誤色 | Error message |

**透明度變化：** 使用 `/10`, `/20`, `/50` 等
- `bg-base-300/50` - 50% 透明度
- `bg-error/10` - 10% 透明度（淡色背景）

### 文字色 (Text)

| 類別 | 用途 | 範例 |
|------|------|------|
| `text-base-content` | 主要文字 | 標題、內文 |
| `text-base-content/70` | 次要文字 | 說明文字、metadata |
| `text-base-content/50` | 灰色文字 | Placeholder, disabled |
| `text-primary` | 品牌主色文字 | Upvote count |
| `text-secondary` | 次要色文字 | Downvote count |
| `text-accent` | 強調色文字 | 連結 |
| `text-info` | 資訊色文字 | Info text |
| `text-success` | 成功色文字 | Success text |
| `text-warning` | 警告色文字 | Warning text |
| `text-error` | 錯誤色文字 | Error text |
| `text-white` | 純白 | Button text on colored bg |

**別名（已清理，不再使用）：**
- ❌ `text-upvote` → ✅ `text-primary`
- ❌ `text-downvote` → ✅ `text-secondary`

### 邊框色 (Border)

| 類別 | 用途 |
|------|------|
| `border-neutral` | 預設邊框 |
| `border-primary` | 主色邊框 |
| `border-error` | 錯誤邊框 |
| `border-warning` | 警告邊框 |

---

## 🚫 禁止使用的顏色類別

### Tailwind 原生顏色（已清理）
- ❌ `text-slate-*`, `bg-slate-*`
- ❌ `text-red-*`, `bg-red-*`
- ❌ `text-blue-*`, `bg-blue-*`
- ❌ `text-gray-*`, `bg-gray-*`
- ❌ `text-green-*`, `bg-green-*`

### 自定義顏色（已清理）
- ❌ `text-text-primary` → ✅ `text-base-content`
- ❌ `bg-canvas` → ✅ `bg-base-200`
- ❌ `bg-surface` → ✅ `bg-base-100`
- ❌ `bg-highlight` → ✅ `bg-base-300`
- ❌ `border-border-default` → ✅ `border-neutral`

---

## 📝 使用範例

### ✅ 正確

```tsx
// Card
<div className="bg-base-100 border border-neutral rounded-lg p-4">
  <h2 className="text-base-content font-bold">Title</h2>
  <p className="text-base-content/70">Description</p>
</div>

// Button
<button className="bg-primary text-white px-4 py-2 rounded-full">
  Submit
</button>

// Error message
<div className="bg-error/10 border border-error/30 text-error p-3 rounded">
  Error occurred
</div>
```

### ❌ 錯誤

```tsx
// 不要使用 Tailwind 原生顏色
<div className="bg-red-50 text-red-700">Error</div>

// 不要使用自定義顏色
<div className="bg-canvas text-text-primary">Content</div>

// 不要使用已刪除的別名
<span className="text-upvote">+42</span>
```

---

## 🎯 特殊用途

### Upvote / Downvote 顏色

```tsx
// Upvote
<button className="text-primary hover:bg-primary/10">▲</button>

// Downvote
<button className="text-secondary hover:bg-secondary/10">▼</button>
```

### 連結顏色

```tsx
<a href="/..." className="text-accent hover:brightness-110">
  Link text
</a>
```

### Badge 顏色

```tsx
// Mod badge
<span className="bg-success/20 text-success px-2 py-0.5 rounded">
  MOD
</span>

// NSFW badge
<span className="bg-error/20 text-error px-2 py-0.5 rounded">
  NSFW
</span>
```

---

## 🔧 修改顏色

所有顏色定義在 `src/app/globals.css`：

```css
[data-theme="black"] {
  --p: 255 69 0;    /* Primary (upvote) */
  --s: 113 147 255; /* Secondary (downvote) */
  --a: 79 188 255;  /* Accent (link) */
}
```

修改這些變數即可全域生效。

---

## 📚 參考資源

- [DaisyUI Colors](https://daisyui.com/docs/colors/)
- [DaisyUI Themes](https://daisyui.com/docs/themes/)
