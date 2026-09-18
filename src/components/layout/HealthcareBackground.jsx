import React from 'react';

/**
 * HealthcareBackground
 * Ambient, moving healthcare-themed background with theme-aware gradient orbs.
 * GPU-accelerated CSS animations, pointer-events-none, -z-10, respects reduced motion.
 */
export default function HealthcareBackground() {
  return (
    <div
      aria-hidden="true"
      className="healthcare-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none motion-reduce:hidden"
    >
      {/* Light theme ambient orbs */}
      <div className="dark:hidden absolute inset-0">
        {/* Soft Sky / Cyan Orb */}
        <div
          className="absolute -top-[12%] -right-[8%] w-[520px] h-[520px] rounded-full bg-sky-200/35 filter blur-[100px] animate-float-1"
          style={{ willChange: 'transform' }}
        />
        {/* Soft Mint / Emerald Orb */}
        <div
          className="absolute top-[45%] -left-[10%] w-[580px] h-[580px] rounded-full bg-emerald-100/30 filter blur-[110px] animate-float-2"
          style={{ willChange: 'transform' }}
        />
        {/* Soft Warm Indigo / Cyan Accent Orb */}
        <div
          className="absolute -bottom-[15%] right-[15%] w-[480px] h-[480px] rounded-full bg-blue-100/40 filter blur-[95px] animate-float-3"
          style={{ willChange: 'transform' }}
        />
        {/* Delicate Medical Cross / Dot Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(#0284c7 0.75px, transparent 0.75px), radial-gradient(#0284c7 0.75px, transparent 0.75px)`,
            backgroundSize: '32px 32px',
            backgroundPosition: '0 0, 16px 16px',
          }}
        />
      </div>

      {/* Dark theme ambient orbs: Rich Burgundy / Crimson / Deep Midnight Navy */}
      <div className="hidden dark:block absolute inset-0">
        {/* Deep Crimson / Burgundy Orb */}
        <div
          className="absolute -top-[15%] -right-[10%] w-[600px] h-[600px] rounded-full bg-rose-950/40 filter blur-[120px] animate-float-1"
          style={{ willChange: 'transform' }}
        />
        {/* Midnight Cyan / Deep Blue Orb */}
        <div
          className="absolute top-[40%] -left-[12%] w-[540px] h-[540px] rounded-full bg-sky-950/35 filter blur-[115px] animate-float-2"
          style={{ willChange: 'transform' }}
        />
        {/* Deep Wine / Plum Orb */}
        <div
          className="absolute -bottom-[15%] right-[20%] w-[500px] h-[500px] rounded-full bg-fuchsia-950/30 filter blur-[105px] animate-float-3"
          style={{ willChange: 'transform' }}
        />
        {/* Subtle Dark Grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 0.75px, transparent 0.75px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>
    </div>
  );
}
