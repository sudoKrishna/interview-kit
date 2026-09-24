import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Valid email required." } });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters." } });
    }
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "An account with this email already exists." } });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: cleanEmail, passwordHash });
    req.session.userId = String(user._id);
    req.session.userEmail = user.email;
    res.status(201).json({ user: { id: String(user._id), email: user.email } });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const user = await User.findOne({ email: String(email ?? "").trim().toLowerCase() });
    if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: { code: "BAD_CREDENTIALS", message: "Email or password is incorrect." } });
    }
    req.session.userId = String(user._id);
    req.session.userEmail = user.email;
    res.json({ user: { id: String(user._id), email: user.email } });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("prepkit.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ user: null });
  res.json({ user: { id: req.session.userId, email: req.session.userEmail } });
});

export default router;
