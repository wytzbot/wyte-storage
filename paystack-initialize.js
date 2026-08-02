// /api/paystack-initialize.js
// Deploy this alongside your existing /payments-webhook on the same Vercel
// project (labguru-five). It's the only place PAYSTACK_SECRET_KEY is used.
//
// Client calls this with { email, amount, currency }.
// This calls Paystack's Initialize Transaction endpoint and returns the
// authorization_url the browser should redirect to.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, amount, currency } = req.body || {};

  if (!email || !amount) {
    return res.status(400).json({ message: "email and amount are required" });
  }

  try {
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        amount, // amount in kobo — client already multiplies by 100
        currency: currency || "NGN",
        callback_url: "https://YOUR-APP-DOMAIN/index.html" // TODO: set your real hosted URL
      })
    });

    const data = await paystackRes.json();

    if (!data.status) {
      return res.status(400).json({ message: data.message || "Paystack rejected the request" });
    }

    return res.status(200).json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error starting checkout" });
  }
}

// Reminder: your existing /payments-webhook route is where Paystack tells
// you a payment succeeded (event "charge.success"). Always verify the
// x-paystack-signature header there using PAYSTACK_SECRET_KEY before
// marking a user as Pro — never trust the client alone for that.
