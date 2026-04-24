import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4 border-2 border-primary p-6">
        <div className="flex mb-4 gap-2 items-center">
          <AlertCircle className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-mono font-bold text-primary uppercase">404 PAGE NOT FOUND</h1>
        </div>

        <p className="mt-4 text-sm text-primary font-mono uppercase">
          SYSTEM_ERROR: ROUTE_NOT_FOUND
        </p>
      </div>
    </div>
  );
}
