// Synthetic demo code for Nexus Intelligence. Not a real system.

const state = {
  catalog: null,
  cartId: null,
  lines: [],
  step: 1,
  ship: {
    name: "Receiving desk",
    company: "Brightline Tools",
    line1: "400 Harbor Yard, Suite 12",
    city: "Example City",
    region: "EX",
    postal: "00000",
    phone: "555-0100",
  },
  pay: { name: "Brightline Tools", number: "4242 4242 4242 4242", exp: "12/28", cvc: "123" },
};

const main = document.querySelector("#main");
const drawer = document.querySelector("#drawer");

function money(minor) {
  if (typeof minor !== "number" || Number.isNaN(minor)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
}

function priceOf(product) {
  return typeof product.amountMinor === "number" ? product.amountMinor : product.contractMinor;
}

function bySku(sku) {
  return state.catalog.products.find((product) => product.sku === sku);
}

function stars(rating, reviews) {
  const full = Math.round(rating);
  return `<span class="stars" aria-label="${rating} out of 5 stars, ${reviews} reviews">${"★".repeat(full)}${"☆".repeat(5 - full)} <span>(${reviews})</span></span>`;
}

function stockBadge(product) {
  const kind = product.stock === "low" ? "low" : "in";
  return `<span class="stock ${kind}">${product.stockLabel}</span>`;
}

function go(path) {
  if (location.pathname + location.search !== path) {
    history.pushState({}, "", path);
  }
  draw();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

function qtyOf(sku) {
  return state.lines.find((line) => line.sku === sku)?.qty ?? 0;
}

function cartCount() {
  return state.lines.reduce((sum, line) => sum + line.qty, 0);
}

function updateCount() {
  const count = document.querySelector("#cart-count");
  count.textContent = String(cartCount());
}

function persistCart() {
  sessionStorage.setItem("orbit-cart", JSON.stringify({ cartId: state.cartId, lines: state.lines, step: state.step }));
}

function restoreCart() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("orbit-cart") || "null");
    if (!saved) return;
    state.cartId = saved.cartId;
    state.lines = saved.lines || [];
    state.step = saved.step || 1;
  } catch {
    // ignore a bad session snapshot
  }
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog");
    if (!response.ok) throw new Error("catalog");
    state.catalog = await response.json();
  } catch {
    const response = await fetch("/catalog.json");
    state.catalog = await response.json();
    for (const product of state.catalog.products) {
      product.amountMinor = product.contractMinor;
    }
  }
}

async function ensureCart() {
  if (state.cartId) return state.cartId;
  const response = await fetch("/api/carts", { method: "POST" });
  const body = await response.json();
  state.cartId = body.id;
  state.lines = body.lines || [];
  return state.cartId;
}

