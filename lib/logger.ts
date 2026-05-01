type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown> & {
  requestId?: string;
  route?: string;
  method?: string;
  userId?: string | null;
};

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = process.env.LOG_LEVEL?.toLowerCase();
const configuredLevel: LogLevel =
  envLevel === "debug" || envLevel === "info" || envLevel === "warn" || envLevel === "error"
    ? envLevel
    : process.env.NODE_ENV === "development"
      ? "debug"
      : "info";

function canLog(level: LogLevel) {
  return levelWeight[level] >= levelWeight[configuredLevel];
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, serializeValue(entryValue)]),
    );
  }

  return value;
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  if (!canLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? (serializeValue(context) as Record<string, unknown>) : {}),
  };

  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  debug(message: string, context?: LogContext) {
    emit("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    emit("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    emit("error", message, context);
  },
};
