


const express = require("express");
const Stripe = require("stripe");
const bodyParser = require("body-parser");

const app = express();

// --- GHL WEBHOOK (JSON parser) ---
app.post("/webhook", bodyParser.json(), (req, res) => {
  console.log("📩 Received GHL webhook:", req.body);
  res.status(200).send({ success: true });
});

// --- STRIPE WEBHOOK (RAW parser for signature check) ---

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post("/stripe-webhook", bodyParser.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    console.log("💰 PaymentIntent succeeded:", paymentIntent.id);
  }

  res.json({ received: true });
});
// GHL Webhook endpoint
app.post("/ghl-webhook", bodyParser.json(), async (req, res) => {
  console.log("📩 Received GHL webhook:", req.body);

  try {
    // Example: create/update contact in GHL using API key
    const response = await fetch("https://rest.gohighlevel.com/v1/contacts/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GHL_API_KEY}`  // set this in Render ENV
      },
      body: JSON.stringify({
        email: req.body.email || "unknown@example.com",
        name: req.body.name || "Unnamed Contact",
        phone: req.body.phone || "",
        customField: req.body.customField || ""  // you can map more fields here
      })
    });

    const data = await response.json();
    console.log("✅ GHL response:", data);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ Error handling GHL webhook:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.listen(10000, () => console.log("🚀 Webhook server running"));
