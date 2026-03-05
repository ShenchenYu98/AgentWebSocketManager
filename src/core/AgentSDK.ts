import { EventBus } from "../event/EventBus"
import { ConnectionManager } from "./ConnectionManager"
import { MessageDispatcher } from "./MessageDispatcher"
import { SessionManager } from "./SessionManager"
import { HeartbeatManager } from "./HeartbeatManager"
import { ReconnectManager } from "./ReconnectManager"
import { MiddlewareChain, MiddlewareContext, Middleware } from "../middleware/middleware"
import { SDKOptions, SDKRequest, SDKResponse, Session, EventHandler, SDKEvent } from "../protocol/types"
import { generateUUID } from "../utils/uuid"
import { logger } from "../utils/logger"
import { isStreamMessage, isResponse } from "../protocol/message"

export class AgentSDK {
  private options: SDKOptions
  private connectionManager: ConnectionManager
  private messageDispatcher: MessageDispatcher
  private eventBus: EventBus
  private sessionManager: SessionManager
  private heartbeatManager?: HeartbeatManager
  private reconnectManager: ReconnectManager
  private middlewareChain: MiddlewareChain
  private isManualClose: boolean = false

  constructor(options: SDKOptions) {
    this.options = {
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 20000,
      heartbeatTimeout: 10000,
      requestTimeout: 20000,
      ...options,
    }

    this.eventBus = new EventBus()
    this.connectionManager = new ConnectionManager(this.options.url, this.eventBus, this.options)
    this.messageDispatcher = new MessageDispatcher(this.options.requestTimeout)
    this.sessionManager = new SessionManager()
    this.reconnectManager = new ReconnectManager(
      this.options.maxReconnectAttempts,
      this.options.reconnectInterval
    )
    this.middlewareChain = new MiddlewareChain()

    this.initializeHeartbeat()
    this.setupEventListeners()
  }

  private initializeHeartbeat(): void {
    this.heartbeatManager = new HeartbeatManager(
      () => this.send({ type: "ping" }),
      () => this.handleHeartbeatTimeout(),
      this.options.heartbeatInterval,
      this.options.heartbeatTimeout
    )
  }

  private setupEventListeners(): void {
    this.eventBus.on("open", () => {
      logger.info("SDK connected")
      this.reconnectManager.reset()
      this.heartbeatManager?.start()
    })

    this.eventBus.on("close", () => {
      logger.info("SDK disconnected")
      this.heartbeatManager?.stop()

      if (!this.isManualClose && this.options.reconnect) {
        this.handleReconnect()
      }
    })

    this.eventBus.on("error", (error) => {
      logger.error("SDK error:", error)
    })

    this.eventBus.on("message", (data: string) => {
      this.handleMessage(data)
    })
  }

  private async handleMessage(data: string): Promise<void> {
    try {
      const msg = JSON.parse(data)

      if (isStreamMessage(msg)) {
        this.eventBus.emit("stream", msg)
        return
      }

      if (isResponse(msg)) {
        this.messageDispatcher.resolve(msg)
        return
      }

      this.eventBus.emit("message", msg)
    } catch (error) {
      logger.error("Failed to parse message:", error)
    }
  }

  private handleHeartbeatTimeout(): void {
    logger.warn("Heartbeat timeout")
    this.connectionManager.close(4000, "Heartbeat timeout")
  }

  private async handleReconnect(): Promise<void> {
    if (!this.reconnectManager.canReconnect()) {
      logger.error("Max reconnect attempts reached")
      this.eventBus.emit("error", new Error("Max reconnect attempts reached"))
      return
    }

    try {
      await this.reconnectManager.wait()
      this.reconnectManager.next()
      this.connectionManager.connect()
    } catch (error) {
      logger.error("Reconnect failed:", error)
    }
  }

  connect(): void {
    this.isManualClose = false
    this.connectionManager.connect()
  }

  disconnect(code: number = 1000, reason?: string): void {
    this.isManualClose = true
    this.heartbeatManager?.stop()
    this.connectionManager.close(code, reason)
  }

  async send(request: SDKRequest): Promise<SDKResponse> {
    const requestId = generateUUID()
    const finalRequest: SDKRequest = {
      ...request,
      requestId,
      sessionId: request.sessionId || this.sessionManager.getCurrentSessionId(),
    }

    const context: MiddlewareContext = {
      request: finalRequest,
      timestamp: Date.now(),
    }

    await this.middlewareChain.execute(context)

    const promise = this.messageDispatcher.register(requestId)
    this.connectionManager.send(finalRequest)

    return promise
  }

  on(event: SDKEvent, handler: EventHandler): void {
    this.eventBus.on(event, handler)
  }

  off(event: SDKEvent, handler?: EventHandler): void {
    this.eventBus.off(event, handler)
  }

  once(event: SDKEvent, handler: EventHandler): void {
    this.eventBus.once(event, handler)
  }

  createSession(userId?: string): Session {
    return this.sessionManager.create(userId)
  }

  getCurrentSession(): Session | undefined {
    return this.sessionManager.getCurrentSession()
  }

  switchSession(sessionId: string): boolean {
    const result = this.sessionManager.switch(sessionId)
    if (result) {
      this.eventBus.emit("sessionChanged", sessionId)
    }
    return result
  }

  getAllSessions(): Session[] {
    return this.sessionManager.getAll()
  }

  closeSession(sessionId?: string): void {
    this.sessionManager.close(sessionId)
  }

  use(middleware: Middleware): void {
    this.middlewareChain.use(middleware)
  }

  updateToken(token: string): void {
    this.options.token = token
    this.connectionManager.updateToken(token)
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected()
  }

  getState(): string {
    return this.connectionManager.getState()
  }

  destroy(): void {
    this.isManualClose = true
    this.heartbeatManager?.stop()
    this.messageDispatcher.clear()
    this.eventBus.removeAllListeners()
    this.connectionManager.close()
    this.sessionManager.clear()
    logger.info("SDK destroyed")
  }
}