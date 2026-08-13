export type TicketAlign = "left" | "center" | "right"

export interface TicketBuilder {
  readonly width: number
  text(value: string, align?: TicketAlign): this
  rawLine(value: string): this
  bold(on: boolean): this
  size(doubleHeight: boolean, doubleWidth?: boolean): this
  invert(on: boolean): this
  feed(lines?: number): this
  separator(char?: string): this
  blackBar(heightDots?: number): this
  qr(data: string, moduleSize?: number): this
  cut(): this
}
