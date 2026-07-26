import { redirect } from "next/navigation";
import { FEEDBACK_URL } from "@/components/site-links";

export default function FeedbackPage() {
  redirect(FEEDBACK_URL);
}
