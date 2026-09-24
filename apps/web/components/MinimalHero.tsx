"use client";

import { motion } from "framer-motion";

export default function MinimalHero() {
  return (
    <section className="minimal-hero">
      <div className="minimal-hero-orb" aria-hidden />
      <div className="minimal-hero-inner">
        <motion.p className="minimal-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
          AI interview preparation
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .08, ease: [0.16, 1, 0.3, 1] }}>
          Prepare with clarity.
        </motion.h1>
        <motion.p className="minimal-hero-copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .2 }}>
          Turn any job description into a focused plan, thoughtful questions, and the confidence to do your best work.
        </motion.p>
        <motion.a className="minimal-hero-button" href="#new-kit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .32 }} whileHover={{ y: -2 }} whileTap={{ scale: .98 }}>
          Create a prep kit <span aria-hidden>↓</span>
        </motion.a>
      </div>
      <div className="minimal-hero-meta"><span>Built for your next conversation</span><span>Scroll to begin ↓</span></div>
    </section>
  );
}
