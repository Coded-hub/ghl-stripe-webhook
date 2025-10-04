import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ In-memory store for business info
const businessData = {};

// ✅ Middleware for all routes EXCEPT Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe-webhook") {
    next(); // Skip bodyParser here — handled below
  } else {
    bodyParser.json()(req, res, next);
  }
});

// ✅ Route 1: Receive business info from GHL
app.post("/save-business-info", (req, res) => {
  const { email, business_name, tax_id } = req.body.customData || req.body;
  if (!email) return res.status(400).send("Missing email field");

  businessData[email.toLowerCase()] = { business_name, tax_id };
  console.log("✅ Clean business data stored:", businessData[email.toLowerCase()]);
  return res.json({ success: true });
});

// ✅ Route 2: Stripe webhook (RAW BODY REQUIRED)
app.post(
  "/stripe-webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      // Verify raw body
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log("✅ Stripe webhook verified:", event.type);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process successful payments
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const email = paymentIntent.receipt_email?.toLowerCase();
      if (!email) {
        console.warn("⚠️ Missing email in payment intent");
        return res.sendStatus(200);
      }

      const customerId = paymentIntent.customer;
      const data = businessData[email];

      if (data && customerId) {
        const { business_name, tax_id } = data;
        console.log(`💾 Updating Stripe customer for ${email}`, data);

        try {
          await stripe.customers.update(customerId, { name: business_name });
          await stripe.customers.createTaxId(customerId, {
            type: "eu_vat", // or "us_ein"
            value: tax_id,
          });
          console.log("✅ Stripe customer updated successfully");
        } catch (updateError) {
          console.error("❌ Failed to update Stripe customer:", updateError.message);
        }
      }
    }

    res.status(200).send("Success");
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
