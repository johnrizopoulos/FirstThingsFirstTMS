export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-primary font-mono relative overflow-hidden flex flex-col items-center justify-center">
      {/* CRT Overlay */}
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      
      <div className="relative z-10 max-w-2xl mx-auto p-8 text-center">
        <div className="mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-4 h-4 bg-primary animate-blink" />
            <h1 className="text-4xl md:text-6xl font-bold tracking-widest">
              FIRST_THINGS_FIRST
            </h1>
          </div>
          <p className="text-lg opacity-70 mb-2">
            TASK MANAGEMENT SYSTEM // V.1.0
          </p>
          <p className="text-sm opacity-50">
            Bloomberg Terminal-inspired task prioritization
          </p>
        </div>

        <div className="border-4 border-primary p-8 mb-8 bg-card/50 relative">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />

          <h2 className="text-2xl font-bold mb-4">SYSTEM FEATURES</h2>
          <ul className="text-left space-y-2 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Focus mode displays only your highest priority task</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Global task queue with drag-and-drop prioritization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Milestone-based project organization (max 5 active)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>30-day trash retention with automatic cleanup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">▸</span>
              <span>Keyboard-driven navigation (F1-F4)</span>
            </li>
          </ul>
        </div>

        <a
          href="/api/login"
          className="inline-block border-2 border-primary bg-primary text-black px-8 py-4 font-bold text-lg hover:bg-primary/80 transition-colors"
        >
          [ENTER] AUTHENTICATE_AND_CONTINUE
        </a>

        <div className="mt-12 text-xs opacity-50">
          <p>TERMINAL_INTERFACE © 2025 FIRST THINGS FIRST CORP.</p>
          <p className="mt-2">DESIGNED FOR MAXIMUM PRODUCTIVITY</p>
        </div>
      </div>
    </div>
  );
}
