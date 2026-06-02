// PM2 ecosystem file
// Uso: pm2 start ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: 'smart-scraper-worker',
      script: './dist/index.js',
      cwd: __dirname,
      instances: 1, // NÃO escalar (mantém uma sessão Smart só)
      exec_mode: 'fork',
      max_memory_restart: '1500M', // chromium vaza com o tempo
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Logs (rotação via pm2-logrotate; instalar com `pm2 install pm2-logrotate`)
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      merge_logs: true,
      time: false, // pino já formata timestamp
    },
  ],
};
