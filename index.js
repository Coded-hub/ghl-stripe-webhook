const express = require("express");
const bodyParser = require("body-parser");
const Stripe = require("stripe");

const app = express();

// GHL webhook - JSON body
app.use("/webhook", bodyParser.json(), (req, res) => {
  console.log("📩 Received GHL webhook:", req.body);
  res.status(200).send({ success: true });
});

// Stripe webhook requires raw body
const stripe = Stripe("sk_test_yourSecretKeyHere"); // replace with your Stripe secret key
const endpointSecret = "whsec_yourWebhookSecretHere"; // replace with your webhook secret

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

    // Handle Stripe events
    switch (event.type) {
      case "payment_intent.succeeded":
        console.log("✅ PaymentIntent succeeded:", event.data.object.id);
        break;
      case "charge.failed":
        console.log("❌ Charge failed:", event.data.object.id);
        break;
      default:
        console.log(`⚠️ Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});
