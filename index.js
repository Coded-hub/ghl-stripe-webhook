import express from "express";
import Stripe from "stripe";
import bodyParser from "body-parser";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Temporary in-memory storage for GHL form data
const formDataStore = new Map();

// GHL form data endpoint
app.post("/save-business-info", bodyParser.json(), (req, res) => {
  const { email, business_name, tax_id } = req.body;

  if (!email) {
    console.log("❌ Missing email, cannot store form data");
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  formDataStore.set(email.toLowerCase(), { business_name, tax_id });
  console.log("✅ Saved form data for:", email, { business_name, tax_id });

  res.json({ success: true });
});

// Stripe webhook endpoint
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log("❌ Stripe signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const email = paymentIntent.receipt_email || paymentIntent.customer_email;

    console.log("💰 Payment successful for:", email);

    // Match form data (if submitted earlier)
    const formData = formDataStore.get(email?.toLowerCase());
    if (formData) {
      console.log("✅ Found matching form data:", formData);

      // Combine Stripe + GHL data
      const combinedData = {
        email,
        amount: paymentIntent.amount_received / 100,
        currency: paymentIntent.currency,
        business_name: formData.business_name,
        tax_id: formData.tax_id,
        stripe_payment_id: paymentIntent.id,
      };

      console.log("📦 Combined data ready for Oblio:", combinedData);

      // TODO: send this to Oblio via API (we’ll handle this next)
    } else {
      console.log("⚠️ No form data found for this email.");
    }
  }

  res.send();
});

// Default route
app.get("/", (req, res) => {
  res.send("✅ Server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
