"use strict";

const Api = (() => {
  const BASE = "/api";
  const TOKEN_KEY = "wildlife_explorer_token";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function request(path, { method = "GET", body, auth = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      // no JSON body
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  return {
    getToken,
    setToken,
    clearToken,

    // Auth
    register: (payload) => request("/auth/register", { method: "POST", body: payload }),
    login: (payload) => request("/auth/login", { method: "POST", body: payload }),
    me: () => request("/auth/me", { auth: true }),

    // Animals
    getAnimals: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return request(`/animals${qs ? `?${qs}` : ""}`);
    },
    getAnimalFacets: () => request("/animals/facets"),
    getAnimal: (id) => request(`/animals/${id}`),

    // Favorites
    getFavorites: () => request("/favorites", { auth: true }),
    addFavorite: (animalId) => request(`/favorites/${animalId}`, { method: "POST", auth: true }),
    removeFavorite: (animalId) => request(`/favorites/${animalId}`, { method: "DELETE", auth: true }),

    // Sightings
    getSightings: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
      return request(`/sightings${qs ? `?${qs}` : ""}`);
    },
    createSighting: (payload) => request("/sightings", { method: "POST", body: payload, auth: true }),
    deleteSighting: (id) => request(`/sightings/${id}`, { method: "DELETE", auth: true }),

    // Stats
    getStats: () => request("/stats"),
  };
})();
