import { CheckCircle2Icon, ClockIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Enums } from "@/lib/database.types"

export function StatusBadge({ status }: { status: Enums<"assignment_status"> }) {
  if (status === "signed") {
    return (
      <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2Icon />
        Signed
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
      <ClockIcon />
      Pending
    </Badge>
  )
}

export function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
