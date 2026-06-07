# 🛣️ ROADWATCH — Infrastructure Intelligence Dashboard

> A full-stack real-time infrastructure monitoring platform for tracking road projects, citizen complaints, contractor performance, and government analytics — powered by Node.js, SQLite, Socket.io and a fully offline-capable frontend.

---

## 🌐 Live Features

| Feature | Description |
|---|---|
| 📊 **Dashboard** | Live KPI cards — health score, projects, complaints, budget per country |
| 🗺️ **Interactive Map** | Leaflet.js map with live project markers per country |
| ⚠️ **Complaints Center** | Citizens file complaints with photo upload; govt/admin resolve or delete |
| 👷 **Contractors** | View active auditing firms and project assignments per country |
| 📈 **Analytics** | Infrastructure trends and performance metrics |
| 📁 **Reports** | Auto-generated visual HTML reports with CSS bar charts, doughnut and trend graphs |
| 🔔 **Real-time Alerts** | Socket.io country-room alerts — toast popups when complaints are filed/resolved |
| 🔍 **Global Search** | Live search across projects, complaints and contractors |
| ⚙️ **Settings** | Dark/Light mode toggle, notification preferences, privacy guard |
| 📴 **Offline Mode** | Full `localStorage` virtual DB fallback when server is unreachable |

---

## 🏗️ Tech Stack

**Backend**
- [Node.js](https://nodejs.org/) + [Express.js](https://expressjs.com/)
- [SQLite3](https://www.npmjs.com/package/sqlite3) — persistent relational database (WAL mode for concurrency)
- [Socket.io](https://socket.io/) — real-time bidirectional events via country rooms
- [Multer](https://www.npmjs.com/package/multer) — photo upload handling

**Frontend**
- Vanilla HTML, CSS, JavaScript — zero framework overhead
- [Leaflet.js](https://leafletjs.com/) — interactive maps
- Socket.io client — real-time room-based notifications
- `localStorage` virtual database for full offline capability

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/full-stack-hackathon.git
cd full-stack-hackathon

# Install backend dependencies
cd backend
npm install
```

### Running the App

```bash
# From the backend folder
node server.js
```

Then open your browser at:
```
http://localhost:3001
```

> The frontend is served as static files by Express — no separate frontend server needed.

---

## 📁 Project Structure

```
full-stack-hackathon/
│
├── backend/
│   ├── server.js              # Express + Socket.io server
│   ├── roadwatch.db           # SQLite database
│   ├── govt_officials.json    # Whitelisted govt official accounts
│   └── uploads/               # Complaint photo uploads
│
└── frontend/
    ├── index.html             # Dashboard
    ├── complaints.html        # Complaints center
    ├── contractors.html       # Contractors list
    ├── analytics.html         # Analytics page
    ├── reports.html           # Reports page
    ├── settings.html          # User preferences
    ├── login.html             # Auth page
    ├── app.js                 # Main frontend logic (online + offline)
    └── style.css              # Full design system (dark + light mode)
```

---

## 👥 User Roles

| Role | Capabilities |
|---|---|
| **Guest** | View dashboard, map, complaints, contractors |
| **Citizen** | + File complaints with photo, delete own complaints |
| **Govt Official** | + Resolve complaints, view analytics |
| **Admin (Owner)** | + Delete any complaint, full access |

> Govt officials are whitelisted in `backend/govt_officials.json`. Role enforcement is applied on both frontend (UI visibility) and backend (API authorization).

---

## 🔔 Real-time Citizen Alerts

ROADWATCH uses **Socket.io country rooms** to deliver targeted alerts:

- When a user selects a country, their browser **joins that country's room**
- When a complaint is **filed**, **resolved**, or **deleted** in that country, only users watching that country receive a toast notification
- Alerts can be toggled ON/OFF in **Settings → Real-time Citizen Alerts**

```
User watches "India"  →  socket.join('India')
Complaint filed in India  →  io.to('India').emit('complaint_filed', {...})
Toast appears: ⚠️ "New Complaint Filed — Pothole on NH44"
```

---

## 📊 Reports

Clicking **View Report** opens a fully self-contained HTML report with:
- 4 KPI cards with YoY trend badges
- Horizontal CSS bar charts (this year vs last year)
- CSS conic-gradient doughnut chart
- 6-month complaint trend bar chart
- Full audit summary table
- **Print / Save as PDF** button

> Reports work in both online and offline mode.

---

## 📴 Offline Mode

If the Express server is unreachable (or the app is opened via `file://`), ROADWATCH automatically activates **LocalStorage Virtual DB Mode**:
- All data (countries, complaints, contractors) is persisted in `localStorage`
- Complaints can be filed, resolved and deleted offline
- Reports are generated from offline data
- All UI features remain functional

---

## 🔍 Global Search

The top search bar searches live across:
- 🏗️ Projects
- ⚠️ Complaints
- 👷 Contractors

Results are filtered for the **currently selected country** with highlighted match text and clickable navigation.

---

## 📸 Screenshots

> *(Add screenshots of your dashboard, complaints page, and a report here)*

---

## 🛡️ Security Notes

- Complaint deletion is restricted to **admin** or the **original complaint author**
- Government officials cannot delete complaints
- Role checks are enforced on both client and server
- Govt official accounts are validated against a server-side JSON whitelist

---

## 🙏 Acknowledgements

Built for a full-stack hackathon. Uses open-source tools:
[Express](https://expressjs.com/) · [SQLite3](https://www.npmjs.com/package/sqlite3) · [Socket.io](https://socket.io/) · [Leaflet.js](https://leafletjs.com/) · [Multer](https://www.npmjs.com/package/multer)

---

## 📄 License

[MIT](LICENSE)
