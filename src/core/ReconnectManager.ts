import { logger } from "../utils/logger"

export class ReconnectManager {
  private attempts: number = 0
  private maxAttempts: number
  private baseInterval: number
  private maxInterval: number
  private currentInterval: number

  constructor(
    maxAttempts: number = 5,
    baseInterval: number = 1000,
    maxInterval: number = 30000
  ) {
    this.maxAttempts = maxAttempts
    this.baseInterval = baseInterval
    this.maxInterval = maxInterval
    this.currentInterval = baseInterval
  }

  async wait(): Promise<void> {
    if (!this.canReconnect()) {
      logger.warn("Max reconnect attempts reached")
      throw new Error("Max reconnect attempts reached")
    }

    logger.info(`Reconnecting in ${this.currentInterval}ms (attempt ${this.attempts + 1})`)

    return new Promise((resolve) => setTimeout(resolve, this.currentInterval))
  }

  next(): void {
    this.attempts++
    this.currentInterval = Math.min(this.currentInterval * 2, this.maxInterval)
    logger.debug(`Next reconnect interval: ${this.currentInterval}ms`)
  }

  reset(): void {
    this.attempts = 0
    this.currentInterval = this.baseInterval
    logger.info("Reconnect manager reset")
  }

  canReconnect(): boolean {
    return this.attempts < this.maxAttempts
  }

  getAttempts(): number {
    return this.attempts
  }

  getMaxAttempts(): number {
    return this.maxAttempts
  }

  setMaxAttempts(max: number): void {
    this.maxAttempts = max
  }
}