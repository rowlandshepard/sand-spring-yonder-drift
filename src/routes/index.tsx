import { createFileRoute } from "@tanstack/react-router";
import { StudyApp } from "@/components/study-app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <StudyApp />;
}
