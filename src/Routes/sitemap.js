import express from "express";
import { Article } from "../Models/ArticleSchema.js"; // ✅ FIXED IMPORT

const router = express.Router();
const SITE_URL = "https://loksatya.com";

router.get("/sitemap.xml", async (req, res) => {
  try {
    const articles = await Article.find({
      status: { $in: ["online", "published"] },
      slug: { $exists: true, $ne: "" }
    })
      .select("slug _id updatedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const urls = articles.map(a => `
      <url>
        <loc>${SITE_URL}/details/${a.slug}?id=${a._id}</loc>
        <lastmod>${(a.updatedAt || a.createdAt).toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
      </url>
    `).join("");

    res.setHeader("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${urls}
</urlset>`);
  } catch (e) {
    res.status(500).send("Sitemap error");
  }
});

router.get("/article-count", async (req, res) => {
  const total = await Article.countDocuments();
  const published = await Article.countDocuments({
    status: { $in: ["online", "published"] },
    approved: true
  });

  res.json({ total, published });
});

router.get("/status-check", async (req, res) => {
  const statuses = await Article.distinct("status");
  const approvedValues = await Article.distinct("approved");

  res.json({ statuses, approvedValues });
});

export default router;