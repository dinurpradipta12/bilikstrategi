# Bilik Strategi Workspace

**Bilik Strategi Workspace** adalah aplikasi web internal agency modern yang terhubung langsung dengan **ClickUp API** sebagai mesin utama project management, task tracking, komentar, dan komunikasi tim, serta didukung oleh **Supabase PostgreSQL & Auth**.

---

## 🌟 Fitur Utama Aplikasi

1. **Executive Dashboard**: Ringkasan project aktif, pending task, overdue task, total client, grafik Recharts (Created vs Completed, Status Distribution, Workload per Member, Monthly Progress Trend), serta filter multi-dimensi.
2. **Project Management (4 View Modes)**: List, Board/Kanban, Timeline (Gantt), dan Calendar view untuk seluruh project agency.
3. **Detail Project (7 Tabs)**: Overview, Tasks, Timeline, Team Members, Files & Assets, Activity Log, dan Client Feedback.
4. **ClickUp Task Management**: Data task ClickUp real-time, optimistic updates (status, assignee, priority), filter, pencarian, dan Task Detail Drawer.
5. **Task Detail Drawer**: Detail task, komentar interaktif (sync ke ClickUp), subtasks, checklist, tag, jam kerja tercatat, dan tautan langsung ke ClickUp.
6. **My Tasks**: Dashboard tugas personal yang dikategorikan berdasarkan Today, Upcoming, Overdue, dan Completed.
7. **Agency Timeline**: Visualisasi Gantt chart untuk estimasi deliverable dan milestone project.
8. **Interactive Calendar**: Jadwal due date deliverable berdasarkan tampilan Bulan, Minggu, dan Hari.
9. **Team Workload & Capacity Planner**: Indikator beban kerja tim (*Low*, *Balanced*, *High*, *Over Capacity*), jam terpakai vs kapasitas max, serta pengaturan kapasitas default per anggota.
10. **Client Listing**: Katalog klien agency yang tersimpan di Supabase, terhubung dengan Folder ClickUp dan histori retainer.
11. **Agency Chat**: Channel komunikasi tim terintegrasi ClickUp Chat (dengan fallback) dan *Tab Visibility API polling* untuk menghemat bandwidth.
12. **Notification Center**: Log notifikasi aktivitas (task baru, deadline mendekat, task overdue, komentar, mention, pesan).
13. **Activity Log & Audit Trail**: Catatan audit pengubah entitas, sumber event (Web App vs Webhook), dan perubahan nilai (old vs new value).
14. **Settings & ClickUp Integration Diagnostic**: Halaman pengujian koneksi ClickUp API, status token terenkripsi, webhook listener, dan pengaturan peran pengguna.
15. **Global Command Menu (`Cmd/Ctrl + K`)**: Shortcut navigasi cepat dan pembuatan task dari mana saja.

---

## 🏗️ Teknologi Yang Digunakan

- **Frontend & App Framework**: Next.js 15 (App Router, React 19)
- **Bahasa**: TypeScript (Strict type checking)
- **Styling**: Tailwind CSS v4 dengan Palet Warna Kustom Agency
- **Database & Auth**: Supabase PostgreSQL & Supabase Authentication
- **Data Fetching & Caching**: TanStack Query (React Query v5)
- **Validasi Form**: React Hook Form & Zod
- **Ikon**: Lucide Icons
- **Grafik Dashboard**: Recharts
- **Integration Engine**: ClickUp API v2 Service Layer Backend

---

## 📁 Struktur Direktori Project

```text
bilik-strategi/
├── app/
│   ├── (auth)/
│   │   └── login/             # Halaman Login & Reset Password
│   ├── (dashboard)/
│   │   ├── dashboard/         # Executive Dashboard + Recharts
│   │   ├── projects/          # Project Management & Detail Tab
│   │   ├── tasks/             # ClickUp Task Management
│   │   ├── my-tasks/          # Dashboard Task Personal
│   │   ├── timeline/          # Agency Timeline / Gantt
│   │   ├── calendar/          # Interactive Calendar
│   │   ├── team/              # Team Workload & Capacity Planner
│   │   ├── clients/           # Client Directory & ClickUp Folders
│   │   ├── chat/              # Team Communication & Tab Polling
│   │   ├── notifications/     # Notification Center
│   │   ├── activity-logs/     # Audit & Event Trail
│   │   ├── settings/          # Integration & Role Settings
│   │   └── layout.tsx         # Dashboard Shell Layout
│   ├── api/
│   │   ├── clickup/           # Backend Proxy Routes (Tasks, Comments)
│   │   ├── webhooks/          # ClickUp Webhook Event Listener
│   │   └── health/            # Diagnostic Endpoint
│   ├── globals.css            # Custom CSS Variables & Color Tokens
│   ├── layout.tsx             # Root Layout + React Query Provider
│   └── page.tsx               # Root Redirect
├── components/
│   ├── layout/                # Sidebar, Header, CommandMenu (Cmd+K)
│   └── tasks/                 # CreateTaskModal, TaskDetailDrawer
├── lib/
│   ├── clickup/               # ClickUp Service Layer (client, auth, tasks, comments, webhooks, rate-limit, errors)
│   └── mock/                  # Demo Engine & Realistic Mock Dataset
├── supabase/
│   ├── migrations/            # Migration SQL Schema & RLS Policies
│   └── seed.sql               # Seed Data Klien & Project Initial
├── .env.example               # Environment Variables Template
├── .env.local                 # Local Environment Setup (Mock active by default)
└── package.json
```

