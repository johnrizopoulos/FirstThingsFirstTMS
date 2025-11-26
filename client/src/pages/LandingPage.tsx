
import { Link } from "wouter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-primary font-mono relative overflow-hidden">
      {/* CRT Overlay */}
      <div className="fixed inset-0 crt-overlay pointer-events-none z-50" />
      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-4 h-4 bg-primary animate-blink" />
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-widest">
              FIRST_THINGS_FIRST
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl mb-4 opacity-90">
            DO THE MOST IMPORTANT THING. ALWAYS.
          </p>
          
          <p className="text-sm md:text-base mb-12 opacity-70 max-w-2xl mx-auto">
            A terminal-inspired task management system that helps you focus on what truly matters.
            No distractions. No overwhelm. Just pure productivity.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <a className="inline-block border-2 border-primary bg-primary text-black px-8 py-4 font-bold text-lg hover:bg-primary/80 transition-colors">
                [ENTER] GET_STARTED
              </a>
            </Link>
            <a href="#features" className="inline-block border-2 border-primary bg-background text-primary px-8 py-4 font-bold text-lg hover:bg-primary/10 transition-colors">
              LEARN_MORE
            </a>
          </div>
        </div>
      </section>
      {/* Problem Statement */}
      <section className="relative z-10 py-24 px-4 border-t-4 border-primary">
        <div className="max-w-4xl mx-auto">
          <div className="border-4 border-primary p-8 md:p-12 bg-card/50 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />
            
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
              &gt;&gt; THE_PROBLEM &lt;&lt;
            </h2>
            <p className="text-base md:text-lg mb-4 opacity-80">
              Traditional task managers let you pile up hundreds of tasks. They give you endless lists, 
              infinite categories, and overwhelming dashboards. The result? Paralysis by analysis.
            </p>
            <p className="text-base md:text-lg opacity-80">
              <span className="text-primary font-bold">FIRST_THINGS_FIRST</span> is different. 
              We believe in ruthless prioritization. At any moment, you should know exactly what to work on next.
            </p>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/login">
              <a className="inline-block border-4 border-primary bg-primary text-black px-12 py-5 font-bold text-xl hover:bg-primary/80 transition-colors">
                [ENTER] START_NOW
              </a>
            </Link>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 px-4 border-t-4 border-primary">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">
            &gt;&gt; CORE_FEATURES &lt;&lt;
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Focus Mode */}
            <div className="border-2 border-primary p-6 bg-card/30">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-3 h-3 bg-primary animate-blink shrink-0 mt-1" />
                <h3 className="text-xl font-bold">FOCUS_MODE</h3>
              </div>
              <p className="text-sm mb-4 opacity-80">
                See only your highest priority task. No distractions, no alternatives. 
                Complete it or move it down. It's that simple.
              </p>
              <div className="border border-primary bg-background/50 p-4 text-xs font-mono">
                <div className="opacity-50 mb-2">[F1] FOCUS</div>
                <div className="border border-primary p-3 bg-primary/5">
                  <div className="font-bold mb-1">▸ YOUR TOP TASK</div>
                  <div className="opacity-70 text-xs">The one thing you should be doing right now.</div>
                </div>
              </div>
            </div>

            {/* Global Queue */}
            <div className="border-2 border-primary p-6 bg-card/30">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-3 h-3 bg-primary animate-blink shrink-0 mt-1" />
                <h3 className="text-xl font-bold">GLOBAL_QUEUE</h3>
              </div>
              <p className="text-sm mb-4 opacity-80">
                All your tasks in one prioritized list. Drag and drop to reorder. 
                The top task is always the most important.
              </p>
              <div className="border border-primary bg-background/50 p-4 text-xs font-mono">
                <div className="opacity-50 mb-2">[F2] LIST</div>
                <div className="space-y-1">
                  <div className="border border-primary bg-primary/10 p-2">1. Critical task</div>
                  <div className="border border-primary p-2">2. Important task</div>
                  <div className="border border-primary p-2">3. Regular task</div>
                </div>
              </div>
            </div>

            {/* Kanban Board */}
            <div className="border-2 border-primary p-6 bg-card/30">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-3 h-3 bg-primary animate-blink shrink-0 mt-1" />
                <h3 className="text-xl font-bold">MILESTONE_BOARD</h3>
              </div>
              <p className="text-sm mb-4 opacity-80">
                Organize tasks into milestones. Max 5 active milestones to prevent overwhelm. 
                Move tasks between stages as you progress.
              </p>
              <div className="border border-primary bg-background/50 p-4 text-xs font-mono">
                <div className="opacity-50 mb-2">[F3] BOARD</div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="border border-primary p-2 text-center">PROJECT A</div>
                  <div className="border border-primary p-2 text-center">PROJECT B</div>
                  <div className="border border-primary p-2 text-center">PROJECT C</div>
                </div>
              </div>
            </div>

            {/* Smart Retention */}
            <div className="border-2 border-primary p-6 bg-card/30">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-3 h-3 bg-primary animate-blink shrink-0 mt-1" />
                <h3 className="text-xl font-bold">SMART_RETENTION</h3>
              </div>
              <p className="text-sm mb-4 opacity-80">
                Completed tasks archived permanently. Deleted tasks held for 30 days. 
                Automatic cleanup keeps your system lean.
              </p>
              <div className="border border-primary bg-background/50 p-4 text-xs font-mono">
                <div className="opacity-50 mb-2">SYSTEM_STATUS</div>
                <div className="space-y-1">
                  <div>✓ COMPLETED: 47 tasks archived</div>
                  <div>⊗ TRASH: 3 tasks (auto-delete in 12d)</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/login">
              <a className="inline-block border-4 border-primary bg-primary text-black px-12 py-5 font-bold text-xl hover:bg-primary/80 transition-colors">
                [ENTER] START_NOW
              </a>
            </Link>
          </div>
        </div>
      </section>
      {/* Terminal Aesthetic Section */}
      <section className="relative z-10 py-24 px-4 border-t-4 border-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            &gt;&gt; TERMINAL_INSPIRED_DESIGN &lt;&lt;
          </h2>
          <p className="text-lg mb-12 opacity-80">
            Inspired by Bloomberg Terminal and IBM 3270 mainframes. Three beautiful themes: 
            <span className="text-primary font-bold"> Terminal</span>, 
            <span className="font-bold"> Dark</span>, and 
            <span className="font-bold"> Light</span>.
          </p>
          
          <div className="border-4 border-primary p-8 bg-card/50 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />
            
            <div className="font-mono text-left text-sm md:text-base">
              <div className="opacity-50 mb-2">&gt; KEYBOARD_NAVIGATION</div>
              <div className="space-y-1 mb-4">
                <div>[F1] → FOCUS MODE</div>
                <div>[F2] → LIST VIEW</div>
                <div>[F3] → KANBAN BOARD</div>
                <div>[F4] → COMPLETED ARCHIVE</div>
              </div>
              <div className="opacity-50 mb-2">&gt; EFFICIENCY_FIRST</div>
              <div>No mouse required. Navigate at the speed of thought.</div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/login">
              <a className="inline-block border-4 border-primary bg-primary text-black px-12 py-5 font-bold text-xl hover:bg-primary/80 transition-colors">
                [ENTER] START_NOW
              </a>
            </Link>
          </div>
        </div>
      </section>
      {/* Social Proof / Philosophy */}
      <section className="relative z-10 py-24 px-4 border-t-4 border-primary">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            &gt;&gt; THE_PHILOSOPHY &lt;&lt;
          </h2>
          <div className="space-y-6 text-left text-base md:text-lg opacity-80">
            <p className="border-l-4 border-primary pl-4">
              "Do the most important thing first. When it's done, do the next most important thing. 
              Repeat until you've accomplished everything that matters."
            </p>
            <p className="border-l-4 border-primary pl-4">
              "Limitations breed creativity. By capping active milestones at 5 and showing only one 
              task in Focus mode, we force you to make real decisions about what matters."
            </p>
            <p className="border-l-4 border-primary pl-4">
              "Your task manager shouldn't be another source of stress. It should be a tool that 
              brings clarity and calm to your work."
            </p>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/login">
              <a className="inline-block border-4 border-primary bg-primary text-black px-12 py-5 font-bold text-xl hover:bg-primary/80 transition-colors">
                [ENTER] START_NOW
              </a>
            </Link>
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4 border-t-4 border-primary">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            READY_TO_FOCUS?
          </h2>
          <p className="text-lg mb-12 opacity-80">
            Start managing your tasks the way they should be managed. 
            Simple. Focused. Effective.
          </p>
          
          <Link href="/login">
            <a className="inline-block border-4 border-primary bg-primary text-black px-12 py-5 font-bold text-xl hover:bg-primary/80 transition-colors">
              [ENTER] START_NOW
            </a>
          </Link>
          
          <p className="mt-8 text-sm opacity-50">
            No credit card required. Free to use.
          </p>
        </div>
      </section>
      {/* Footer */}
      <footer className="relative z-10 border-t-4 border-primary p-6 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs opacity-50 mb-2">
            TERMINAL_INTERFACE © 2025 FIRST THINGS FIRST CORP.
          </p>
          <p className="text-xs opacity-50">
            DESIGNED FOR MAXIMUM PRODUCTIVITY // INSPIRED BY BLOOMBERG TERMINAL & IBM 3270
          </p>
        </div>
      </footer>
    </div>
  );
}
