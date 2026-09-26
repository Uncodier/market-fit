export function reconcileSupportConnectionById(
  connections: any[],
  connectionId: string,
  payload: any,
): any[] | null {
  const currentIndex = connections.findIndex(
    (connection) => connection.id === connectionId
  )
  if (currentIndex === -1) return null

  return connections.map((connection, index) => index === currentIndex
    ? {
        ...connection,
        ...payload,
        metadata: { ...connection.metadata, ...payload.metadata },
      }
    : connection
  )
}