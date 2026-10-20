import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConnectionGuide } from "@/components/ConnectionGuide";
import { InstallInstructions } from "@/components/InstallPrompt";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help — ISB Deadline Tracker" },
      {
        name: "description",
        content:
          "How the deadline tracker gets your dates, what it can and cannot do, and how to fix a broken connection.",
      },
      { property: "og:title", content: "Help — ISB Deadline Tracker" },
      {
        property: "og:description",
        content: "How the deadline tracker gets your dates and what it can and cannot do.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "Where do these dates come from?",
    a: "Straight from eLearn: assignment due dates and cut-offs, quiz close times, forum due dates, the course calendar, and dates written into course text. Every card shows which one it came from.",
  },
  {
    q: "Can this app submit work or change anything?",
    a: "No. It only reads. It cannot submit, post, edit or delete anything in eLearn, and it never has your password.",
  },
  {
    q: "Why does one card say the sources disagree?",
    a: "The course calendar and the activity page sometimes carry different times. Both are shown so you can check the activity page in eLearn and rely on that.",
  },
  {
    q: "What does “mentioned in course text” mean?",
    a: "A date written in a course description or a section body rather than set as a real due date. It is a hint, not an official deadline — always confirm it in eLearn.",
  },
  {
    q: "How often does it refresh?",
    a: "About every 30 minutes, even when this tracker is closed. Refresh now requests an extra update with a short wait between manual refreshes. Last synced changes only after fresh deadline data is saved; unavailable sections retain their previous dates.",
  },
  {
    q: "My connection stopped working",
    a: "eLearn connection codes expire. Open Settings and choose Reconnect with a new link. There is no need to disconnect or delete your saved deadlines.",
  },
] as const;

function HelpPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          What this tool does, what it cannot do, and how to reconnect if something stops working.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Common questions</h2>
        <Accordion type="single" collapsible className="surface-card px-4">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Connect eLearn</h2>
        <ConnectionGuide />
      </section>

      <section className="surface-card p-4">
        <InstallInstructions />
      </section>
    </div>
  );
}
