import { notFound } from "next/navigation";
import Preview from "./Preview";

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Preview />;
}
