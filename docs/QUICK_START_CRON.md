# Cron Jobs 快速開始指南

## 🚀 5 分鐘快速部署

### 方案選擇

#### ✅ 推薦方案：Unified Cron Manager（單一程序）

**優勢**：
- 單一程序管理所有任務
- 記憶體使用最低（~250MB）
- 統一的日誌輸出
- 集中的統計資訊

**適用場景**：
- Supabase Free Tier
- VPS/Cloud Server
- 本地開發測試

---

## 📋 部署步驟

### Step 1: 執行 Database Migrations

```bash
# 執行 karma 系統 migration
supabase db push

# 或手動執行
psql -f supabase/migrations/20260219000001_add_karma_system.sql
```

### Step 2: 測試執行

```bash
# 測試所有任務（執行一次後退出）
npm run cron:once
```

**預期輸出**：
```
✅ [2026-02-19T12:00:01.234Z] [Karma Queue] Processed 42 items in 1134ms
✅ [2026-02-19T12:00:03.456Z] [Karma Full] Completed in 2156ms
✅ [2026-02-19T12:00:05.678Z] [Rankings] Completed in 2178ms

Task Statistics
karmaQueue:
  Runs: 1 (✅ 1, ❌ 0)
  Success Rate: 100.0%
```

### Step 3: 安裝 PM2

```bash
npm install -g pm2
```

### Step 4: 啟動服務

```bash
# 啟動 cron manager
pm2 start ecosystem.config.js

# 查看狀態
pm2 status

# 應該看到:
# ┌─────┬──────────────┬─────┬────────┬─────────┬──────┐
# │ id  │ name         │ ... │ status │ restart │ cpu  │
# ├─────┼──────────────┼─────┼────────┼─────────┼──────┤
# │ 0   │ cron-manager │ ... │ online │ 0       │ 2%   │
# └─────┴──────────────┴─────┴────────┴─────────┴──────┘
```

### Step 5: 查看即時日誌

```bash
pm2 logs cron-manager
```

**預期輸出**：
```
0|cron-man | ℹ️  [2026-02-19T12:00:00.000Z] Unified Cron Manager
0|cron-man | ✅ [2026-02-19T12:00:01.234Z] [Karma Queue] Processed 42 items
0|cron-man | ⏳ [2026-02-19T12:05:00.000Z] [Karma Queue] Processing...
```

### Step 6: 設定開機自動啟動

```bash
# 儲存 PM2 配置
pm2 save

# 設定開機啟動
pm2 startup

# 執行輸出的命令（通常需要 sudo）
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

---

## 🎯 完成！

現在你的背景任務已經在運行：

| 任務 | 頻率 | 說明 |
|------|------|------|
| Karma Queue | 每 5 分鐘 | 處理投票變化 |
| Karma Full | 每 1 小時 | 完整刷新 karma |
| Rankings | 每 24 小時 | 更新排名 |

---

## 📊 監控命令

```bash
# 查看狀態
pm2 status

# 查看即時日誌
pm2 logs cron-manager

# 查看資源使用
pm2 monit

# 重啟服務
pm2 restart cron-manager

# 停止服務
pm2 stop cron-manager
```

---

## 🔧 常用操作

### 只執行 Karma 任務

```bash
pm2 delete cron-manager
pm2 start ecosystem.config.js -- --karma-only
```

### 只執行 Rankings 任務

```bash
pm2 delete cron-manager
pm2 start ecosystem.config.js -- --rankings-only
```

### 手動觸發更新

```bash
# 手動執行一次（不影響背景任務）
npm run cron:once
```

---

## ⚠️ 故障排除

### 任務沒有執行

```bash
# 1. 檢查程序狀態
pm2 status

# 2. 查看日誌
pm2 logs cron-manager --lines 50

# 3. 重啟服務
pm2 restart cron-manager
```

### 記憶體使用過高

```bash
# 查看記憶體使用
pm2 monit

# 如果超過 1GB 會自動重啟（已配置）
```

### 查看錯誤訊息

```bash
# 只顯示錯誤日誌
pm2 logs cron-manager --err

# 查看最近 100 行錯誤
pm2 logs cron-manager --err --lines 100
```

---

## 📚 更多資訊

- [完整文件](./scripts/CRON_MANAGER.md)
- [Karma 系統文件](./features/KARMA_SYSTEM.md)
- [Script 重構文件](./scripts/SCRIPT_REFACTORING.md)

---

## 💡 提示

- 日誌檔案位置：`logs/cron-manager-out.log`
- 統計資訊每小時自動輸出
- 可使用 `pm2 logs` 即時查看執行狀況
- 建議每週檢查一次日誌檔案大小

---

## 🎉 恭喜！

你已成功部署背景任務系統，現在 Karma 和 Rankings 會自動更新！
