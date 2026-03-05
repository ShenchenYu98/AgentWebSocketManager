export type LogLevel = "debug" | "info" | "warn" | "error"

export interface Logger {
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
}

class DefaultLogger implements Logger {
  private level: LogLevel = "info"

  constructor(level: LogLevel = "info") {
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"]
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }

  debug(...args: any[]): void {
    if (this.shouldLog("debug")) {
      console.debug("[AgentSDK]", ...args)
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog("info")) {
      console.info("[AgentSDK]", ...args)
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog("warn")) {
      console.warn("[AgentSDK]", ...args)
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog("error")) {
      console.error("[AgentSDK]", ...args)
    }
  }
}

export const logger = new DefaultLogger()

export function createLogger(level: LogLevel): Logger {
  return new DefaultLogger(level)
}