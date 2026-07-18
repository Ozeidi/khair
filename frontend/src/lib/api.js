import axios from "axios";

// Session-cookie + CSRF auth (DECISIONS §8). No tokens in localStorage.
function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const token = getCookie("csrftoken");
    if (token) config.headers["X-CSRFToken"] = token;
  }
  return config;
});

// Normalize the API error envelope { error: { code, message, fields } }.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error.response?.data?.error;
    if (payload) {
      error.apiMessage = payload.message;
      error.apiCode = payload.code;
      error.apiFields = payload.fields;
    }
    return Promise.reject(error);
  }
);

// Bootstrap CSRF cookie once at app start.
export async function ensureCsrf() {
  try {
    await api.get("/auth/csrf/");
  } catch (e) {
    /* non-fatal */
  }
}

export default api;
