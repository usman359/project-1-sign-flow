import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftIcon, EyeIcon, FileTextIcon } from "lucide-react"

import { PdfViewer } from "@/components/PdfViewer"
import { StatusBadge, formatDate } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DOCUMENTS_BUCKET, SIGNED_BUCKET, getFileUrl, supabase } from "@/lib/supabase"

type DocumentWithAssignments = {
  id: string
  title: string
  description: string | null
  file_path: string
  created_at: string
  uploader: { full_name: string; email: string } | null
  assignments: {
    id: string
    status: "pending" | "signed"
    assigned_at: string
    signed_at: string | null
    signer_name: string | null
    signed_file_path: string | null
    profiles: { full_name: string; email: string } | null
  }[]
}

type Preview = { title: string; description: string; url: string }

export function DocumentDetail() {
  const { documentId } = useParams()
  const [doc, setDoc] = useState<DocumentWithAssignments | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    if (!documentId) return
    supabase
      .from("documents")
      .select(
        `id, title, description, file_path, created_at,
         uploader:profiles(full_name, email),
         assignments(id, status, assigned_at, signed_at, signer_name, signed_file_path,
           profiles(full_name, email))`
      )
      .eq("id", documentId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
          return
        }
        setDoc(data)
      })
  }, [documentId])

  const openPreview = async (bucket: string, path: string, title: string, description: string) => {
    try {
      setPreview({ title, description, url: await getFileUrl(bucket, path) })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">Document not found.</p>
        <Button asChild variant="outline">
          <Link to="/manager">Back to documents</Link>
        </Button>
      </div>
    )
  }

  const assignments = [...(doc?.assignments ?? [])].sort((a, b) =>
    (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "")
  )
  const signed = assignments.filter((a) => a.status === "signed").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to="/manager">
              <ArrowLeftIcon />
              All documents
            </Link>
          </Button>
          {doc ? (
            <>
              <h1 className="font-display text-3xl font-medium tracking-tight">{doc.title}</h1>
              {doc.description && (
                <p className="text-sm text-muted-foreground">{doc.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Uploaded {formatDate(doc.created_at)}
                {doc.uploader && ` by ${doc.uploader.full_name || doc.uploader.email}`}
              </p>
            </>
          ) : (
            <Skeleton className="h-8 w-64" />
          )}
        </div>
        {doc && (
          <Button
            variant="outline"
            onClick={() =>
              openPreview(DOCUMENTS_BUCKET, doc.file_path, doc.title, "Original, unsigned document")
            }
          >
            <FileTextIcon />
            View original
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signing status</CardTitle>
          <CardDescription>
            {signed} of {assignments.length} employees have signed
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Progress value={assignments.length ? (signed / assignments.length) * 100 : 0} />
          <div className="-mx-6 border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed by</TableHead>
                  <TableHead>Signed at</TableHead>
                  <TableHead className="pr-6 text-right">Signed PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!doc && (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{a.profiles?.full_name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{a.profiles?.email}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{a.signer_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(a.signed_at)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      {a.signed_file_path ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openPreview(
                              SIGNED_BUCKET,
                              a.signed_file_path!,
                              doc!.title,
                              `Signed by ${a.signer_name} on ${formatDate(a.signed_at)}`
                            )
                          }
                        >
                          <EyeIcon />
                          View
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Awaiting</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[90svh] overflow-x-hidden overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              {preview?.description}{" "}
              {preview && (
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Open in new tab
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          {preview && <PdfViewer url={preview.url} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
