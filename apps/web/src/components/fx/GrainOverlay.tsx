
export default function GrainOverlay() {
  return (
    <>
      {/* animated grain via SVG turbulence */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          animation: "grain 0.8s steps(4) infinite",
        }}
      />
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[59]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <style>{`
        @keyframes grain {
          0%{transform:translate(0,0)} 25%{transform:translate(-2%,3%)}
          50%{transform:translate(3%,-2%)} 75%{transform:translate(-3%,-3%)}
          100%{transform:translate(2%,2%)}
        }
      `}</style>
    </>
  );
}
