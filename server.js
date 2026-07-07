require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.get("/test", (req, res) => {
  res.send("Server is running");
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Environment Variables ────────────────────────────────────────────────────
const {
  OLA_API_KEY,
  OLA_PROJECT_ID,
  OLA_CLIENT_ID,
  OLA_CLIENT_SECRET,
  PORT = 3000,
} = process.env;

function normalizeAppUrl() {
  const raw = (process.env.APP_URL || "https://fixed-sooty-mu.vercel.app").trim();
  return raw.replace(/^['"]|['"]$/g, "").replace(/\/+$/, "");
}

function buildImageUrl() {
  return `${normalizeAppUrl()}/api/player-map-image`;
}

// ─── OAuth Token Cache ────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

// ─── Persistent Location Storage ──────────────────────────────────────────────
const LOCATIONS_FILE = path.join(__dirname, "public", "images", "locations.json");

function ensureLocationsFile() {
  if (!fs.existsSync(LOCATIONS_FILE)) {
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify([]));
  }
}

function loadLocations() {
  try {
    ensureLocationsFile();
    const data = fs.readFileSync(LOCATIONS_FILE, "utf8");
    return JSON.parse(data) || [];
  } catch (error) {
    console.error("Error loading locations:", error);
    return [];
  }
}

function saveLocations(locations) {
  try {
    ensureLocationsFile();
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2));
  } catch (error) {
    console.error("Error saving locations:", error);
  }
}

async function generateMapSnapshot(uploadedLocations) {

  if (!uploadedLocations.length) {
    return;
  }

  try {

  const markers = uploadedLocations
  .map(player => {
    return `${player.longitude},${player.latitude}|red`;
  })
  .join("&marker=");

  const extraPoints = [
  { latitude: 35.5, longitude: 74.0 }, // Jammu & Kashmir
  { latitude: 11.7, longitude: 92.7 }, // Andaman & Nicobar
  { latitude: 10.5, longitude: 72.6 }  // Lakshadweep
];

const allLocations = [...uploadedLocations, ...extraPoints];

const latitudes = allLocations.map(
  p => parseFloat(p.latitude)
);

const longitudes = allLocations.map(
  p => parseFloat(p.longitude)
);

const centerLat =
  (Math.min(...latitudes) +
   Math.max(...latitudes)) / 2;

const centerLng =
  (Math.min(...longitudes) +
   Math.max(...longitudes)) / 2;

const staticMapUrl =
  `https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/` +
  `${centerLng},${centerLat},5/1400x900.png?marker=${markers}` +
  `&api_key=${OLA_API_KEY}`;
    const response = await axios.get(
      staticMapUrl,
      {
        responseType: "arraybuffer"
      }
    );
 console.log(
    "Generating snapshot..."
  );
    fs.writeFileSync(
      path.join(
        __dirname,
        "public",
        "images",
        "player-map.png"
      ),
      response.data
    );
    console.log(
    "Snapshot saved successfully"
  );

    console.log(
      "✅ Map Snapshot Generated"
    );
    return buildImageUrl();
  } catch (error) {

  console.error(
    "❌ Snapshot Generation Error:",
    error.response?.status
  );

  console.error(
    "❌ Error Data:",
    error.response?.data?.toString()
  );

}
}

// ─── Generate OAuth Token ─────────────────────────────────────────────────────
async function getOAuthToken() {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams();

    params.append("grant_type", "client_credentials");
    params.append("client_id", OLA_CLIENT_ID);
    params.append("client_secret", OLA_CLIENT_SECRET);
    params.append("scope", "openid");

    const response = await axios.post(
      "https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    cachedToken = response.data.access_token;

    // Refresh token 60 seconds before expiry
    tokenExpiresAt =
      Date.now() + (response.data.expires_in - 60) * 1000;

    console.log("✅ OAuth token refreshed");

    return cachedToken;
  } catch (error) {
    console.error(
      "❌ OAuth Token Error:",
      error?.response?.data || error.message
    );

    return null;
  }
}

// ─── Helper Function: Auth Headers ────────────────────────────────────────────
async function authHeaders(useOAuth = false) {
  if (useOAuth && OLA_CLIENT_ID && OLA_CLIENT_SECRET) {
    const token = await getOAuthToken();

    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        "X-Request-Id": Date.now().toString(),
      };
    }
  }

  return {
    "X-Request-Id": Date.now().toString(),
  };
}

// ─── Route: Send Config To Frontend (without API key) ────────────────────────
app.get("/api/config", (req, res) => {
  // IMPORTANT: Never send OLA_API_KEY directly to frontend
  // The API key should only be used on the backend to ensure it's not exposed
  res.json({
    projectId: OLA_PROJECT_ID,
    mapInitialized: !!OLA_API_KEY
  });
});

// ─── Route: Secure Map Initialization (API key stays on backend) ──────────────
app.post("/api/init-map", (req, res) => {
  // This endpoint validates that map API key exists and is properly configured
  if (!OLA_API_KEY) {
    return res.status(500).json({
      error: "Map API key not configured on server"
    });
  }
  // Only return API key for map initialization via POST request
  res.json({
    apiKey: OLA_API_KEY,
    status: "ready"
  });
});

