const SENSITIVE_PATTERNS = [
  { pattern: /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/g, replacement: '[EMAIL_REDACTED]' },
  { pattern: /(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth[_-]?token)["\s:=]+([^\s,"']+)/gi, replacement: '$1=[REDACTED]' },
  { pattern: /(Bearer|Basic|Token)\s+([^\s]+)/gi, replacement: '$1 [REDACTED]' },
  { pattern: /(\d{3}-\d{2}-\d{4})/g, replacement: '[SSN_REDACTED]' },
  { pattern: /(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})/g, replacement: '[CARD_REDACTED]' },
  { pattern: /(sk-|pk_)[A-Za-z0-9]{20,}/g, replacement: '[KEY_REDACTED]' },
];

export function sanitizeLogData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return SENSITIVE_PATTERNS.reduce((result, { pattern, replacement }) => {
      return result.replace(pattern, replacement);
    }, data);
  }

  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('key') || lowerKey.includes('auth')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeLogData(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

export function createSanitizedLogger(logger = console) {
  return {
    log: (...args) => logger.log(...sanitizeLogData(args)),
    info: (...args) => logger.info(...sanitizeLogData(args)),
    warn: (...args) => logger.warn(...sanitizeLogData(args)),
    error: (...args) => logger.error(...sanitizeLogData(args)),
    debug: (...args) => {
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug(...sanitizeLogData(args));
      }
    },
  };
}

export default { sanitizeLogData, createSanitizedLogger };
