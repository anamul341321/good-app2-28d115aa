import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/social/")({
  // /social নিজে কোনো পেজ নয় — সরাসরি নিউজ ফিডে পাঠিয়ে দিই (আগে সাদা স্ক্রিন আসত)
  beforeLoad: () => {
    throw redirect({ to: "/feed" });
  },
});