// ─── Route: Directions API ────────────────────────────────────────────────────
app.get("/api/directions", async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({
      error: "origin and destination are required",
    });
  }

  try {
    const headers = await authHeaders(true);
    const response = await axios.post(
  "https://api.olamaps.io/routing/v1/directions",
  null,
  {
    params: {
      origin,
      destination,
      mode: "driving",
      alternatives: false,
      steps: true,
      overview: "full",
      language: "en",
      traffic_metadata: false,
      api_key: OLA_API_KEY,
    },
    headers,
  }
);

    res.json(response.data);
  } catch (error) {
     console.log("STATUS =", error?.response?.status);

console.log(
  "ERROR DATA =",
  JSON.stringify(error?.response?.data, null, 2)
);

    res.status(error?.response?.status || 500).json({
      error:
        error?.response?.data?.error ||
        "Directions API failed",
    });
  }
});

// ─── Route: Places Autocomplete ───────────────────────────────────────────────
app.get("/api/autocomplete", async (req, res) => {
  const { input, lat, lng } = req.query;

  if (!input) {
    return res.status(400).json({
      error: "input is required",
    });
  }

  try {
    const headers = await authHeaders(true);

    const params = {
      input,
      api_key: OLA_API_KEY,
    };

    if (lat && lng) {
      params.location = `${lat},${lng}`;
      params.radius = 50000;
    }

    const response = await axios.get(
      "https://api.olamaps.io/places/v1/autocomplete",
      {
        params,
        headers,
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "❌ Autocomplete Error:",
      error?.response?.data || error.message
    );

    res.status(error?.response?.status || 500).json({
      error: "Autocomplete API failed",
    });
  }
});

// ─── Route: Reverse Geocode ───────────────────────────────────────────────────
app.get("/api/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: "lat and lng are required",
    });
  }

  try {
    const headers = await authHeaders(true);

    const response = await axios.get(
      "https://api.olamaps.io/places/v1/reverse-geocode",
      {
        params: {
          latlng: `${lat},${lng}`,
          api_key: OLA_API_KEY,
        },
        headers,
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "❌ Reverse Geocode Error:",
      error?.response?.data || error.message
    );

    res.status(500).json({
      error: "Reverse Geocode API failed",
    });
  }
});

// ─── Route: Distance Matrix ───────────────────────────────────────────────────
app.get("/api/distance-matrix", async (req, res) => {
  const { origins, destinations } = req.query;

  if (!origins || !destinations) {
    return res.status(400).json({
      error: "origins and destinations are required",
    });
  }

  try {
    const headers = await authHeaders(true);

    const response = await axios.get(
      "https://api.olamaps.io/routing/v1/distanceMatrix",
      {
        params: {
          origins,
          destinations,
          api_key: OLA_API_KEY,
        },
        headers,
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "❌ Distance Matrix Error:",
      error?.response?.data || error.message
    );

    res.status(500).json({
      error: "Distance Matrix API failed",
    });
  }
});
app.post("/api/load-locations", async (req, res) => {
  try {
    const incomingPlayers = req.body;

    if (!Array.isArray(incomingPlayers)) {
      return res.status(400).json({
        error: "Expected a JSON array of players",
      });
    }

    console.log(`📥 Received ${incomingPlayers.length} players`);

    // Save locations persistently
    saveLocations(incomingPlayers);

    console.log(
      `✅ Total Players to Plot: ${incomingPlayers.length}`
    );

   const imageUrl =
  (await generateMapSnapshot(incomingPlayers)) || buildImageUrl();

    return res.json({
      success: true,
      totalPlayers: incomingPlayers.length,
      imageUrl,
      version: "v2-debug",
    });
  } catch (error) {
    console.error("❌ Load locations error:", error);
    return res.status(500).json({
      error: "Failed to load locations",
      details: error.message,
    });
  }
});
app.get("/api/load-locations", (req, res) => {
  const locations = loadLocations();
  console.log(
    "GET locations:",
    locations.length
  );

  res.json(locations);

});
app.get(
  "/api/player-map-image",
  (req, res) => {

    const imagePath =
      path.join(
        __dirname,
        "public",
        "images",
        "player-map.png"
      );

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        error: "Map snapshot not found"
      });
    }

    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    res.sendFile(imagePath);

});

// ─── Default Route ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n🚀 OlaRoute Server Started Successfully");
  console.log(`🌐 URL: http://localhost:${PORT}\n`);

  console.log(
    `API Key: ${
      OLA_API_KEY ? "✅ Connected" : "❌ Missing"
    }`
  );

  console.log(
    `Project ID: ${
      OLA_PROJECT_ID ? "✅ Connected" : "❌ Missing"
    }`
  );

  console.log(
    `Client ID: ${
      OLA_CLIENT_ID
        ? "✅ Connected"
        : "⚠️ OAuth Disabled"
    }`
  );

  console.log(
    `Client Secret: ${
      OLA_CLIENT_SECRET
        ? "✅ Connected"
        : "⚠️ OAuth Disabled"
    }\n`
  );
});