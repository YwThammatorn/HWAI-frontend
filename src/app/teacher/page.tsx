"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/dashboard"); }, [router]);
  return null;
}
