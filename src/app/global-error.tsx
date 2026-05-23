"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-slate-200 shadow-lg text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-slate-500 mb-6">
              {error.message || "An unexpected error occurred. Please try again."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={reset}
                className="gap-2 bg-cyan-500 hover:bg-cyan-600"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
