import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2Icon, ClockIcon, FileTextIcon, UploadIcon } from "lucide-react"

import { SearchInput } from "@/components/SearchInput"
import { formatDate } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useQueryParam } from "@/lib/useQueryParam"
import { supabase } from "@/lib/supabase"

type DocumentRow = {
  id: string
  title: string
  created_at: string
  assignments: { status: "pending" | "signed" }[]
}

type RecentSignature = {
  id: string
  signer_name: string | null
  signed_at: string | null
  documents: { id: string; title: string } | null
  profiles: { email: string } | null
}

export function ManagerDashboard() {
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null)
  const [recent, setRecent] = useState<RecentSignature[] | null>(null)
  const [query, setQuery] = useQueryParam("q", "")
  const [status, setStatus] = useQueryParam("status", "all")

  useEffect(() => {
    supabase
      .from("documents")
      .select("id, title, created_at, assignments(status)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setDocuments(data ?? [])
      })
    supabase
      .from("assignments")
      .select("id, signer_name, signed_at, documents(id, title), profiles(email)")
      .eq("status", "signed")
      .order("signed_at", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setRecent(data ?? [])
      })
  }, [])

  const needle = query.trim().toLowerCase()
  const visible = documents?.filter((d) => {
    if (needle && !d.title.toLowerCase().includes(needle)) return false
    const total = d.assignments.length
    const done = d.assignments.filter((a) => a.status === "signed").length
    const complete = total > 0 && done === total
    if (status === "complete") return complete
    if (status === "progress") return !complete
    return true
  })

  const all = documents?.flatMap((d) => d.assignments) ?? []
  const signedCount = all.filter((a) => a.status === "signed").length
  const stats = [
    { label: "Documents", value: documents?.length, icon: FileTextIcon },
    { label: "Awaiting signature", value: documents && all.length - signedCount, icon: ClockIcon },
    { label: "Signed", value: documents && signedCount, icon: CheckCircle2Icon },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Track signing progress across all assigned documents.
          </p>
        </div>
        <Button asChild>
          <Link to="/manager/upload">
            <UploadIcon />
            Upload document
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <stat.icon className="size-4" />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stat.value ?? <Skeleton className="h-9 w-12" />}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={["progress", "complete"].includes(status) ? status : "all"} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="progress">In progress</TabsTrigger>
            <TabsTrigger value="complete">Complete</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder="Search documents" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="py-0 lg:col-span-2">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Document</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-48 pr-4">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!documents &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3} className="px-4">
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {documents && documents.length > 0 && visible?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                      No documents match your filters.
                    </TableCell>
                  </TableRow>
                )}
                {documents?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-14 text-center">
                      <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <FileTextIcon className="size-5" />
                        </span>
                        <p className="text-sm text-muted-foreground">
                          No documents yet. Upload a PDF and assign it to your team.
                        </p>
                        <Button asChild size="sm">
                          <Link to="/manager/upload">
                            <UploadIcon />
                            Upload document
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {visible?.map((doc) => {
                  const total = doc.assignments.length
                  const signed = doc.assignments.filter((a) => a.status === "signed").length
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="pl-4">
                        <Link
                          to={`/manager/documents/${doc.id}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          <FileTextIcon className="size-4 text-muted-foreground" />
                          {doc.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center gap-3">
                          <Progress value={total ? (signed / total) * 100 : 0} className="h-1.5" />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {signed}/{total}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently signed</CardTitle>
            <CardDescription>Who signed what, most recent first.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!recent && <Skeleton className="h-24 w-full" />}
            {recent?.length === 0 && (
              <p className="text-sm text-muted-foreground">No signatures yet.</p>
            )}
            {recent?.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p>
                    <span className="font-medium">{item.signer_name || item.profiles?.email}</span>{" "}
                    signed{" "}
                    <Link
                      to={`/manager/documents/${item.documents?.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.documents?.title}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.signed_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
