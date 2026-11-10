"use strict";

const state = {
  user: null,
  animals: [],       // currently displayed (filtered) explore results
  animalsById: new Map(), // lookup index, populated from every animal list we fetch
  facets: { categories: [], habitats: [], statuses: [] },
  favoriteIds: new Set(),
  sightings: { page: 0, pageSize: 15, total: 0, items: [] },
};

function indexAnimals(list) {
  list.forEach((a) => state.animalsById.set(a.id, a));
}

/* -------------------------------------------------------------- */
/* Helpers                                                         */
/* -------------------------------------------------------------- */
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDate(isoDateStr) {
  const d = new Date(isoDateStr);
  if (Number.isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 3200);
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* -------------------------------------------------------------- */
/* Navigation                                                      */
/* -------------------------------------------------------------- */
function goTo(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("view-active", v.id === viewId));
  document.querySelectorAll(".main-nav button").forEach((b) => b.classList.toggle("active", b.dataset.nav === viewId));
  document.getElementById("headerInner")?.classList.remove("menu-open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (viewId === "favorites") refreshFavoritesView();
  if (viewId === "sightings" && state.sightings.items.length === 0) loadSightings();
}

function setupNav() {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => goTo(el.dataset.nav));
  });

  const toggle = document.getElementById("navToggle");
  const headerInner = document.querySelector(".header-inner");
  headerInner.id = "headerInner";
  toggle.addEventListener("click", () => {
    const isOpen = headerInner.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

/* -------------------------------------------------------------- */
/* Auth                                                             */
/* -------------------------------------------------------------- */
function updateAuthUI() {
  const loggedIn = !!state.user;
  document.getElementById("loginBtn").classList.toggle("hidden", loggedIn);
  document.getElementById("registerBtn").classList.toggle("hidden", loggedIn);
  document.getElementById("userMenu").classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    document.getElementById("userGreeting").textContent = `Hi, ${state.user.username}`;
  }
  document.getElementById("sightingAuthNotice").classList.toggle("hidden", loggedIn);
  document.getElementById("sightingFields").querySelectorAll("input, select, textarea, button").forEach((el) => {
    el.disabled = !loggedIn;
  });
}

async function checkAuth() {
  if (!Api.getToken()) return;
  try {
    const { user } = await Api.me();
    state.user = user;
    updateAuthUI();
    await loadFavorites();
  } catch (err) {
    Api.clearToken();
  }
}

function openAuthModal(tab = "login") {
  document.getElementById("authModal").classList.remove("hidden");
  switchAuthTab(tab);
}
function closeAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
  document.getElementById("loginError").textContent = "";
  document.getElementById("registerError").textContent = "";
}

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
  document.getElementById("authModalTitle").textContent = tab === "login" ? "Welcome back" : "Join Wildlife Explorer";
}

function setupAuth() {
  document.getElementById("loginBtn").addEventListener("click", () => openAuthModal("login"));
  document.getElementById("registerBtn").addEventListener("click", () => openAuthModal("register"));
  document.getElementById("closeAuthModal").addEventListener("click", closeAuthModal);
  document.getElementById("authModal").addEventListener("click", (e) => {
    if (e.target.id === "authModal") closeAuthModal();
  });
  document.querySelectorAll(".auth-tab").forEach((t) => t.addEventListener("click", () => switchAuthTab(t.dataset.tab)));

  document.getElementById("sightingLoginLink")?.addEventListener("click", () => openAuthModal("login"));
  document.getElementById("favoritesLoginLink")?.addEventListener("click", () => openAuthModal("login"));

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const { token, user } = await Api.login({ email, password });
      Api.setToken(token);
      state.user = user;
      updateAuthUI();
      closeAuthModal();
      showToast(`Welcome back, ${user.username}.`);
      await loadFavorites();
      renderAnimalGrid("animalGrid", state.animals);
    } catch (err) {
      document.getElementById("loginError").textContent = err.message;
    }
  });

  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    try {
      const { token, user } = await Api.register({ username, email, password });
      Api.setToken(token);
      state.user = user;
      updateAuthUI();
      closeAuthModal();
      showToast(`Welcome to Wildlife Explorer, ${user.username}.`);
    } catch (err) {
      document.getElementById("registerError").textContent = err.message;
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Api.clearToken();
    state.user = null;
    state.favoriteIds = new Set();
    updateAuthUI();
    renderAnimalGrid("animalGrid", state.animals);
    showToast("Logged out.");
    goTo("home");
  });
}

