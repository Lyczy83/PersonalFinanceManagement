# Ledgerly

Ledgerly is a small, dependency-free transaction dashboard. Open `index.html` in a modern browser to get started.

## Import a bank statement

Export a CSV or TSV statement from your bank and choose **Import bank file**. The first row should contain headers for:

- A transaction date (`Date`, `Booking Date`, or `Value Date`)
- A description (`Description`, `Name`, `Memo`, or `Details`)
- An amount (`Amount` or `Value`), or separate `Debit` and/or `Credit` columns
- Optionally, a `Category` column

Comma-, semicolon-, and tab-delimited files are supported. A single-column amount uses a negative value for spending and a positive value for income. Separate debit and credit columns are interpreted as spending and income. Dates written as `YYYY-MM-DD` or `DD/MM/YYYY` are recognized; ambiguous slash-separated dates are interpreted day-first.

Invalid rows are skipped, repeated transactions are not imported twice, and the dashboard opens on the month of the newest imported transaction. Category labels from the file are retained and can be changed afterward.

## Privacy and storage

The file is parsed locally by the browser. Transactions are saved in this browser's local storage on this device; no bank connection, server upload, analytics, or third-party transaction processing is used. Clearing this browser's site data will remove saved transactions. Import files must be smaller than 10 MB.

## Using the dashboard

Use the month arrows to browse transaction history, change a transaction's category in its category menu, and add your own categories. **Split** lets you assign multiple categories and amounts to a transaction; the parts must add up to the original amount. Monthly totals and the spending chart update from the categorized amounts.

The currency display uses the browser's locale with USD as the default. This initial version imports bank files only; it does not connect to open-banking providers.
