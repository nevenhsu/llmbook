# 04 - @mention System

> **目標：** 在評論和文章中實作 @username 提及功能，支援即時驗證、自動完成，並在被提及時發送通知。

---

## 0. 必須複用的現有程式碼

| 類型 | 路徑 | 用途 |
|------|------|------|
| Component | `src/components/ui/Avatar.tsx` | MentionList 中顯示用戶頭像 |
| Component | `src/components/ui/SafeHtml.tsx` | **需擴展** - 渲染時解析 mention |
| Utility | `src/lib/server/route-helpers.ts` | `withAuth`, `http.*` |
| Lib | `src/lib/notifications.ts` | `createNotification` 函數 |

### Avatar 元件注意事項

Avatar 使用 `fallbackSeed` 而非 `username`：

```tsx
// ✅ 正確
<Avatar src={item.avatarUrl} fallbackSeed={item.username} size="sm" />

// ❌ 錯誤
<Avatar src={item.avatarUrl} username={item.username} size="sm" />
```

---

## 1. 功能規格

### 1.1 核心行為

| 行為 | 說明 |
|------|------|
| 觸發 | 輸入 `@` 後**立即**顯示 dropdown |
| 初始建議 | 優先顯示用戶追蹤的人，若無則顯示推薦用戶（最多 5 個） |
| 過濾 | 繼續輸入文字時即時過濾選項 |
| 關閉 dropdown | 輸入空白或符號時自動關閉 |
| 選擇 | 從 dropdown 選擇或完整輸入後驗證 |
| 驗證 | 即時驗證 username 是否存在 |
| 成功 mention | 文字變 primary 色，發布後可點擊 |
| 失敗 mention | 保持純文字，無法點擊 |
| 資料存儲 | 存 `user_id`，渲染時查詢最新 username |
| 用戶改名/刪除 | 顯示最新的 username（動態查詢） |

### 1.2 使用流程

```
1. 用戶輸入 @
   → dropdown 顯示（追蹤的人優先，或推薦 5 人）

2. 用戶繼續輸入 "al"
   → dropdown 過濾為含 "al" 的用戶

3a. 用戶從 dropdown 選擇 "alice"
   → 插入 mention 節點（id: alice的user_id）
   → 文字顯示為 @alice（primary 色）

3b. 用戶完整輸入 "alice" 後按空白
   → 即時驗證 "alice" 是否存在
   → 存在：插入 mention 節點
   → 不存在：保持純文字 "@alice"

4. 發布文章/評論
   → mention 節點渲染為可點擊連結
   → 發送通知給被 mention 的用戶
```

---

## 2. 資料結構

### 2.1 TipTap 節點結構

Mention 在 TipTap 中存儲為特殊節點：

```html
<!-- 存儲格式 -->
<span 
  data-type="mention" 
  data-id="uuid-of-user"
  data-label="current-username"
>@username</span>
```

- `data-id`: 用戶的 `user_id`（UUID），**永久不變**
- `data-label`: 當前的 username，**僅用於編輯時顯示**

### 2.2 渲染時動態查詢

```typescript
// 渲染時從 data-id 查詢最新的 username
// 如果用戶不存在，則不渲染為連結
```

---

## 3. API Endpoints

### 3.1 GET `/api/mentions/suggestions`

返回 mention 建議列表：

```typescript
// GET /api/mentions/suggestions?q=<query>

import { withAuth, http } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

export const GET = withAuth(async (req, { user, supabase }) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase() || "";

  // 1. 如果有搜尋字串，直接搜尋
  if (query.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("user_id", user.id)  // 排除自己
      .limit(5);

    if (error) {
      console.error("Error fetching suggestions:", error);
      return http.internalError();
    }

    return http.ok(formatSuggestions(data));
  }

  // 2. 無搜尋字串：優先返回追蹤的人
  const { data: following, error: followError } = await supabase
    .from("follows")
    .select(`
      following_id,
      profiles!follows_following_id_fkey(user_id, username, display_name, avatar_url)
    `)
    .eq("follower_id", user.id)
    .limit(5);

  if (!followError && following && following.length > 0) {
    const profiles = following
      .map((f) => f.profiles)
      .filter(Boolean);
    return http.ok(formatSuggestions(profiles));
  }

  // 3. 沒有追蹤任何人：返回推薦用戶（按 karma 排序）
  const { data: recommended, error: recError } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .neq("user_id", user.id)
    .order("karma", { ascending: false })
    .limit(5);

  if (recError) {
    console.error("Error fetching recommendations:", recError);
    return http.internalError();
  }

  return http.ok(formatSuggestions(recommended));
});

function formatSuggestions(data: any[] | null) {
  return (data ?? []).map((user) => ({
    id: user.user_id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  }));
}
```

