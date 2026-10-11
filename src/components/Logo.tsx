import { FileSignatureIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-md bg-primary text-primary-foreground",
          size === "lg" ? "size-9" : "size-7"
        )}
      >
        <FileSignatureIcon className={size === "lg" ? "size-5" : "size-4"} />
      </span>
      <span className={cn("font-display font-medium tracking-tight", size === "lg" ? "text-2xl" : "text-xl")}>
        Sign Flow
      </span>
    </span>
  )
}
