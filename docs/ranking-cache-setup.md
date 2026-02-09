# Post Rankings 快取系統設定指南

> 使用本地 Node.js 腳本定期更新 Hot 和 Rising 排序快取

---

## 概述

為了優化 `GET /api/posts` 的效能，我們建立了 `post_rankings` 快取表。此表需要**定期更新**以反映最新的互動數據（投票、評論）。

與傳統的 API 觸發或資料庫 Cron 不同，本系統使用**本地 Node.js 腳本**執行更新，提供更好的控制和監控能力。

---

## 更新方式

### 方法一：直接執行 npm run（開發環境）

最簡單的方式，適合開發和測試：

```bash
# 持續執行（每 24 小時自動更新）
npm run update-rankings

# 只執行一次
npm run update-rankings:once
```

腳本會：
1. 計算 Hot 排序（30 天內貼文）
2. 計算 Rising 排序（7 天內貼文）
3. 等待 24 小時
4. 自動重複執行

---

### 方法二：使用 PM2（生產環境推薦）

在生產環境中，建議使用 **PM2** 來管理更新進程：

#### 1. 安裝 PM2

```bash
npm install -g pm2
```

#### 2. 建立 PM2 配置文件

創建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'ranking-updater',
      script: 'scripts/update-rankings.ts',
      interpreter: 'ts-node',
      interpreter_args: '-r tsconfig-paths/register',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // 自動重啟策略
      autorestart: true,
      // 記憶體限制重啟
      max_memory_restart: '500M',
      // 日誌配置
      log_file: './logs/ranking-updater.log',
      out_file: './logs/ranking-updater-out.log',
      error_file: './logs/ranking-updater-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 不合并日誌
      merge_logs: false,
    },
  ],
};
```

#### 3. 啟動服務

```bash
# 啟動更新服務
pm2 start ecosystem.config.js

# 查看狀態
pm2 status

# 查看日誌
pm2 logs ranking-updater

# 監控資源使用
pm2 monit
```

#### 4. 設置開機自啟

```bash
# 保存當前配置
pm2 save

# 設置開機自啟
pm2 startup

# 按照提示執行命令（通常需要 sudo）
```

#### 5. 常用 PM2 命令

```bash
# 重啟服務
pm2 restart ranking-updater

# 停止服務
pm2 stop ranking-updater

# 刪除服務
pm2 delete ranking-updater

# 查看詳細信息
pm2 show ranking-updater

# 查看所有日誌
pm2 logs

# 清空日誌
pm2 flush
```

---

### 方法三：使用 Systemd（Linux 服務器）

如果你使用 Linux 服務器，可以創建 systemd 服務：

#### 1. 創建服務文件

```bash
sudo nano /etc/systemd/system/ranking-updater.service
```

#### 2. 添加配置

```ini
[Unit]
Description=Post Rankings Updater
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/npm run update-rankings
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### 3. 啟動服務

```bash
# 重載 systemd
sudo systemctl daemon-reload

# 啟動服務
sudo systemctl start ranking-updater

# 設置開機自啟
sudo systemctl enable ranking-updater

# 查看狀態
sudo systemctl status ranking-updater

# 查看日誌
sudo journalctl -u ranking-updater -f
```

---

## 腳本行為說明

### 執行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    npm run update-rankings                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 載入環境變數 (.env.local / .env)                         │
│    - NEXT_PUBLIC_SUPABASE_URL                               │
│    - SUPABASE_SERVICE_ROLE_KEY                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 測試資料庫連線                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 執行更新                                                 │
│    - 清理 30 天前的舊資料                                    │
│    - 計算 Hot 排序（30 天內）                                │
│    - 計算 Rising 排序（7 天內）                              │
│    - 更新 post_rankings 表                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 等待 24 小時                                             │
│    - 每小時顯示剩餘時間                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   返回步驟 3    │
                    └─────────────────┘
```

### 環境變數

確保 `.env.local` 包含以下變數：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 監控與除錯

### 檢查快取狀態

```sql
-- 查看快取統計
SELECT
  COUNT(*) FILTER (WHERE hot_rank > 0) as hot_posts,
  COUNT(*) FILTER (WHERE rising_rank > 0) as rising_posts,
  MAX(calculated_at) as last_update
FROM public.post_rankings;

-- 查看快取年齡
SELECT
  calculated_at,
  EXTRACT(EPOCH FROM (now() - calculated_at))/60 as age_minutes
FROM public.post_rankings
ORDER BY calculated_at DESC
LIMIT 1;

-- 查看 Top 10 Hot
SELECT
  pr.hot_rank,
  pr.hot_score,
  p.title,
  p.score,
  p.comment_count
FROM public.post_rankings pr
JOIN public.posts p ON p.id = pr.post_id
WHERE pr.hot_rank > 0
ORDER BY pr.hot_rank ASC
LIMIT 10;
```

### 檢查腳本日誌

如果使用 PM2：
```bash
# 實時查看日誌
pm2 logs ranking-updater

# 查看最後 100 行
pm2 logs ranking-updater --lines 100

# 查看錯誤日誌
pm2 logs ranking-updater --err
```

如果直接執行：
```bash
# 輸出到文件
npm run update-rankings > ranking.log 2>&1 &

# 實時查看
tail -f ranking.log
```

---

## 效能優化建議

### 1. 調整更新頻率

編輯 `scripts/update-rankings.ts` 修改等待時間：

```typescript
// 預設：24 小時
const WAIT_TIME_MS = 24 * 60 * 60 * 1000;

// 高流量網站：每 6 小時
const WAIT_TIME_MS = 6 * 60 * 60 * 1000;

// 低流量網站：每 3 天
const WAIT_TIME_MS = 3 * 24 * 60 * 60 * 1000;
```

### 2. 監控快取命中率

在 API 回應標頭中檢查快取狀態：

```bash
curl -I "https://your-domain.com/api/posts?sort=hot"

# 回應標頭：
X-Cache-Hit: 1  # 1 = 使用快取, 0 = 未使用快取
X-Response-Time: 45ms
```

### 3. 自動降級

如果快取過期（> 48 小時未更新），API 會自動回退到即時計算模式。

---

## 故障排除

### 快取一直顯示過期

1. **檢查腳本是否在運行**：
   ```bash
   pm2 status
   # 或
   ps aux | grep update-rankings
   ```

2. **檢查日誌錯誤**：
   ```bash
   pm2 logs ranking-updater --err
   ```

3. **手動執行測試**：
   ```bash
   npm run update-rankings:once
   ```

### API 回應很慢

檢查回應標頭確認是否使用快取：
- `X-Cache-Hit: 0` 表示快取未命中，檢查快取表是否有資料
- 如果經常未命中，可能是更新間隔太長

### 排序結果不準確

- 檢查 `calculated_at` 時間確認快取是否最新
- 手動觸發更新並觀察結果
- 檢查 vote/comment 觸發器是否正常標記過期快取

---

## 相關檔案

- `supabase/schema.sql` - 資料庫結構（含 post_rankings 表）
- `src/lib/ranking.ts` - 排序邏輯與快取函數
- `src/app/api/posts/route.ts` - 使用快取的 API
- `scripts/update-rankings.ts` - 更新腳本

---

## 更新記錄

- **v1.1** (2026-02-09): 移除 API 觸發方式，改為本地 Node.js 腳本
- **v1.0** (2026-02-09): 初始版本

---

_文件版本: v1.1_  
_最後更新: 2026-02-09_
