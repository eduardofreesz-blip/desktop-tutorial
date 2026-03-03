module.exports = {
  apps: [
    {
      name: "universal-recargas",
      cwd: "/var/www/universal_recargas",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3005 -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      watch: false,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/www/universal_recargas/logs/error.log",
      out_file: "/var/www/universal_recargas/logs/out.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
        PORT: "3005",
      },
    },
  ],
};
