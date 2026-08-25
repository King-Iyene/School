import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      {...sceneTransitions.morphExpand}
    >
      <motion.div
        className="flex items-center justify-center space-x-12 mb-12"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="w-40 h-40 bg-white rounded-2xl flex items-center justify-center shadow-2xl p-4">
           <img src={`${import.meta.env.BASE_URL}ogs_logo.png`} alt="OGS" className="w-full h-full object-contain" />
        </div>
        <div className="h-16 w-px bg-white/20"></div>
        <div className="w-40 h-40 bg-white rounded-2xl flex items-center justify-center shadow-2xl p-4">
           <img src={`${import.meta.env.BASE_URL}diocese_logo.jpg`} alt="Diocese" className="w-full h-full object-contain" />
        </div>
      </motion.div>

      <motion.h1
        className="text-[4vw] font-black text-white text-center mb-6"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        OKRIKA GRAMMAR SCHOOL
      </motion.h1>
      
      <motion.div
        className="bg-accent text-primary px-8 py-3 rounded-full font-bold text-[1.5vw] tracking-wider uppercase"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        Portal Now Live
      </motion.div>
    </motion.div>
  );
}