const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Health check route
app.get("/", (req, res) => {
  res.send("🚀 Webhook server is running!");
});

// Webhook handler
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Extract required fields
    const email = body?.payment?.customer?.email;
    const priceId = body?.payment?.line_items?.[0]?.meta?.price_id;

    // Validate
    if (!email || !priceId) {
      return res.status(400).json({
        error: "Missing required fields: email or priceId",
        received: { email, priceId }
      });
    }

    // Log values for debugging
    console.log("✅ Webhook received:", { email, priceId });

    // 👉 Do whatever processing you need here (DB save, call API, etc.)

    // Response to webhook source
    res.status(200).json({ success: true, email, priceId });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
