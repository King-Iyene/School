import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions } from '@/lib/video/animations';
import { ClipboardCheck, FileText, CalendarCheck } from 'lucide-react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1000),
      setTimeout(() => setPhase(4), 1400),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const features = [
    { icon: ClipboardCheck, title: 'Smart Attendance', desc: 'Real-time tracking & alerts' },
    { icon: FileText, title: 'Grade Management', desc: 'Automated report cards' },
    { icon: CalendarCheck, title: 'Exam Scheduling', desc: 'Seamless timetables' },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      {...sceneTransitions.slideUp}
    >
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: -30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-[4vw] font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
          ACADEMIC <span className="text-accent">EXCELLENCE</span>
        </h1>
      </motion.div>

      <div className="flex space-x-12 w-full max-w-[80vw] mx-auto justify-center">
        {features.map((feat, i) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={feat.title}
              className="flex-1 bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-8 text-center relative overflow-hidden group"
              initial={{ opacity: 0, y: 50, rotateX: 20 }}
              animate={phase >= i + 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: 20 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
              <div className="w-20 h-20 mx-auto bg-accent/20 text-accent rounded-2xl flex items-center justify-center mb-6">
                <Icon size={40} />
              </div>
              <h3 className="text-[1.8vw] font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>{feat.title}</h3>
              <p className="text-[1.2vw] text-text-secondary">{feat.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}