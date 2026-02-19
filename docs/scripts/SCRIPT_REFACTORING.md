# Script Refactoring Documentation

## 概述

Background scripts (`update-rankings.ts` 和 `update-karma.ts`) 已重構以共用通用邏輯，減少程式碼重複並提升可維護性。

---

## 重構內容

### 新增共用 Helper Library

**檔案**: `scripts/lib/script-helpers.ts`

#### 共用函式：

| 函式 | 用途 |
|------|------|
| `log(message, type)` | 統一的日誌輸出格式 |
| `logSeparator()` | 輸出分隔線 |
| `getTimestamp()` | 取得 ISO 格式時間戳記 |
| `validateEnvironment()` | 驗證環境變數 |
| `testDatabaseConnection(tableName)` | 測試資料庫連接 |
| `wait(ms)` | 智慧等待（支援天/小時/分鐘顯示） |
| `setupGracefulShutdown()` | 設定優雅關閉處理 |
| `runScript(options, updateFn, waitTime)` | 執行腳本主迴圈 |

---

## 檔案對照

### 原始檔案（未重構）

| 檔案 | 用途 | 狀態 |
|------|------|------|
| `scripts/update-rankings.ts` | Post rankings 更新 | ✅ 保留（向後相容） |
| `scripts/update-karma.ts` | Karma 更新 | ✅ 保留（向後相容） |

### 重構後檔案

| 檔案 | 用途 | 狀態 |
|------|------|------|
| `scripts/lib/script-helpers.ts` | 共用工具函式 | ✅ 新增 |
| `scripts/update-rankings-refactored.ts` | 重構後的 rankings 腳本 | 📋 可選使用 |
| `scripts/update-karma-refactored.ts` | 重構後的 karma 腳本 | 📋 可選使用 |

---

## 重構優勢

### ✅ 程式碼減少

| 腳本 | 原始行數 | 重構後行數 | 減少 |
|------|----------|------------|------|
| `update-rankings.ts` | 214 行 | ~110 行 | **-48%** |
| `update-karma.ts` | ~300 行 | ~190 行 | **-37%** |
| **總計** | 514 行 | ~300 行 + 180 行 (helpers) | **-6.6%** |

### ✅ 可維護性提升

1. **單一職責**：每個函式只做一件事
2. **DRY 原則**：消除重複程式碼
3. **一致性**：所有腳本使用相同的日誌格式
4. **可測試性**：共用函式可以獨立測試

### ✅ 功能增強

1. **智慧等待顯示**：
   - 原本：只支援小時
   - 現在：自動切換天/小時/分鐘顯示

2. **錯誤處理**：
   - 統一的錯誤處理邏輯
   - 更清楚的錯誤訊息

3. **可擴展性**：
   - 未來新增腳本可重用 `script-helpers.ts`
   - 只需實作核心更新邏輯

---

## 使用方式

### 選項 1: 繼續使用原始檔案（推薦）

```bash
# 原始檔案已更新，使用與之前相同的命令
npm run update-rankings
npm run update-karma
npm run update-karma:queue
```

### 選項 2: 切換到重構版本

#### 1. 重命名檔案

```bash
# 備份原始檔案
mv scripts/update-rankings.ts scripts/update-rankings-old.ts
mv scripts/update-karma.ts scripts/update-karma-old.ts

# 使用重構版本
mv scripts/update-rankings-refactored.ts scripts/update-rankings.ts
mv scripts/update-karma-refactored.ts scripts/update-karma.ts
```

#### 2. 無需修改 package.json

npm scripts 會自動使用新檔案。

---

## NPM Scripts

### Karma 更新

```bash
# 持續執行，每小時完整更新 (queue + full refresh)
npm run update-karma

# 只執行一次，不重複
npm run update-karma:once

# 只處理 queue，每 5 分鐘執行一次（推薦用於生產環境）
npm run update-karma:queue
```

### Rankings 更新

```bash
# 持續執行，每 24 小時更新一次
npm run update-rankings

# 只執行一次，不重複
npm run update-rankings:once
```

---

## 生產環境部署建議

### 使用 PM2 管理背景程序

#### 安裝 PM2

```bash
npm install -g pm2
```

#### 建立 PM2 配置檔案

**檔案**: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: "karma-queue",
      script: "npm",
      args: "run update-karma:queue",
      cwd: "/path/to/your/project",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "rankings",
      script: "npm",
      args: "run update-rankings",
      cwd: "/path/to/your/project",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
```

#### 啟動服務

```bash
# 啟動所有腳本
pm2 start ecosystem.config.js

# 查看狀態
pm2 status

# 查看日誌
pm2 logs karma-queue
pm2 logs rankings

# 停止服務
pm2 stop all

# 重啟服務
pm2 restart all
```

---

## 建議的執行頻率

### Karma 系統

| 模式 | 頻率 | 命令 | 用途 |
|------|------|------|------|
| Queue 處理 | **每 5 分鐘** | `npm run update-karma:queue` | 即時處理投票變化 |
| 完整刷新 | 每小時 | `npm run update-karma` | 確保資料一致性 |
| 驗證刷新 | 每天 3:00 AM | `npm run update-karma:once` | 深度資料驗證 |

### Rankings 系統

| 模式 | 頻率 | 命令 | 用途 |
|------|------|------|------|
| Hot/Rising 更新 | **每 24 小時** | `npm run update-rankings` | 更新熱門與新興內容 |

---

## 監控與日誌

### 日誌格式

所有腳本輸出統一格式：

```
ℹ️  [2026-02-19T12:30:45.123Z] Starting karma update...
✅ [2026-02-19T12:30:46.456Z] Queue processed successfully in 1234ms
  - Processed: 150 items
  - Remaining: 0 items
⏳ [2026-02-19T12:30:46.789Z] Waiting 5 minutes before next update...
```

### 日誌級別

| Emoji | 類型 | 用途 |
|-------|------|------|
| ℹ️ | info | 一般資訊 |
| ✅ | success | 成功完成 |
| ❌ | error | 錯誤訊息 |
| ⚠️ | warning | 警告訊息 |
| ⏳ | wait | 等待中 |

---

## 故障排除

### 腳本無法啟動

```bash
# 檢查環境變數
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# 測試資料庫連接
npm run update-karma:once
```

### 記憶體使用過高

PM2 配置中已設定 `max_memory_restart: "1G"`，超過 1GB 會自動重啟。

### 日誌檔案過大

```bash
# PM2 會自動輪替日誌，手動清理：
pm2 flush
```

---

## 未來改進

- [ ] 新增腳本健康檢查 API endpoint
- [ ] 實作 Prometheus metrics export
- [ ] 建立 Grafana dashboard 監控
- [ ] 新增 Slack/Discord 通知整合
- [ ] 實作自動錯誤重試機制
- [ ] 新增效能分析工具

---

## 總結

重構後的 scripts 提供了：

✅ 更簡潔的程式碼  
✅ 更好的可維護性  
✅ 統一的日誌格式  
✅ 智慧的等待顯示  
✅ 優雅的關閉處理  
✅ 向後相容性  

建議逐步遷移到重構版本，並使用 PM2 管理背景程序。
