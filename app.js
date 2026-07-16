/* ============================================================
   Melissa's Cookbook — candy-pastel edition 🍓 (localStorage)
   ============================================================ */

const STORAGE_KEY = "melissas-cookbook-v1"; // same key as before — your recipes are safe!

// Categories: value -> {label, emoji}
const CATEGORIES = [
  { value: "breakfast", label: "Breakfast", emoji: "🥞" },
  { value: "snack",     label: "Snacks",    emoji: "🥨" },
  { value: "meal",      label: "Meals",     emoji: "🍝" },
  { value: "mealprep",  label: "Meal Prep", emoji: "🍱" },
  { value: "dessert",   label: "Desserts",  emoji: "🍰" },
  { value: "drink",     label: "Drinks",    emoji: "🧋" },
  { value: "other",     label: "Other",     emoji: "🍽️" },
];
const catInfo = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];

// The original preloaded sample recipes are permanently retired — they get
// dropped from device storage AND ignored if an old publish brings them back.
const RETIRED_SAMPLES = new Set([
  "Garlic Butter Pasta",
  "Chewy Chocolate Chip Cookies",
  "Honey Garlic Chicken Meal Prep Bowls",
]);

// Vibe filters: made-it vs wishlist vs favorites
const VIBES = [
  { value: "all",   label: "everything",   emoji: "🌈" },
  { value: "made",  label: "tried & true", emoji: "💖" },
  { value: "totry", label: "wishlist",     emoji: "✨" },
  { value: "fav",   label: "faves",        emoji: "⭐" },
];

/* ---------- State ---------- */
let recipes = load();
let activeCategory = "all";
let activeVibe = "all";
let searchTerm = "";
let editingId = null;
let currentDetail = null;   // recipe currently open in detail view
let currentServings = null; // chosen serving size in detail view

/* ---------- Storage ---------- */
function load() {
  let list = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) list = JSON.parse(raw);
  } catch (e) { /* ignore */ }
  if (!Array.isArray(list)) list = seedRecipes();
  // drop retired samples that older versions stored on this device
  list = list.filter((r) => r && !RETIRED_SAMPLES.has(r.title));
  // gentle migration: older recipes get the new fields with defaults.
  // Anything without a timestamp predates syncing — mark it as "ours"
  // (dirty) so the published file can never overwrite or drop it.
  return list.map((r) => {
    const out = { ...r, made: !!r.made, fav: !!r.fav };
    if (typeof out.updatedAt !== "number") { out.updatedAt = Date.now(); out.dirty = true; }
    return out;
  });
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

// mark a recipe as changed-by-us so it wins over the published copy
function touch(r) {
  r.updatedAt = Date.now();
  r.dirty = true;
}

/* tombstones: remember deletes so a published copy doesn't resurrect them */
const TOMB_KEY = "melissas-cookbook-deleted-v1";
function loadTomb() {
  try { return JSON.parse(localStorage.getItem(TOMB_KEY)) || {}; } catch (e) { return {}; }
}
function saveTomb(t) { localStorage.setItem(TOMB_KEY, JSON.stringify(t)); }
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Published cookbook sync ----------
   recipes.json is the shared, published cookbook (updated via publish.bat).
   On the hosted site everyone loads it; your local unpublished changes
   (dirty) always win on your own device. On file:// the fetch just fails
   quietly and everything works like before. */
