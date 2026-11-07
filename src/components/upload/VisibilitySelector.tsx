"use client";

import { Globe, Users, Star, Lock, UserCheck, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import type { PostVisibility } from "@/types";

interface VisibilityOption {
  value: PostVisibility;
  label: string;
  description: string;
  icon: React.ElementType;
}

const OPTIONS: VisibilityOption[] = [
  { value: "public", label: "Public", description: "Anyone can see this", icon: Globe },
  { value: "followers", label: "Followers", description: "Only your followers", icon: Users },
  { value: "closeFriends", label: "Close Friends", description: "Your close friends list", icon: Star },
  { value: "custom", label: "Custom", description: "Specific people you choose", icon: UserCheck },
  { value: "private", label: "Only Me", description: "Only visible to you", icon: Lock },
];

interface Props {
  value: PostVisibility;
  onChange: (v: PostVisibility) => void;
  allowAudiences?: boolean;
}

export function VisibilitySelector({ value, onChange, allowAudiences = false }: Props) {
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 pr-2.5">
          <Icon className="h-3.5 w-3.5 text-accent" />
          <span>{current.label}</span>
          <ChevronDown className="h-3 w-3 text-text-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Who can see this?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.filter(opt => allowAudiences || !["custom", "closeFriends"].includes(opt.value)).map((opt) => {
          const OptIcon = opt.icon;
          const isSelected = opt.value === value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="flex flex-col items-start gap-0 py-2.5"
            >
              <div className="flex items-center gap-2 w-full">
                <OptIcon className={`h-4 w-4 shrink-0 ${isSelected ? "text-accent" : "text-text-secondary"}`} />
                <span className={isSelected ? "text-accent font-medium" : ""}>{opt.label}</span>
                {isSelected && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
              </div>
              <p className="text-xs text-text-muted pl-6">{opt.description}</p>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
