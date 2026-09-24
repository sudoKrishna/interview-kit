import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { config } from "./config";
import authRoutes from "./routes/auth";
import kitRoutes from "./routes/kits";
import { errorHandler } from "./middleware/errorHandler";

async function main() {
  await mongoose.connect(config.mongoUri);

  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" })); 
  app.use(
    session({
      name: "prepkit.sid",
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: config.mongoUri, collectionName: "sessions" }),
      cookie: {
        httpOnly: true,
        sameSite: config.isProd ? "none" : "lax",
        secure: config.isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/kits", kitRoutes);
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`API listening on :${config.port}`);
  });
}

main().catch((e) => {
  console.error("Failed to start API", e);
  process.exit(1);
});
