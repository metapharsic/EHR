module.exports = {
  apps: [
    {
      name: 'metapharsic-erp',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
