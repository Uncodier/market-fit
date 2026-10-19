import { printRegisterReport } from "@/app/pos/register/print-register-report";
import { closedRegisterSession, registerSummary } from "./register-ui-fixtures";

describe("isolated cash register printing", () => {
  afterEach(() => jest.restoreAllMocks());

  it("prints only the report and renders user-controlled content as text", () => {
    const reportDocument = document.implementation.createHTMLDocument();
    const popup = {
      document: reportDocument, opener: window, closed: false,
      focus: jest.fn(), print: jest.fn(), close: jest.fn(),
      setTimeout: jest.fn((callback: () => void) => { callback(); return 1; }), onafterprint: null as (() => void) | null,
    };
    jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const payload = '<script>alert("unsafe")</script><img src="https://example.com/track">';
    printRegisterReport({ ...closedRegisterSession, notes: payload }, { ...registerSummary, movements: [{ ...registerSummary.movements[0], reason: payload }] }, payload);
    expect(window.open).toHaveBeenCalledWith("", "_blank", "width=900,height=700");
    expect(popup.opener).toBeNull();
    expect(popup.print).toHaveBeenCalledTimes(1);
    expect(reportDocument.body.textContent).toContain(payload);
    expect(reportDocument.querySelectorAll("script, img, iframe")).toHaveLength(0);
    expect(reportDocument.body.textContent).toContain("Immutable closing snapshot");
    expect(reportDocument.body.textContent).toContain("cashier-1");
    expect(reportDocument.body.textContent).not.toContain("Charge");
    popup.onafterprint?.();
    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it("reports blocked popups without falling back to printing the POS", () => {
    jest.spyOn(window, "open").mockReturnValue(null);
    const print = jest.spyOn(window, "print").mockImplementation(() => {});
    expect(() => printRegisterReport(closedRegisterSession, registerSummary, "Store")).toThrow("Allow pop-ups");
    expect(print).not.toHaveBeenCalled();
  });
});