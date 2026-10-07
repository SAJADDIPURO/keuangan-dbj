# Financial Dashboard: PT Dipuro Berkah Jaya

A business intelligence dashboard for a small company. Staff enter daily and monthly operational data, and management gets **charts and KPIs** to monitor the health of the business.

## Features

- **Authentication:** login page with Supabase Auth
- **Data entry forms** for daily and monthly records:
  - Daily finance: revenue, number of transactions, gross margin, cash in/out, payment mix
  - Accounts receivable, inventory, service metrics, best-selling products, HR
- **Interactive dashboard** with Chart.js: revenue vs. daily target, monthly trends, receivables, and top products
- **Data management page** to edit or correct entries

## Tech Stack

HTML · CSS · Vanilla JavaScript · Chart.js · Supabase (PostgreSQL + Auth)

## Data Model (Supabase tables)

`transaksi_harian` (daily transactions) · `target_harian` (daily targets) · `keuangan_bulanan` (monthly finance) · `piutang` (receivables) · `produk_terlaris` (best sellers)

## Getting Started

1. Create a Supabase project and the tables above.
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`.
3. Enable **Row Level Security** so only authenticated users can read and write data.
4. Open `login.html` with any static server, for example `npx serve .`.

## Why This Project Matters

This project turns raw daily business numbers into decisions: it covers data collection, storage in a relational database, aggregation, and visualization. These are the foundations of a data analytics workflow.
