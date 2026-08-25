import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { Users, UserCircle, BookOpen, GraduationCap } from 'lucide-react';

const roles = [
  { icon: Users, label: "Admin", color: "#3B82F6" },
  { icon: BookOpen, label: "Teacher", color: "#10B981" },
  { icon: GraduationCap, label: "Student", color: "#F59E0B" },
  { icon: UserCircle, label: "Parent", color: "#8B5CF6" }
];

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10 px-[10vw]"
      {...sceneTransitions.clipPolygon}
    >
      <div className="w-1/3 text-left">
        <motion.div
          className="w-16 h-1 bg-accent mb-6"
          initial={{ width: 0 }}
          animate={phase >= 1 ? { width: 64 } : { width: 0 }}
          transition={{ duration: 0.6 }}
        />
        <motion.h1
          className="text-[5vw] font-black text-text-primary leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6 }}
        >
          CONNECTING<br/><span className="text-accent">EVERYONE</span>
        </motion.h1>
        <motion.p
          className="text-[1.5vw] text-text-secondary"
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Dedicated portals tailored for every role in the school ecosystem.
        </motion.p>
      </div>

      <div className="w-2/3 grid grid-cols-2 gap-8 pl-12">
        {roles.map((role, i) => {
          const Icon = role.icon;
          return (
            <motion.div
              key={role.label}
              className="bg-secondary/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 flex items-center space-x-6"
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 30 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: phase >= 2 ? i * 0.15 : 0
              }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${role.color}20`, color: role.color }}
              >
                <Icon size={32} />
              </div>
              <span className="text-[2vw] font-bold text-white tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                {role.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}