### 3.2 GET `/api/mentions/validate`

驗證 username 是否存在：

```typescript
// GET /api/mentions/validate?username=<username>

export const GET = withAuth(async (req, { supabase }) => {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return http.badRequest("username is required");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("Error validating username:", error);
    return http.internalError();
  }

  if (!data) {
    return http.ok({ valid: false, user: null });
  }

  return http.ok({
    valid: true,
    user: {
      id: data.user_id,
      username: data.username,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
    },
  });
});
```

### 3.3 POST `/api/mentions/resolve`

批量解析 user_id 到 username（用於渲染）：

```typescript
// POST /api/mentions/resolve
// Body: { userIds: string[] }

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  
  const body = await req.json();
  const { userIds } = body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return http.badRequest("userIds array is required");
  }

  // 限制一次最多解析 50 個
  const limitedIds = userIds.slice(0, 50);

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name")
    .in("user_id", limitedIds);

  if (error) {
    console.error("Error resolving mentions:", error);
    return http.internalError();
  }

  // 轉為 Map 格式方便前端使用
  const userMap: Record<string, { username: string; displayName: string } | null> = {};
  
  for (const id of limitedIds) {
    const user = data?.find((u) => u.user_id === id);
    userMap[id] = user 
      ? { username: user.username, displayName: user.display_name }
      : null;  // null 表示用戶不存在
  }

  return http.ok({ users: userMap });
}
```

---

## 4. TipTap Extension

### 4.1 安裝依賴

```bash
npm install @tiptap/extension-mention tippy.js
```

### 4.2 MentionExtension 配置

**建立 `src/components/tiptap-extensions/mention/MentionExtension.ts`：**

```typescript
import { Mention } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { MentionList, MentionListRef } from './MentionList';

export interface MentionSuggestion {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

// API 搜尋/建議用戶
async function fetchMentionSuggestions(query: string): Promise<MentionSuggestion[]> {
  try {
    const res = await fetch(`/api/mentions/suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// 驗證 username 是否存在
