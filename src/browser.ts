import { AgentSDK } from "./core/AgentSDK"

// For browser global access
if (typeof window !== "undefined") {
  (window as any).AgentSDK = AgentSDK
}

// Export for module usage
export { AgentSDK }
export default AgentSDK
