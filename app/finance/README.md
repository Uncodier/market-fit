# Finance report contract

- `getPnLReport(siteId, fromDate, toDate, currency?)` and
  `getBalanceSheetReport(siteId, asOfDate, currency?)` return an account-code
  record of `{ debit, credit }` totals. Every request authorizes accounting read
  access for the requested site before reading data.
- Each report selects exactly one valid currency. An explicit currency overrides
  the site's settings; an omitted currency requires valid `settings.currency`.
  Unknown or missing currencies fail closed, rather than mixing currencies or
  assuming USD. No exchange-rate conversion occurs. Opening balances belong only
  to the currency stored on their journal entry.
- Accounting dates use **UTC calendar days**, independent of browser or site
  time zone. P&L dates are inclusive calendar dates implemented against
  `journal_entries.entry_date` (`TIMESTAMPTZ`) as
  `[fromDateT00:00:00Z, dayAfterToDateT00:00:00Z)`. Balance sheets include all
  entries before midnight UTC after the as-of date. P&L excludes opening entries;
  balance sheets and trial balances include them.
- Production reports use the scalar `accounting_report_snapshot` RPC. Its STABLE
  invoker function uses one statement's MVCC snapshot for currency checks,
  journal validation and SQL aggregates; changes between offset pages cannot mix
  journal versions, and the Data API row cap cannot truncate its JSON totals.
  Historical NULL/invalid currencies and invalid journals block the affected
  report with an actionable reconciliation message. No partial/zero substitute
  is returned. Only demo reads retain the in-memory adapter's paginated path.
- The UI loads read-only chart metadata and aggregates together, hides totals
  until both succeed, and rejects unclassified accounts. Site, currency, date,
  tab, and refresh changes invalidate previous requests and their results.
- CSV exports use the selected report currency in the filename and every row,
  quote text fields, escape spreadsheet formula prefixes, and release temporary
  download URLs. Numeric amounts are unconverted journal amounts.