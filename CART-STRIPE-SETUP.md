# Shopping cart + Stripe checkout — setup guide

This adds a real "Add to Cart" experience to the Gemméa site and connects
checkout to Stripe, while keeping the site on GitHub Pages (free, static
hosting). GitHub Pages can't run server code and can't safely hold a Stripe
secret key, so a small free helper — a Cloudflare Worker — sits in between:
your site calls the Worker, the Worker talks to Stripe.

```
Shopper's browser  →  Cloudflare Worker  →  Stripe
(cart in localStorage)  (holds the secret key,   (hosted checkout page,
                          builds the real prices)   takes the payment)
```

## What was added to the site

- `products.js` — the list of pieces, prices (in SGD cents) and images.
- `cart.js` — the cart itself: Add to Cart buttons, the slide-out bag,
  quantity controls, and the "Checkout" button.
- CSS for the cart icon and drawer, appended to `gemmea.css`.
- Every piece on necklaces/rings/earrings/bracelets pages now has a real
  price and an **Add to Cart** button, alongside the existing **Enquire**
  button.
- `success.html` and `cancel.html` — the pages Stripe sends shoppers back
  to after paying or backing out.
- `index.js` and `wrangler.toml` — the Cloudflare Worker code that creates
  the Stripe Checkout session. These two sit as plain files at the top
  level of your repo (not in a subfolder) so they're easy to drag-and-drop
  into GitHub the same way as everything else — GitHub Pages just ignores
  them since they're not linked from any page.

## Step 0 — Set your real prices (do this first)

Every price right now is a **placeholder**. Before taking real orders, edit:

1. `products.js` — the `price` field for each product (in cents, so
   S$488.00 is `48800`).
2. `index.js` — the matching `PRODUCTS` list near the top must have the
   **exact same prices**. This is the copy Stripe actually charges, so if
   the two ever disagree, the Worker's number wins and the site will just
   be showing the wrong price to shoppers.

Easiest path: message Claude with the real price for each piece (or a
photo of your price list) and ask it to update both files together.

## Step 1 — Create your Stripe account

1. Go to stripe.com and sign up with your business email.
2. Fill in your business details when prompted (this can be done later,
   but Stripe won't pay out real money to your bank account until it's
   verified — test payments work immediately, before verification).
3. In the Stripe Dashboard, toggle **Test mode** (top right) while you're
   setting things up — this lets you rehearse checkout with fake cards
   before any real money is involved.

## Step 2 — Get your Stripe secret key

1. In the Dashboard, go to **Developers → API keys**.
2. Under Test mode, copy the **Secret key** (starts with `sk_test_...`).
   Keep this private — never put it in the website's HTML/JS or commit it
   to GitHub. It only ever goes into the Worker, as a secret (Step 4).

## Step 3 — Install the Cloudflare CLI (wrangler)

You'll need Node.js installed on your computer (nodejs.org, the LTS
version). Then, in a terminal, in a folder that has both `index.js` and
`wrangler.toml` sitting next to each other (e.g. a fresh clone of your
GitHub repo, or your `github-upload` staging folder):

```
npm install -g wrangler
wrangler login
```

`wrangler login` opens a browser window to sign up/log in to Cloudflare
(free account) and authorize the CLI.

## Step 4 — Deploy the Worker

From that same folder (`index.js` and `wrangler.toml` side by side):

```
wrangler deploy
```

This prints a URL like `https://gemmea-checkout.YOUR-SUBDOMAIN.workers.dev`
— copy it, you'll need it in Step 5.

Then set your Stripe secret key as a Worker secret (this is what keeps it
out of your code and off GitHub):

```
wrangler secret put STRIPE_SECRET_KEY
```

Paste your `sk_test_...` key when prompted.

## Step 5 — Point the site at your Worker

Open `cart.js` and find this line near the top:

```js
var WORKER_URL = "https://REPLACE-ME.workers.dev";
```

Replace it with the URL from Step 4, e.g.:

```js
var WORKER_URL = "https://gemmea-checkout.fiona-abc1.workers.dev";
```

Save, then push the changed `cart.js` to GitHub the way you normally do
(stage it in your `github-upload` folder and upload/push), or ask Claude
to help.

## Step 6 — Test it end to end (still in Stripe test mode)

1. Open your live GitHub Pages site.
2. Add a piece to the bag, open the cart, click **Checkout**.
3. You should land on a Stripe-hosted payment page. Use Stripe's test
   card: card number `4242 4242 4242 4242`, any future expiry date, any
   3-digit CVC, any postal code.
4. Complete payment — you should land on your `success.html` page, and
   see the test payment appear in your Stripe Dashboard under **Payments**
   (make sure Test mode is still toggled on).
5. Try the cancel path too: start checkout, then click Stripe's back
   arrow — you should land on `cancel.html`.

## Step 7 — Go live

1. In Stripe, finish business verification if you haven't (Dashboard will
   prompt you) and add your Singapore bank account for payouts.
2. Toggle off **Test mode** in the Dashboard, go to **Developers → API
   keys**, and copy the **live** secret key (starts with `sk_live_...`).
3. Run `wrangler secret put STRIPE_SECRET_KEY` again (from the folder with
   `index.js` and `wrangler.toml`) and paste the live key. Nothing else
   needs to change — the Worker URL and `cart.js` stay the same.
4. Place one small real order yourself to confirm everything works, then
   you're live.

## Ongoing: adding or re-pricing pieces

Since you'd rather ask Claude than run a CMS: just message Claude with the
new piece's details (name, price, description, category, photo) or a price
change, and ask it to update `products.js` **and** the matching entry in
`index.js`, then push the changes. No redeploy of the Worker is needed for
a products.js-only change — but if `index.js` changes too, run
`wrangler deploy` again (no need to touch the secret key again).

## Notes on how this cart works

- The cart lives in each shopper's browser (`localStorage`) — it's not
  shared between devices and isn't visible to you anywhere; it just
  remembers what's in the bag until checkout.
- Shipping is currently restricted to Singapore addresses with a
  complimentary (S$0) shipping option at checkout, matching your site's
  existing shipping copy.
- The Worker is the only place that decides what things actually cost —
  even if someone tampered with prices in their browser, Stripe would
  still charge the real price from `index.js`.
