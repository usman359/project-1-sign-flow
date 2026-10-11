import { FileSignatureIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
          size === "lg" ? "size-10" : "size-8"
        )}
      >
        <FileSignatureIcon className={size === "lg" ? "size-6" : "size-5"} />
      </span>
      <span className={size === "lg" ? "text-xl" : "text-base"}>Sign Flow</span>
    </span>
  )
}
