import { act, render, screen } from "@testing-library/react";
import POSPage from "@/app/pos/page";
import { usePosLocationAccess } from "@/app/pos/hooks/use-pos-location-access";
import { getPosDb } from "@/app/pos/local/db";
import { useEffect } from "react";

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
    render(<POSPage />);
    expect(getPosDb).not.toHaveBeenCalled();
    expect(screen.queryByText("Private customer cache")).not.toBeInTheDocument();
  });

  it("unmounts cached data and sync hooks on revocation and explains unconfirmed work safety", () => {
    jest.mocked(usePosLocationAccess).mockReturnValue({ status: "allowed", lease: {
      siteId: "site-a", userId: "actor-a", role: "collaborator", generation: 1, expiresAt: Date.now() + 30_000,
    } });
    const view = render(<POSPage />);
    expect(screen.getByText("Private customer cache")).toBeInTheDocument();
    act(() => {
      jest.mocked(usePosLocationAccess).mockReturnValue({ status: "restricted", lease: null });
      view.rerender(<POSPage />);
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Private customer cache")).not.toBeInTheDocument();
    expect(screen.getByText(/not supported for members with location exclusions/)).toBeInTheDocument();
    expect(screen.getByText(/Check server orders and payments/)).toBeInTheDocument();
  });
});