/* -------------------------------------------------------------- */
/* Stats (home ledger)                                             */
/* -------------------------------------------------------------- */
async function loadStats() {
  try {
    const stats = await Api.getStats();
    document.getElementById("statAnimals").textContent = stats.totalAnimals;
    document.getElementById("statAtRisk").textContent = stats.atRisk;
    document.getElementById("statSightings").textContent = stats.totalSightings;
    document.getElementById("statExplorers").textContent = stats.totalExplorers;
  } catch (err) {
    // Non-critical; leave placeholders
  }
}

/* -------------------------------------------------------------- */
/* Animals: catalog, filters, cards, detail modal                  */
/* -------------------------------------------------------------- */
function animalCardHtml(animal) {
  const statusClass = `tag-status-${slugify(animal.conservation_status)}`;
  const isFav = state.favoriteIds.has(animal.id);
  return `
    <article class="animal-card" data-id="${animal.id}">
      <div class="card-top">
        <div class="card-icon">${animal.icon}</div>
        <div>
          <div class="card-title">${escapeHtml(animal.name)}</div>
          <div class="card-sci">${escapeHtml(animal.scientific_name)}</div>
        </div>
      </div>
      <p class="card-desc">${escapeHtml(animal.description)}</p>
      <div class="tag-row">
        <span class="tag">${escapeHtml(animal.habitat)}</span>
        <span class="tag ${statusClass}">${escapeHtml(animal.conservation_status)}</span>
      </div>
      <div class="card-actions">
        <button data-action="favorite" class="${isFav ? "is-favorited" : ""}">${isFav ? "★ Saved" : "☆ Save"}</button>
        <button data-action="log">+ Log sighting</button>
      </div>
    </article>
  `;
}

function renderAnimalGrid(containerId, animals) {
  const grid = document.getElementById(containerId);
  if (!animals.length) {
    grid.innerHTML = `<p class="empty-state">No species match those filters yet. Try widening your search.</p>`;
    return;
  }
  grid.innerHTML = animals.map(animalCardHtml).join("");
}

function attachGridDelegation(containerId) {
  document.getElementById(containerId).addEventListener("click", async (e) => {
    const card = e.target.closest(".animal-card");
    if (!card) return;
    const animalId = Number(card.dataset.id);
    const action = e.target.dataset.action;

    if (action === "favorite") {
      e.stopPropagation();
      await toggleFavorite(animalId);
      return;
    }
    if (action === "log") {
      e.stopPropagation();
      goTo("sightings");
      document.getElementById("sightingAnimal").value = String(animalId);
      return;
    }
    openAnimalModal(animalId);
  });
}

async function toggleFavorite(animalId) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  const isFav = state.favoriteIds.has(animalId);
  try {
    if (isFav) {
      await Api.removeFavorite(animalId);
      state.favoriteIds.delete(animalId);
      showToast("Removed from favorites.");
    } else {
      await Api.addFavorite(animalId);
      state.favoriteIds.add(animalId);
      showToast("Added to favorites.");
    }
    renderAnimalGrid("animalGrid", state.animals);
    if (document.getElementById("favorites").classList.contains("view-active")) refreshFavoritesView();
    refreshOpenModalFavoriteButton(animalId);
  } catch (err) {
    showToast(err.message, true);
  }
}

function refreshOpenModalFavoriteButton(animalId) {
  const btn = document.querySelector(`#animalModalBody [data-modal-fav="${animalId}"]`);
  if (!btn) return;
  const isFav = state.favoriteIds.has(animalId);
  btn.textContent = isFav ? "★ Saved to favorites" : "☆ Save to favorites";
  btn.classList.toggle("is-favorited", isFav);
}

