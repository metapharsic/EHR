module.exports = {
  apps: [
    {
      name: 'metapharsic-erp',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
