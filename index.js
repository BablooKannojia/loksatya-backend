// index.js
import express from "express";
import dotenv from "dotenv";
import color from "colors";
import morgan from "morgan";
import cors from "cors";
import connectDB from "./src/Config/db.js";
import route from "./src/Routes/UserRoutes.js";
import startArticleScheduler from "./src/scheduler.js";
import { shareUrl } from "./src/Controllers/ArticleController.js";
import path from "path";
import { fileURLToPath } from "url";
import { redisClient } from './src/Config/redisClient.js';
import compression from "compression";
import sitemapRoute from "./src/Routes/sitemap.js"; // ✅ ADD THIS

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
dotenv.config();

connectDB();
const app = express();

app.use("/", sitemapRoute);

// ✅ CORS setup
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "https://loksatya.com",
      "https://www.loksatya.com",
      "https://admin.loksatya.com",
      "http://localhost:3000",   // 👈 add local frontend port
      "http://localhost:5000", 
    ];
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      process.env.ENV === "development"
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "userId"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress responses larger than 1KB
}));

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  next();
});


// Middleware
// app.use(cors({
//   origin: ['https://loksatya.com', 'https://admin.loksatya.com'],
//   credentials: true
// }));
app.use(express.json());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
if (process.env.ENV === "development") app.use(morgan("dev"));


// Initialize Redis connection when server starts
const initializeRedis = async () => {
  await redisClient.connect();
};

initializeRedis().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (redisClient.client) {
    await redisClient.client.quit();
  }
  process.exit(0);
});

// API routes
app.use("/api", route);

// Scheduler
startArticleScheduler();

// Health & root
app.get("/", (req, res) => {
  res.send(
    `${process.env.APP_NAME || "Test APP"} API is Working on ${
      process.env.ENV
    }.....`
  );
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// ✅ CRITICAL: put shareUrl route BEFORE static serving
app.get("/details/:slug", shareUrl);

// Serve React build
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS policy: Request not allowed" });
  }
  res.status(500).json({
    error: "Something broke!",
    message: err.message,
    stack: process.env.ENV === "development" ? err.stack : undefined,
  });
});

// Start
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`.white.bgYellow.bold);
});
