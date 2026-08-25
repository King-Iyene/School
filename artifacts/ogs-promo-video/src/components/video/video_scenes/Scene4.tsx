import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { CreditCard, Bus, Bed } from 'lucide-react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 700),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const modules = [
    { icon: CreditCard, label: "Fee Management" },
    { icon: Bus, label: "Transport" },
    { icon: Bed, label: "Dormitory" }
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center z-10 px-[10vw]"
      {...sceneTransitions.splitHorizontal}
    >
      <div className="w-1/2 relative h-full flex flex-col justify-center">
        <motion.div
          className="absolute left-[-20%] top-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full border border-accent/20"
          initial={{ scale: 0, rotate: 0 }}
          animate={phase >= 1 ? { scale: 1, rotate: 90 } : { scale: 0, rotate: 0 }}
          transition={{ duration: 2, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute left-[-10%] top-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full border border-accent/40"
          initial={{ scale: 0, rotate: 0 }}
          animate={phase >= 1 ? { scale: 1, rotate: -90 } : { scale: 0, rotate: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        
        <div className="z-10 pl-8">
          <motion.h1
            className="text-[4.5vw] font-black text-white leading-tight mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ opacity: 0, x: -50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
          >
            BEYOND THE<br/>CLASSROOM
          </motion.h1>
          <motion.p
            className="text-[1.5vw] text-text-secondary"
            initial={{ opacity: 0 }}
            animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Streamlined operations for a seamless educational experience.
          </motion.p>
        </div>
      </div>

      <div className="w-1/2 flex flex-col justify-center space-y-6 pl-16">
        {modules.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <motion.div
              key={mod.label}
              className="bg-white/5 backdrop-blur-sm border-l-4 border-accent p-6 flex items-center space-x-6"
              initial={{ opacity: 0, x: 100 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.15 }}
            >
              <Icon size={36} className="text-accent" />
              <span className="text-[2.2vw] font-bold text-white tracking-wide">{mod.label}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}