async function validateUsername(username: string): Promise<MentionSuggestion | null> {
  try {
    const res = await fetch(`/api/mentions/validate?username=${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.valid ? data.user : null;
  } catch {
    return null;
  }
}

export const MentionExtension = Mention.configure({
  HTMLAttributes: {
    class: 'mention',
  },
  
  // 渲染時的輸出格式
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'mention',
        'data-id': node.attrs.id,
        'data-label': node.attrs.label,
      },
      `@${node.attrs.label}`,
    ];
  },
  
  suggestion: {
    char: '@',
    allowSpaces: false,
    
    // 輸入 @ 後立即觸發（無需額外字元）
    startOfLine: false,
    
    // 當輸入空白或特定符號時結束 suggestion
    allowedPrefixes: null,
    
    items: async ({ query }) => {
      return fetchMentionSuggestions(query);
    },

    // 自定義：當用戶輸入完成但未從列表選擇時的處理
    // TipTap 原生不支援，需要額外處理（見下方）

    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            maxWidth: 320,
          });
        },

        onUpdate(props) {
          component?.updateProps(props);

          if (!props.clientRect) return;

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  },
});

// 自定義 extension 處理手動輸入的 username 驗證
export const MentionValidatorExtension = Mention.extend({
  name: 'mentionValidator',
  
  // 監聽輸入，當 @ 後的文字結束時驗證
  // 這需要在編輯器層級處理，見 SimpleEditor 整合
});
```

### 4.3 MentionList 元件

**建立 `src/components/tiptap-extensions/mention/MentionList.tsx`：**

```tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import Avatar from '@/components/ui/Avatar';  // ✅ 使用現有元件
import { Loader2 } from 'lucide-react';
import type { MentionSuggestion } from './MentionExtension';

interface MentionListProps {
  items: MentionSuggestion[];
  command: (item: { id: string; label: string }) => void;
  query: string;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.username });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          if (items.length > 0) {
            selectItem(selectedIndex);
            return true;
          }
          return false;
        }
        if (event.key === 'Tab') {
          if (items.length > 0) {
            selectItem(selectedIndex);
            return true;
          }
          return false;
        }
        return false;
      },
    }));

    // Empty state
    if (items.length === 0 && query.length > 0) {
      return (
        <div className="bg-base-100 border-neutral rounded-lg border p-3 shadow-xl">
          <p className="text-base-content/50 text-sm">
            No users found for &quot;{query}&quot;
          </p>
        </div>
      );
    }

    // Loading state (for initial load)
    if (items.length === 0 && query.length === 0) {
      return (
        <div className="bg-base-100 border-neutral rounded-lg border p-3 shadow-xl">
          <div className="flex items-center gap-2 text-base-content/50 text-sm">
            <Loader2 size={14} className="animate-spin" />
            Loading suggestions...
          </div>
        </div>
      );
    }

    return (
      <div className="bg-base-100 border-neutral max-h-60 min-w-[200px] overflow-y-auto rounded-lg border shadow-xl">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex ? 'bg-base-200' : 'hover:bg-base-200/50'
            }`}
          >
            {/* ✅ 使用 fallbackSeed（Avatar 元件的正確 prop） */}
            <Avatar 
              src={item.avatarUrl} 
              fallbackSeed={item.username} 
              size="sm" 
            />
            <div className="min-w-0 flex-1">
              <p className="text-base-content truncate text-sm font-medium">
                {item.displayName}
              </p>
              <p className="text-base-content/50 truncate text-xs">
                @{item.username}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';
```

### 4.4 處理手動輸入的 username 驗證

當用戶不從 dropdown 選擇，而是直接輸入 `@username ` 時，需要驗證：

**在 SimpleEditor 中新增：**

```typescript
// 監聽編輯器事件，處理手動輸入的 mention
useEffect(() => {
  if (!editor) return;

  // 當 suggestion 被取消（空白/符號）時觸發
  const handleMentionComplete = async (text: string) => {
    // 提取 @username
    const match = text.match(/@(\w+)$/);
    if (!match) return;
    
    const username = match[1];
    
    // 驗證 username
    const res = await fetch(`/api/mentions/validate?username=${username}`);
    const data = await res.json();
    
    if (data.valid) {
      // 有效：替換為 mention 節點
      // 這裡需要找到剛輸入的文字位置並替換
      // ... 實作細節
    }
    // 無效：保持純文字，不做處理
  };

  // ... 註冊事件監聽
}, [editor]);
```

**更完整的實作方式 - 自定義 InputRule：**

```typescript
import { Extension } from '@tiptap/core';
import { InputRule } from '@tiptap/pm/inputrules';

export const MentionInputRule = Extension.create({
  name: 'mentionInputRule',

  addInputRules() {
    return [
      // 匹配 @username 後接空白或符號
      new InputRule({
        find: /@(\w+)[\s\.,!?;:\)\]]/,
        handler: async ({ state, range, match }) => {
          const username = match[1];
          
          // 非同步驗證
          const res = await fetch(`/api/mentions/validate?username=${username}`);
          const data = await res.json();
          
          if (data.valid) {
            // 創建 mention 節點
            const mentionNode = state.schema.nodes.mention.create({
              id: data.user.id,
              label: data.user.username,
            });
            
            // 替換文字為 mention 節點
            // 保留後面的空白/符號
            const tr = state.tr.replaceWith(
              range.from,
              range.to - 1,  // 保留最後的符號
              mentionNode
            );
            
            return tr;
          }
          
          // 不存在：不做任何處理，保持純文字
          return null;
        },
      }),
    ];
  },
});
```

---

## 5. 渲染時動態解析 mention

### 5.1 修改 SafeHtml 元件

**更新 `src/components/ui/SafeHtml.tsx`：**

```tsx
"use client";

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import Link from 'next/link';

interface SafeHtmlProps {
  html: string;
  className?: string;
}

interface MentionData {
  username: string;
  displayName: string;
}

export default function SafeHtml({ html, className }: SafeHtmlProps) {
  const [resolvedHtml, setResolvedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolveMentions() {
      // 1. 清理 HTML
      const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img', 'span'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'data-type', 'data-id', 'data-label'],
      });

      // 2. 提取所有 mention 的 user_id
      const mentionRegex = /data-type="mention"[^>]*data-id="([^"]+)"/g;
      const userIds: string[] = [];
      let match;
      while ((match = mentionRegex.exec(cleanHtml)) !== null) {
        if (!userIds.includes(match[1])) {
          userIds.push(match[1]);
        }
      }

      // 3. 如果沒有 mention，直接返回
      if (userIds.length === 0) {
        setResolvedHtml(cleanHtml);
        setIsLoading(false);
        return;
      }

      // 4. 批量解析 user_id → username
      try {
        const res = await fetch('/api/mentions/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });
        
        if (!res.ok) throw new Error('Failed to resolve mentions');
        
        const { users } = await res.json();

        // 5. 替換 mention 為連結或純文字
        let processed = cleanHtml;
        
        for (const userId of userIds) {
          const user = users[userId] as MentionData | null;
          
          // 正則匹配這個 user 的 mention
          const mentionPattern = new RegExp(
            `<span[^>]*data-type="mention"[^>]*data-id="${userId}"[^>]*data-label="[^"]*"[^>]*>[^<]*</span>`,
            'g'
          );
          
          if (user) {
            // 用戶存在：替換為可點擊連結
            processed = processed.replace(
              mentionPattern,
              `<a href="/profile/${user.username}" class="mention text-primary hover:underline">@${user.username}</a>`
            );
          } else {
            // 用戶不存在：替換為純文字
            processed = processed.replace(
              mentionPattern,
              (match) => {
                // 提取原本的 label
                const labelMatch = match.match(/data-label="([^"]*)"/);
                const label = labelMatch ? labelMatch[1] : 'deleted';
                return `<span class="text-base-content/50">@${label}</span>`;
              }
            );
          }
        }

        setResolvedHtml(processed);
      } catch (error) {
        console.error('Error resolving mentions:', error);
        // 失敗時使用原始 HTML
        setResolvedHtml(cleanHtml);
      } finally {
        setIsLoading(false);
      }
    }

    resolveMentions();
  }, [html]);

  if (isLoading) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: resolvedHtml }}
    />
  );
}
```

### 5.2 效能優化：快取

為避免重複請求，可以加入快取：

```typescript
// 全局快取 Map
const mentionCache = new Map<string, MentionData | null>();

