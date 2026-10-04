export function ingestionKey(connectorId: string, externalEventId: string) {
  return `${connectorId}:${externalEventId}`;
}
