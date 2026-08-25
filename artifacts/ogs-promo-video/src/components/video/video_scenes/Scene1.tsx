import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      {...sceneTransitions.zoomThrough}
    >
      <motion.div
        className="w-32 h-32 mb-8 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-accent/20"
        initial={{ opacity: 0, scale: 0, rotate: -15 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0, rotate: -15 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <img src={`${import.meta.env.BASE_URL}ogs_logo.png`} alt="OGS Logo" className="w-24 h-24 object-contain" />
      </motion.div>

      <div className="text-center overflow-hidden">
        <motion.h2
          className="text-[2vw] font-medium text-accent tracking-widest uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          Okrika Grammar School
        </motion.h2>
        
        <motion.h1
          className="text-[6vw] font-black text-text-primary leading-none"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 50, rotateX: 45 }}
          animate={phase >= 3 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: 45 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          EMPOWERING<br/>EDUCATION
        </motion.h1>
      </div>

      <motion.div
        className="absolute bottom-16 h-1 bg-accent rounded-full"
        initial={{ width: 0, opacity: 0 }}
        animate={phase >= 4 ? { width: '20vw', opacity: 1 } : { width: 0, opacity: 0 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}