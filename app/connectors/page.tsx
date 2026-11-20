import { Suspense } from "react"
import ConnectorCatalog from "./connector-catalog"
import { ConnectorCatalogueSkeleton } from "./connector-skeletons"

export default function ConnectorsPage() {
  return <Suspense fallback={<ConnectorCatalogueSkeleton fullPage />}><ConnectorCatalog /></Suspense>
}