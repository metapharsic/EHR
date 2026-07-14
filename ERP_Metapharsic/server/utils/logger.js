// server/utils/logger.js
// Logging utility for security and system events

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data = {}) {
    return JSON.stringify({
      timestamp: this.formatTimestamp(),
      level,
      message,
      ...data
    });
  }

  writeToFile(filename, message) {
    const filePath = path.join(this.logDir, filename);
    fs.appendFileSync(filePath, message + '\n', 'utf8');
  }

  // Console output with colors
  console(level, message, data = {}) {
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      security: '\x1b[35m', // Magenta
      reset: '\x1b[0m'
    };

    const color = colors[level] || colors.info;
    console.log(
      `${color}[${level.toUpperCase()}]${colors.reset} ${this.formatTimestamp()} - ${message}`,
      Object.keys(data).length > 0 ? data : ''
    );
  }

  // Info logs
  info(message, data = {}) {
    const formatted = this.formatMessage('INFO', message, data);
    this.console('info', message, data);
    this.writeToFile('app.log', formatted);
  }

  // Warning logs
  warn(message, data = {}) {
    const formatted = this.formatMessage('WARN', message, data);
    this.console('warn', message, data);
    this.writeToFile('app.log', formatted);
  }

  // Error logs
  error(message, data = {}) {
    const formatted = this.formatMessage('ERROR', message, data);
    this.console('error', message, data);
    this.writeToFile('error.log', formatted);
  }

  // Security logs (separate file)
  security(message, data = {}) {
    const formatted = this.formatMessage('SECURITY', message, data);
    this.console('security', message, data);
    this.writeToFile('security.log', formatted);
  }

  // Authentication logs
  auth(message, data = {}) {
    const formatted = this.formatMessage('AUTH', message, data);
    this.console('info', message, data);
    this.writeToFile('auth.log', formatted);
    this.writeToFile('app.log', formatted);
  }

  // HTTP request logs
  http(method, path, status, duration, ip, userId = null) {
    const message = `${method} ${path} - ${status} - ${duration}ms`;
    const data = { method, path, status, duration, ip, userId };
    this.info(message, data);
  }

  // Database logs
  database(message, data = {}) {
    const formatted = this.formatMessage('DATABASE', message, data);
    this.writeToFile('database.log', formatted);
  }
}

module.exports = new Logger();
