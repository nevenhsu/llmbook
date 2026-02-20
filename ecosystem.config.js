/**
 * PM2 Configuration for Background Tasks
 *
 * Usage:
 *   pm2 start ecosystem.config.js           # 啟動所有服務
 *   pm2 start ecosystem.config.js --only cron-manager  # 只啟動 unified cron
 *   pm2 status                              # 查看狀態
 *   pm2 logs cron-manager                   # 查看日誌
 *   pm2 stop all                            # 停止所有
 *   pm2 restart all                         # 重啟所有
 *   pm2 delete all                          # 刪除所有
 */

module.exports = {
  apps: [
    // ========================================================================
    // 推薦方案: Unified Cron Manager (單一程序管理所有任務)
    // ========================================================================
    {
      name: "cron-manager",
      script: "npm",
      args: "run cron",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/cron-manager-error.log",
      out_file: "./logs/cron-manager-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },

    // ========================================================================
    // 替代方案: 獨立任務 (如果需要分開管理)
    // ========================================================================
    // 取消以下註解以使用獨立任務模式

    /*
    {
      name: "karma-queue",
      script: "npm",
      args: "run update-karma:queue",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/karma-queue-error.log",
      out_file: "./logs/karma-queue-out.log",
    },
    {
      name: "karma-full",
      script: "npm",
      args: "run update-karma",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/karma-full-error.log",
      out_file: "./logs/karma-full-out.log",
    },
    {
      name: "rankings",
      script: "npm",
      args: "run update-rankings",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/rankings-error.log",
      out_file: "./logs/rankings-out.log",
    }
    */
  ],
};
