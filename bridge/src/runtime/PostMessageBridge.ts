import type {
  ChatBridgeHostEvent,
  ChatBridgeHostEventType,
  ChatBridgeAppEvent,
  ChatBridgeAppEventType,
} from '../../../packages/app-sdk/src'

export class PostMessageBridge {
  createHostEvent<T extends ChatBridgeHostEventType>(
    type: T,
    payload: Extract<ChatBridgeHostEvent, { type: T }>['payload']
  ): Extract<ChatBridgeHostEvent, { type: T }> {
    return { type, payload } as Extract<ChatBridgeHostEvent, { type: T }>
  }

  createAppEvent<T extends ChatBridgeAppEventType>(
    type: T,
    payload: Extract<ChatBridgeAppEvent, { type: T }>['payload']
  ): Extract<ChatBridgeAppEvent, { type: T }> {
    return { type, payload } as Extract<ChatBridgeAppEvent, { type: T }>
  }
}
