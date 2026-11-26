import React from 'react';
import { motion } from 'framer-motion';

const FADE = { duration: 0.2, ease: 'easeOut' };

/** Entrada suave (fade + 6px). Respeta prefers-reduced-motion vía <MotionConfig reducedMotion="user">. */
const Reveal = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...FADE, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export default Reveal;
