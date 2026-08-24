"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StudentCourseRedirect() {
  const { secId } = useParams<{ secId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/student/courses/${secId}/classwork`);
  }, [secId, router]);

  return null;
}
