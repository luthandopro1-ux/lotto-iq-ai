import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell, PublicSection } from "@/components/PublicPageShell";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — FAQ" },
      {
        name: "description",
        content: "Frequently asked questions about Lotto IQ AI by Lum Tech Solutions.",
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <PublicPageShell eyebrow="FAQ" title="Frequently asked questions">
      <PublicSection title="What is Lotto IQ AI?">
        <p>
          Lotto IQ AI is a historical lottery-results and strategy-analysis workspace developed by
          Lum Tech Solutions. It helps users inspect draw data, define strategies, compare signals,
          and understand historical results.
        </p>
      </PublicSection>
      <PublicSection title="Does it predict winning numbers?">
        <p>
          No. Lottery draws are random. The product presents analysis of historical data and
          user-defined strategies; it does not guarantee a result, change probability, or promise
          winnings.
        </p>
      </PublicSection>
      <PublicSection title="Can I create an account?">
        <p>
          Yes. The account foundation uses the configured Supabase project and creates a personal
          Lotto IQ workspace. Use the{" "}
          <a className="text-primary hover:underline" href="/account">
            Account page
          </a>{" "}
          to start.
        </p>
      </PublicSection>
      <PublicSection title="What is Premium?">
        <p>
          Premium is the planned paid tier for additional capabilities such as deeper history, more
          saved strategies, advanced backtesting, comparison views, alerts, exports, and an ad-free
          interface when advertising is activated. Purchases are not connected yet.
        </p>
      </PublicSection>
      <PublicSection title="Are notifications active?">
        <p>
          Notification consent preferences are being prepared separately from message delivery. A
          saved preference is not evidence that an email or push notification was delivered. A
          provider and delivery tracking must be configured before notifications are marketed as
          active.
        </p>
      </PublicSection>
      <PublicSection title="Is there an Android app?">
        <p>
          The current verified product is a web application. It has a PWA installation foundation
          planned for this phase. A Play Store package requires a completed native wrapper, signing
          key, store listing, privacy declarations, and release testing before it can be called
          ready.
        </p>
      </PublicSection>
      <PublicSection title="Where can I get help?">
        <p>
          Visit the{" "}
          <a className="text-primary hover:underline" href="/support">
            Support page
          </a>
          . Do not send passwords, payment details, session tokens, or admin keys.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