async function syncFromPublished() {
  try {
    const res = await fetch("recipes.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const published = await res.json();
    if (!Array.isArray(published)) return;
    mergePublished(published);
    save();
    renderAll();
  } catch (e) { /* offline or opened as a local file — no biggie */ }
}

function mergePublished(published) {
  const tomb = loadTomb();
  const localById = new Map(recipes.map((r) => [r.id, r]));
  const pubIds = new Set();
  const merged = [];

  for (const p of published) {
    if (!p || !p.id || !p.title) continue;
    if (RETIRED_SAMPLES.has(p.title)) continue; // stale publishes can't revive them
    pubIds.add(p.id);
    // deleted locally after this was published? keep it gone
    if (tomb[p.id] && tomb[p.id] > (p.updatedAt || 0)) continue;
    const loc = localById.get(p.id);
    if (loc && loc.dirty && (loc.updatedAt || 0) > (p.updatedAt || 0)) {
      merged.push(loc); // our newer unpublished version wins
    } else {
      merged.push({ ...p, made: !!p.made, fav: !!p.fav, dirty: false });
    }
  }

  // our drafts / edits that aren't published yet stay at the top;
  // non-dirty leftovers (e.g. starter recipes) defer to the published list
  const drafts = recipes.filter((r) => !pubIds.has(r.id) && r.dirty);
  recipes = [...drafts, ...merged];

  // prune tombstones that no longer matter
  let changed = false;
  for (const id of Object.keys(tomb)) {
    if (!pubIds.has(id)) { delete tomb[id]; changed = true; }
  }
  if (changed) saveTomb(tomb);
}

/* ---------- Seed data ----------
   The shared cookbook (recipes.json) is the source of truth now,
   so fresh browsers start empty and fill up on the first sync. */
function seedRecipes() {
  return [];
}

/* ---------- Number / fraction helpers ---------- */
// Turn a decimal into a friendly fraction string (for scaled amounts).
function prettyQty(n) {
  if (n === 0 || n == null || isNaN(n)) return "";
  const whole = Math.floor(n);
  const frac = n - whole;
  const fractions = [
    [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
    [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
  ];
  let best = null, bestDiff = 0.06; // tolerance
  for (const [val, sym] of fractions) {
    const d = Math.abs(frac - val);
    if (d < bestDiff) { bestDiff = d; best = sym; }
  }
  if (frac < 0.06) return String(whole);          // basically whole
  if (frac > 0.94) return String(whole + 1);      // rounds up
  if (best) return whole > 0 ? `${whole}${best}` : best;
  // fallback: round to 2 decimals, trim
  return String(Math.round(n * 100) / 100);
}

/* ============================================================
   Rendering
   ============================================================ */
const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const tabs = document.getElementById("tabs");
const vibes = document.getElementById("vibes");

function renderVibes() {
  const counts = {
    all: recipes.length,
    made: recipes.filter((r) => r.made).length,
    totry: recipes.filter((r) => !r.made).length,
    fav: recipes.filter((r) => r.fav).length,
  };
  vibes.innerHTML = VIBES.map((v) => {
    const active = activeVibe === v.value ? " active" : "";
    return `<button class="vibe-chip${active}" data-vibe="${v.value}">
      <span class="t-emoji">${v.emoji}</span><span class="t-label">${v.label}</span><span class="count">${counts[v.value]}</span>
    </button>`;
  }).join("");
}

function renderTabs() {
  const counts = { all: recipes.length };
  for (const c of CATEGORIES) counts[c.value] = recipes.filter((r) => r.category === c.value).length;

  const items = [{ value: "all", label: "All recipes", emoji: "📖" }, ...CATEGORIES];
  tabs.innerHTML = items.map((c) => {
    const n = counts[c.value] || 0;
    const active = activeCategory === c.value ? " active" : "";
    return `<button class="tab${active}" data-cat="${c.value}">
      <span class="t-emoji">${c.emoji}</span><span class="t-label">${c.label}</span><span class="count">${n}</span>
    </button>`;
  }).join("");
}

function filteredRecipes() {
  const t = searchTerm.trim().toLowerCase();
  return recipes.filter((r) => {
    if (activeCategory !== "all" && r.category !== activeCategory) return false;
    if (activeVibe === "made" && !r.made) return false;
    if (activeVibe === "totry" && r.made) return false;
    if (activeVibe === "fav" && !r.fav) return false;
    if (!t) return true;
    if (r.title.toLowerCase().includes(t)) return true;
    return (r.ingredients || []).some((i) => (i.name || "").toLowerCase().includes(t));
  });
}

function renderGrid() {
  const list = filteredRecipes();
  if (list.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    grid.innerHTML = list.map(cardHTML).join("");
  }
}

function cardHTML(r) {
  const info = catInfo(r.category);
  const thumb = r.image
    ? `<img src="${escapeAttr(r.image)}" alt="" onerror="this.remove()" />`
    : `<span>${info.emoji}</span>`;
  const time = r.time ? `<span>⏱️ ${escapeHtml(r.time)}</span>` : "";
  const sticker = r.made
    ? `<span class="status-sticker made">💖 tried &amp; true</span>`
    : `<span class="status-sticker totry">✨ on the list</span>`;
  return `<article class="card" data-id="${r.id}">
    <div class="card-thumb">
      ${thumb}
      <button class="fav-btn" data-fav title="${r.fav ? "Un-favorite" : "Favorite!"}">${r.fav ? "❤️" : "🤍"}</button>
      ${sticker}
    </div>
    <div class="card-body">
      <span class="card-cat">${info.emoji} ${info.label}</span>
      <h3>${escapeHtml(r.title)}</h3>
      <div class="card-meta">
        <span>🍽️ ${r.servings} serving${r.servings == 1 ? "" : "s"}</span>
        ${time}
      </div>
    </div>
  </article>`;
}

function renderAll() {
  renderVibes();
  renderTabs();
  renderGrid();
}

/* ============================================================
   Confetti 🎉
   ============================================================ */
const CONFETTI_BITS = ["💖", "✨", "🍓", "🎀", "🌸", "💛", "⭐", "🧁"];
function confetti(n = 26) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "confetti-bit";
    s.textContent = CONFETTI_BITS[Math.floor(Math.random() * CONFETTI_BITS.length)];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDelay = Math.random() * 0.35 + "s";
    s.style.fontSize = 14 + Math.random() * 18 + "px";
    s.style.setProperty("--drift", Math.random() * 140 - 70 + "px");
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 2200);
  }
}

