# Cron Manager

## 任務清單

- `reviewExpire`: expire review queue due items every 5 minutes
- `rankings`: recalculate rankings every 24 hours

## 啟動

```bash
npm run cron
```

## 一次性執行

```bash
npm run cron:once
```

## 只執行 rankings

```bash
npm run cron:rankings
# or
node scripts/cron-manager.ts --rankings-only
```

## 監控

```bash
pm2 status
pm2 logs cron-manager
pm2 monit
```

## 注意

- Karma refresh runtime 已移除，不再有 karma queue / karma full 任務。
