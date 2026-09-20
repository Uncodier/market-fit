import { fireEvent, render, screen } from "@testing-library/react"
import { OrdersKanban } from "@/app/orders/components/OrdersKanban"
import { KanbanView as SalesKanban } from "@/app/sales/components/KanbanView"
import type { OrderWithRelations } from "@/app/orders/types"
import type { Sale } from "@/app/types"
import { formatOrderTime } from "@/app/orders/order-list-description"
import { formatScheduledFor } from "@/app/orders/format-scheduled-for"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) =>
      ({
        "orders.kanban.fulfillment.dine_in": "Dine in",
        "orders.kanban.paid": "Paid",
      })[key] || key,
  }),
}))

jest.mock("@/app/components/dashboard/campaign-revenue-donut", () => ({
  formatCurrency: (amount: number) => `$${amount}`,
}))

jest.mock("@/app/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLDivElement>
  }) => (
    <div role="menu" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode
    onSelect?: () => void
  }) => (
    <button role="menuitem" onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Droppable: ({
    children,
  }: {
    children: (
      provided: { innerRef: jest.Mock; droppableProps: Record<string, never> },
      snapshot: { isDraggingOver: boolean },
    ) => React.ReactNode
  }) => children({ innerRef: jest.fn(), droppableProps: {} }, { isDraggingOver: false }),
  Draggable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: jest.Mock
        draggableProps: Record<string, never>
        dragHandleProps: Record<string, never>
      },
      snapshot: { isDragging: boolean },
    ) => React.ReactNode
  }) =>
    children(
      { innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} },
      { isDragging: false },
    ),
}))

const order = {
  id: "order-1",
  sale_id: "sale-1",
  order_number: "1001",
  items: [],
  subtotal: 25,
  tax_total: 0,
  discount_total: 0,
  total: 25,
  status: "pending",
  site_id: "site-1",
  fulfillment_method: "dine_in",
  scheduled_for: "2026-09-20T18:30:00.000Z",
  created_at: "2026-09-19T12:00:00.000Z",
  updated_at: "2026-09-19T12:00:00.000Z",
  sales: {
    status: "completed",
    source: "retail",
    amount: 25,
    amount_due: 0,
    payment_method: "cash",
  },
  sale_order_items: [
    {
      name: "Coffee",
      quantity: 2,
    },
  ],
} as OrderWithRelations

const sale = {
  id: "sale-1",
  title: "Counter sale",
  productName: "Coffee",
  amount: 25,
  amount_due: 10,
  status: "pending",
  leadId: null,
  leadName: "Anonymous Customer",
  campaignId: null,
  segmentId: null,
  saleDate: "2026-09-19T12:00:00.000Z",
  paymentMethod: "cash",
  source: "retail",
  siteId: "site-1",
  userId: "user-1",
  createdAt: "2026-09-19T12:00:00.000Z",
  updatedAt: "2026-09-19T12:00:00.000Z",
} as Sale

describe("commerce kanban cards", () => {
  it("omits the customer fallback and exposes order actions", () => {
    const onOrderClick = jest.fn()

    render(
      <OrdersKanban
        orders={[order]}
        onOrderClick={onOrderClick}
        onUpdateOrderStatus={jest.fn()}
        onPay={jest.fn()}
        onPrintFull={jest.fn()}
        onPrintDelta={jest.fn()}
        onCancel={jest.fn()}
        onSplit={jest.fn()}
      />,
    )

    expect(screen.queryByText(/unknown customer/i)).not.toBeInTheDocument()
    expect(screen.getByText("Coffee ×2")).toHaveClass("w-full", "line-clamp-2")
    expect(screen.getByText(formatOrderTime(order.created_at))).toBeInTheDocument()
    expect(screen.queryByText(`Coffee ×2 · ${formatOrderTime(order.created_at)}`)).not.toBeInTheDocument()
    expect(screen.getByLabelText("Dine in")).toHaveClass("ml-auto")
    expect(screen.queryByText("Dine in")).not.toBeInTheDocument()
    expect(screen.getByText("Paid").parentElement).toHaveTextContent("$25")
    expect(screen.getByText(formatScheduledFor(order.scheduled_for)!)).toHaveClass("whitespace-nowrap")
    expect(screen.getByRole("button", { name: "Order actions" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("menuitem", { name: "Open order" }))
    expect(onOrderClick).toHaveBeenCalledTimes(1)
  })

  it("shows the lead email beside the name and falls back to the phone", () => {
    render(
      <OrdersKanban
        orders={[
          {
            ...order,
            id: "order-email",
            order_number: "1002",
            leads: {
              id: "lead-email",
              name: "Ada Lovelace",
              email: "ada@example.com",
              phone: "555-0101",
            },
          },
          {
            ...order,
            id: "order-phone",
            order_number: "1003",
            leads: {
              id: "lead-phone",
              name: "Grace Hopper",
              phone: "555-0102",
            },
          },
        ]}
        onOrderClick={jest.fn()}
        onUpdateOrderStatus={jest.fn()}
        onPay={jest.fn()}
        onPrintFull={jest.fn()}
        onPrintDelta={jest.fn()}
        onCancel={jest.fn()}
        onSplit={jest.fn()}
      />,
    )

    expect(screen.getByText("Ada Lovelace").parentElement).toHaveClass("w-full")
    expect(screen.getByText("Ada Lovelace").parentElement).toHaveTextContent("ada@example.com")
    expect(screen.queryByText("555-0101")).not.toBeInTheDocument()
    expect(screen.getByText("Grace Hopper").parentElement).toHaveClass("w-full")
    expect(screen.getByText("Grace Hopper").parentElement).toHaveTextContent("555-0102")
  })

  it("omits mapped anonymous customers and exposes sale actions", () => {
    const onPrintSale = jest.fn()
    const onRegisterPayment = jest.fn()

    render(
      <SalesKanban
        sales={[sale]}
        segments={[]}
        onUpdateSaleStatus={jest.fn()}
        onSaleClick={jest.fn()}
        onPrintSale={onPrintSale}
        onRegisterPayment={onRegisterPayment}
      />,
    )

    expect(screen.queryByText("Anonymous Customer")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sale actions" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Register payment" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Print" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("menuitem", { name: "Register payment" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Print" }))
    expect(onRegisterPayment).toHaveBeenCalledWith(sale)
    expect(onPrintSale).toHaveBeenCalledWith(sale)
  })
})
