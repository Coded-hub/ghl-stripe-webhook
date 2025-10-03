const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// ✅ Webhook endpoint
app.post("/webhook", (req, res) => {
  console.log("Received webhook data:", req.body);

  const email = req.body.email || req.body.customer?.email;
  const priceId = req.body.priceId || req.body.customData?.priceId;

  if (!email || !priceId) {
    console.error("❌ Missing email or priceId", req.body);
    return res.status(400).json({
      error: "Missing required fields: email or priceId",
      received: req.body,
    });
  }

  console.log(`✅ Email: ${email}, Price ID: ${priceId}`);

  // TODO: Add Stripe subscription / invoice creation here

  res.json({ success: true, email, priceId });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook server is running on port ${PORT}`);
});
