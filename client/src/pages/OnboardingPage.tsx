import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/onboarding";
import { Link } from "wouter";
import { ArrowRight, CheckCircle } from "lucide-react";

export default function OnboardingPage() {
  const { markOnboardingComplete } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "WELCOME TO FIRST THINGS FIRST",
      description: "A terminal-inspired task management system for focused productivity",
      content: (
        <div className="space-y-4">
          <p className="text-sm opacity-80">
            Get things done with a distraction-free interface inspired by Bloomberg Terminal and IBM 3270 systems.
          </p>
          <div className="border-l-2 border-primary pl-4 space-y-2">
            <p className="text-xs opacity-70">• Monospace terminal aesthetic</p>
            <p className="text-xs opacity-70">• Three theme modes: Terminal, Dark, Light</p>
            <p className="text-xs opacity-70">• Keyboard shortcuts for power users</p>
          </div>
        </div>
      ),
    },
    {
      title: "FOCUS MODE (F1)",
      description: "Concentrate on a single task",
      content: (
        <div className="space-y-4">
          <p className="text-sm opacity-80">
            Focus mode displays one task at a time, helping you concentrate without distractions.
          </p>
          <div className="bg-primary/10 border border-primary/30 p-3 rounded-none text-xs opacity-70">
            Perfect for deep work sessions. Cycle through tasks or mark them complete.
          </div>
        </div>
      ),
    },
    {
      title: "LIST VIEW (F2)",
      description: "Global task queue with drag-to-reorder",
      content: (
        <div className="space-y-4">
          <p className="text-sm opacity-80">
            All tasks in a single ordered list. Drag tasks to reorder priorities.
          </p>
          <div className="space-y-2 text-xs opacity-70">
            <p>• Tap/click task to edit details</p>
            <p>• Tap-and-hold to drag and reorder</p>
            <p>• Mark complete to move to Completed view</p>
          </div>
        </div>
      ),
    },
    {
      title: "BOARD VIEW (F3)",
      description: "Milestone-based Kanban board",
      content: (
        <div className="space-y-4">
          <p className="text-sm opacity-80">
            Organize tasks into up to 5 milestones (columns). Each milestone has independent task ordering.
          </p>
          <div className="space-y-2 text-xs opacity-70">
            <p>• Drag tasks within milestone to reorder</p>
            <p>• Complete milestone to complete all tasks</p>
            <p>• Independent from List view ordering</p>
          </div>
        </div>
      ),
    },
    {
      title: "COMPLETED VIEW (F4)",
      description: "Permanent storage of finished work",
      content: (
        <div className="space-y-4">
          <p className="text-sm opacity-80">
            All completed tasks and milestones are permanently stored here for reference.
          </p>
          <div className="bg-primary/10 border border-primary/30 p-3 rounded-none text-xs opacity-70">
            Never lose track of what you've accomplished. Milestones auto-complete all linked tasks.
          </div>
        </div>
      ),
    },
    {
      title: "KEYBOARD SHORTCUTS",
      description: "Power user controls",
      content: (
        <div className="space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="opacity-70">[F1]</span>
            <span className="opacity-80">Focus Mode</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">[F2]</span>
            <span className="opacity-80">List View</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">[F3]</span>
            <span className="opacity-80">Board View</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">[F4]</span>
            <span className="opacity-80">Completed</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">[F5]</span>
            <span className="opacity-80">Trash</span>
          </div>
        </div>
      ),
    },
    {
      title: "YOU'RE ALL SET",
      description: "Ready to get started",
      content: (
        <div className="space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="w-12 h-12 text-primary opacity-70" />
          </div>
          <p className="text-sm opacity-80 text-center">
            You're ready to take control of your tasks. Start with Focus mode or List view to add your first task.
          </p>
          <div className="bg-primary/10 border border-primary/30 p-3 rounded-none text-xs opacity-70">
            Tip: Use the theme toggle in the header to switch between Terminal, Dark, and Light modes.
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      markOnboardingComplete();
    }
  };

  const handleSkip = () => {
    markOnboardingComplete();
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Layout>
      <div className="h-full flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="border-2 border-primary p-8 md:p-12 bg-card">
            {/* Step Counter */}
            <div className="flex justify-between items-center mb-8">
              <div className="text-xs opacity-50">
                STEP {currentStep + 1} OF {steps.length}
              </div>
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 w-2 ${
                      index <= currentStep ? "bg-primary" : "bg-primary/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold uppercase mb-2">
                {step.title}
              </h1>
              <p className="text-sm opacity-70 mb-6">{step.description}</p>
              <div className="space-y-4">{step.content}</div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 justify-between">
              <Button
                onClick={handleSkip}
                variant="outline"
                className="rounded-none border-primary text-primary"
                data-testid="button-skip-onboarding"
              >
                SKIP
              </Button>
              <Link href="/">
                <Button
                  onClick={handleNext}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 rounded-none font-mono"
                  data-testid="button-next-onboarding"
                >
                  {isLastStep ? (
                    <>GET_STARTED</>
                  ) : (
                    <>
                      NEXT
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
