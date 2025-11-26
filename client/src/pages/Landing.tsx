
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background text-primary font-mono relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* CRT Overlay */}
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      <div className="relative z-10 max-w-2xl mx-auto py-8 text-center w-full">
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4 md:mb-6">
            <div className="w-3 h-3 md:w-4 md:h-4 bg-primary animate-blink shrink-0" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold tracking-wide md:tracking-widest break-words">
              FIRST_THINGS_FIRST
            </h1>
          </div>
          <p className="text-sm md:text-lg opacity-70 mb-2">TASK MANAGEMENT SYSTEM // V.1.1</p>
        </div>

        <a
          href="/api/login"
          className="inline-block border-2 border-primary bg-primary text-black px-4 py-3 md:px-8 md:py-4 font-bold text-sm md:text-lg hover:bg-primary/80 transition-colors"
        >
          <span className="hidden sm:inline">[ENTER] AUTHENTICATE_AND_CONTINUE</span>
          <span className="sm:hidden">AUTHENTICATE</span>
        </a>

        <div className="mt-6 mb-6 md:mb-8 text-sm md:text-base opacity-70 italic max-w-2xl mx-auto text-justify">
          <p>"If you can't focus, you can't create, build, or achieve anything meaningful. The best ideas, the biggest dreams, and even the simplest daily tasks need one thing—your undivided attention."</p>
        </div>

        <div className="border-2 md:border-4 border-primary p-4 md:p-8 mb-6 md:mb-8 bg-card/50 relative">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-l-2 md:border-t-4 md:border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 border-t-2 border-r-2 md:border-t-4 md:border-r-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-l-2 md:border-b-4 md:border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 md:w-4 md:h-4 border-b-2 border-r-2 md:border-b-4 md:border-r-4 border-primary" />

          <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-4">_AUTHENTICATION_REQUIRED_</h2>
          <div className="text-sm md:text-base mb-6 opacity-80">
            <p>Sign in to access <span className="font-bold">FIRST_THINGS_FIRST_TMS</span>.</p>
            <p className="mt-2">[Replit Auth in use, account creation is easy and offers greater security while app is in development]</p>
          </div>
          <ul className="text-left space-y-2 mb-4 md:mb-6 text-xs md:text-base">
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Focus mode displays only your highest priority task</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Ordered task list view with drag-and-drop prioritisation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Board view with Milestones (max 5 active)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>30-day trash retention with automatic cleanup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary shrink-0">▸</span>
              <span>Keyboard-driven navigation (F1-F6)</span>
            </li>
          </ul>
        </div>

        <a
          href="/api/login"
          className="inline-block border-2 border-primary bg-primary text-black px-4 py-3 md:px-8 md:py-4 font-bold text-sm md:text-lg hover:bg-primary/80 transition-colors"
        >
          <span className="hidden sm:inline">[ENTER] AUTHENTICATE_AND_CONTINUE</span>
          <span className="sm:hidden">AUTHENTICATE</span>
        </a>

        <div className="mt-6 mb-8 md:mb-12 text-sm md:text-base opacity-70 italic max-w-2xl mx-auto text-justify">
          <p>"Extraordinary success comes from doing ordinary things, with extraordinary focus, over an extraordinary period of time."</p>
        </div>

        <div className="mt-8 md:mt-12 text-[10px] md:text-xs opacity-50">
          <p>TERMINAL_INTERFACE © 2025 FIRST THINGS FIRST CORP.</p>
          <p className="mt-2">DESIGNED FOR MAXIMUM PRODUCTIVITY</p>
        </div>
      </div>
    </div>
  );
}
