import { act, fireEvent, render, screen } from "@testing-library/react";
import POSPage from "@/app/pos/page";
import { usePosLocationAccess } from "@/app/pos/hooks/use-pos-location-access";
import { getPosDb } from "@/app/pos/local/db";
import { useEffect } from "react";
import PosLoading from "@/app/pos/loading";
import { LocalizationProvider } from "@/app/context/LocalizationContext";

function LocalizedPOS({ locale = "en" }: { locale?: "en" | "es" }) {
  return <LocalizationProvider preferredLocale={locale}><POSPage /></LocalizationProvider>;
}

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }));
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: { id: "actor-a" } }) }));
jest.mock("@/app/pos/hooks/use-pos-location-access", () => ({ usePosLocationAccess: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
const cleanup = jest.fn();
jest.mock("@/app/pos/PosWorkspace", () => ({ __esModule: true, default: function Workspace() {
  useEffect(() => { getPosDb(); return cleanup; }, []);
  return <div>Private customer cache</div>;
} }));

describe("POS guarded workspace mount", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["checking", "unavailable", "restricted"] as const)("never mounts private hooks for %s permission", (status) => {
    jest.mocked(usePosLocationAccess).mockReturnValue({ status, lease: null });
    render(<LocalizedPOS />);
    expect(getPosDb).not.toHaveBeenCalled();
    expect(screen.queryByText("Private customer cache")).not.toBeInTheDocument();
  });

  it("shows only a POS skeleton while access is pending, not an error or offline warning", () => {
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "checking", lease: null });
    render(<LocalizedPOS />);
    expect(screen.getByRole("status", { name: "Loading point of sale" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/Checking POS access|POS unavailable|online connection|Changing account/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getPosDb).not.toHaveBeenCalled();
  });

  it("uses the same safe skeleton for route loading", () => {
    render(<PosLoading />);
    expect(screen.getByRole("status", { name: "Loading point of sale" })).toBeInTheDocument();
    expect(getPosDb).not.toHaveBeenCalled();
  });

  it("explains a confirmed timeout without claiming the browser is offline and offers retry", () => {
    const retry = jest.fn();
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "unavailable", lease: null, reason: "timeout", retry });
    render(<LocalizedPOS />);
    expect(screen.getByText(/verification timed out/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cached POS data is not available offline/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry access check" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(getPosDb).not.toHaveBeenCalled();
  });

  it.each([
    ["offline", /browser reports that it is offline/],
    ["session", /session could not be verified/],
    ["permission", /site permissions could not be verified/],
    ["storage", /device storage could not be prepared/],
    ["context", /account or current site did not finish loading/],
  ] as const)("shows the confirmed %s failure without mounting private data", (reason, message) => {
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "unavailable", lease: null, reason });
    render(<LocalizedPOS />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading point of sale" })).not.toBeInTheDocument();
    expect(getPosDb).not.toHaveBeenCalled();
  });

  it("unmounts cached data and sync hooks on revocation and explains unconfirmed work safety", () => {
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "allowed", lease: {
      siteId: "site-a", userId: "actor-a", role: "collaborator", generation: 1, expiresAt: Date.now() + 30_000,
    } });
    const view = render(<LocalizedPOS />);
    expect(screen.getByText("Private customer cache")).toBeInTheDocument();
    act(() => {
      jest.mocked(usePosLocationAccess).mockReturnValue({ status: "restricted", lease: null });
      view.rerender(<LocalizedPOS />);
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Private customer cache")).not.toBeInTheDocument();
    expect(screen.getByText(/not supported for members with location exclusions/)).toBeInTheDocument();
    expect(screen.getByText(/Check server orders and payments/)).toBeInTheDocument();
  });

  it("shows the storage diagnostic and wires retry without mounting private data", () => {
    const retry = jest.fn();
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "unavailable", lease: null, reason: "storage", diagnostic: "POS_STORAGE_OPEN", retry });
    render(<LocalizedPOS />);
    expect(screen.getByText("POS_STORAGE_OPEN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry access check" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(getPosDb).not.toHaveBeenCalled();
  });

  it("translates access warnings without granting access or mounting private data", () => {
    const retry = jest.fn();
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "unavailable", lease: null, reason: "timeout", retry });
    const view = render(<LocalizedPOS />);
    view.rerender(<LocalizedPOS locale="es" />);
    expect(screen.getByRole("heading", { name: "Punto de venta no disponible" })).toBeInTheDocument();
    expect(screen.getByText(/Comprueba los pedidos y pagos del servidor/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar comprobación de acceso" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(getPosDb).not.toHaveBeenCalled();
  });
});