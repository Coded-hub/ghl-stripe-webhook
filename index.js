




// --- GHL WEBHOOK (JSON parser) ---
app.post("/webhook", bodyParser.json(), (req, res) => {
  console.log("📩 Received GHL webhook:", req.body);
  res.status(200).send({ success: true });
});

// --- STRIPE WEBHOOK (RAW parser for signature check) ---
const express = require("express");
const Stripe = require("stripe");
const bodyParser = require("body-parser");

const app = express();
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

app.listen(10000, () => console.log("🚀 Webhook server running"));
