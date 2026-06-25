# OlaRoute — Smart Navigation App

A full-stack map routing app using **Ola Maps API** with Express.js backend and a sleek dark-theme frontend.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
Edit `.env` and fill in your credentials:

```env
# Required — your Ola Maps API key
OLA_API_KEY=oNfKBLHD5pBKlMZoaZb5rRRRywcPfsZaxUqrwYvG

# Optional — enables OAuth (better rate limits)
OLA_PROJECT_ID=your_project_id_here
OLA_CLIENT_ID=your_client_id_here
OLA_CLIENT_SECRET=your_client_secret_here

# Server port
PORT=3000
```

### 3. Run
```bash
npm start
# or for development:
npm run dev
```

### 4. Open
```
http://localhost:3000
```

---

## 📋 Features

| Feature | Description |
|---|---|
| 🗺️ Map Tiles | Full Ola Maps tiles rendered via SDK |
| 🔍 Autocomplete | Search places as you type |
| 🛣️ Route Drawing | Draws polyline route on map |
| 📊 Route Stats | Distance (km) + Duration (mins) |
| 📍 My Location | Use device GPS as origin |
| 🖱️ Click to Place | Click map to set origin/destination |
| ⇅ Swap | Swap origin and destination |
| 🔐 OAuth | Auto-token refresh with client credentials |

---

## 🌐 API Routes (server.js)

| Endpoint | Description |
|---|---|
| `GET /api/config` | Returns API key to frontend |
| `GET /api/directions?origin=lat,lng&destination=lat,lng` | Get route |
| `GET /api/autocomplete?input=text` | Place search |
| `GET /api/reverse-geocode?lat=&lng=` | Lat/lng → address |
| `GET /api/distance-matrix?origins=&destinations=` | Distance matrix |

---

## 🔑 Where to Find Credentials

1. Go to [Ola Maps Dashboard](https://maps.olacabs.com/dashboard)
2. **API Key**: Under "API Keys" section
3. **Project ID / Client ID / Client Secret**: Under "OAuth Clients" section

---

## ❗ Troubleshooting

**Map not showing (blank)**  
→ Check `OLA_API_KEY` is correct in `.env`  
→ Make sure your API key has Maps SDK enabled on the dashboard

**Route not drawing**  
→ Check the Directions API is enabled for your project  
→ Check browser console for errors

**Autocomplete not working**  
→ Enable Places API on your Ola Maps dashboard
