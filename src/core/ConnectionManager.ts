import { EventBus } from "../event/EventBus"
import { ConnectionState, SDKOptions } from "../protocol/types"
import { logger } from "../utils/logger"

export class ConnectionManager {
  private ws?: WebSocket
  private url: string
  private token?: string
  private protocols?: string | string[]
  private eventBus: EventBus
  private state: ConnectionState = "INIT"
  private reconnectEnabled: boolean = false

  constructor(url: string, eventBus: EventBus, options?: SDKOptions) {
    this.url = url
    this.eventBus = eventBus
    this.token = options?.token
    this.protocols = options?.protocols
    this.reconnectEnabled = options?.reconnect ?? true
  }

  getState(): ConnectionState {
    return this.state
  }

  isConnected(): boolean {
    return this.state === "OPEN" && this.ws?.readyState === WebSocket.OPEN
  }

  connect(): void {
    if (this.state === "CONNECTING" || this.state === "OPEN") {
      logger.warn("Connection already exists or in progress")
      return
    }

    this.setState("CONNECTING")
    logger.info(`Connecting to ${this.url}`)

    try {
      const wsUrl = this.token ? `${this.url}?token=${encodeURIComponent(this.token)}` : this.url
      this.ws = this.protocols
        ? new WebSocket(wsUrl, this.protocols as string | string[])
        : new WebSocket(wsUrl)

      this.setupEventHandlers()
    } catch (error) {
      logger.error("Failed to create WebSocket:", error)
      this.setState("CLOSED")
      this.eventBus.emit("error", error)
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      logger.info("WebSocket connected")
      this.setState("OPEN")
      this.eventBus.emit("open")
    }

    this.ws.onmessage = (event) => {
      this.eventBus.emit("message", event.data)
    }

    this.ws.onerror = (error) => {
      logger.error("WebSocket error:", error)
      this.eventBus.emit("error", error)
    }

    this.ws.onclose = (event) => {
      logger.info(`WebSocket closed: code=${event.code}, reason=${event.reason}`)
      this.setState("CLOSED")
      this.eventBus.emit("close", event)

      if (this.reconnectEnabled && event.code !== 1000) {
        this.eventBus.emit("reconnecting")
      }
    }
  }

  send(data: any): boolean {
    if (!this.isConnected()) {
      logger.warn("Cannot send: WebSocket not connected")
      return false
    }

    try {
      this.ws?.send(JSON.stringify(data))
      return true
    } catch (error) {
      logger.error("Failed to send message:", error)
      return false
    }
  }

  close(code: number = 1000, reason?: string): void {
    this.reconnectEnabled = false
    this.ws?.close(code, reason)
  }

  updateToken(token: string): void {
    this.token = token
    logger.info("Token updated")
  }

  private setState(state: ConnectionState): void {
    this.state = state
    logger.debug(`Connection state: ${state}`)
  }
}