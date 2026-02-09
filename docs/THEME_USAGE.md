# Theme 使用說明

## 🎨 目前配置

### DaisyUI Themes
- **Light Theme** (`light`) - 淺色主題
- **Black Theme** (`black`) - 深色主題（預設使用 `prefers-color-scheme: dark`）

### 自動 Theme 切換
專案會自動偵測使用者的系統偏好：
- 系統偏好深色 → 使用 `black` theme
- 系統偏好淺色 → 使用 `light` theme

## 🔧 如何使用 Theme Toggle

### 1. 在 Header 加入切換按鈕

編輯 `src/components/layout/Header.tsx`：

```tsx
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function Header({ user, profile }: HeaderProps) {
  return (
    <header>
      {/* 其他內容 */}
      <ThemeToggle />
    </header>
  );
}
```

### 2. 使用者體驗

- 點擊 🌙/☀️ 按鈕切換 theme
- 設定會自動保存到 `localStorage`
- 重新載入頁面時會記住使用者的選擇

## 🎨 修改品牌色

編輯 `src/app/globals.css`：

```css
/* Black Theme 品牌色 */
[data-theme="black"] {
  --p: 255 69 0;    /* Primary: upvote 橙色 #ff4500 */
  --s: 113 147 255; /* Secondary: downvote 藍色 #7193ff */
  --a: 79 188 255;  /* Accent: 連結藍色 #4fbcff */
}

/* Light Theme 品牌色 */
[data-theme="light"] {
  --p: 255 69 0;    /* Primary: upvote 橙色 #ff4500 */
  --s: 113 147 255; /* Secondary: downvote 藍色 #7193ff */
  --a: 0 102 204;   /* Accent: 連結藍色 #0066cc (darker) */
}
```

## 📝 新增更多 Theme

在 `src/app/globals.css` 修改：

```css
@plugin "daisyui" {
  themes: light, black --prefersdark, dark, cupcake, cyberpunk;
}
```

然後在 `ThemeToggle.tsx` 加入更多選項。

## 🔍 DaisyUI Theme 變數

常用的 DaisyUI CSS 變數：

| 變數 | 說明 | 使用範例 |
|------|------|----------|
| `--p` | Primary 主色 | `bg-primary`, `text-primary` |
| `--s` | Secondary 次要色 | `bg-secondary`, `text-secondary` |
| `--a` | Accent 強調色 | `bg-accent`, `text-accent` |
| `--n` | Neutral 中性色 | `bg-neutral`, `border-neutral` |
| `--b1` | Base-100 主背景 | `bg-base-100` |
| `--b2` | Base-200 次背景 | `bg-base-200` |
| `--b3` | Base-300 輸入框背景 | `bg-base-300` |
| `--bc` | Base-content 文字色 | `text-base-content` |

## 📚 參考資源

- [DaisyUI Themes 文檔](https://daisyui.com/docs/themes/)
- [DaisyUI Theme Generator](https://daisyui.com/theme-generator/)
- [Tailwind CSS v4 文檔](https://tailwindcss.com/docs)
