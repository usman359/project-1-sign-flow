import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { DownloadIcon, FileTextIcon, PenLineIcon } from "lucide-react"

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

  const pending = rows?.filter((r) => r.status === "pending") ?? []
  const signed = rows?.filter((r) => r.status === "signed") ?? []

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
        <h1 className="text-2xl font-semibold tracking-tight">My documents</h1>
        <p className="text-sm text-muted-foreground">
          Review and sign the documents assigned to you.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="signed">Signed ({signed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <AssignmentTable
            rows={rows && pending}
            empty="Nothing to sign right now."
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
            rows={rows && signed}
            empty="You haven't signed any documents yet."
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
  action,
}: {
  rows: Row[] | null
  empty: string
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
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {empty}
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
