import AdminLoginForm from "@/components/AdminLoginForm";

export const metadata = { title: "Admin login — Excel's Gallery" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-ink">Admin</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Sign in to publish and manage gallery projects.
        </p>
        <div className="mt-8">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
