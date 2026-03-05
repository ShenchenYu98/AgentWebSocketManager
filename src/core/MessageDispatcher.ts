import { SDKResponse, PendingRequest } from "../protocol/types"
import { logger } from "../utils/logger"

export class MessageDispatcher {
  private pending = new Map<string, PendingRequest>()
  private requestTimeout: number

  constructor(requestTimeout: number = 20000) {
    this.requestTimeout = requestTimeout
  }

  register(requestId: string): Promise<SDKResponse> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(requestId)
        logger.warn(`Request ${requestId} timeout`)
        reject(new Error("Request timeout"))
      }, this.requestTimeout)

      this.pending.set(requestId, { resolve, reject, timeoutId })
    })
  }

  resolve(response: SDKResponse): void {
    const pending = this.pending.get(response.requestId)
    if (!pending) {
      logger.debug(`No pending request found for ${response.requestId}`)
      return
    }

    clearTimeout(pending.timeoutId)
    pending.resolve(response)
    this.pending.delete(response.requestId)
  }

  reject(requestId: string, error: Error): void {
    const pending = this.pending.get(requestId)
    if (!pending) return

    clearTimeout(pending.timeoutId)
    pending.reject(error)
    this.pending.delete(requestId)
  }

  hasPending(requestId: string): boolean {
    return this.pending.has(requestId)
  }

  clear(): void {
    this.pending.forEach((pending) => {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error("SDK closed"))
    })
    this.pending.clear()
  }

  getPendingCount(): number {
    return this.pending.size
  }
}