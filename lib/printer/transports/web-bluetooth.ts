const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
]

type BluetoothApi = {
  requestDevice: (options: {
    acceptAllDevices?: boolean
    filters?: { services?: string[]; namePrefix?: string }[]
    optionalServices?: string[]
  }) => Promise<BluetoothDeviceLike>
  getDevices?: () => Promise<BluetoothDeviceLike[]>
}

type BluetoothRemoteGattServerLike = {
  connected?: boolean
  connect: () => Promise<BluetoothRemoteGattServerLike>
  getPrimaryServices: () => Promise<BluetoothRemoteGattServiceLike[]>
  disconnect: () => void
}

type BluetoothDeviceLike = {
  id: string
  name?: string
  gatt?: BluetoothRemoteGattServerLike
  watchAdvertisements?: (options?: { signal?: AbortSignal }) => Promise<void>
  addEventListener?: (
    type: string,
    listener: () => void,
    opts?: { once?: boolean },
  ) => void
}

type BluetoothRemoteGattServiceLike = {
  getCharacteristics: () => Promise<BluetoothRemoteGattCharacteristicLike[]>
}

type BluetoothRemoteGattCharacteristicLike = {
  uuid?: string
  properties: { write?: boolean; writeWithoutResponse?: boolean }
  writeValue?: (data: BufferSource) => Promise<void>
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>
}

const CLASSIC_BT_MESSAGE =
  "Chrome cannot use Bluetooth 3.0 Classic. Plug the printer in with USB for automatic printing, or restart it in BLE 4.0 mode without pairing it in macOS."

export function bluetoothErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "")
  const text = raw.toLowerCase()
  if (
    text.includes("unsupported device") ||
    text.includes("no gatt") ||
    text.includes("has no gatt")
  ) {
    return CLASSIC_BT_MESSAGE
  }
  if (text.includes("user cancelled") || text.includes("user canceled") || text.includes("cancelled")) {
    return "Bluetooth pairing was cancelled"
  }
  return raw || "Bluetooth printer error"
}

function rethrowBluetooth(err: unknown): never {
  throw new Error(bluetoothErrorMessage(err))
}

const deviceCache = new Map<string, BluetoothDeviceLike>()

