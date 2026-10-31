# POS receipt printing

## Transport selection

The manual receipt button uses an enabled POS USB/Bluetooth printer bound to
the current workstation. It sends ESC/POS bytes directly, without invoking the
operating system's print dialog. Automatic-print toggles do not gate manual prints.

If POS hardware is configured but disabled, unpaired, unsupported, or claimed
by another workstation, manual printing reports that it is not ready. A transport
failure is surfaced to the cashier; it never silently falls back to system
printing, even when a system printer is also configured. Check for a partial
ticket before retrying a failed transfer.

With no POS hardware configuration, an enabled POS system printer uses its
configured paper width. With no applicable printer, manual printing opens a
system dialog with an 80 mm receipt. A browser cannot select an installed system
printer or suppress that dialog using ordinary web APIs.

## USB setup

1. Use a browser exposing WebUSB/Web Serial (typically desktop Chrome or Edge).
2. In Settings > Printers, select USB and the actual paper width (58 or 80 mm).
3. Enable the POS module, connect the device on the cashier's computer, and save.
4. Run a receipt test print from Settings before printing from POS.

An installed OS driver does not grant this website direct USB permission.
The browser binding is specific to the workstation/browser profile and origin.
Some OS drivers exclusively claim the USB interface, preventing WebUSB access.
Do not replace or uninstall drivers without confirming the printer model and
the manufacturer's supported setup. Driver-only devices may require a separately
designed local print bridge for silent printing; none is currently implemented.

## PostScript text instead of a receipt

Paper containing commands such as `findfont`, `def`, or `showpage` suggests that
the system print pipeline sent PostScript to a device that did not interpret it.
The direct USB path encodes ESC/POS, not PostScript. This symptom is not normally
fixed by changing receipt CSS, margins, or paper width.

Cancel pending jobs to avoid wasting paper. Confirm the printer's exact model,
supported command language, OS, selected print queue, and manufacturer driver.
If an OS test page also prints source code, repair the driver/queue setup before
using system printing. Installing a driver alone does not prove that the selected
queue uses the correct one. Direct USB printing requires an ESC/POS-compatible
device and a successful browser connection/test.

## Validation

```bash
npm test -- --runInBand __tests__/app/pos/print-receipt.test.ts __tests__/lib/printer
```

These regressions validate routing and encoding, not physical printer output.
Hardware acceptance still requires the Settings test and a POS receipt on the
cashier's actual workstation.