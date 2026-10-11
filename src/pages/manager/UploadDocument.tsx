import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Loader2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/AuthProvider"
import type { Tables } from "@/lib/database.types"
import { DOCUMENTS_BUCKET, supabase } from "@/lib/supabase"

type Employee = Pick<Tables<"profiles">, "id" | "full_name" | "email">

export function UploadDocument() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "employee")
      .order("full_name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setEmployees(data ?? [])
      })
  }, [])

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const allSelected = !!employees?.length && selected.size === employees.length

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || !file) return
    if (selected.size === 0) {
      toast.error("Select at least one employee.")
      return
    }

    setSubmitting(true)
    const safeName = file.name.replace(/[^\w.-]+/g, "_")
    const path = `${crypto.randomUUID()}/${safeName}`

    try {
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: "application/pdf" })
      if (uploadError) throw uploadError

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_path: path,
          uploaded_by: profile.id,
        })
        .select("id")
        .single()
      if (docError) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
        throw docError
      }

      const { error: assignError } = await supabase
        .from("assignments")
        .insert([...selected].map((employee_id) => ({ document_id: doc.id, employee_id })))
      if (assignError) {
        await supabase.from("documents").delete().eq("id", doc.id)
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
        throw assignError
      }

      toast.success(`Assigned "${title.trim()}" to ${selected.size} employee(s)`)
      navigate(`/manager/documents/${doc.id}`)
    } catch (err) {
      toast.error((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload document</h1>
        <p className="text-sm text-muted-foreground">
          Upload a PDF and choose which employees need to sign it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Employee handbook acknowledgement"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything employees should know before signing"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="file">PDF file</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null
                setFile(next)
                if (next && !title) setTitle(next.name.replace(/\.pdf$/i, ""))
              }}
            />
            <p className="text-xs text-muted-foreground">PDF only, up to 10 MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign to</CardTitle>
          <CardDescription>
            {selected.size} of {employees?.length ?? 0} employees selected
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {!employees && <Skeleton className="h-24 w-full" />}
          {employees?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No employees have signed up yet.
            </p>
          )}
          {!!employees?.length && (
            <label className="flex items-center gap-3 rounded-md border-b px-2 pb-3 text-sm font-medium">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(employees.map((e) => e.id)) : new Set())
                }
              />
              Select all
            </label>
          )}
          {employees?.map((emp) => (
            <label
              key={emp.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selected.has(emp.id)}
                onCheckedChange={(checked) => toggle(emp.id, checked === true)}
              />
              <span className="font-medium">{emp.full_name || "Unnamed"}</span>
              <span className="text-muted-foreground">{emp.email}</span>
            </label>
          ))}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting || !file || selected.size === 0}>
            {submitting ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            Upload &amp; assign
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
