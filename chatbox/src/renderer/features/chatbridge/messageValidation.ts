const BRIDGE_PROTOCOL_VERSION = '1' as const

export interface BridgeEnvelope<TEvent = { type: string; payload?: unknown }> {
  protocolVersion: typeof BRIDGE_PROTOCOL_VERSION
  appSessionId: string
  nonce: string
  event: TEvent
}

interface TrustedEnvelopeInput {
  data: unknown
  origin: string
  expectedOrigin: string
  source: unknown
  expectedSource: unknown
  expectedSessionId: string
  expectedNonce: string
}

export function isBridgeEnvelope(data: unknown): data is BridgeEnvelope<{ type: string; payload?: unknown }> {
  if (!data || typeof data !== 'object') {
    return false
  }

  const candidate = data as Record<string, unknown>
  const event = candidate.event as Record<string, unknown> | undefined

  return (
    candidate.protocolVersion === BRIDGE_PROTOCOL_VERSION &&
    typeof candidate.appSessionId === 'string' &&
    typeof candidate.nonce === 'string' &&
    !!event &&
    typeof event.type === 'string'
  )
}

export function isTrustedBridgeEnvelope(input: TrustedEnvelopeInput): input is TrustedEnvelopeInput & {
  data: BridgeEnvelope<{ type: string; payload?: unknown }>
} {
  return (
    input.origin === input.expectedOrigin &&
    input.source === input.expectedSource &&
    isBridgeEnvelope(input.data) &&
    input.data.appSessionId === input.expectedSessionId &&
    input.data.nonce === input.expectedNonce
  )
}
