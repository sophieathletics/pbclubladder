import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import router from "./routes";
import paymentsRouter from "./routes/payments";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop so express-rate-limit and req.ip see the real client IP
// (Replit deployments sit behind a reverse proxy).
app.set("trust proxy", 1);

const PROD_ORIGIN = "https://pbclubladder.com";
const allowedOrigins = new Set<string>([
  PROD_ORIGIN,
  "https://www.pbclubladder.com",
]);

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Allow same-origin / server-to-server / curl (no Origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    // In non-production, allow Replit preview/dev domains so we can iterate.
    if (process.env.NODE_ENV !== "production") {
      if (
        origin.endsWith(".replit.dev") ||
        origin.endsWith(".replit.app") ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1")
      ) {
        return cb(null, true);
      }
    }
    cb(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
};

// Strict per-IP rate limits on auth endpoints to make brute-forcing impractical.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));

// Stripe webhook needs the raw body — mount it BEFORE express.json().
// The route itself uses express.raw() and is exposed at /api/payments/webhook.
app.use("/api", paymentsRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate-limit the brute-forceable auth endpoints.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);

app.use("/api", router);

export default app;
