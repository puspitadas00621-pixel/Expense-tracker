# 💰 RupeeTrack - Modern Expense Tracker Web App

A clean, modern, responsive, and beginner-friendly Expense Tracker web app built with **HTML5, CSS3, Vanilla JavaScript, Chart.js, and Supabase**.

---

## ✨ Features

- **📊 Dashboard Overview**:
  - Total expenses today (₹)
  - Total expenses this month (₹)
  - Total transactions count
  - Monthly summary highlight banner: *"Your total expense this month is ₹____."*

- **➕ Full CRUD Operations**:
  - **Add Expense**: Modal form with Amount (₹), Category, Date, and Description.
  - **Edit Expense**: Update existing entries in-place.
  - **Delete Expense**: Remove entries with instant UI feedback.

- **🗂️ Categories Supported**:
  - 🍔 Food
  - 🚗 Travel
  - 🛍️ Shopping
  - 📚 Education
  - 🎬 Entertainment
  - 💡 Bills
  - 📦 Other

- **📈 Visual Spending Analytics**:
  - Interactive **Chart.js Doughnut Chart** showing category distribution.
  - Percentage and progress breakdown list per category.

- **🔍 Search, Filter & Sort**:
  - Real-time text search on descriptions.
  - Category dropdown filter.
  - Sort by: *Newest First*, *Oldest First*, *Amount: High to Low*, *Amount: Low to High*.

- **⚡ Cloud Sync & Local Storage**:
  - **Supabase Cloud PostgreSQL Database Integration** with real-time multi-device sync.
  - Automatic fallback to browser **`localStorage`** when offline or not configured.

- **📥 CSV Export**:
  - Export recorded expenses to a CSV spreadsheet anytime with a single click.

---

## 🚀 Quick Start

1. Open `index.html` in any web browser, or serve with a local server:
   ```bash
   python -m http.server 8000
   ```
2. Navigate to `http://localhost:8000`.

---

## ⚡ Supabase Setup (Optional for Cloud Sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard and run:
   ```sql
   CREATE TABLE IF NOT EXISTS expenses (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     amount NUMERIC NOT NULL,
     category TEXT NOT NULL,
     date DATE NOT NULL,
     description TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Allow public full access" ON expenses
     FOR ALL USING (true) WITH CHECK (true);
   ```
3. In the web app, click **Supabase Sync** in the header.
4. Paste your **Project URL** and **anon public API key** from `Project Settings -> API`, then click **Connect & Sync**.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Icons & Typography**: FontAwesome 6, Plus Jakarta Sans (Google Fonts)
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime Sync)
