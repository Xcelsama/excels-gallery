import { redirect } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import { createClient } from "@/lib/supabase/server";

// Lives in the (protected) route group so it wraps /admin (the dashboard)
// but NOT /admin/login, which is a sibling route outside this group.
// Wrapping the login page too would redirect it to itself in a loop for
// any signed-out visitor.
export default async function AdminProtectedLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-dvh">
      <AdminHeader />
      <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">{children}</main>
    </div>
  );
}
