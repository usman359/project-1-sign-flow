# Sign Flow

Document signing & management. React + Vite + Tailwind v4 + shadcn/ui, backed by Supabase (Postgres, Auth, Storage).

- **Employees** see the PDFs assigned to them, draw a signature, and submit. The signature, signer name and timestamp are stamped onto the last page (pdf-lib) and the signed copy is uploaded.
- **Managers** upload PDFs, assign them to employees, track who has signed and when, and view each signed PDF.

## Setup

```bash
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm install
npm run build && npx vite preview   # see note below about `npm run dev`
```

Database schema, RLS policies and storage buckets live in `supabase/migrations/`.

## Roles

Everyone signs up as an `employee`. Promote a manager in the Supabase SQL editor:

```sql
update public.profiles set role = 'manager' where email = 'someone@company.com';
```

## Notes

- New Supabase projects require email confirmation, and the built-in mailer only delivers to members of your Supabase org. For testing, turn off **Auth → Providers → Email → Confirm email**, or configure custom SMTP.
- `npm run dev` does not work while the project folder name contains `#` (Vite limitation). Rename the folder (e.g. `project-1-sign-flow`) to use the dev server.
- Signing goes through the `sign_assignment` RPC, so `signed_at` and `signer_name` are set by the server, not the client.
