/* ==========================================================================
   Gemméa — Stripe Checkout Worker
   ==========================================================================
   Deployed to Cloudflare Workers. This is the ONLY place that talks to
   Stripe with a secret key, and the ONLY place prices are authoritative —
   never trust a price sent from the browser.

   Endpoints:
     POST /create-checkout-session   { items: [{ id, qty }] }  -> { url }
     OPTIONS *                       CORS preflight

   ⚠️ Keep this PRODUCTS list in sync with ../../products.js (the copy the
   website uses to render prices). When a piece is added, removed, or
   re-priced, update BOTH — or ask Claude to do it in one go.
   ========================================================================== */

const PRODUCTS = {
  "clover-pendant": { name: "The Clover Pendant", price: 48800, image: "clover-pendant.jpg" },
  "double-ring-pendant": { name: "The Double-Ring Pendant", price: 52800, image: "double-ring-necklace.jpg" },
  "marquise-bloom-pendant": { name: "The Marquise Bloom Pendant", price: 58800, image: "flower-pendant.jpg" },
  "spiral-band-pendant": { name: "The Spiral Band Pendant", price: 45800, image: "spiral-pendant.jpg" },
  "infinity-drop-pendant": { name: "The Infinity Drop Pendant", price: 49800, image: "teardrop-pendant.jpg" },
  "halo-solitaire-necklace": { name: "The Halo Solitaire Necklace", price: 68800, image: "halo-necklace.jpg" },
  "pave-solitaire-ring": { name: "The Pavé Solitaire Ring", price: 78800, image: "ring.jpg" },
  "halo-stud-earrings": { name: "The Halo Stud Earrings", price: 42800, image: "earrings.jpg" },
  "tennis-bracelet": { name: "The Tennis Bracelet", price: 88800, image: "bracelet.jpg" }
};

const MAX_QTY_PER_LINE = 10;
const MAX_LINES = 20;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(env))
  });
}

// Turns a nested object into Stripe's bracket-notation form encoding,
// e.g. {line_items:[{price_data:{currency:'sgd'}}]} ->
// "line_items[0][price_data][currency]=sgd"
function toFormParams(obj, prefix, params) {
  params = params || new URLSearchParams();
  Object.keys(obj).forEach(function (key) {
    var value = obj[key];
    var name = prefix ? prefix + "[" + key + "]" : key;
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(function (item, i) {
        var arrName = name + "[" + i + "]";
        if (typeof item === "object" && item !== null) {
          toFormParams(item, arrName, params);
        } else {
          params.append(arrName, String(item));
        }
      });
    } else if (typeof value === "object") {
      toFormParams(value, name, params);
    } else {
      params.append(name, String(value));
    }
  });
  return params;
}

async function createCheckoutSession(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400, env);
  }

  const items = Array.isArray(body && body.items) ? body.items : [];
  if (items.length === 0) {
    return json({ error: "Cart is empty" }, 400, env);
  }
  if (items.length > MAX_LINES) {
    return json({ error: "Too many line items" }, 400, env);
  }

  const lineItems = [];
  for (const raw of items) {
    const id = raw && raw.id;
    const qty = Math.floor(Number(raw && raw.qty));
    const product = PRODUCTS[id];

    if (!product) {
      return json({ error: "Unknown product: " + id }, 400, env);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return json({ error: "Invalid quantity for " + id }, 400, env);
    }

    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "sgd",
        unit_amount: product.price,
        product_data: {
          name: product.name,
          images: [env.SITE_BASE_URL + "/" + product.image]
        }
      }
    });
  }

  const sessionPayload = {
    mode: "payment",
    line_items: lineItems,
    success_url: env.SITE_BASE_URL + "/success.html?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: env.SITE_BASE_URL + "/cancel.html",
    shipping_address_collection: {
      allowed_countries: ["SG"]
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 0, currency: "sgd" },
          display_name: "Complimentary insured shipping (Singapore)"
        }
      }
    ]
  };

  const formBody = toFormParams(sessionPayload);

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formBody.toString()
  });

  const stripeData = await stripeRes.json();

  if (!stripeRes.ok) {
    return json(
      { error: (stripeData.error && stripeData.error.message) || "Stripe error" },
      stripeRes.status,
      env
    );
  }

  return json({ url: stripeData.url }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/create-checkout-session" && request.method === "POST") {
      try {
        return await createCheckoutSession(request, env);
      } catch (err) {
        return json({ error: "Server error: " + err.message }, 500, env);
      }
    }

    return json({ error: "Not found" }, 404, env);
  }
};
