import { redirect } from "next/navigation";
import { getSessionProfile, staffHome } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSessionProfile();

  if (!session) {
    redirect("/login");
  }

  redirect(staffHome(session.profile.role));
}
