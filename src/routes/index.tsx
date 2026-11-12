import { createFileRoute } from "@tanstack/react-router";
import { AgriApp } from "@/features/agri/app";

// The whole shop workspace lives in src/features/agri. This route only mounts it.
export const Route = createFileRoute("/")({ component: AgriApp });