/* ============================================================
   Detail view
   ============================================================ */
const detailModal = document.getElementById("detailModal");
const detailContent = document.getElementById("detailContent");

function openDetail(id) {
  const r = recipes.find((x) => x.id === id);
  if (!r) return;
  currentDetail = r;
  currentServings = r.servings;
  renderDetail();
  showModal(detailModal);
}

function renderDetail() {
  const r = currentDetail;
  const info = catInfo(r.category);
  const factor = currentServings / r.servings;

  const hero = r.image
    ? `<img src="${escapeAttr(r.image)}" alt="" onerror="this.parentElement.innerHTML='<span>${info.emoji}</span>'" />`
    : `<span>${info.emoji}</span>`;

  const ingredientsHTML = (r.ingredients || []).map((i) => {
    const scaledQty = (Number(i.qty) || 0) * factor;
    const amt = scaledQty > 0 ? `<span class="amt">${prettyQty(scaledQty)} ${escapeHtml(i.unit || "")}</span>` : "";
    return `<li>${amt}<span>${escapeHtml(i.name)}</span></li>`;
  }).join("");

  const stepsHTML = (r.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  const scaledNote = currentServings !== r.servings
    ? `<span class="scaled-note">scaled from ${r.servings} ✨</span>` : "";

  const notesHTML = r.notes ? `<div class="detail-notes">📝 ${escapeHtml(r.notes)}</div>` : "";
  const timeHTML = r.time ? ` • ⏱️ ${escapeHtml(r.time)}` : "";

  detailContent.innerHTML = `
    <div class="detail-hero">${hero}</div>
    <div class="detail-cat">${info.emoji} ${info.label}</div>
    <h2 class="detail-title">${escapeHtml(r.title)}</h2>
    <div class="detail-meta">recipe makes ${r.servings} serving${r.servings == 1 ? "" : "s"}${timeHTML}</div>

    <div class="love-row">
      <button class="toggle-pill${r.made ? " on-made" : ""}" id="madeToggle">
        ${r.made ? "💖 we made this!" : "👩‍🍳 mark as made"}
      </button>
      <button class="toggle-pill${r.fav ? " on-fav" : ""}" id="favToggle">
        ${r.fav ? "⭐ a favorite!" : "☆ add to faves"}
      </button>
    </div>

    <div class="serving-bar">
      <span class="label">🍽️ serving size</span>
      <div class="stepper">
        <button type="button" id="servMinus" aria-label="Fewer">−</button>
        <span class="val" id="servVal">${currentServings}</span>
        <button type="button" id="servPlus" aria-label="More">＋</button>
      </div>
      ${scaledNote}
      <button class="btn btn-primary" id="shopBtn">🛒 shopping list</button>
    </div>

    ${notesHTML}

    <div class="detail-columns">
      <div class="detail-section">
        <h3>🧺 Ingredients</h3>
        <ul class="ingredients-ul">${ingredientsHTML || "<li>No ingredients listed</li>"}</ul>
      </div>
      <div class="detail-section">
        <h3>👩‍🍳 Steps</h3>
        <ol class="steps-ol">${stepsHTML || "<li>No steps listed</li>"}</ol>
      </div>
    </div>

    <div class="detail-footer-actions">
      <button class="btn btn-danger" id="deleteBtn">🗑️ delete</button>
      <button class="btn btn-soft" id="editBtn">✏️ edit</button>
    </div>
  `;

  document.getElementById("servMinus").onclick = () => { if (currentServings > 1) { currentServings--; renderDetail(); } };
  document.getElementById("servPlus").onclick = () => { currentServings++; renderDetail(); };
  document.getElementById("shopBtn").onclick = openShoppingList;
  document.getElementById("editBtn").onclick = () => { closeModal(detailModal); openForm(r.id); };
  document.getElementById("deleteBtn").onclick = () => deleteRecipe(r.id);

  document.getElementById("madeToggle").onclick = () => {
    r.made = !r.made;
    touch(r);
    save();
    renderAll();
    renderDetail();
    if (r.made) { confetti(30); toast("yayyy, chef!! 💖👩‍🍳"); }
  };
  document.getElementById("favToggle").onclick = () => {
    r.fav = !r.fav;
    touch(r);
    save();
    renderAll();
    renderDetail();
    if (r.fav) toast("added to faves ⭐");
  };
}

function deleteRecipe(id) {
  const r = recipes.find((x) => x.id === id);
  if (!confirm(`Delete "${r ? r.title : "this recipe"}"? This can't be undone.`)) return;
  recipes = recipes.filter((x) => x.id !== id);
  const tomb = loadTomb();
  tomb[id] = Date.now();
  saveTomb(tomb);
  save();
  closeModal(detailModal);
  renderAll();
  toast("recipe deleted 🥀");
}

/* ============================================================
   Surprise picker 🎲
   ============================================================ */
document.getElementById("surpriseBtn").onclick = () => {
  let pool = filteredRecipes();
  if (pool.length === 0) pool = recipes;
  if (pool.length === 0) { toast("add a recipe first, cutie! 🥺"); return; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  confetti(14);
  setDrawer(false);
  openDetail(pick.id);
  toast(`🎲 fate says: ${pick.title}!`);
};

/* ============================================================
   Shopping list
   ============================================================ */
const shoppingModal = document.getElementById("shoppingModal");

function openShoppingList() {
  const r = currentDetail;
  const factor = currentServings / r.servings;
  const items = (r.ingredients || []).filter((i) => (i.name || "").trim() !== "");

  document.getElementById("shoppingSub").textContent =
    `${r.title} — for ${currentServings} serving${currentServings == 1 ? "" : "s"}`;

  document.getElementById("shoppingList").innerHTML = items.map((i, idx) => {
    const scaledQty = (Number(i.qty) || 0) * factor;
    const amt = scaledQty > 0 ? `${prettyQty(scaledQty)} ${escapeHtml(i.unit || "")} ` : "";
    return `<li data-idx="${idx}">
      <input type="checkbox" id="chk${idx}" />
      <label for="chk${idx}"><span><strong>${amt}</strong>${escapeHtml(i.name)}</span></label>
    </li>`;
  }).join("");

  // toggle strike-through
  shoppingModal.querySelectorAll(".shopping-list input").forEach((box) => {
    box.onchange = () => box.closest("li").classList.toggle("checked", box.checked);
  });

  showModal(shoppingModal);
}

function shoppingListText() {
  const r = currentDetail;
  const factor = currentServings / r.servings;
  const lines = (r.ingredients || [])
    .filter((i) => (i.name || "").trim() !== "")
    .map((i) => {
      const scaledQty = (Number(i.qty) || 0) * factor;
      const amt = scaledQty > 0 ? `${prettyQty(scaledQty)} ${i.unit || ""} `.trim() + " " : "";
      return `- ${amt}${i.name}`;
    });
  return `Shopping list — ${r.title} (${currentServings} servings)\n\n${lines.join("\n")}`;
}

document.getElementById("copyListBtn").onclick = async () => {
  try {
    await navigator.clipboard.writeText(shoppingListText());
    toast("shopping list copied 📋💕");
  } catch (e) {
    toast("couldn't copy — try selecting the text");
  }
};
document.getElementById("printListBtn").onclick = () => window.print();

/* ============================================================
   Add / Edit form
   ============================================================ */
const formModal = document.getElementById("formModal");
const recipeForm = document.getElementById("recipeForm");
const ingredientList = document.getElementById("ingredientList");
const stepList = document.getElementById("stepList");
const categorySelect = document.getElementById("categorySelect");

// populate category dropdown
categorySelect.innerHTML = CATEGORIES.map((c) => `<option value="${c.value}">${c.emoji} ${c.label}</option>`).join("");

function ingredientRow(data = { qty: "", unit: "", name: "" }) {
  const div = document.createElement("div");
  div.className = "ing-row";
  div.innerHTML = `
    <input class="ing-qty" type="text" inputmode="decimal" placeholder="amt" value="${escapeAttr(data.qty === 0 ? "" : data.qty ?? "")}" />
    <input class="ing-unit" type="text" placeholder="unit" value="${escapeAttr(data.unit ?? "")}" />
    <input class="ing-name" type="text" placeholder="ingredient" value="${escapeAttr(data.name ?? "")}" />
    <button type="button" class="row-del" title="Remove">✕</button>`;
  div.querySelector(".row-del").onclick = () => div.remove();
  return div;
}

function stepRow(text = "") {
  const div = document.createElement("div");
  div.className = "step-row";
  div.innerHTML = `
    <span class="step-num"></span>
    <textarea class="step-text" rows="1" placeholder="describe this step…">${escapeHtml(text)}</textarea>
    <button type="button" class="row-del" title="Remove">✕</button>`;
  div.querySelector(".row-del").onclick = () => { div.remove(); renumberSteps(); };
  return div;
}

function renumberSteps() {
  [...stepList.querySelectorAll(".step-num")].forEach((el, i) => (el.textContent = i + 1));
}

function openForm(id = null) {
  editingId = id;
  recipeForm.reset();
  ingredientList.innerHTML = "";
  stepList.innerHTML = "";

  if (id) {
    const r = recipes.find((x) => x.id === id);
    document.getElementById("formTitle").textContent = "Edit Recipe ✏️";
    recipeForm.title.value = r.title;
    recipeForm.category.value = r.category;
    recipeForm.servings.value = r.servings;
    recipeForm.time.value = r.time || "";
    recipeForm.image.value = r.image || "";
    recipeForm.notes.value = r.notes || "";
    recipeForm.made.checked = !!r.made;
    (r.ingredients || []).forEach((i) => ingredientList.appendChild(ingredientRow(i)));
    (r.steps || []).forEach((s) => stepList.appendChild(stepRow(s)));
  } else {
    document.getElementById("formTitle").textContent = "Add a Recipe 🧁";
    ingredientList.appendChild(ingredientRow());
    ingredientList.appendChild(ingredientRow());
    stepList.appendChild(stepRow());
  }
  renumberSteps();
  showModal(formModal);
  recipeForm.title.focus();
}

recipeForm.onsubmit = (e) => {
  e.preventDefault();
  const fd = new FormData(recipeForm);

  const ingredients = [...ingredientList.querySelectorAll(".ing-row")].map((row) => ({
    qty: parseQty(row.querySelector(".ing-qty").value),
    unit: row.querySelector(".ing-unit").value.trim(),
    name: row.querySelector(".ing-name").value.trim(),
  })).filter((i) => i.name !== "");

  const steps = [...stepList.querySelectorAll(".step-text")]
    .map((t) => t.value.trim())
    .filter((t) => t !== "");

  const data = {
    title: fd.get("title").trim(),
    category: fd.get("category"),
    servings: Math.max(1, parseInt(fd.get("servings"), 10) || 1),
    time: fd.get("time").trim(),
    image: fd.get("image").trim(),
    notes: fd.get("notes").trim(),
    made: fd.get("made") === "on",
    ingredients,
    steps,
    updatedAt: Date.now(),
    dirty: true,
  };

  if (editingId) {
    const idx = recipes.findIndex((x) => x.id === editingId);
    recipes[idx] = { ...recipes[idx], ...data };
    toast("recipe updated ✨");
  } else {
    recipes.unshift({ id: uid(), fav: false, ...data });
    confetti(20);
    toast("recipe saved 💌");
  }
  save();
  renderAll();
  closeModal(formModal);
};

// "amount" field can hold fractions like "1/2" or "1 1/2"
function parseQty(str) {
  str = (str || "").trim();
  if (str === "") return 0;
  // mixed number "1 1/2"
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  // simple fraction "1/2"
  const frac = str.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = parseFloat(str.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.onclick = () => {
    if (btn.dataset.add === "ingredient") {
      ingredientList.appendChild(ingredientRow());
    } else {
      stepList.appendChild(stepRow());
      renumberSteps();
    }
  };
});

/* ============================================================
   Export / Import
   ============================================================ */
document.getElementById("exportBtn").onclick = () => {
  const clean = recipes.map(({ dirty, ...rest }) => rest); // internal flag stays home
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `melissas-cookbook-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toggleMenu(false);
  toast("backup downloaded ⬇️💕");
};

document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("bad format");
      // merge, skipping exact-id duplicates; give new ids to anything missing one
      const existingIds = new Set(recipes.map((r) => r.id));
      let added = 0;
      for (const r of imported) {
        if (!r || !r.title) continue;
        if (!r.id || existingIds.has(r.id)) r.id = uid();
        existingIds.add(r.id);
        recipes.unshift({ made: false, fav: false, ...r, updatedAt: Date.now(), dirty: true });
        added++;
      }
      save();
      renderAll();
      toggleMenu(false);
      toast(`imported ${added} recipe${added === 1 ? "" : "s"} 📥`);
    } catch (err) {
      toast("that file didn't look like a cookbook backup 🥺");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
};

/* ============================================================
   Modal + misc helpers
   ============================================================ */
function showModal(m) { m.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(m) { m.classList.add("hidden"); document.body.style.overflow = ""; }

document.querySelectorAll(".modal").forEach((m) => {
  m.querySelectorAll("[data-close]").forEach((el) => (el.onclick = () => closeModal(m)));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal:not(.hidden)").forEach(closeModal);
});

// grid click -> fav heart or open detail
grid.addEventListener("click", (e) => {
  const favBtn = e.target.closest(".fav-btn");
  if (favBtn) {
    const card = favBtn.closest(".card");
    const r = recipes.find((x) => x.id === card.dataset.id);
    if (r) {
      r.fav = !r.fav;
      touch(r);
      save();
      renderAll();
      if (r.fav) toast("added to faves ⭐");
    }
    return;
  }
  const card = e.target.closest(".card");
  if (card) openDetail(card.dataset.id);
});

// tabs (chapters)
tabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  activeCategory = tab.dataset.cat;
  renderAll();
  setDrawer(false);
});

// vibe chips (show me…)
vibes.addEventListener("click", (e) => {
  const chip = e.target.closest(".vibe-chip");
  if (!chip) return;
  activeVibe = chip.dataset.vibe;
  renderAll();
  setDrawer(false);
});

// mobile chapters drawer
const sidebar = document.getElementById("sidebar");
const drawerBackdrop = document.getElementById("drawerBackdrop");
function setDrawer(open) {
  sidebar.classList.toggle("open", open);
  drawerBackdrop.classList.toggle("hidden", !open);
}
document.getElementById("drawerBtn").onclick = () => setDrawer(true);
drawerBackdrop.onclick = () => setDrawer(false);

// search
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderGrid();
});

// add button
document.getElementById("addBtn").onclick = () => openForm();

// overflow menu
const menu = document.getElementById("menu");
function toggleMenu(force) {
  const show = force !== undefined ? force : menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !show);
}
document.getElementById("menuBtn").onclick = (e) => { e.stopPropagation(); toggleMenu(); };
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-wrap")) toggleMenu(false);
});

// toast
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* escaping */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function escapeAttr(str) { return escapeHtml(str); }

/* ---------- Auto-grow step textareas ---------- */
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("step-text")) {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }
});

/* ---------- Go ---------- */
save(); // persist migrated fields right away
renderAll();
syncFromPublished(); // then blend in the shared published cookbook
