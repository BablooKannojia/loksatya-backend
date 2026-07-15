// src/utils/helpers.js
export const getAbsoluteUrl = (path, base = "https://loksatya.com") => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

export const stripHtml = (html = "") =>
  html.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, " ").trim();

export const escapeHtml = (s = "") =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;")
   .replace(/'/g, "&#039;");
