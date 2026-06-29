import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import feedV1Router from "./routes/feedV1";
import cedulaV1Router from "./routes/cedulaV1";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the reverse proxy (nginx) so req.ip and rate limiting key off the
// real client IP (X-Forwarded-For) instead of the proxy's address.
app.set("trust proxy", 1);

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Java backend proxy ────────────────────────────────────────────────────────
// Forwards /api/v1/* requests to the Java Spring backend.
// This lets the browser call /api/v1/... as same-origin instead of cross-origin.
const JAVA_BACKEND = (process.env.JAVA_BACKEND_URL ?? "https://heart.encuentrove.online").replace(/\/$/, "");

// Servido desde el snapshot en memoria del poller en vez de reenviarse al
// backend Java — ver routes/feedV1.ts. Tiene que registrarse antes del
// passthrough generico de abajo para interceptar esta ruta especifica.
app.use("/api/v1", feedV1Router);

// Enmascara telefonoRef/usuario.telefono antes de relayar — ver routes/cedulaV1.ts.
app.use("/api/v1", cedulaV1Router);

app.use("/api/v1", async (req: Request, res: Response) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const targetUrl = `${JAVA_BACKEND}/api/v1${req.path}${qs}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const body = await upstream.text();
    res.status(upstream.status).set("Content-Type", contentType).send(body);
  } catch (err) {
    logger.error({ err, targetUrl }, "Java backend proxy error");
    res.status(502).json({ success: false, message: "Backend proxy error", data: [] });
  }
});

// ─── Local routes ──────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
