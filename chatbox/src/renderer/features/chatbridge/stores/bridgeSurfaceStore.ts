import { createStore, useStore } from 'zustand'

interface BridgeSurfaceState {
  activeAppId?: string
  activeAppName?: string
  activeAppSessionId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
}

interface BridgeSurfaceActions {
  setActiveApp: (payload: BridgeSurfaceState) => void
  clearActiveApp: () => void
}

export const bridgeSurfaceStore = createStore<BridgeSurfaceState & BridgeSurfaceActions>()((set) => ({
  activeAppId: undefined,
  activeAppName: undefined,
  activeAppSessionId: undefined,
  toolName: undefined,
  toolInput: undefined,
  setActiveApp: (payload) =>
    set(() => ({
      activeAppId: payload.activeAppId,
      activeAppName: payload.activeAppName,
      activeAppSessionId: payload.activeAppSessionId,
      toolName: payload.toolName,
      toolInput: payload.toolInput,
    })),
  clearActiveApp: () =>
    set(() => ({
      activeAppId: undefined,
      activeAppName: undefined,
      activeAppSessionId: undefined,
      toolName: undefined,
      toolInput: undefined,
    })),
}))

export function useBridgeSurfaceStore<U>(selector: (state: BridgeSurfaceState & BridgeSurfaceActions) => U) {
  return useStore(bridgeSurfaceStore, selector)
}
