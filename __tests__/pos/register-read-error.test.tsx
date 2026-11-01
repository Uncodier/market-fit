import { render, screen } from "@testing-library/react";
import { RegisterReadError } from "@/app/pos/register/RegisterReadError";

it("explains origin rejection without blaming sync, printing or migrations", () => {
  render(<RegisterReadError error="Forbidden POS request origin." />);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("Cash register request blocked");
  expect(alert).toHaveTextContent("not a catalog sync or printer error");
  expect(alert).toHaveTextContent("host and proxy configuration");
  expect(alert).not.toHaveTextContent("migration");
});

it("preserves server detail and warns when previously loaded figures are stale", () => {
  render(<RegisterReadError error="Unable to load summary" hasPreviousData />);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load summary");
  expect(screen.getByRole("alert")).toHaveTextContent("Last loaded figures have not been reset. They may be out of date.");
});