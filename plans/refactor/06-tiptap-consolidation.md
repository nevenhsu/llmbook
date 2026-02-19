# P3a — TipTap 目錄整合 & SearchBar CSS 修正

> **優先順序：P3 — 低優先**  
> 組織性問題，不影響功能，但影響開發者體驗和 import 一致性。

---

## 整合項目 1：TipTap 目錄結構整合

### 問題描述

TipTap 相關元件分散在 6 個不同的目錄中（有些甚至是空目錄）：

```
src/components/
├── tiptap-extension/      ← 空目錄
├── tiptap-extensions/     ← mention 擴展
├── tiptap-icons/          ← 37 個 SVG 圖示元件
├── tiptap-node/           ← 空目錄
├── tiptap-templates/      ← simple editor 範本
│   └── simple/
│       ├── simple-editor.tsx
│       └── simple-editor.scss
├── tiptap-ui/             ← 13 個按鈕/工具列元件
└── tiptap-ui-primitive/   ← 10 個基礎 UI 元件
```

問題：

- 命名不一致（`extension` vs `extensions` 單複數）
- 空目錄造成混亂
- import 路徑冗長且難以記憶

### 目標結構

```
src/components/editor/
├── extensions/            ← 原 tiptap-extensions/
│   └── mention.ts
├── icons/                 ← 原 tiptap-icons/（37 個元件保持不動）
├── primitives/            ← 原 tiptap-ui-primitive/
├── ui/                    ← 原 tiptap-ui/
├── SimpleEditor.tsx       ← 原 tiptap-templates/simple/simple-editor.tsx
└── simple-editor.scss     ← 原 simple-editor.scss
```

### 執行步驟

**步驟 1：確認所有 import 路徑**

在移動任何檔案之前，先執行：

```bash
grep -rn "tiptap-extension\|tiptap-icons\|tiptap-templates\|tiptap-ui" src/ --include="*.ts" --include="*.tsx" | grep "import "
```

記錄所有受影響的 import 路徑。

**步驟 2：建立新目錄結構**

```bash
mkdir -p src/components/editor/{extensions,icons,primitives,ui}
```

**步驟 3：移動檔案**

按照以下對應關係移動：

| 來源                                         | 目標                        |
| -------------------------------------------- | --------------------------- |
| `tiptap-extensions/*`                        | `editor/extensions/*`       |
| `tiptap-icons/*`                             | `editor/icons/*`            |
| `tiptap-ui-primitive/*`                      | `editor/primitives/*`       |
| `tiptap-ui/*`                                | `editor/ui/*`               |
| `tiptap-templates/simple/simple-editor.tsx`  | `editor/SimpleEditor.tsx`   |
| `tiptap-templates/simple/simple-editor.scss` | `editor/simple-editor.scss` |

**步驟 4：更新所有 import**

對每個在步驟 1 找到的 import，更新路徑：

```typescript
// Before
import { MentionList } from "@/components/tiptap-extensions/mention";
import { BoldButton } from "@/components/tiptap-ui/bold-button";
import { Toolbar } from "@/components/tiptap-ui-primitive/toolbar";

// After
import { MentionList } from "@/components/editor/extensions/mention";
import { BoldButton } from "@/components/editor/ui/bold-button";
import { Toolbar } from "@/components/editor/primitives/toolbar";
```

**步驟 5：刪除空目錄和舊目錄**

```bash
# 確認舊目錄為空後再刪除
rmdir src/components/tiptap-extension
rmdir src/components/tiptap-node
# 確認無 import 後再刪除整個舊目錄
rm -rf src/components/tiptap-extensions
rm -rf src/components/tiptap-icons
# ... 依此類推
```

**⚠️ 警告**：移動 37 個圖示元件時，確認沒有動態 import（如 `import(\`../tiptap-icons/${name}\`)` 這樣的動態路徑）。

### 更新文件

移動完成後，更新 `AGENTS.md` 中如果有引用舊路徑的部分。

---

## 整合項目 2：`SearchBar.tsx` 的 `focus-within:` CSS Bug

### 問題描述

```typescript
// src/components/search/SearchBar.tsx（約某行）
className = "... focus-within: flex items-center ...";
//                         ^ 這裡有一個多餘的空格，導致 focus-within: 是空的 variant
```

這可能是本來想寫 `focus-within:border-primary` 或類似效果，但意外變成了無效的 class。

### 修正步驟

1. 打開 `src/components/search/SearchBar.tsx`。
2. 找到 `focus-within:` 後面跟著空格的位置。
3. 根據設計意圖決定：
   - 若是想要 focus 時改變邊框色：`focus-within:border-primary`
   - 若是多餘的：直接刪除 `focus-within:`
4. 啟動開發伺服器，測試搜尋框 focus 效果。

---

## 驗收標準

- [ ] 所有 TipTap 元件整合到 `src/components/editor/` 目錄。
- [ ] 空目錄（`tiptap-extension`, `tiptap-node`）已刪除。
- [ ] 所有 import 路徑更新完畢，`pnpm build` 無錯誤。
- [ ] `SearchBar.tsx` 的 `focus-within:` bug 修正。
- [ ] 視覺驗證：富文字編輯器功能完整。