// 在 resolve 時先檢查快取
const uncachedIds = userIds.filter(id => !mentionCache.has(id));

if (uncachedIds.length > 0) {
  const res = await fetch('/api/mentions/resolve', {
    method: 'POST',
    body: JSON.stringify({ userIds: uncachedIds }),
  });
  const { users } = await res.json();
  
  // 更新快取
  for (const id of uncachedIds) {
    mentionCache.set(id, users[id] || null);
  }
}

// 從快取讀取
const users = Object.fromEntries(
  userIds.map(id => [id, mentionCache.get(id)])
);
```

---

## 6. Mention 樣式

**在 `src/app/globals.css` 新增：**

```css
/* Mention styling in editor */
.ProseMirror .mention {
  @apply text-primary font-medium;
}

/* Mention styling in rendered content */
a.mention {
  @apply text-primary hover:underline cursor-pointer;
}

/* Invalid/deleted mention */
span.mention-invalid {
  @apply text-base-content/50;
}
```

---

## 7. 通知觸發

### 7.1 解析 Mention 從 HTML

**建立 `src/lib/mention-parser.ts`：**

```typescript
export interface ParsedMention {
  userId: string;
  username: string;
}

/**
 * 從 HTML 內容中解析所有有效的 mention
 * 只解析有 data-id 的 mention（已驗證存在的用戶）
 */
export function parseMentions(html: string): ParsedMention[] {
  if (!html) return [];

  const regex = /data-type="mention"[^>]*data-id="([^"]+)"[^>]*data-label="([^"]+)"/g;
  const parsed: ParsedMention[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = regex.exec(html)) !== null) {
    const [, userId, username] = match;
    if (userId && username && !seen.has(userId)) {
      seen.add(userId);
      parsed.push({ userId, username });
    }
  }

  return parsed;
}
```

### 7.2 在評論/文章 API 中觸發通知

與原本設計相同，使用 `parseMentions` 解析後發送通知。

---

## 8. 檔案結構

```
src/
├── app/
│   └── api/
│       └── mentions/
│           ├── suggestions/
│           │   └── route.ts       # 用戶建議 API
│           ├── validate/
│           │   └── route.ts       # 驗證 username API
│           └── resolve/
│               └── route.ts       # 批量解析 user_id API
├── components/
│   ├── tiptap-extensions/
│   │   └── mention/
│   │       ├── MentionExtension.ts
│   │       ├── MentionList.tsx
│   │       └── MentionInputRule.ts  # 手動輸入驗證
│   └── ui/
│       └── SafeHtml.tsx           # 動態解析 mention
└── lib/
    └── mention-parser.ts          # 解析 HTML 中的 mention
```

---

## 9. 驗收標準

### 功能驗收

- [ ] 輸入 `@` 後立即顯示 dropdown（追蹤的人優先）
- [ ] 無追蹤時顯示推薦用戶（5 人）
- [ ] 輸入文字時即時過濾選項
- [ ] 輸入空白/符號時自動關閉 dropdown
- [ ] 從 dropdown 選擇可正確插入 mention
- [ ] 手動輸入 username 後即時驗證
- [ ] 有效 username 顯示為 primary 色
- [ ] 無效 username 保持純文字
- [ ] 發布後 mention 可點擊跳轉
- [ ] 用戶改名後 mention 顯示新名稱
- [ ] 用戶刪除後 mention 變灰色/純文字

### 技術驗收

- [ ] 存儲 `data-id`（user_id），非 username
- [ ] 渲染時動態查詢最新 username
- [ ] 有適當的快取機制
- [ ] `npm run build` 無錯誤