function getBluetooth(): BluetoothApi | null {
  if (typeof navigator === "undefined") return null
  return (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth || null
}

function rememberDevice(device: BluetoothDeviceLike) {
  if (device?.id) deviceCache.set(device.id, device)
}

export function isWebBluetoothSupported(): boolean {
  return Boolean(getBluetooth())
}

const BLE_FILTERS = [
  { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
  { services: ["0000ffe0-0000-1000-8000-00805f9b34fb"] },
  { services: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"] },
  { namePrefix: "Printer" },
  { namePrefix: "Blue" },
  { namePrefix: "BT" },
  { namePrefix: "POS" },
  { namePrefix: "MTP" },
  { namePrefix: "RPP" },
  { namePrefix: "XP" },
  { namePrefix: "GP" },
  { namePrefix: "ZJ" },
  { namePrefix: "58" },
]

const PREFERRED_CHAR_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
]

async function requestDevice(bluetooth: BluetoothApi): Promise<BluetoothDeviceLike> {
  try {
    const device = await bluetooth.requestDevice({
      filters: BLE_FILTERS,
      optionalServices: BLE_SERVICES,
    })
    rememberDevice(device)
    return device
  } catch (err) {
    rethrowBluetooth(err)
  }
}

export async function requestBluetoothPrinter(): Promise<{ deviceId: string; name?: string }> {
  const bluetooth = getBluetooth()
  if (!bluetooth) throw new Error("Web Bluetooth is not supported in this browser")
  const device = await requestDevice(bluetooth)
  if (!device.gatt) rethrowBluetooth(new Error("Unsupported device"))
  try {
    if (!device.gatt.connected) await device.gatt.connect()
  } catch (err) {
    rethrowBluetooth(err)
  }
  return { deviceId: device.id, name: device.name }
}

async function findDevice(deviceId?: string): Promise<BluetoothDeviceLike | null> {
  if (deviceId) {
    const cached = deviceCache.get(deviceId)
    if (cached) return cached
  }
  const bluetooth = getBluetooth()
  if (bluetooth?.getDevices) {
    try {
      const devices = await bluetooth.getDevices()
      for (const device of devices) rememberDevice(device)
      if (deviceId) return deviceCache.get(deviceId) || null
      return devices[0] || null
    } catch {
      // getDevices is unavailable or blocked in this context
    }
  }
  if (!deviceId && deviceCache.size === 1) {
    return [...deviceCache.values()][0]
  }
  return null
}

async function connectGatt(device: BluetoothDeviceLike): Promise<BluetoothRemoteGattServerLike> {
  if (!device.gatt) throw new Error("Bluetooth printer has no GATT server")
  if (device.gatt.connected) return device.gatt
  try {
    return await device.gatt.connect()
  } catch {
    // Chrome often needs an advertisement after a reload before GATT will connect.
  }
  if (!device.watchAdvertisements || !device.addEventListener) {
    throw new Error("Bluetooth printer is not connected on this station")
  }
  const abort = new AbortController()
  try {
    await device.watchAdvertisements({ signal: abort.signal })
  } catch {
    abort.abort()
    throw new Error("Bluetooth printer is not connected on this station")
  }
  return new Promise<BluetoothRemoteGattServerLike>((resolve, reject) => {
    const timer = setTimeout(() => {
      abort.abort()
      reject(new Error("Bluetooth printer is not connected on this station"))
    }, 8000)
    device.addEventListener?.(
      "advertisementreceived",
      () => {
        clearTimeout(timer)
        abort.abort()
        device.gatt
          ?.connect()
          .then(resolve)
          .catch(() => reject(new Error("Bluetooth printer is not connected on this station")))
      },
      { once: true },
    )
  })
}

export async function warmBluetoothPrinter(deviceId?: string): Promise<boolean> {
  try {
    const device = await findDevice(deviceId)
    if (!device) return false
    await connectGatt(device)
    return true
  } catch {
    return false
  }
}

async function writeCharacteristic(
  characteristic: BluetoothRemoteGattCharacteristicLike,
  chunk: Uint8Array,
) {
  if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
    await characteristic.writeValueWithoutResponse(chunk)
    return
  }
  if (characteristic.writeValue) {
    await characteristic.writeValue(chunk)
    return
  }
  throw new Error("Bluetooth characteristic is not writable")
}

export async function writeBluetoothBytes(
  data: Uint8Array,
  deviceId?: string,
  options?: { allowPrompt?: boolean },
): Promise<void> {
  const bluetooth = getBluetooth()
  if (!bluetooth) throw new Error("Web Bluetooth is not supported in this browser")
  let device = await findDevice(deviceId)
  if (!device) {
    if (options?.allowPrompt === false) {
      throw new Error("Bluetooth printer is not connected on this station")
    }
    device = await requestDevice(bluetooth)
  }
  rememberDevice(device)
  try {
    const server = await connectGatt(device)
    const services = await server.getPrimaryServices()
    const chars: BluetoothRemoteGattCharacteristicLike[] = []
    for (const service of services) {
      chars.push(...(await service.getCharacteristics()))
    }
    const writable = chars.filter(
      (c) => c.properties.writeWithoutResponse || c.properties.write,
    )
    const writer =
      writable.find((c) =>
        PREFERRED_CHAR_UUIDS.includes((c.uuid || "").toLowerCase()),
      ) || writable[0] || null
    if (!writer) throw new Error("No writable Bluetooth characteristic found")
    const chunkSize = 180
    for (let i = 0; i < data.length; i += chunkSize) {
      await writeCharacteristic(writer, data.slice(i, i + chunkSize))
      if (i + chunkSize < data.length) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    }
  } catch (err) {
    rethrowBluetooth(err)
  }
}
