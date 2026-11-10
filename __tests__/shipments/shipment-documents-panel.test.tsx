import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ShipmentDocumentsPanel } from "@/app/shipments/components/ShipmentDocumentsPanel"
import type { ShipmentWithRelations } from "@/app/shipments/types"

const mockManual = jest.fn().mockResolvedValue("printer")
const mockAuto = jest.fn().mockResolvedValue(true)
const mockClaim = jest.fn().mockResolvedValue(true)
const mockGet = jest.fn()
let mockAllowed = true
const mockSettings = { devices: [{ enabled: true, transport: "usb", modules: { shipments: true }, autoPrint: { shipmentPackingSlip: true } }] }
const mockSite = { id: "site", name: "Warehouse" }
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user" } }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ siteId: "site", capabilities: {}, can: () => mockAllowed }) }))
jest.mock("@/lib/printer/hooks/use-printer", () => ({ usePrinterSettings: () => mockSettings }))
jest.mock("@/lib/printer/core/station-claim", () => ({ stationOwnsPrinter: () => true }))
jest.mock("@/lib/printer/core/bind-store", () => ({ getPrinterBind: () => ({}) }))
jest.mock("@/lib/printer/transports/manual-print", () => ({ printJobManually: (...args: unknown[]) => mockManual(...args) }))
jest.mock("@/lib/printer/transports/dispatch", () => ({ printJobForSettings: (...args: unknown[]) => mockAuto(...args) }))
jest.mock("@/app/shipments/actions", () => ({ getShipment: (...args: unknown[]) => mockGet(...args) }))
jest.mock("@/app/shipments/packing-slip", () => ({
  shipmentPackingSlip: () => ({ shipmentId: "shipment", lines: [{ name: "Item", quantity: 1 }] }),
  claimShipmentPackingSlip: (...args: unknown[]) => mockClaim(...args),
}))
jest.mock("@/app/shipments/packing-slip-pdf", () => ({ packingSlipPdf: jest.fn(), downloadShipmentBlob: jest.fn() }))

const shipment = { id: "shipment", site_id: "site", status: "pending" } as ShipmentWithRelations

describe("shipment documents panel", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "manual-job-id" })
    mockAllowed = true
    mockSettings.devices[0].transport = "usb"
    mockGet.mockResolvedValue({ data: shipment })
    mockClaim.mockResolvedValue(true)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) })
  })

  it("hides documents for missing permission or a foreign site", () => {
    mockAllowed = false
    const { rerender } = render(<ShipmentDocumentsPanel shipment={shipment} />)
    expect(screen.queryByText("Shipment documents")).not.toBeInTheDocument()
    mockAllowed = true
    rerender(<ShipmentDocumentsPanel shipment={{ ...shipment, site_id: "other" }} />)
    expect(screen.queryByText("Shipment documents")).not.toBeInTheDocument()
  })

  it("reloads authoritative data before manual printing and rejects a changed site", async () => {
    mockGet.mockResolvedValue({ data: { ...shipment, site_id: "other" } })
    render(<ShipmentDocumentsPanel shipment={shipment} />)
    fireEvent.click(screen.getByText("Print packing slip"))
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("shipment"))
    expect(mockManual).not.toHaveBeenCalled()
  })

  it("claims a preparing shipment on first eligible load before prompt-free dispatch", async () => {
    const preparing = { ...shipment, status: "preparing" } as ShipmentWithRelations
    mockGet.mockResolvedValue({ data: preparing })
    render(<ShipmentDocumentsPanel shipment={preparing} />)
    await waitFor(() => expect(mockAuto).toHaveBeenCalled())
    expect(mockClaim).toHaveBeenCalledWith("site", "user", "shipment")
    expect(mockClaim.mock.invocationCallOrder[0]).toBeLessThan(mockAuto.mock.invocationCallOrder[0])
    expect(mockAuto.mock.calls[0][2]).toEqual({ autoPrintFlag: "shipmentPackingSlip", bestEffort: true, fallbackToSystem: false, allowPrompt: false })
  })

  it("dispatches manual packing slips directly after refreshing the shipment", async () => {
    render(<ShipmentDocumentsPanel shipment={shipment} />)
    fireEvent.click(screen.getByText("Print packing slip"))
    await waitFor(() => expect(mockManual).toHaveBeenCalled())
    expect(mockGet.mock.invocationCallOrder[0]).toBeLessThan(mockManual.mock.invocationCallOrder[0])
    expect(mockManual.mock.calls[0][1]).toMatchObject({ module: "shipments", template: "packing-slip" })
  })

  it("does not print when an authoritative read finishes after detail closes", async () => {
    let resolve: (value: unknown) => void = () => undefined
    mockGet.mockReturnValue(new Promise((done) => { resolve = done }))
    const { unmount } = render(<ShipmentDocumentsPanel shipment={shipment} />)
    fireEvent.click(screen.getByText("Print packing slip"))
    unmount()
    resolve({ data: shipment })
    await Promise.resolve()
    expect(mockManual).not.toHaveBeenCalled()
  })

  it("does not dispatch when a persisted claim already exists", async () => {
    mockClaim.mockResolvedValue(false)
    const preparing = { ...shipment, status: "preparing" } as ShipmentWithRelations
    mockGet.mockResolvedValue({ data: preparing })
    render(<ShipmentDocumentsPanel shipment={preparing} />)
    await waitFor(() => expect(mockClaim).toHaveBeenCalled())
    expect(mockAuto).not.toHaveBeenCalled()
  })

  it("never automatically claims or prints to a system printer", async () => {
    mockSettings.devices[0].transport = "system"
    render(<ShipmentDocumentsPanel shipment={{ ...shipment, status: "preparing" }} />)
    await screen.findByText("No carrier PDFs loaded.")
    expect(mockClaim).not.toHaveBeenCalled()
    expect(mockAuto).not.toHaveBeenCalled()
  })
})