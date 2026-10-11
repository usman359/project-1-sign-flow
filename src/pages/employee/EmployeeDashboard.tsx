import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2Icon, DownloadIcon, FileTextIcon, InboxIcon, PenLineIcon } from "lucide-react"

import { SearchInput } from "@/components/SearchInput"
import { StatusBadge, formatDate } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/AuthProvider"
import { useQueryParam } from "@/lib/useQueryParam"
import { SIGNED_BUCKET, getFileUrl, supabase } from "@/lib/supabase"

type Row = {
  id: string
  status: "pending" | "signed"
  assigned_at: string
  signed_at: string | null
  signed_file_path: string | null
  documents: { id: string; title: string; description: string | null } | null
}

export function EmployeeDashboard() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    if (!profile) return
    supabase
      .from("assignments")
      .select(
        "id, status, assigned_at, signed_at, signed_file_path, documents(id, title, description)"
      )
      .eq("employee_id", profile.id)
      .order("assigned_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setRows(data ?? [])
      })
  }, [profile])

  const totalPending = rows?.filter((r) => r.status === "pending").length ?? 0
  const [tab, setTab] = useQueryParam("tab", "pending")
  const [query, setQuery] = useQueryParam("q", "")

  const needle = query.trim().toLowerCase()
  const matches = rows?.filter((r) => !needle || (r.documents?.title ?? "").toLowerCase().includes(needle))
  const pending = matches?.filter((r) => r.status === "pending") ?? []
  const signed = matches?.filter((r) => r.status === "signed") ?? []

  const openSigned = async (path: string) => {
    try {
      window.open(await getFileUrl(SIGNED_BUCKET, path), "_blank", "noopener")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows === null
            ? "Loading your documents…"
            : totalPending > 0
              ? `You have ${totalPending} document${totalPending === 1 ? "" : "s"} waiting for your signature.`
              : "You're all caught up. Nothing is waiting for your signature."}
        </p>
      </div>

      <Tabs value={tab === "signed" ? "signed" : "pending"} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="signed">Signed ({signed.length})</TabsTrigger>
        </TabsList>
        <SearchInput value={query} onChange={setQuery} placeholder="Search documents" />
        </div>

        <TabsContent value="pending">
          <AssignmentTable
            rows={matches ? pending : null}
            empty={needle ? "No pending documents match your search." : "Nothing to sign right now."}
            emptyIcon={<CheckCircle2Icon className="size-5" />}
            action={(row) => (
              <Button asChild size="sm">
                <Link to={`/employee/sign/${row.id}`}>
                  <PenLineIcon />
                  Review &amp; sign
                </Link>
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="signed">
          <AssignmentTable
            rows={matches ? signed : null}
            empty={needle ? "No signed documents match your search." : "You haven't signed any documents yet."}
            emptyIcon={<InboxIcon className="size-5" />}
            action={(row) =>
              row.signed_file_path && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openSigned(row.signed_file_path!)}
                >
                  <DownloadIcon />
                  Signed copy
                </Button>
              )
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AssignmentTable({
  rows,
  empty,
  emptyIcon,
  action,
}: {
  rows: Row[] | null
  empty: string
  emptyIcon: React.ReactNode
  action: (row: Row) => React.ReactNode
}) {
  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Signed</TableHead>
              <TableHead className="pr-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="px-4">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center text-muted-foreground">
                  <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                      {emptyIcon}
                    </span>
                    <p className="text-sm">{empty}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {rows?.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2 font-medium">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    {row.documents?.title ?? "Untitled"}
                  </div>
                  {row.documents?.description && (
                    <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                      {row.documents.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.assigned_at)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.signed_at)}</TableCell>
                <TableCell className="pr-4 text-right">{action(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
