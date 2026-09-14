/* ==========================================================================
   Gemméa — Product Catalog
   ==========================================================================
   This is the single source of truth for what's for sale on the site.

   ⚠️ PRICES BELOW ARE PLACEHOLDERS — replace `price` (in SGD cents) with
   the real price for each piece before going live. e.g. 48800 = S$488.00

   IMPORTANT: this exact list is duplicated inside the Cloudflare Worker
   (stripe-worker/src/index.js) because the worker cannot trust prices sent
   from the browser — it looks up its own copy to build the Stripe charge.
   Whenever a piece is added, removed, or re-priced here, the same change
   must be made in the worker's PRODUCTS list, or ask Claude to update both
   at once ("add this new ring at $X" / "update the price of the clover
   pendant to $Y").
   ========================================================================== */

window.GEMMEA_PRODUCTS = [
  {
    id: "clover-pendant",
    name: "The Clover Pendant",
    price: 48800, // TODO: real price in SGD cents
    image: "clover-pendant.jpg",
    category: "necklaces"
  },
  {
    id: "double-ring-pendant",
    name: "The Double-Ring Pendant",
    price: 52800, // TODO: real price in SGD cents
    image: "double-ring-necklace.jpg",
    category: "necklaces"
  },
  {
    id: "marquise-bloom-pendant",
    name: "The Marquise Bloom Pendant",
    price: 58800, // TODO: real price in SGD cents
    image: "flower-pendant.jpg",
    category: "necklaces"
  },
  {
    id: "spiral-band-pendant",
    name: "The Spiral Band Pendant",
    price: 45800, // TODO: real price in SGD cents
    image: "spiral-pendant.jpg",
    category: "necklaces"
  },
  {
    id: "infinity-drop-pendant",
    name: "The Infinity Drop Pendant",
    price: 49800, // TODO: real price in SGD cents
    image: "teardrop-pendant.jpg",
    category: "necklaces"
  },
  {
    id: "halo-solitaire-necklace",
    name: "The Halo Solitaire Necklace",
    price: 68800, // TODO: real price in SGD cents
    image: "halo-necklace.jpg",
    category: "necklaces"
  },
  {
    id: "pave-solitaire-ring",
    name: "The Pavé Solitaire Ring",
    price: 78800, // TODO: real price in SGD cents
    image: "ring.jpg",
    category: "rings"
  },
  {
    id: "halo-stud-earrings",
    name: "The Halo Stud Earrings",
    price: 42800, // TODO: real price in SGD cents
    image: "earrings.jpg",
    category: "earrings"
  },
  {
    id: "tennis-bracelet",
    name: "The Tennis Bracelet",
    price: 88800, // TODO: real price in SGD cents
    image: "bracelet.jpg",
    category: "bracelets"
  }
];
