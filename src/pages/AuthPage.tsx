import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MailCheckIcon,
} from "lucide-react"

import { Logo } from "@/components/Logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

const RESEND_COOLDOWN = 60

const steps = [
  "A manager uploads a PDF and picks who needs to sign it.",
  "Each employee reviews the document and signs on screen.",
  "The signed copy is saved and the manager sees who signed, and when.",
]

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup"
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isManager, setIsManager] = useState(false)
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
          data: {
            full_name: fullName.trim(),
            role: isManager ? "manager" : "employee",
          },
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
      <aside className="hidden flex-col justify-between bg-[oklch(0.27_0.05_160)] p-12 text-[oklch(0.96_0.01_95)] lg:flex">
        <Logo size="lg" className="[&>span:first-child]:bg-[oklch(0.96_0.01_95)] [&>span:first-child]:text-[oklch(0.27_0.05_160)]" />
        <div className="flex max-w-md flex-col gap-10">
          <h2 className="font-display text-5xl font-normal leading-[1.1] tracking-tight">
            Paperwork that gets signed, not chased.
          </h2>
          <ol className="flex flex-col gap-4 border-t border-white/15 pt-6 text-sm leading-relaxed text-white/75">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="font-display text-base text-white/50">0{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-white/50">Secure document signing for teams</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Logo className="lg:hidden" />

          {awaitingEmail ? (
            <div className="flex flex-col gap-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <MailCheckIcon className="size-6" />
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="font-display text-3xl font-medium tracking-tight">Check your email</h1>
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
                <h1 className="font-display text-3xl font-medium tracking-tight">
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
                {isSignup && (
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium">
                    {[
                      { value: false, label: "Employee" },
                      { value: true, label: "Manager" },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={isManager === option.value}
                        onClick={() => setIsManager(option.value)}
                        className={
                          isManager === option.value
                            ? "rounded-md bg-background py-1.5 shadow-sm"
                            : "rounded-md py-1.5 text-muted-foreground hover:text-foreground"
                        }
                      >
                        {option.label}
                      </button>
                    ))}
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
