const express = require("express");
const bodyParser = require("body-parser");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // put your real key in .env

// --- GHL WEBHOOK (JSON parser) ---
app.post("/webhook", bodyParser.json(), (req, res) => {
  console.log("📩 Received GHL webhook:", req.body);
  res.status(200).send({ success: true });
});

// --- STRIPE WEBHOOK (RAW parser for signature check) ---
app.post(
  "/stripe-webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      console.log("✅ Payment succeeded:", event.data.object.id);
    }

    res.json({ received: true });
  }
);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
