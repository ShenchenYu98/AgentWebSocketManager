import { SDKRequest } from "../protocol/types"

export interface MiddlewareContext {
  request: SDKRequest
  timestamp: number
}

export type MiddlewareNext = () => Promise<void>

export type Middleware = (
  context: MiddlewareContext,
  next: MiddlewareNext
) => Promise<void>

export class MiddlewareChain {
  private middlewares: Middleware[] = []

  use(middleware: Middleware): void {
    this.middlewares.push(middleware)
  }

  async execute(context: MiddlewareContext): Promise<void> {
    let index = 0

    const next: MiddlewareNext = async () => {
      if (index >= this.middlewares.length) return
      const middleware = this.middlewares[index++]
      await middleware(context, next)
    }

    await next()
  }

  clear(): void {
    this.middlewares = []
  }

  getLength(): number {
    return this.middlewares.length
  }
}

export function createLoggerMiddleware(): Middleware {
  return async (context, next) => {
    console.log(`[Middleware] Request: ${context.request.type}`, context.request)
    await next()
  }
}