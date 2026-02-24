# Cron Jobs 快速開始指南

## 目前任務

- Review Queue Expire：每 5 分鐘
- Rankings Update：每 24 小時

## 快速部署

### 1) 執行 migration

```bash
supabase db push
```

### 2) 本機測試一次

```bash
npm run cron:once
```

### 3) PM2 啟動

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 status
pm2 logs cron-manager
```

### 4) 常用模式

```bash
# 只跑 rankings
pm2 delete cron-manager
pm2 start ecosystem.config.js -- --rankings-only

# 手動跑一次
npm run cron:once
```

## 監控

```bash
pm2 status
pm2 monit
pm2 logs cron-manager --lines 100
```

## 補充

- Karma refresh runtime 已移除。
- 舊 `--karma-only` 參數不再支援。
