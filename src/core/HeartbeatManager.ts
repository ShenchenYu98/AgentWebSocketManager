import { logger } from "../utils/logger"

export class HeartbeatManager {
  private intervalId?: ReturnType<typeof setInterval>
  private timeoutId?: ReturnType<typeof setTimeout>
  private sendPing: () => void
  private onTimeout: () => void
  private interval: number
  private timeout: number
  private isRunning: boolean = false

  constructor(
    sendPing: () => void,
    onTimeout: () => void,
    interval: number = 20000,
    timeout: number = 10000
  ) {
    this.sendPing = sendPing
    this.onTimeout = onTimeout
    this.interval = interval
    this.timeout = timeout
  }

  start(): void {
    if (this.isRunning) {
      logger.warn("Heartbeat already running")
      return
    }

    this.isRunning = true
    logger.info("Heartbeat started")

    this.schedulePing()
  }

  private schedulePing(): void {
    if (!this.isRunning) return

    this.intervalId = setInterval(() => {
      this.sendPing()

      this.timeoutId = setTimeout(() => {
        logger.warn("Heartbeat timeout, triggering reconnect")
        this.onTimeout()
      }, this.timeout)
    }, this.interval)
  }

  stop(): void {
    this.isRunning = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }

    logger.info("Heartbeat stopped")
  }

  reset(): void {
    this.stop()
    this.start()
  }

  isActive(): boolean {
    return this.isRunning
  }
}