async function addSku(sku, qty, quiet) {
  const cartId = await ensureCart();
  const response = await fetch(`/api/carts/${cartId}/items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku, qty }),
  });
  const body = await response.json();
  state.lines = body.lines || state.lines;
  persistCart();
  updateCount();
  if (!quiet) openDrawer();
}

function lineTotal() {
  return state.lines.reduce((sum, line) => {
    const product = bySku(line.sku);
    return sum + (product ? priceOf(product) * line.qty : 0);
  }, 0);
}

function productCard(product) {
  const badge = product.badge ? `<span class="badge">${product.badge}</span>` : "";
  return `<article class="card">
    <a href="/p/${product.sku}"><img src="${product.image}" alt="" width="480" height="480" loading="lazy" /></a>
    <div class="body">
      <div>${badge} ${stockBadge(product)}</div>
      <a class="title-link" href="/p/${product.sku}">${product.title}</a>
      <div class="sku">SKU ${product.sku}</div>
      ${stars(product.rating, product.reviews)}
      <div><span class="price">${money(priceOf(product))}</span><span class="compare">${money(product.listMinor)}</span></div>
      <div class="muted">Contract price · list ${money(product.listMinor)}</div>
      <button class="btn" type="button" data-add="${product.sku}">Add to cart</button>
    </div>
  </article>`;
}

function renderHome() {
  const hero = "/images/hero-jobsite.webp";
  const picks = state.catalog.products.slice(0, 8);
  main.innerHTML = `
    <section class="hero" style="background-image:linear-gradient(90deg,rgba(16,32,51,.72),rgba(16,32,51,.15)),url('${hero}')">
      <div class="hero-copy">
        <p class="badge">Brightline contract</p>
        <h1>Stock the site before the crew clocks in.</h1>
        <p>Power tools, fasteners, lighting, and safety gear on the Brightline Tools price book. Checkout runs through Orbit pricing and payments.</p>
        <a class="btn" href="/c/power-tools">Shop power tools</a>
      </div>
    </section>
    <div class="wrap">
      <div class="promos">
        <div class="promo"><strong>Contract price at checkout</strong><span class="muted">Your price is the amount the pricing service returns, not the crossed-out list price.</span></div>
        <div class="promo"><strong>Ship to the job site</strong><span class="muted">400 Harbor Yard is the demo ship-to. Nothing leaves a warehouse.</span></div>
        <div class="promo"><strong>30-day returns on stocked goods</strong><span class="muted">Opened fastener cartons are final sale in this fictional policy.</span></div>
      </div>
      <div class="section-head"><h2>Shop by department</h2></div>
      <div class="tiles">${state.catalog.categories.map((cat) => `<a class="tile" href="/c/${cat.id}"><img src="${cat.image}" alt="" /><span>${cat.name}</span></a>`).join("")}</div>
      <div class="section-head"><h2>Pro picks</h2><a href="/c/power-tools">View power tools</a></div>
      <div class="grid">${picks.map(productCard).join("")}</div>
    </div>`;
}

function renderCategory(id) {
  const cat = state.catalog.categories.find((item) => item.id === id);
  const products = state.catalog.products.filter((product) => product.category === id);
  if (!cat) {
    main.innerHTML = `<div class="wrap"><h1>Department not found</h1><a href="/">Back home</a></div>`;
    return;
  }
  main.innerHTML = `<div class="wrap">
    <p class="crumb"><a href="/">Home</a> / ${cat.name}</p>
    <div class="section-head"><h1 style="margin:0">${cat.name}</h1><span class="muted">${products.length} items · ${cat.blurb}</span></div>
    <div class="grid">${products.map(productCard).join("")}</div>
  </div>`;
}

function renderSearch(q) {
  const query = q.trim().toLowerCase();
  const products = state.catalog.products.filter((product) =>
    `${product.title} ${product.sku} ${product.blurb}`.toLowerCase().includes(query));
  main.innerHTML = `<div class="wrap">
    <h1>Search</h1>
    <p class="muted">${products.length} results for “${q.replace(/[&<>"']/g, "")}”</p>
    <div class="grid">${products.map(productCard).join("") || "<p>No matching products.</p>"}</div>
  </div>`;
}

function renderProduct(sku) {
  const product = bySku(sku);
  if (!product) {
    main.innerHTML = `<div class="wrap"><h1>Product not found</h1></div>`;
    return;
  }
  const cat = state.catalog.categories.find((item) => item.id === product.category);
  const gallery = [product.image, cat && cat.image !== product.image ? cat.image : null].filter(Boolean);
  main.innerHTML = `<div class="wrap">
    <p class="crumb"><a href="/">Home</a> / <a href="/c/${product.category}">${cat ? cat.name : "Shop"}</a> / ${product.title}</p>
    <article class="pdp">
      <div class="gallery">
        <img id="hero-img" src="${gallery[0]}" alt="${product.title}" width="800" height="800" />
        <div class="thumbs">${gallery.map((src, index) => `<button type="button" data-thumb="${src}" aria-current="${index === 0 ? "true" : "false"}" aria-label="Photo ${index + 1}"><img src="${src}" alt="" /></button>`).join("")}</div>
      </div>
      <div class="buy">
        ${product.badge ? `<span class="badge">${product.badge}</span>` : ""} ${stockBadge(product)}
        <h1>${product.title}</h1>
        <div class="sku">SKU ${product.sku}</div>
        ${stars(product.rating, product.reviews)}
        <p>${product.blurb}</p>
        <div><span class="price">${money(priceOf(product))}</span><span class="compare">${money(product.listMinor)}</span></div>
        <p class="muted">Your contract price. List price shown for comparison. Checkout charges the contract price.</p>
        <div class="qty">
          <label for="qty">Qty</label>
          <input id="qty" type="number" min="1" max="99" value="1" />
        </div>
        <button class="btn" type="button" id="pdp-add">Add to cart</button>
        <p class="muted">In the cart: ${qtyOf(product.sku)}</p>
      </div>
    </article>
    <h2>Specifications</h2>
    <table>${product.specs.map((row) => `<tr><th scope="row">${row.name}</th><td>${row.value}</td></tr>`).join("")}</table>
    <div class="note">
      <h2>Shipping and returns</h2>
      <p>In-stock items are quoted to ship in 1–2 business days from the fictional Orbit distribution center. The Brightline contract can mark a job site as the ship-to. Unused stocked goods can be returned within 30 days. Opened fastener cartons are final sale. This policy is part of the demo and is not an offer from a real merchant.</p>
    </div>
  </div>`;
  document.querySelector("#pdp-add").addEventListener("click", () => {
    const qty = Math.max(1, Number(document.querySelector("#qty").value) || 1);
    addSku(product.sku, qty).catch((error) => alert(String(error)));
  });
}

function cartRows() {
  if (!state.lines.length) return `<p>Your cart is empty.</p>`;
  return state.lines.map((line) => {
    const product = bySku(line.sku);
    if (!product) return "";
    return `<div class="line">
      <img src="${product.image}" alt="" />
      <div><a href="/p/${product.sku}">${product.title}</a><div class="sku">${product.sku}</div><div>${line.qty} × ${money(priceOf(product))}</div></div>
      <strong>${money(priceOf(product) * line.qty)}</strong>
    </div>`;
  }).join("") + `<p><strong>Estimated contract total ${money(lineTotal())}</strong></p><p class="muted">The receipt total is confirmed when you place the order.</p>`;
}

function renderCartPage() {
  main.innerHTML = `<div class="wrap"><h1>Cart</h1>${cartRows()}
    <p><a class="btn" href="/checkout">Checkout</a> <a class="btn ghost" href="/">Keep shopping</a></p></div>`;
}

function openDrawer() {
  document.querySelector("#drawer-body").innerHTML = `${cartRows()}<p><a class="btn" href="/cart">View cart</a> <a class="btn secondary" href="/checkout">Checkout</a></p>`;
  drawer.hidden = false;
}

function closeDrawer() {
  drawer.hidden = true;
}

function renderCheckout() {
  if (!state.lines.length) {
    main.innerHTML = `<div class="wrap"><h1>Checkout</h1><p>Your cart is empty.</p><a href="/">Continue shopping</a></div>`;
    return;
  }
  const steps = ["Shipping", "Payment", "Review"].map((label, index) =>
    `<span class="${state.step === index + 1 ? "on" : ""}">${index + 1}. ${label}</span>`).join("");
  let body = "";
  if (state.step === 1) {
    const s = state.ship;
    body = `<form class="form" id="ship-form">
      <label>Site contact<input name="name" required value="${s.name}" /></label>
      <label>Company<input name="company" required value="${s.company}" /></label>
      <label>Address<input name="line1" required value="${s.line1}" /></label>
      <div class="grid-2">
        <label>City<input name="city" required value="${s.city}" /></label>
        <label>Region<input name="region" required value="${s.region}" /></label>
      </div>
      <div class="grid-2">
        <label>Postal code<input name="postal" required value="${s.postal}" /></label>
        <label>Phone<input name="phone" required value="${s.phone}" /></label>
      </div>
      <button class="btn" type="submit">Continue to payment</button>
    </form>`;
  } else if (state.step === 2) {
    const p = state.pay;
    body = `<form class="form" id="pay-form">
      <p class="muted">This card is not sent anywhere. Placing the order calls <code>/api/checkout</code>, which authorizes through the payments gateway.</p>
      <label>Name on card<input name="name" required value="${p.name}" /></label>
      <label>Card number<input name="number" required value="${p.number}" inputmode="numeric" autocomplete="off" /></label>
      <div class="grid-2">
        <label>Exp<input name="exp" required value="${p.exp}" /></label>
        <label>CVC<input name="cvc" required value="${p.cvc}" /></label>
      </div>
      <button class="btn" type="submit">Review order</button>
      <button class="btn ghost" type="button" id="back-ship">Back</button>
    </form>`;
  } else {
    body = `<div class="form">
      <h2>Ship to</h2>
      <p>${state.ship.name}<br />${state.ship.company}<br />${state.ship.line1}<br />${state.ship.city}, ${state.ship.region} ${state.ship.postal}</p>
      <h2>Pay with</h2>
      <p>Demo card ending ${state.pay.number.slice(-4)}. Not transmitted.</p>
      ${cartRows()}
      <button class="btn" type="button" id="place">Place order</button>
      <button class="btn ghost" type="button" id="back-pay">Back</button>
      <p id="place-error" class="alert bad" hidden></p>
    </div>`;
  }
  main.innerHTML = `<div class="wrap"><h1>Checkout</h1><div class="steps">${steps}</div>${body}</div>`;
  const ship = document.querySelector("#ship-form");
  if (ship) {
    ship.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(ship);
      for (const key of Object.keys(state.ship)) state.ship[key] = String(data.get(key) || "");
      state.step = 2;
      draw();
    });
  }
  const pay = document.querySelector("#pay-form");
  if (pay) {
    pay.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(pay);
      for (const key of Object.keys(state.pay)) state.pay[key] = String(data.get(key) || "");
      state.step = 3;
      draw();
    });
    document.querySelector("#back-ship").addEventListener("click", () => { state.step = 1; draw(); });
  }
  const place = document.querySelector("#place");
  if (place) {
    place.addEventListener("click", () => placeOrder(place));
    document.querySelector("#back-pay").addEventListener("click", () => { state.step = 2; draw(); });
  }
}

function saveOrder(record) {
  const existing = JSON.parse(localStorage.getItem("orbit-orders") || "[]");
  existing.unshift(record);
  localStorage.setItem("orbit-orders", JSON.stringify(existing.slice(0, 40)));
}

function orders() {
  return JSON.parse(localStorage.getItem("orbit-orders") || "[]");
}

async function placeOrder(button) {
  button.disabled = true;
  const errorBox = document.querySelector("#place-error");
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartId: state.cartId }),
    });
    const body = await response.json();
    const record = { status: response.status, body, ship: { ...state.ship }, at: new Date().toISOString(), lines: state.lines.slice() };
    saveOrder(record);
    state.cartId = null;
    state.lines = [];
    state.step = 1;
    persistCart();
    updateCount();
    const id = body.orderId || `failed-${record.at}`;
    go(`/orders/${encodeURIComponent(id)}`);
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = String(error);
    button.disabled = false;
  }
}

function chargeTable(charges) {
  if (!charges || !charges.length) return "";
  return `<table><thead><tr><th>Attempt</th><th>Idempotency key</th><th>Authorization</th></tr></thead><tbody>
    ${charges.map((charge) => `<tr><td>${charge.attempt}</td><td><code>${charge.idempotencyKey}</code></td><td>${charge.paymentStatus === 200 ? "Approved" : "Declined (" + charge.paymentStatus + ")"}</td></tr>`).join("")}
  </tbody></table>`;
}

function outcomeBanner(body, status) {
  if (status === 200 && body.duplicate) {
    return `<div class="alert warn"><strong>This order was submitted ${body.charges.length} times.</strong> Each attempt used a new payment idempotency key, so each one is a separate charge. Router ${body.router} is on order-service ${body.version}.</div>`;
  }
  if (body.error === "payment_failed" || status === 502) {
    return `<div class="alert bad"><strong>Payment failed.</strong> The authorization service declined this checkout. If risk scoring panicked, the receipt below includes that detail.</div>`;
  }
  if (body.error === "OUT_OF_STOCK" || status === 409) {
    return `<div class="alert bad"><strong>Out of stock.</strong> The item showed as stocked in the catalog, but checkout could not reserve it and mapped the failure to out of stock.</div>`;
  }
  if (status === 200) {
    return `<div class="alert good"><strong>Order placed.</strong> One charge on ${body.router} (${body.version}).</div>`;
  }
  return `<div class="alert bad">Checkout returned HTTP ${status}.</div>`;
}

function renderOrder(id) {
  const record = orders().find((item) => (item.body.orderId || `failed-${item.at}`) === id);
  if (!record) {
    main.innerHTML = `<div class="wrap"><h1>Order not on this browser</h1><a href="/orders">Order history</a></div>`;
    return;
  }
  const body = record.body;
  const lines = (body.lines || []).map((line) => `<li><code>${line}</code></li>`).join("");
  main.innerHTML = `<div class="wrap">
    <p class="crumb"><a href="/orders">Orders</a> / ${body.orderId || "Reservation"}</p>
    <h1>${body.orderId || "Could not reserve"}</h1>
    ${outcomeBanner(body, record.status)}
    <p>Placed ${new Date(record.at).toLocaleString()} · Ship to ${record.ship.line1}, ${record.ship.city}</p>
    ${body.totalMinor ? `<p class="price">${money(body.totalMinor)}</p>` : ""}
    <h2>Charges</h2>
    ${chargeTable(body.charges) || "<p>No authorization was started.</p>"}
    ${body.log ? `<h2>Reservation detail</h2><p><code>${body.log}</code></p>` : ""}
    <details class="note"><summary>Fulfillment receipt</summary><ul>${lines || "<li>No router lines.</li>"}</ul></details>
    <p><a class="btn ghost" href="/orders">All orders</a></p>
  </div>`;
}

function renderOrders() {
  const list = orders();
  main.innerHTML = `<div class="wrap"><h1>Order history</h1>
    ${list.length ? `<table><thead><tr><th>Order</th><th>When</th><th>Result</th><th>Charges</th></tr></thead><tbody>
      ${list.map((record) => {
        const id = record.body.orderId || `failed-${record.at}`;
        const chargeList = record.body.charges || [];
        const result = record.body.duplicate ? `${chargeList.length} submissions` : (record.body.error || "Placed");
        const detail = chargeList.map((charge) => `#${charge.attempt} ${charge.idempotencyKey} · ${charge.paymentStatus === 200 ? "Approved" : "Declined"}`).join("<br />");
        return `<tr><td><a href="/orders/${encodeURIComponent(id)}">${record.body.orderId || "Reservation failed"}</a></td><td>${new Date(record.at).toLocaleString()}</td><td>${result}</td><td>${detail || "—"}</td></tr>`;
      }).join("")}
    </tbody></table>` : `<p>No orders in this browser yet.</p>`}
  </div>`;
}

function renderAccount() {
  const options = state.catalog.products.map((product) => `<option value="${product.sku}">${product.sku} · ${product.title}</option>`).join("");
  main.innerHTML = `<div class="wrap">
    <h1>Brightline Tools · B2B account</h1>
    <p>Signed in as the receiving desk for tenant <strong>t_brightline</strong>. Contract orders on this account use <code>ENABLE_BULK_REPRICE</code>. A host still on order-service 5.5.3 re-submits the order; 5.6.0 applies the contract price once.</p>
    <div class="note"><h2>Bulk order</h2>
      <p>Add several lines, then check out once. The cart still posts to <code>/api/checkout</code>.</p>
      <div id="bulk-rows"></div>
      <p><button class="btn secondary" type="button" id="add-row">Add line</button> <button class="btn" type="button" id="bulk-add">Add lines to cart</button></p>
    </div>
    <h2>Shipping and returns</h2>
    <p>Stocked goods: 1–2 business days in this demo. Returns within 30 days if unused. Fastener cartons that have been opened are final sale. Orbit Commerce is fictional.</p>
  </div>`;
  const rows = document.querySelector("#bulk-rows");
  function addRow() {
    const wrap = document.createElement("div");
    wrap.className = "grid-2";
    wrap.innerHTML = `<label>SKU<select>${options}</select></label><label>Qty<input type="number" min="1" value="1" /></label>`;
    rows.append(wrap);
  }
  addRow();
  document.querySelector("#add-row").addEventListener("click", addRow);
  document.querySelector("#bulk-add").addEventListener("click", async () => {
    for (const row of rows.querySelectorAll(".grid-2")) {
      const sku = row.querySelector("select").value;
      const qty = Math.max(1, Number(row.querySelector("input").value) || 1);
      await addSku(sku, qty, true);
    }
    go("/cart");
  });
}

function draw() {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  document.title = "Orbit Supply";
  if (path === "/" || path === "/index.html") renderHome();
  else if (path.startsWith("/c/")) renderCategory(decodeURIComponent(path.slice(3)));
  else if (path.startsWith("/p/")) renderProduct(decodeURIComponent(path.slice(3)));
  else if (path === "/cart") renderCartPage();
  else if (path === "/checkout") renderCheckout();
  else if (path === "/orders") renderOrders();
  else if (path.startsWith("/orders/")) renderOrder(decodeURIComponent(path.slice(8)));
  else if (path === "/account") renderAccount();
  else if (path === "/search") renderSearch(params.get("q") || "");
  else renderHome();
  updateCount();
}

function fillDepartments() {
  const links = document.querySelector("#dept-links");
  links.innerHTML = `<button type="button" class="dept-btn" id="open-depts" aria-expanded="false" aria-controls="dept-panel">Departments</button>`
    + state.catalog.categories.map((cat) => `<a href="/c/${cat.id}">${cat.name}</a>`).join("");
  const panel = document.querySelector("#dept-panel");
  panel.innerHTML = `<div class="dept-grid">${state.catalog.categories.map((cat) => `<a href="/c/${cat.id}"><img src="${cat.image}" alt="" /><span>${cat.name}<br /><small class="muted">${cat.blurb}</small></span></a>`).join("")}</div>`;
  document.querySelector("#open-depts").addEventListener("click", () => {
    const open = panel.hasAttribute("hidden");
    panel.hidden = !open;
    panel.classList.toggle("open", open);
    document.querySelector("#open-depts").setAttribute("aria-expanded", open ? "true" : "false");
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (link && link.origin === location.origin && !link.href.includes("/images/")) {
    const url = new URL(link.href);
    if (!url.pathname.startsWith("/api/")) {
      event.preventDefault();
      closeDrawer();
      go(url.pathname + url.search);
      return;
    }
  }
  const add = event.target.closest("[data-add]");
  if (add) {
    addSku(add.dataset.add, 1).catch((error) => alert(String(error)));
  }
  const thumb = event.target.closest("[data-thumb]");
  if (thumb) {
    document.querySelector("#hero-img").src = thumb.dataset.thumb;
    document.querySelectorAll("[data-thumb]").forEach((button) => button.setAttribute("aria-current", button === thumb ? "true" : "false"));
  }
  if (event.target.closest("[data-close-drawer]")) closeDrawer();
  if (event.target.id === "cart-link") {
    event.preventDefault();
    openDrawer();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});

document.querySelector(".search").addEventListener("submit", (event) => {
  event.preventDefault();
  const q = new FormData(event.target).get("q") || "";
  go(`/search?q=${encodeURIComponent(String(q))}`);
});

document.querySelector(".menu-btn").addEventListener("click", () => {
  const nav = document.querySelector("#dept");
  const open = nav.classList.toggle("open");
  eventTarget(open);
});

function eventTarget(open) {
  const button = document.querySelector(".menu-btn");
  button.setAttribute("aria-expanded", open ? "true" : "false");
  document.querySelector("#dept-panel").hidden = !open;
}

window.addEventListener("popstate", draw);

loadCatalog().then(() => {
  restoreCart();
  fillDepartments();
  draw();
}).catch((error) => {
  main.innerHTML = `<div class="wrap"><h1>Catalog unavailable</h1><p>${String(error)}</p></div>`;
});
