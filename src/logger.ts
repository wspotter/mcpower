import pino from 'pino';

/**
 * Pino logger configured for MCP server
 * Outputs structured JSON to stderr (stdout reserved for MCP protocol)
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: {
      destination: 2 // stderr (fd 2), stdout is fd 1
    }
  },
  base: {
    pid: process.pid,
    hostname: undefined // Omit hostname for cleaner logs
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Set logger level at runtime
 */
export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
  logger.level = level;
}