function openAnimalModal(animalId) {
  const animal = state.animalsById.get(animalId);
  if (!animal) return;
  const isFav = state.favoriteIds.has(animalId);

  document.getElementById("animalModalBody").innerHTML = `
    <div class="animal-detail-header">
      <div class="animal-detail-icon">${animal.icon}</div>
      <div>
        <h3 id="animalModalName">${escapeHtml(animal.name)}</h3>
        <div class="card-sci">${escapeHtml(animal.scientific_name)}</div>
      </div>
    </div>
    <p class="detail-desc">${escapeHtml(animal.description)}</p>
    ${animal.fun_fact ? `<div class="fact-box">${escapeHtml(animal.fun_fact)}</div>` : ""}
    <dl class="detail-facts">
      <div><dt>Category</dt><dd>${escapeHtml(animal.category)}</dd></div>
      <div><dt>Habitat</dt><dd>${escapeHtml(animal.habitat)}</dd></div>
      <div><dt>Conservation status</dt><dd>${escapeHtml(animal.conservation_status)}</dd></div>
      <div><dt>Diet</dt><dd>${escapeHtml(animal.diet || "Unknown")}</dd></div>
      <div><dt>Lifespan</dt><dd>${escapeHtml(animal.lifespan || "Unknown")}</dd></div>
      <div><dt>Population</dt><dd>${escapeHtml(animal.population || "Unknown")}</dd></div>
    </dl>
    <div class="detail-actions">
      <button class="btn btn-outline ${isFav ? "is-favorited" : ""}" data-modal-fav="${animal.id}">${isFav ? "★ Saved to favorites" : "☆ Save to favorites"}</button>
      <button class="btn btn-primary" data-modal-log="${animal.id}">Log a sighting</button>
    </div>
  `;

  document.querySelector(`[data-modal-fav="${animal.id}"]`).addEventListener("click", () => toggleFavorite(animal.id));
  document.querySelector(`[data-modal-log="${animal.id}"]`).addEventListener("click", () => {
    closeAnimalModal();
    goTo("sightings");
    document.getElementById("sightingAnimal").value = String(animal.id);
  });

  document.getElementById("animalModal").classList.remove("hidden");
}
function closeAnimalModal() {
  document.getElementById("animalModal").classList.add("hidden");
}

async function loadFacets() {
  try {
    const facets = await Api.getAnimalFacets();
    state.facets = facets;
    const fill = (id, values) => {
      const select = document.getElementById(id);
      values.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });
    };
    fill("categoryFilter", facets.categories);
    fill("habitatFilter", facets.habitats);
    fill("statusFilter", facets.statuses);
  } catch (err) {
    showToast("Couldn't load filter options.", true);
  }
}

async function loadAnimals() {
  const params = {
    search: document.getElementById("searchInput").value.trim(),
    category: document.getElementById("categoryFilter").value,
    habitat: document.getElementById("habitatFilter").value,
    status: document.getElementById("statusFilter").value,
  };
  try {
    const { animals, count } = await Api.getAnimals(params);
    state.animals = animals;
    indexAnimals(animals);
    document.getElementById("resultsCount").textContent = `${count} species`;
    renderAnimalGrid("animalGrid", animals);
  } catch (err) {
    showToast("Couldn't load the catalog.", true);
  }
}

async function loadFullCatalogForSightingForm() {
  try {
    const { animals } = await Api.getAnimals({});
    indexAnimals(animals);
    populateSightingAnimalSelect(animals);
  } catch (err) {
    // Explore tab load will retry indexing; non-critical here.
  }
}

function setupFilters() {
  const debounced = debounce(loadAnimals, 250);
  document.getElementById("searchInput").addEventListener("input", debounced);
  ["categoryFilter", "habitatFilter", "statusFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("change", loadAnimals);
  });
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("searchInput").value = "";
    document.getElementById("categoryFilter").value = "";
    document.getElementById("habitatFilter").value = "";
    document.getElementById("statusFilter").value = "";
    loadAnimals();
  });
}

/* -------------------------------------------------------------- */
/* Favorites view                                                   */
/* -------------------------------------------------------------- */
async function loadFavorites() {
  if (!state.user) return;
  try {
    const { favorites } = await Api.getFavorites();
    state.favoriteIds = new Set(favorites.map((f) => f.id));
  } catch (err) {
    // ignore
  }
}

async function refreshFavoritesView() {
  const notice = document.getElementById("favoritesAuthNotice");
  const grid = document.getElementById("favoritesGrid");
  if (!state.user) {
    notice.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }
  notice.classList.add("hidden");
  try {
    const { favorites } = await Api.getFavorites();
    state.favoriteIds = new Set(favorites.map((f) => f.id));
    indexAnimals(favorites);
    if (!favorites.length) {
      grid.innerHTML = `<p class="empty-state">No favorites yet. Explore the catalog and tap ☆ Save on species you want to revisit.</p>`;
      return;
    }
    grid.innerHTML = favorites.map(animalCardHtml).join("");
  } catch (err) {
    showToast("Couldn't load favorites.", true);
  }
}

