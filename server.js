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

// ─── OAuth Token Cache ────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;
let uploadedLocations = [];
async function generateMapSnapshot() {

  if (!uploadedLocations.length) {
    return;
  }

  try {

   const markers = uploadedLocations
  .map(player => {

    const label =
      player.player_name.charAt(0).toUpperCase();

    return `${player.longitude},${player.latitude}|red|label:${label}`;

  })
  .join("&marker=");

    const centerLng =
      uploadedLocations[0].longitude;

    const centerLat =
      uploadedLocations[0].latitude;

    const staticMapUrl =
      `https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/` +
      `${centerLng},${centerLat},4/1200x800.png?marker=${markers}` +
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

  } catch (error) {

    console.error(
      "❌ Snapshot Generation Error:",
      error.message
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

// ─── Route: Send API Key To Frontend ──────────────────────────────────────────
app.get("/api/config", (req, res) => {
  res.json({
    apiKey: OLA_API_KEY,
    projectId: OLA_PROJECT_ID,
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

  const incomingPlayers = req.body;

  incomingPlayers.forEach((player) => {

    const existingPlayer =
      uploadedLocations.find(
        p =>
          p.player_name === player.player_name
      );

    if (existingPlayer) {

      existingPlayer.latitude =
        player.latitude;

      existingPlayer.longitude =
        player.longitude;

    } else {

      uploadedLocations.push(player);

    }

  });

  console.log(
    "Total Players:",
    uploadedLocations.length
  );
  await generateMapSnapshot();

  res.json({
    success: true,
    totalPlayers:
      uploadedLocations.length
  });

});
app.get("/api/load-locations", (req, res) => {
  console.log(
    "GET locations:",
    uploadedLocations.length
  );


  res.json(uploadedLocations);

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