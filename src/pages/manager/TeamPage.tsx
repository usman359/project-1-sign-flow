import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckIcon, CopyIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"

import { formatDate } from "@/components/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/context/AuthProvider"
import type { Tables } from "@/lib/database.types"
import { supabase } from "@/lib/supabase"

type Member = Tables<"profiles">
type Invite = Tables<"manager_invites">

export function TeamPage() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("manager_invites").select("*").is("used_at", null).order("created_at", { ascending: false }),
    ])
    if (m.error) toast.error(m.error.message)
    if (i.error) toast.error(i.error.message)
    setMembers(m.data ?? [])
    setInvites(i.data ?? [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const createInvite = async () => {
    if (!profile) return
    setCreating(true)
    const { error } = await supabase.from("manager_invites").insert({ created_by: profile.id })
    setCreating(false)
    if (error) return toast.error(error.message)
    await load()
  }

  const deleteInvite = async (code: string) => {
    const { error } = await supabase.from("manager_invites").delete().eq("code", code)
    if (error) return toast.error(error.message)
    await load()
  }

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  const setRole = async (member: Member, role: Member["role"]) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", member.id)
    if (error) return toast.error(error.message)
    toast.success(`${member.full_name || member.email} is now ${role === "manager" ? "a manager" : "an employee"}.`)
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Everyone with an account, and how new managers get added.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="py-0 lg:col-span-2">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="pr-4 text-right">Change role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!members && (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {members?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4">
                      <div className="font-medium">{m.full_name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === "manager" ? "default" : "secondary"} className="capitalize">
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {m.id === profile?.id ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRole(m, m.role === "manager" ? "employee" : "manager")}
                        >
                          {m.role === "manager" ? "Make employee" : "Make manager"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manager invite codes</CardTitle>
            <CardDescription>
              Share a code with someone so they can sign up as a manager. Each code works once.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={createInvite} disabled={creating} className="w-full">
              {creating ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              Generate code
            </Button>
            {invites?.length === 0 && (
              <p className="text-sm text-muted-foreground">No unused codes.</p>
            )}
            {invites?.map((invite) => (
              <div
                key={invite.code}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2"
              >
                <code className="flex-1 font-mono text-sm tracking-wider">{invite.code}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy code"
                  onClick={() => copy(invite.code)}
                >
                  {copied === invite.code ? <CheckIcon /> : <CopyIcon />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete code"
                  onClick={() => deleteInvite(invite.code)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
