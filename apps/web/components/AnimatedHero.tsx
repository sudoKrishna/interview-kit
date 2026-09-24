"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

export default function AnimatedHero() {
  const ref = useRef<HTMLElement>(null);
  const cursorX = useMotionValue(50);
  const cursorY = useMotionValue(50);
  const smoothX = useSpring(cursorX, { stiffness: 90, damping: 22, mass: 0.35 });
  const smoothY = useSpring(cursorY, { stiffness: 90, damping: 22, mass: 0.35 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const frameOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    cursorX.set(((event.clientX - bounds.left) / bounds.width) * 100);
    cursorY.set(((event.clientY - bounds.top) / bounds.height) * 100);
  }

  return (
    <section ref={ref} className="motion-hero" onPointerMove={trackPointer} onPointerLeave={() => { cursorX.set(50); cursorY.set(50); }}>
      <div className="motion-hero-lines" />
      <motion.div className="motion-hero-reveal" style={{ left: useTransform(smoothX, (value) => `${value}%`), top: useTransform(smoothY, (value) => `${value}%`) }}>
        <div className="reveal-art reveal-art-one"><span>01</span><strong>ROLE<br />SIGNALS</strong></div>
        <div className="reveal-art reveal-art-two"><span>02</span><strong>COMPANY<br />CONTEXT</strong></div>
        <div className="reveal-art reveal-art-three"><span>03</span><strong>THE<br />PLAN</strong></div>
      </motion.div>

      <div className="motion-hero-nav">
        <span className="dot-grid" aria-hidden><i /><i /><i /><i /></span>
        <span className="motion-location">PREP / INTERVIEW INTELLIGENCE</span>
        <a href="#new-kit" className="motion-menu">Start <span>↘</span></a>
      </div>

      <motion.div className="motion-hero-content" style={{ y: titleY }}>
        <motion.p className="motion-eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .15 }}>AI interview preparation / 2026</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, delay: .25, ease: [0.16, 1, 0.3, 1] }}>Prepare<br /><span>with intent.</span></motion.h1>
        <motion.p className="motion-subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .8, delay: .65 }}>Designing a better answer<br />before the question arrives.</motion.p>
      </motion.div>

      <motion.div className="motion-side-note" style={{ opacity: frameOpacity }}>Move your cursor<br />to explore</motion.div>
      <motion.div className="motion-frame-word motion-frame-left" style={{ opacity: frameOpacity }}>ready</motion.div>
      <motion.div className="motion-frame-word motion-frame-right" style={{ opacity: frameOpacity }}>steady</motion.div>
      <motion.div className="motion-scroll-cue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}><span /> scroll to begin</motion.div>
    </section>
  );
}
