# Invoice Sorter

Automatically extracts invoice dates from PDF invoices and stores them inside folders based on **Year → Month**.

---

## Features

| Feature | Status |
|--------|--------|
| Upload invoice PDF | ✔ Completed |
| Extract date automatically | ✔ |
| Auto-create folders by Year/Month | ✔ |
| View stored invoices | ✔ |
| OCR support for scanned PDFs | ✔ (uses Tesseract + Poppler) |

---

## Run Backend

```bash
cd backend
npm install
node index.js
