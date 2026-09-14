/* ==========================================================================
   Gemméa — Cart (localStorage) + Stripe Checkout
   ==========================================================================
   Include this AFTER products.js on every page that should have a cart
   (i.e. every page — the cart icon and drawer are injected automatically).

   How it works:
   1. Cart contents live in localStorage on this browser only (per visitor).
   2. "Add to Cart" buttons just need: class="btn-add-cart" data-product-id="...".
   3. On checkout, we POST {items:[{id,qty}]} to the Cloudflare Worker below.
      The Worker looks up real prices server-side and creates a Stripe
      Checkout Session, then we redirect the browser to the Stripe-hosted
      payment page it returns.
   ========================================================================== */

(function () {
  "use strict";

  /* ---- 1. CONFIG ---------------------------------------------------- */
  // TODO: replace with your deployed Cloudflare Worker URL after you run
  // `wrangler deploy` (see stripe-worker/README.md). Example:
  // "https://gemmea-checkout.fiona-abc1.workers.dev"
  var WORKER_URL = "https://REPLACE-ME.workers.dev";

  var CART_KEY = "gemmea_cart_v1";
  var PRODUCTS = window.GEMMEA_PRODUCTS || [];

  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) return PRODUCTS[i];
    }
    return null;
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString("en-SG", {
      style: "currency",
      currency: "SGD"
    });
  }

  /* ---- 2. CART STORAGE ------------------------------------------------ */
  function getCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCart(cart) {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {
      /* localStorage unavailable (private browsing etc.) — cart just won't persist */
    }
    renderCart();
  }

  function addToCart(id, qty) {
    qty = qty || 1;
    var cart = getCart();
    cart[id] = (cart[id] || 0) + qty;
    saveCart(cart);
    openDrawer();
  }

  function setQty(id, qty) {
    var cart = getCart();
    if (qty <= 0) {
      delete cart[id];
    } else {
      cart[id] = qty;
    }
    saveCart(cart);
  }

  function removeFromCart(id) {
    var cart = getCart();
    delete cart[id];
    saveCart(cart);
  }

  function cartLines() {
    var cart = getCart();
    var lines = [];
    Object.keys(cart).forEach(function (id) {
      var product = findProduct(id);
      if (product) {
        lines.push({ product: product, qty: cart[id] });
      }
    });
    return lines;
  }

  function cartCount() {
    var cart = getCart();
    return Object.keys(cart).reduce(function (sum, id) {
      return sum + cart[id];
    }, 0);
  }

  function cartSubtotal() {
    return cartLines().reduce(function (sum, line) {
      return sum + line.product.price * line.qty;
    }, 0);
  }

  /* ---- 3. DRAWER MARKUP (injected once) -------------------------------- */
  var drawerEl, overlayEl, badgeEl, linesEl, subtotalEl, checkoutBtn, checkoutMsgEl;

  function buildDrawer() {
    overlayEl = document.createElement("div");
    overlayEl.className = "cart-overlay";
    overlayEl.setAttribute("hidden", "");

    drawerEl = document.createElement("aside");
    drawerEl.className = "cart-drawer";
    drawerEl.setAttribute("aria-label", "Shopping cart");
    drawerEl.setAttribute("hidden", "");
    drawerEl.innerHTML =
      '<div class="cart-drawer-head">' +
      "<h2>Your Bag</h2>" +
      '<button type="button" class="cart-close" aria-label="Close cart">&times;</button>' +
      "</div>" +
      '<div class="cart-lines"></div>' +
      '<div class="cart-drawer-foot">' +
      '<div class="cart-subtotal"><span>Subtotal</span><strong></strong></div>' +
      '<p class="cart-shipping-note">Complimentary insured shipping in Singapore. Calculated at checkout.</p>' +
      '<p class="cart-checkout-msg" hidden></p>' +
      '<button type="button" class="btn btn-primary cart-checkout-btn">Checkout</button>' +
      "</div>";

    document.body.appendChild(overlayEl);
    document.body.appendChild(drawerEl);

    linesEl = drawerEl.querySelector(".cart-lines");
    subtotalEl = drawerEl.querySelector(".cart-subtotal strong");
    checkoutBtn = drawerEl.querySelector(".cart-checkout-btn");
    checkoutMsgEl = drawerEl.querySelector(".cart-checkout-msg");

    drawerEl.querySelector(".cart-close").addEventListener("click", closeDrawer);
    overlayEl.addEventListener("click", closeDrawer);
    checkoutBtn.addEventListener("click", goToCheckout);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  function openDrawer() {
    if (!drawerEl) return;
    drawerEl.removeAttribute("hidden");
    overlayEl.removeAttribute("hidden");
    requestAnimationFrame(function () {
      drawerEl.classList.add("is-open");
      overlayEl.classList.add("is-open");
    });
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove("is-open");
    overlayEl.classList.remove("is-open");
    setTimeout(function () {
      drawerEl.setAttribute("hidden", "");
      overlayEl.setAttribute("hidden", "");
    }, 200);
  }

  function renderCart() {
    if (!linesEl) return;

    var lines = cartLines();

    // update every header badge on the page (usually just one)
    var count = cartCount();
    document.querySelectorAll(".cart-badge").forEach(function (b) {
      b.textContent = String(count);
      b.classList.toggle("is-visible", count > 0);
    });

    if (lines.length === 0) {
      linesEl.innerHTML = '<p class="cart-empty">Your bag is empty.</p>';
      checkoutBtn.disabled = true;
    } else {
      checkoutBtn.disabled = false;
      linesEl.innerHTML = lines
        .map(function (line) {
          var p = line.product;
          return (
            '<div class="cart-line" data-id="' +
            p.id +
            '">' +
            '<img src="' +
            p.image +
            '" alt="" width="72" height="72">' +
            '<div class="cart-line-body">' +
            "<p class=\"cart-line-name\">" +
            p.name +
            "</p>" +
            '<p class="cart-line-price">' +
            formatMoney(p.price) +
            "</p>" +
            '<div class="cart-line-qty">' +
            '<button type="button" class="qty-btn qty-minus" aria-label="Decrease quantity">&minus;</button>' +
            '<span>' + line.qty + "</span>" +
            '<button type="button" class="qty-btn qty-plus" aria-label="Increase quantity">+</button>' +
            '<button type="button" class="cart-line-remove">Remove</button>' +
            "</div>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    }

    subtotalEl.textContent = formatMoney(cartSubtotal());
  }

  document.addEventListener("click", function (e) {
    var lineEl = e.target.closest ? e.target.closest(".cart-line") : null;
    if (!lineEl) return;
    var id = lineEl.getAttribute("data-id");
    var cart = getCart();
    var qty = cart[id] || 0;

    if (e.target.classList.contains("qty-plus")) {
      setQty(id, qty + 1);
    } else if (e.target.classList.contains("qty-minus")) {
      setQty(id, qty - 1);
    } else if (e.target.classList.contains("cart-line-remove")) {
      removeFromCart(id);
    }
  });

  /* ---- 4. CHECKOUT ------------------------------------------------------ */
  function goToCheckout() {
    var lines = cartLines();
    if (lines.length === 0) return;

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Redirecting…";
    checkoutMsgEl.setAttribute("hidden", "");

    var items = lines.map(function (line) {
      return { id: line.product.id, qty: line.qty };
    });

    fetch(WORKER_URL + "/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Checkout request failed (" + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        if (data && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      })
      .catch(function (err) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Checkout";
        checkoutMsgEl.textContent =
          "Sorry — checkout couldn't be started (" + err.message + "). Please try again, or message us on Instagram.";
        checkoutMsgEl.removeAttribute("hidden");
      });
  }

  /* ---- 5. HEADER CART BUTTON (injected if missing) ----------------------- */
  function ensureCartButton() {
    document.querySelectorAll(".header-actions").forEach(function (actions) {
      if (actions.querySelector(".cart-toggle")) return; // already present
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cart-toggle";
      btn.setAttribute("aria-label", "Open cart");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
        '<circle cx="9" cy="21" r="1.25" fill="currentColor" stroke="none"/>' +
        '<circle cx="18" cy="21" r="1.25" fill="currentColor" stroke="none"/>' +
        '<path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6"/>' +
        "</svg>" +
        '<span class="cart-badge">0</span>';
      btn.addEventListener("click", openDrawer);
      // insert before the nav-toggle (hamburger) if present, else append
      var navToggle = actions.querySelector(".nav-toggle");
      if (navToggle) {
        actions.insertBefore(btn, navToggle);
      } else {
        actions.appendChild(btn);
      }
    });
  }

  /* ---- 6. ADD-TO-CART BUTTON DELEGATION ---------------------------------- */
  function bindAddToCart() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".btn-add-cart") : null;
      if (!btn) return;
      e.preventDefault();
      var id = btn.getAttribute("data-product-id");
      if (!id) return;
      var original = btn.textContent;
      addToCart(id, 1);
      btn.textContent = "Added ✓";
      setTimeout(function () {
        btn.textContent = original;
      }, 1200);
    });
  }

  /* ---- 7. INIT ------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    ensureCartButton();
    buildDrawer();
    bindAddToCart();
    renderCart();
  });
})();
