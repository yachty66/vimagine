import React from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
// import { CreditProvider } from "../../../CreditContext"; // Temporarily commented out

export default async function MainEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/inference");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, email, credits")
    .eq("id", user.id)
    .single();

  // Simple layout that completely overrides the parent layout
  return (
    // <CreditProvider initialCredits={profile?.credits ?? 0}> {/* Temporarily commented out */}
    <div className="fixed inset-0 bg-zinc-950 text-white overflow-hidden z-[9999]">
      {children}
    </div>
    // </CreditProvider> {/* Temporarily commented out */}
  );
}
