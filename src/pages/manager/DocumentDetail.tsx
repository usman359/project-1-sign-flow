import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  EyeIcon,
  FileTextIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"

import { PdfViewer } from "@/components/PdfViewer"
import { StatusBadge, formatDate } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
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
    employee_id: string
    status: "pending" | "signed"
    assigned_at: string
    signed_at: string | null
    signer_name: string | null
    signed_file_path: string | null
    profiles: { full_name: string; email: string } | null
  }[]
}

type Employee = { id: string; full_name: string; email: string }
type Preview = { title: string; description: string; url: string }

export function DocumentDetail() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DocumentWithAssignments | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [adding, setAdding] = useState(false)
  const [candidates, setCandidates] = useState<Employee[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!documentId) return
    const { data, error } = await supabase
      .from("documents")
      .select(
        `id, title, description, file_path, created_at,
         uploader:profiles(full_name, email),
         assignments(id, employee_id, status, assigned_at, signed_at, signer_name, signed_file_path,
           profiles(full_name, email))`
      )
      .eq("id", documentId)
      .maybeSingle()
    if (error || !data) setNotFound(true)
    else setDoc(data)
  }, [documentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const openEdit = () => {
    if (!doc) return
    setEditTitle(doc.title)
    setEditDescription(doc.description ?? "")
    setEditing(true)
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!doc) return
    setBusy(true)
    const { error } = await supabase
      .from("documents")
      .update({ title: editTitle.trim(), description: editDescription.trim() || null })
      .eq("id", doc.id)
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success("Document updated")
    setEditing(false)
    await load()
  }

  const deleteDocument = async () => {
    if (!doc) return
    if (!window.confirm(`Delete "${doc.title}" and all signed copies? This can't be undone.`)) return
    setBusy(true)
    const signedPaths = doc.assignments.flatMap((a) => (a.signed_file_path ? [a.signed_file_path] : []))
    const { error } = await supabase.from("documents").delete().eq("id", doc.id)
    if (error) {
      setBusy(false)
      return toast.error(error.message)
    }
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path])
    if (signedPaths.length) await supabase.storage.from(SIGNED_BUCKET).remove(signedPaths)
    toast.success("Document deleted")
    navigate("/manager")
  }

  const removeAssignment = async (a: DocumentWithAssignments["assignments"][number]) => {
    const name = a.profiles?.full_name || a.profiles?.email || "this employee"
    const warning = a.status === "signed" ? " Their signed copy will be deleted too." : ""
    if (!window.confirm(`Remove ${name} from this document?${warning}`)) return
    const { error } = await supabase.from("assignments").delete().eq("id", a.id)
    if (error) return toast.error(error.message)
    if (a.signed_file_path) await supabase.storage.from(SIGNED_BUCKET).remove([a.signed_file_path])
    toast.success(`Removed ${name}`)
    await load()
  }

  const openAdd = async () => {
    if (!doc) return
    setPicked(new Set())
    setAdding(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "employee")
      .order("full_name")
    if (error) return toast.error(error.message)
    const assigned = new Set(doc.assignments.map((a) => a.employee_id))
    setCandidates((data ?? []).filter((emp) => !assigned.has(emp.id)))
  }

  const saveAdd = async () => {
    if (!doc || picked.size === 0) return
    setBusy(true)
    const { error } = await supabase
      .from("assignments")
      .insert([...picked].map((employee_id) => ({ document_id: doc.id, employee_id })))
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(`Assigned to ${picked.size} more employee(s)`)
    setAdding(false)
    await load()
  }

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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                openPreview(DOCUMENTS_BUCKET, doc.file_path, doc.title, "Original, unsigned document")
              }
            >
              <FileTextIcon />
              View original
            </Button>
            <Button variant="outline" onClick={openEdit}>
              <PencilIcon />
              Edit
            </Button>
            <Button variant="outline" onClick={deleteDocument} disabled={busy}>
              <Trash2Icon />
              Delete
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Signing status</CardTitle>
            <CardDescription>
              {signed} of {assignments.length} employees have signed
            </CardDescription>
          </div>
          {doc && (
            <Button size="sm" variant="outline" onClick={openAdd}>
              <UserPlusIcon />
              Add employees
            </Button>
          )}
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
                      <div className="flex items-center justify-end gap-2">
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
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remove employee"
                        onClick={() => removeAssignment(a)}
                      >
                        <Trash2Icon />
                      </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={saveEdit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Edit document</DialogTitle>
              <DialogDescription>Change the title or description employees see.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editTitle">Title</Label>
              <Input
                id="editTitle"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !editTitle.trim()}>
                {busy && <Loader2Icon className="animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add employees</DialogTitle>
            <DialogDescription>Choose who else needs to sign this document.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {candidates.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Every employee is already assigned.
              </p>
            )}
            {candidates.map((emp) => (
              <label
                key={emp.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={picked.has(emp.id)}
                  onCheckedChange={(checked) =>
                    setPicked((prev) => {
                      const next = new Set(prev)
                      if (checked) next.add(emp.id)
                      else next.delete(emp.id)
                      return next
                    })
                  }
                />
                <span className="text-sm font-medium">{emp.full_name || "Unnamed"}</span>
                <span className="text-xs text-muted-foreground">{emp.email}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={saveAdd} disabled={busy || picked.size === 0}>
              {busy && <Loader2Icon className="animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
