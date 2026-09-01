/** Ambient animated gradient blobs used behind dark brand-ink sections (Landing, Onboarding, SaaS Admin). */
export default function GlowBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 -left-24 w-[36rem] h-[36rem] rounded-full bg-brand-violet/25 blur-[100px] animate-brand-float" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-brand-mint/20 blur-[100px] animate-brand-float-slow" />
      <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-brand-indigo/40 blur-[100px] animate-brand-float" />
    </div>
  );
}
