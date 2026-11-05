# POS receipt and cash register printing

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

## Cash register reports

`printRegisterReport(session, summary, locationName, settings)` is asynchronous
and returns `Promise<'printer' | 'system'>`. Pass the current `PrintersSettings`
and await it; rejected promises are printing failures, not successful output.
Receipts and reports share `app/pos/manual-print.ts`, with identical hardware
readiness, manual-toggle independence, system selection, and no-failover rules.

The dedicated `register-report` template is not a receipt with fake product lines.
It prints reconciliation, payment totals, closing notes, every movement and
receipt (including sale IDs, responsible user IDs, timestamps, tendered amounts
and change), and the session/site/location identity. Long audit fields wrap
instead of being truncated. Closed sessions require their stored snapshot and
are labeled **Immutable closing snapshot**. A missing snapshot blocks printing;
an arbitrary supplied summary is never substituted. Open sessions use the supplied
live summary and are labeled **Live session preview — not a closing report**.
Printing does not fetch or reconstruct sales.

The register panel also offers **Print summary** for open and closed sessions.
It passes `{ includeTransactions: false }` as the optional fifth argument to
`printRegisterReport`. This prints session identity, reconciliation, receipt count,
payment totals, and closing notes without the individual cash movement or receipt
sections. **Print report** retains the complete audit detail. Both actions use the
same printer routing and immutable-snapshot checks and cannot run simultaneously.

USB/Bluetooth output uses the existing sanitized ESC/POS ASCII encoding
(supported accented characters are transliterated). System HTML preserves
Unicode text, escapes report content, loads no assets, and uses the selected
58/80 mm width (80 mm when no applicable printer is configured). Printing only
reads report data and never changes reconciliation or the saved snapshot.

Failed writes are never replayed through another USB driver. Incomplete USB
transfers stop the job and remaining copies, and manual printing warns to check
for partial output before retrying. Bindings verify workstation, transport, and
available device identity; ambiguous same-model devices require reconnecting and
binding the intended printer instead of choosing the first match.

Safari does not expose the direct WebUSB, Web Serial or Web Bluetooth APIs used
here. Use a supported Chrome/Edge workstation for direct printing. Safari can use
system printing when no POS hardware is configured, but its native dialog cannot
be suppressed by this application. System print frames stay available until
`afterprint`; browsers that omit that event retain them until navigation rather
than losing the document while the print dialog is open.

## Cash register loading and review

The catalog Sync indicator does not validate register API requests. The register
loads through `/api/pos/operation`; a forbidden origin is a request security error,
not evidence of a missing migration or a printer failure. Both POS operation and
checkout-cancel routes compare the browser Origin with the exact Host authority
and request scheme, not Next's internal bind hostname. Proxies must preserve the
public Host and sanitize forwarding headers; forwarded hosts never bypass the
check. Authentication and operation permissions still run after this check.

The summary separates expected drawer cash from all-method receipts. Closing
previews and saved reconciliation share balanced/shortage/surplus labels. Failed
reads retain previous figures with a stale-data warning and disable writes;
errors remain visible while a closing form is open.

## USB setup

Connecting, reconnecting, opening a module, and checking the status badge never
print a synchronization ticket. Connection checks open the authorized USB/Serial
or Bluetooth connection without sending print data. USB/Serial connection events
and a ten-second health check refresh the badge. Disconnected, unpaired, and
unsupported printers show red; assistance opens only when the user clicks the
badge. Test printing remains an explicit action in Settings.

Connection availability does not prove paper, ink, or successful physical output.

WebUSB probes, reconnects and complete ticket writes share an exclusive session.
The device is closed after each operation, including failures, releasing its
interfaces without forgetting browser permission. Web Locks coordinate same-origin
tabs; a local queue also serializes operations within a tab. Probes cannot close
an in-progress ticket, and failed writes are never automatically replayed.
After deploying this change, close or reload older application tabs once: their
previous code may still hold a USB interface indefinitely and does not participate
in this coordination. This fix cannot forcibly release another application's or
an OS driver's claim. Physical acceptance on the affected Mac remains required.

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
npm test -- --runInBand __tests__/app/pos/print-receipt.test.ts __tests__/pos/register-print-ui.test.ts __tests__/lib/printer
npm test -- --runInBand __tests__/pos/request-origin.test.ts __tests__/pos/register-layout-browser.test.tsx __tests__/pos/register-read-error.test.tsx __tests__/pos/register-summary-ui.test.tsx __tests__/pos/register-write-ui.test.tsx __tests__/pos/register-dashboard-ui.test.tsx
```

These regressions validate routing and encoding, not physical printer output.
The layout suite renders actual components and repository CSS in isolated
Chromium/WebKit pages at mobile/desktop widths and in both themes. It has no
backend access and does not prove an authenticated end-to-end register workflow.
Hardware acceptance still requires the Settings test and a POS receipt on the
cashier's actual workstation.