"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role === "admin") router.replace("/admin");
    else if (user.role === "student") router.replace("/student");
    else router.replace("/dashboard");
  }, [user, router]);

  return null;
}
