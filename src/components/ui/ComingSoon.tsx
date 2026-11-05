import { Construction } from "lucide-react";

interface ComingSoonProps {
  pageName: string;
  description?: string;
}

export function ComingSoon({ pageName, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-card border border-border">
        <Construction className="h-10 w-10 text-accent" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="font-display font-bold text-2xl text-text-primary">{pageName}</h1>
        <p className="text-text-secondary text-sm">
          {description ?? "This feature is being built as part of Phase 1. Full implementation coming in the next phase."}
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="text-xs font-medium text-accent">In development</span>
      </div>
    </div>
  );
}
