# Lyczy Personal Finance Manager

Lyczy Personal Finance Manager is a local transaction dashboard for Windows. Run `start-server.cmd`, keep its window open, and open `http://127.0.0.1:5187/` in any browser on this computer.

## Import a bank statement

Choose **Import bank file** and import a CSV, TSV, or Excel `.xlsx` statement. CSV/TSV files should have a header row for:

- A transaction date (`Date`, `Booking Date`, or `Value Date`)
- A description (`Description`, `Name`, `Memo`, or `Details`)
- An amount (`Amount` or `Value`), or separate `Debit` and/or `Credit` columns
- Optionally, a `Category` column

Comma-, semicolon-, and tab-delimited files are supported. A single-column amount uses a negative value for spending and a positive value for income. Separate debit and credit columns are interpreted as spending and income. Dates written as `YYYY-MM-DD` or `DD/MM/YYYY` are recognized; ambiguous slash-separated dates are interpreted day-first.

Excel workbooks are read from their first visible worksheet. Polish bank-export headers such as `Data transakcji`, `Opis`, `Kwota`, `Waluta`, and `Typ transakcji` are recognized; Excel date serials are supported. The transaction type is used as the initial category. Headerless Erste Bank Polska account-history CSV exports are also supported; the statement summary row is ignored and each transaction's description and amount are imported. Only PLN rows/statements are imported because the dashboard does not convert currencies.

Invalid rows are skipped, and duplicate detection uses available transaction context such as the recipient or bank operation reference so separate transfers with the same date, description, and amount remain distinct. Any rows still identified as duplicates are saved under **Review duplicates**, where they can be restored or dismissed. If there are no saved entries to review, import the original statement again; skipped rows from older imports cannot be recovered unless they were saved for review. Dismissals are remembered when the same file is imported again. The dashboard opens on the month of the newest imported transaction. Category labels from the file are retained and can be changed afterward.

Erste Bank Polska CSV exports are added to the **Erste** budget, and BNP Paribas Excel exports to the **BNP Paribas** budget. Each budget keeps separate transactions, categories, analysis, and duplicate reviews. Existing data from an older, unsplit version is migrated to the **Erste** budget. Unmarked legacy transactions mistakenly placed in BNP are moved back to Erste; matching records are merged while keeping the existing Erste category and analysis flags.

## Privacy and storage

The local PowerShell server stores transactions in a SQLite database at `%LOCALAPPDATA%\LyczyPersonalFinanceManager\ledgerly.sqlite`. All browsers on this computer that open the local app URL use the same database. The server listens only on `127.0.0.1`; it does not expose the database to the network. API data is encoded as UTF-8 so Polish category names are preserved. The database remains on this device, and no bank connection, cloud sync, analytics, or third-party transaction processing is used. Keep the server window open while using the app; close it or press Ctrl+C to stop the server. Import files must be smaller than 10 MB; uncompressed workbooks must be smaller than 50 MB.

## Using the dashboard

Choose a month, quarter, year, all-time view, or custom date range to analyze transactions. Use the arrows to move between months, quarters, or years. Sort the transaction list by date, description, category, or amount, and filter it to one or more categories; type in the category search to narrow the options immediately. Exclude individual transactions from totals and the chart without removing them from the list, or mark transactions as **Zbędne** to highlight them in red.

Change a transaction's category in its category menu, add categories beside the period selector, or use **Manage categories** to rename and delete them. The BNP budget also lets you assign each category to a spending group and edit monthly targets; group totals use included expense amounts (including split parts), while unassigned categories remain visible separately. Monthly targets are prorated for the selected date range. The app learns from your saved category choices and applies a category to new transactions when the description and available counterparty match, or when an exact-description match is unambiguous. After importing, it asks you to review new transactions it could not categorize; remembered choices are used for matching future imports in the same budget. Deleting a category moves its transactions to **Uncategorized**. **Split** lets you assign multiple categories and amounts to a transaction; the parts must add up to the original amount. Analysis totals and charts use included transactions only. The cash-flow chart compares income and spending over the selected period, grouped automatically or by day, week, month, quarter, or year. Long daily and weekly views are capped to the most recent 366 or 1,820 days, respectively. Hover or focus a bar for its exact amount; hover or focus a category in the enlarged spending chart to highlight it and see its share, and click a category to open its included transactions for the selected period. The category filter focuses its search field when opened and closes after a category is selected. The transaction list shows its visible income, spending, and net balance, which update with category and visibility filters. The **Hide excluded** option affects only the transaction list; excluded transactions remain excluded from analysis either way.

Amounts are displayed in PLN. This initial version imports bank files only; it does not connect to open-banking providers.