/* -------------------------------------------------------------- */
/* Sightings                                                        */
/* -------------------------------------------------------------- */
function populateSightingAnimalSelect(animals) {
  const select = document.getElementById("sightingAnimal");
  const current = select.value;
  select.innerHTML = animals
    .map((a) => `<option value="${a.id}">${escapeHtml(a.icon)} ${escapeHtml(a.name)}</option>`)
    .join("");
  if (current) select.value = current;
}

function sightingEntryHtml(s) {
  return `
    <article class="sighting-entry" data-id="${s.id}">
      <div class="sighting-icon">${s.animal_icon}</div>
      <div class="sighting-main">
        <div class="sighting-headline">${escapeHtml(s.animal_name)} — ${escapeHtml(s.location)}</div>
        <div class="sighting-meta">Seen ${formatDate(s.seen_on)} · logged by ${escapeHtml(s.username)}</div>
        ${s.notes ? `<p class="sighting-notes">${escapeHtml(s.notes)}</p>` : ""}
      </div>
      <div class="sighting-entry-actions">
        ${s.is_owner ? `<button data-action="delete-sighting">Delete</button>` : ""}
      </div>
    </article>
  `;
}

async function loadSightings(append = false) {
  const nextPage = append ? state.sightings.page + 1 : 1;
  try {
    const { sightings, total, page } = await Api.getSightings({ page: nextPage, pageSize: state.sightings.pageSize });
    state.sightings.page = page;
    state.sightings.total = total;
    state.sightings.items = append ? state.sightings.items.concat(sightings) : sightings;

    const feed = document.getElementById("sightingFeed");
    if (!state.sightings.items.length) {
      feed.innerHTML = `<p class="empty-state">No sightings logged yet. Be the first to add one.</p>`;
    } else {
      feed.innerHTML = state.sightings.items.map(sightingEntryHtml).join("");
    }

    const loadMoreBtn = document.getElementById("loadMoreSightings");
    const shown = state.sightings.items.length;
    loadMoreBtn.classList.toggle("hidden", shown >= total);
  } catch (err) {
    showToast("Couldn't load the sightings feed.", true);
  }
}

function setupSightingForm() {
  document.getElementById("sightingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.user) {
      openAuthModal("login");
      return;
    }
    const payload = {
      animal_id: Number(document.getElementById("sightingAnimal").value),
      location: document.getElementById("sightingLocation").value.trim(),
      seen_on: document.getElementById("sightingDate").value,
      notes: document.getElementById("sightingNotes").value.trim(),
    };
    try {
      await Api.createSighting(payload);
      document.getElementById("sightingLocation").value = "";
      document.getElementById("sightingNotes").value = "";
      document.getElementById("sightingError").textContent = "";
      showToast("Sighting logged.");
      await loadSightings(false);
      loadStats();
    } catch (err) {
      document.getElementById("sightingError").textContent = err.message;
    }
  });

  document.getElementById("loadMoreSightings").addEventListener("click", () => loadSightings(true));

  document.getElementById("sightingFeed").addEventListener("click", async (e) => {
    if (e.target.dataset.action !== "delete-sighting") return;
    const entry = e.target.closest(".sighting-entry");
    const id = entry.dataset.id;
    if (!confirm("Delete this sighting?")) return;
    try {
      await Api.deleteSighting(id);
      showToast("Sighting deleted.");
      await loadSightings(false);
      loadStats();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  const dateInput = document.getElementById("sightingDate");
  dateInput.max = new Date().toISOString().split("T")[0];
}

/* -------------------------------------------------------------- */
/* Modal chrome (shared)                                            */
/* -------------------------------------------------------------- */
function setupModals() {
  document.getElementById("closeAnimalModal").addEventListener("click", closeAnimalModal);
  document.getElementById("animalModal").addEventListener("click", (e) => {
    if (e.target.id === "animalModal") closeAnimalModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAnimalModal();
    closeAuthModal();
  });
}

/* -------------------------------------------------------------- */
/* Init                                                              */
/* -------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  setupNav();
  setupAuth();
  setupFilters();
  setupSightingForm();
  setupModals();
  attachGridDelegation("animalGrid");
  attachGridDelegation("favoritesGrid");

  updateAuthUI();
  loadStats();
  await loadFacets();
  await loadAnimals();
  await loadFullCatalogForSightingForm();
  await checkAuth();
});
