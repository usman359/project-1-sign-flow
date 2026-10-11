import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftIcon, Loader2Icon, PenLineIcon } from "lucide-react"

import { PdfViewer } from "@/components/PdfViewer"
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad"
import { StatusBadge, formatDate } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/AuthProvider"
import { stampSignature } from "@/lib/pdf"
import {
  DOCUMENTS_BUCKET,
  SIGNED_BUCKET,
  getFileUrl,
  signedCopyPath,
  supabase,
} from "@/lib/supabase"

type Assignment = {
  id: string
  status: "pending" | "signed"
  signed_at: string | null
  signed_file_path: string | null
  documents: { title: string; description: string | null; file_path: string } | null
}

export function SignDocument() {
  const { assignmentId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const padRef = useRef<SignaturePadHandle>(null)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [padEmpty, setPadEmpty] = useState(true)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!assignmentId) return
    ;(async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, status, signed_at, signed_file_path, documents(title, description, file_path)")
        .eq("id", assignmentId)
        .maybeSingle()
      if (error || !data?.documents) {
        setNotFound(true)
        return
      }
      setAssignment(data)
      try {
        setPdfUrl(
          data.status === "signed" && data.signed_file_path
            ? await getFileUrl(SIGNED_BUCKET, data.signed_file_path)
            : await getFileUrl(DOCUMENTS_BUCKET, data.documents.file_path)
        )
      } catch (err) {
        toast.error((err as Error).message)
      }
    })()
  }, [assignmentId])

  const handleSign = async () => {
    if (!assignment?.documents || !profile) return
    const pad = padRef.current
    if (!pad || pad.isEmpty()) {
      toast.error("Please draw your signature first.")
      return
    }

    setSubmitting(true)
    try {
      const { data: original, error: downloadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(assignment.documents.file_path)
      if (downloadError) throw downloadError

      const signedBytes = await stampSignature(
        await original.arrayBuffer(),
        pad.toDataURL(),
        profile.full_name || profile.email,
        new Date()
      )

      const path = signedCopyPath(profile.id, assignment.id)
      const { error: uploadError } = await supabase.storage
        .from(SIGNED_BUCKET)
        .upload(path, new Blob([signedBytes as BlobPart], { type: "application/pdf" }), {
          contentType: "application/pdf",
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { error: signError } = await supabase.rpc("sign_assignment", {
        p_assignment_id: assignment.id,
      })
      if (signError) throw signError

      toast.success(`Signed "${assignment.documents.title}"`)
      navigate("/employee")
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">This document isn't available to you.</p>
        <Button asChild variant="outline">
          <Link to="/employee">Back to my documents</Link>
        </Button>
      </div>
    )
  }

  const isSigned = assignment?.status === "signed"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to="/employee">
              <ArrowLeftIcon />
              Back
            </Link>
          </Button>
          {assignment ? (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {assignment.documents?.title}
                </h1>
                <StatusBadge status={assignment.status} />
              </div>
              {assignment.documents?.description && (
                <p className="text-sm text-muted-foreground">{assignment.documents.description}</p>
              )}
              {isSigned && (
                <p className="text-sm text-muted-foreground">
                  You signed this on {formatDate(assignment.signed_at)}.
                </p>
              )}
            </>
          ) : (
            <Skeleton className="h-8 w-64" />
          )}
        </div>

        {assignment && !isSigned && (
          <Dialog open={open} onOpenChange={(next) => {
              if (submitting) return
              setOpen(next)
              setPadEmpty(true)
            }}>
            <DialogTrigger asChild>
              <Button disabled={!pdfUrl}>
                <PenLineIcon />
                Sign document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Sign "{assignment.documents?.title}"</DialogTitle>
                <DialogDescription>
                  Your signature, name and the current time will be added to the last page.
                </DialogDescription>
              </DialogHeader>
              <SignaturePad ref={padRef} onChange={setPadEmpty} />
              <p className="text-xs text-muted-foreground">
                Signing as <span className="font-medium text-foreground">{profile?.full_name}</span>{" "}
                ({profile?.email})
              </p>
              <DialogFooter>
                <Button variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={padEmpty || submitting} onClick={handleSign}>
                  {submitting && <Loader2Icon className="animate-spin" />}
                  Sign &amp; submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pdfUrl ? <PdfViewer url={pdfUrl} /> : <Skeleton className="h-[600px] w-full" />}
    </div>
  )
}
