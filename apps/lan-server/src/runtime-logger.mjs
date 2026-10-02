const SECRET_KEY = /(authorization|token|password|secret|pairing|setup.?code|snapshot)/i
const BEARER = /Bearer\s+[^\s"']+/gi
const SECRET_ASSIGNMENT = /((?:token|password|secret|pairing[_-]?code|setup[_-]?code)=)[^&\s"']+/gi
const SETUP_CODE = /\b[A-F0-9]{5}-[A-F0-9]{5}\b/g

function sanitizeString(value) {
  return String(value)
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(SECRET_ASSIGNMENT, '$1[REDACTED]')
    .replace(SETUP_CODE, '[REDACTED]')
}

export function redactRuntimeValue(value, key = '') {
  if (SECRET_KEY.test(String(key))) return '[REDACTED]'
  if (value instanceof Error) return { name: value.name, message: sanitizeString(value.message) }
  if (typeof value === 'string') return sanitizeString(value)
  if (Array.isArray(value)) return value.map(item => redactRuntimeValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, redactRuntimeValue(childValue, childKey)])
    )
  }
  return value
}

export function createRuntimeLogger({ sink = console, now = () => new Date() } = {}) {
  const emit = (level, event, details = {}) => {
    const payload = JSON.stringify({
      ts: now().toISOString(),
      level,
      event: String(event),
      ...redactRuntimeValue(details)
    })
    const writer = level === 'error' ? sink.error : level === 'warn' ? sink.warn : sink.log
    writer.call(sink, payload)
  }

  return Object.freeze({
    info: (event, details) => emit('info', event, details),
    warn: (event, details) => emit('warn', event, details),
    error: (event, details) => emit('error', event, details)
  })
}
