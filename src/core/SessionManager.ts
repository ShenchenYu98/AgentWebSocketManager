import { Session } from "../protocol/types"
import { generateUUID } from "../utils/uuid"
import { logger } from "../utils/logger"

export class SessionManager {
  private sessions = new Map<string, Session>()
  private currentSessionId?: string

  create(userId?: string): Session {
    const sessionId = generateUUID()
    const session: Session = {
      sessionId,
      userId,
      status: "active",
    }

    this.sessions.set(sessionId, session)
    this.currentSessionId = sessionId

    logger.info(`Session created: ${sessionId}`)
    return session
  }

  get(sessionId?: string): Session | undefined {
    if (sessionId) {
      return this.sessions.get(sessionId)
    }
    if (this.currentSessionId) {
      return this.sessions.get(this.currentSessionId)
    }
    return undefined
  }

  getCurrentSession(): Session | undefined {
    return this.get(this.currentSessionId)
  }

  getCurrentSessionId(): string | undefined {
    return this.currentSessionId
  }

  switch(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`)
      return false
    }

    if (session.status === "closed") {
      logger.warn(`Session already closed: ${sessionId}`)
      return false
    }

    const oldSessionId = this.currentSessionId
    this.currentSessionId = sessionId
    logger.info(`Switched from ${oldSessionId} to ${sessionId}`)
    return true
  }

  close(sessionId?: string): void {
    const targetId = sessionId || this.currentSessionId
    if (!targetId) return

    const session = this.sessions.get(targetId)
    if (session) {
      session.status = "closed"
      logger.info(`Session closed: ${targetId}`)
    }

    if (targetId === this.currentSessionId) {
      this.currentSessionId = undefined
    }
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined
    }
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values())
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  clear(): void {
    this.sessions.clear()
    this.currentSessionId = undefined
    logger.info("All sessions cleared")
  }
}