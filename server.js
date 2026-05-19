// server.js

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const PAYPAL_CLIENT_ID =
  'BAARFgxY4mArLY7rDlznysgPUo9fnu_NgP1NpIlv_-JMVrFWBK-8UlkNfOZaW76rVwZqQOhzI-4VcsMbBE';

const PAYPAL_SECRET =
  'EL1sm_sRLZj4ulUJFHJ_ywB8kojagMGY89Yhzafl33Vl4EzF3FuiiiR4zgTvVIJ4MQOlX6HGpyNdm1kT';

const BASE =
  //'https://api-m.sandbox.paypal.com'
  'https://api-m.paypal.com';

/* ── helpers ── */

async function generateAccessToken() {
  const auth = Buffer.from(
    PAYPAL_CLIENT_ID + ':' + PAYPAL_SECRET
  ).toString('base64');

  const response = await fetch(
    `${BASE}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }
  );

  const data = await response.json();
  return data.access_token;
}

/* ── routes ── */

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const token = await generateAccessToken();

    const response = await fetch(
      `${BASE}/v2/checkout/orders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: req.body.currency || 'ZAR',
                value: req.body.amount
              }
            }
          ],
          application_context: {
            return_url: 'https://yourdomain.com/paypal-success',
            cancel_url: 'https://yourdomain.com/paypal-cancel'
          }
        })
      }
    );

    const data = await response.json();
    const approval = data.links?.find(l => l.rel === 'approve');

    res.json({
      orderID: data.id,
      approvalUrl: approval?.href || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'PayPal order creation failed' });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    if (!orderID) {
      return res.status(400).json({ error: 'orderID is required' });
    }

    const token = await generateAccessToken();

    const response = await fetch(
      `${BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

    res.json({
      success: data.status === 'COMPLETED',
      captureID: capture?.id || null,
      status: data.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'PayPal capture failed' });
  }
});

app.post('/api/paypal/payout', async (req, res) => {

  try {

    const token =
      await generateAccessToken();

    const response = await fetch(
      `${BASE}/v1/payments/payouts`,
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${token}`,

          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          sender_batch_header: {

            sender_batch_id:
              'batch_' + Date.now(),

            email_subject:
              'You have received a payout'
          },

          items: [
            {

              recipient_type: 'EMAIL',

              amount: {
                value: req.body.amount,
                currency: 'ZAR'
              },

              receiver:
                req.body.recipient,

              note:
                'Withdrawal from AuTrader Pro',

              sender_item_id:
                'item_' + Date.now()
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log(data);

    res.json({

      success: true,

      payout_batch_id:
        data.batch_header.payout_batch_id
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,

      error: 'PayPal payout failed'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AuTrader Pro backend running on port ${PORT}`);
});