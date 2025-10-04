import express from "express";
import Stripe from "stripe";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Use raw body only for Stripe webhooks
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe-webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Temporary in-memory store (for dev/demo)
const businessData = {};

/* ======================================================
   1️⃣ GHL FORM → /save-business-info
   ====================================================== */
app.post("/save-business-info", async (req, res) => {
  const data = req.body;
  const email = data.email;
  const business_name = data.business_name;
  const tax_id = data.tax_id;

  if (!email || !business_name || !tax_id) {
    console.log("⚠️ Missing one or more required fields");
    return res.status(400).send("Missing fields");
  }

  try {
    // Create or update the Stripe customer immediately
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (customers.data.length > 0) {
      customer = customers.data[0];
      await stripe.customers.update(customer.id, { name: business_name });
    } else {
      customer = await stripe.customers.create({
        email,
        name: business_name,
      });
    }

    // Add tax ID if provided
    if (tax_id) {
      await stripe.customers.createTaxId(customer.id, {
        type: "eu_vat",
        value: tax_id,
      });
    }

    console.log(`✅ Stripe customer updated immediately for ${email}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Stripe update failed:", error.message);
    res.status(500).send("Stripe update failed");
  }
});


/* ======================================================
   2️⃣ STRIPE → /stripe-webhook
   ====================================================== */
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("✅ Stripe webhook verified:", event.type);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle only successful payments
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      let email = paymentIntent.receipt_email;

      // 🔍 Try to get email if missing
      if (!email && paymentIntent.customer) {
        try {
          const customer = await stripe.customers.retrieve(paymentIntent.customer);
          email = customer.email;
        } catch (err) {
          console.log("⚠️ Could not retrieve customer:", err.message);
        }
      }

      if (!email && paymentIntent.latest_charge) {
        try {
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
          email = charge.billing_details.email;
        } catch (err) {
          console.log("⚠️ Could not retrieve charge:", err.message);
        }
      }

      if (!email) {
        console.log("⚠️ Missing email in payment intent and customer — skipping update.");
        return res.status(200).send("No email found, skipping update.");
      }

      console.log("✅ Email found:", email);

      const cleanEmail = email.toLowerCase();
      const data = businessData[cleanEmail];

      if (data) {
        const { business_name, tax_id } = data;
        const customerId = paymentIntent.customer;

        if (customerId) {
          try {
            // ✅ Update official customer fields
            await stripe.customers.update(customerId, {
              name: business_name,
            });

            // ✅ Add official tax ID
            await stripe.customers.createTaxId(customerId, {
              type: "eu_vat", // or "us_ein", adjust as needed
              value: tax_id,
            });

            console.log(
              `✅ Updated customer ${customerId} with business: ${business_name}, tax ID: ${tax_id}`
            );

            // ✅ (Optional) Notify GHL that Stripe update succeeded
            if (process.env.GHL_WEBHOOK_URL) {
              await axios.post(process.env.GHL_WEBHOOK_URL, {
                email,
                business_name,
                tax_id,
              });
              console.log("📨 Sent confirmation to GHL webhook");
            }
          } catch (err) {
            console.error("❌ Error updating Stripe customer:", err.message);
          }
        }
      } else {
        console.log(`⚠️ No business data found for ${cleanEmail}`);
      }
    }

    res.json({ received: true });
  }
);

/* ======================================================
   3️⃣ Health Check (optional)
   ====================================================== */
app.get("/", (req, res) => {
  res.send("✅ GHL ↔ Stripe Webhook server running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