---

## 🔐 Matriks Hak Akses & Peran Pengguna (Permissions)

| Peran | Dashboard & Project | Mengelola Task | Ubah Status & PIC | Client Listing | Pengaturan ClickUp & User |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Owner** | Full Access | Full Access | Full Access | Full Access | Full Access |
| **Admin** | Full Access | Full Access | Full Access | Full Access | Mengelola Project & Task |
| **Team Lead** | Project Assigned | Full Access | Full Access | Read Only | Non-admin settings |
| **Member** | Assigned Projects | Assigned Tasks | Sesuai Permission | Read Only | View Only |
| **Client Portal**| Allowed Project Only | View Allowed Task | View Progress | Own Company Only | Restricted |

---

## ⚡ Cara Menjalankan Aplikasi Secara Lokal

### 1. Prasyarat
Pastikan komputer Anda sudah terinstal **Node.js (v18.x / v20.x / v22.x)** dan **npm**.

### 2. Clone / Buka Directory Project
```bash
cd /Users/dinurm.pradipta/.gemini/antigravity/scratch/bilik-strategi
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment File
File `.env.local` sudah disiapkan dengan mode `NEXT_PUBLIC_USE_MOCK_DATA=true` agar aplikasi dapat langsung dijalankan tanpa token ClickUp atau database Supabase awal:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

CLICKUP_CLIENT_ID=your-client-id
CLICKUP_CLIENT_SECRET=your-client-secret
CLICKUP_REDIRECT_URI=http://localhost:3000/api/auth/clickup/callback

CLICKUP_PERSONAL_TOKEN=pk_12345678_example_token
CLICKUP_TEAM_ID=90001122

NEXT_PUBLIC_APP_URL=http://localhost:3000
CLICKUP_WEBHOOK_SECRET=whsec_example_secret

NEXT_PUBLIC_USE_MOCK_DATA=true
```

### 5. Jalankan Development Server
```bash
npm run dev
```
Buka browser di `http://localhost:3000`. Aplikasi akan otomatis mengarahkan ke dashboard.

---

## 🗄️ Panduan Setup Supabase PostgreSQL

1. Buat proyek baru di [Supabase Console](https://supabase.com).
2. Buka **SQL Editor** pada proyek Supabase Anda.
3. Jalankan skrip migration dari file `supabase/migrations/20260730000000_initial_schema.sql`.
4. Jalankan skrip seed data dari `supabase/seed.sql`.
5. Ambil **Project URL** dan **Anon API Key** dari menu `Project Settings -> API`, lalu salin ke `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

---

## 🔑 Panduan Menghubungkan ClickUp Token & Webhook

### 1. Menggunakan Personal Access Token (Default Versi Awal)
1. Buka akun ClickUp Anda -> **My Settings -> Apps**.
2. Generate **Personal Access Token**.
3. Salin token tersebut (format `pk_...`) ke file `.env.local`:
   ```env
   CLICKUP_PERSONAL_TOKEN=pk_12345678_your_actual_token
   CLICKUP_TEAM_ID=90123456
   ```
4. Ubah `NEXT_PUBLIC_USE_MOCK_DATA=false`.
5. Buka halaman **Settings -> ClickUp Integration** di aplikasi Bilik Strategi dan tekan **Test Connection**.

### 2. Mengaktifkan Webhook Real-time
1. Pastikan domain aplikasi terpublikasi (misal via Vercel atau Ngrok).
2. Daftarkan endpoint webhook ke ClickUp Team API:
   ```text
   POST https://api.clickup.com/api/v2/team/{team_id}/webhook
   Endpoint: https://domain-anda.com/api/webhooks/clickup
   Events: ["taskCreated", "taskUpdated", "taskStatusUpdated", "taskCommentPosted"]
   ```
3. Salin `secret` yang diberikan ClickUp ke variable `CLICKUP_WEBHOOK_SECRET`.

---

## 🚀 Cara Deploy ke Vercel / Cloudflare

1. Push repository ke GitHub / GitLab.
2. Impor project ke dashboard Vercel.
3. Atur Framework Preset: **Next.js**.
4. Masukkan seluruh environment variables dari `.env.example` ke Vercel Settings.
5. Klik **Deploy**.

---

## 📊 Mapping Data ClickUp & Status Feature

| Modul | Live Sync ClickUp | Demo Mock Mode | Keterangan |
| :--- | :---: | :---: | :--- |
| **Tasks & Status** | ✅ Active | ✅ Active | CRUD Task, optimistic status update, priority change |
| **Task Comments** | ✅ Active | ✅ Active | Post comment syncs to ClickUp Task |
| **Team Workload** | ✅ Active | ✅ Active | Calculated from ClickUp Time Estimates & Tracked |
| **Project Lists** | ✅ Active | ✅ Active | Mapped to ClickUp Spaces, Folders, & Lists |
| **Agency Chat** | 🔄 Adapter Fallback | ✅ Active | Integrated ClickUp Chat API with safe fallback |
