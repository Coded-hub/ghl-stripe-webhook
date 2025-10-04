import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import Stripe from "stripe";
import axios from "axios";

dotenv.config();
const app = express();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const ghlApiKey = process.env.GHL_API_KEY;

// ✅ 1. Parse raw body for Stripe verification
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log("✅ Stripe webhook verified:", event.type);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Handle successful payments
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const email =
        paymentIntent.receipt_email ||
        paymentIntent.customer_email ||
        (paymentIntent.customer_object &&
          paymentIntent.customer_object.email);

      console.log(`✅ Email found: ${email}`);

      if (!email) {
        console.log("⚠️ Missing email in payment intent and customer — skipping update.");
        return res.sendStatus(200);
      }

      // Fetch business info from memory or fallback
      const businessData = customerData[email];
      if (!businessData) {
        console.log(`⚠️ No business data found for ${email}`);
        return res.sendStatus(200);
      }

      try {
        // ✅ Update Stripe customer record
        const customers = await stripe.customers.list({ email });
        const customer = customers.data[0];

        if (customer) {
          await stripe.customers.update(customer.id, {
            name: businessData.business_name,
          });

          if (businessData.tax_id) {
            await stripe.customers.createTaxId(customer.id, {
              type: "eu_vat",
              value: businessData.tax_id,
            });
          }

          console.log(`✅ Updated Stripe customer for ${email}`);
        } else {
          console.log(`⚠️ No Stripe customer found for ${email}`);
        }
      } catch (err) {
        console.error("❌ Stripe update failed:", err.message);
      }
    }

    res.sendStatus(200);
  }
);

// ✅ 2. Use JSON parser for all other routes
app.use(bodyParser.json());

// Temporary in-memory storage for GHL data
const customerData = {};

// ✅ 3. GHL Webhook: Capture business name + tax ID
app.post("/ghl-webhook", async (req, res) => {
  const authHeader = req.headers.authorization;

  // Check for GHL API key
  if (!authHeader || authHeader !== `Bearer ${ghlApiKey}`) {
    console.log("❌ Unauthorized GHL webhook request");
    return res.status(401).send("Unauthorized");
  }

  const body = req.body;
  const email =
    body.email ||
    (body.contact && body.contact.email) ||
    (body.customData && body.customData.email);

  const business_name =
    body["Business Name"] ||
    body.business_name ||
    (body.customData && body.customData.business_name);

  const tax_id =
    body["Tax-ID (VAT/CUI)"] ||
    body.tax_id ||
    (body.customData && body.customData.tax_id);

  console.log("📩 GHL Webhook Received:", { email, business_name, tax_id });

  if (!email || !business_name || !tax_id) {
    console.log("⚠️ Missing one or more required fields");
    return res.sendStatus(400);
  }

  // ✅ Store for later Stripe lookup
  customerData[email] = { business_name, tax_id };

  console.log(`✅ Saved data for ${email}:`, customerData[email]);

  res.sendStatus(200);
});

// ✅ Root route for Render check
app.get("/", (req, res) => {
  res.send("✅ GHL ↔ Stripe Webhook Server is running!");
});

// ✅ Render Port Binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
