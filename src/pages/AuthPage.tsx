import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MailCheckIcon,
  PenLineIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import { Logo } from "@/components/Logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

const RESEND_COOLDOWN = 60

const highlights = [
  { icon: PenLineIcon, text: "Review and sign documents in seconds, from any device." },
  { icon: UsersIcon, text: "Managers assign documents and track progress at a glance." },
  { icon: ShieldCheckIcon, text: "Every signature is stamped onto the PDF and stored securely." },
]

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup"
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [awaitingEmail, setAwaitingEmail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const resend = async () => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Confirmation email sent to ${email}`)
      setCooldown(RESEND_COOLDOWN)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNeedsConfirmation(false)
    setSubmitting(true)

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) {
        setError(error.message)
      } else if (data.user && data.user.identities?.length === 0) {
        // Supabase hides duplicate emails by returning a user with no identities.
        setError("An account with this email already exists. Try signing in instead.")
      } else if (!data.session) {
        setAwaitingEmail(true)
        setCooldown(RESEND_COOLDOWN)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.code === "email_not_confirmed") {
          setNeedsConfirmation(true)
          setError("Your email isn't confirmed yet. Check your inbox for the confirmation link.")
        } else if (error.code === "invalid_credentials") {
          setError("Incorrect email or password.")
        } else {
          setError(error.message)
        }
      }
    }
    // On success the auth listener updates the session and PublicOnlyRoute redirects.
    setSubmitting(false)
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-black/20 blur-3xl" />
        <Logo size="lg" className="relative [&>span:first-child]:bg-white/15" />
        <div className="relative flex flex-col gap-8">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Get every document signed, without the chasing.
          </h2>
          <ul className="flex max-w-md flex-col gap-5">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-primary-foreground/90">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1 text-sm leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          Sign Flow · Secure document signing
        </p>
      </aside>

      <main className="flex items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Logo className="lg:hidden" />

          {awaitingEmail ? (
            <div className="flex flex-col gap-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <MailCheckIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-foreground">{email}</span>. Open it to activate
                  your account, then sign in.
                </p>
              </div>
              <p className="rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
                Can't find it? Check your spam folder. The email can take a minute or two to arrive.
              </p>
              <div className="flex flex-col gap-3">
                <Button variant="outline" onClick={resend} disabled={cooldown > 0}>
                  {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend confirmation email"}
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {isSignup ? "Create your account" : "Welcome back"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isSignup
                    ? "Sign up to start reviewing and signing documents."
                    : "Sign in to view and sign your documents."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="flex flex-col gap-2">
                      {error}
                      {needsConfirmation && (
                        <button
                          type="button"
                          onClick={resend}
                          disabled={cooldown > 0}
                          className="w-fit font-medium underline underline-offset-4 disabled:no-underline disabled:opacity-60"
                        >
                          {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}
                        </button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {isSignup && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      required
                      autoComplete="name"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className="pr-10"
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      placeholder={isSignup ? "At least 6 characters" : "Your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
                  {submitting && <Loader2Icon className="animate-spin" />}
                  {isSignup ? "Create account" : "Sign in"}
                </Button>
              </form>

              {isSignup && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2Icon className="size-3.5" />
                  New accounts start with the employee role.
                </p>
              )}

              <p className="text-sm text-muted-foreground">
                {isSignup ? "Already have an account? " : "Don't have an account? "}
                <Link
                  to={isSignup ? "/login" : "/signup"}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {isSignup ? "Sign in" : "Sign up"}
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
