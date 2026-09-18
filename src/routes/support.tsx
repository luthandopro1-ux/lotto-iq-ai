import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PublicPageShell, PublicSection } from "@/components/PublicPageShell";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — Support" },
      {
        name: "description",
        content: "Support and troubleshooting for Lotto IQ AI by Lum Tech Solutions.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <PublicPageShell eyebrow="Support" title="Get help with your Lotto IQ workflow">
      <p>
        Support is provided for the Lotto IQ AI product developed by Lum Tech Solutions. Please
        describe the page, action, time, and visible error. Never include your password, session
        token, admin key, service-role key, or other secret.
      </p>
      <PublicSection title="Account and sign-in">
        <p>
          Use the{" "}
          <Link className="text-primary hover:underline" to="/account">
            Account page
          </Link>{" "}
          to sign in or create an account. If email confirmation is enabled for the Supabase
          project, confirm the message before signing in again.
        </p>
      </PublicSection>
      <PublicSection title="Draw data and sync">
        <p>
          Draw synchronization is an operator-controlled workflow in the current release. If a draw
          appears missing or stale, record the draw date, session, and the page where it appears. Do
          not assume that a stale screen means a prediction or result is guaranteed.
        </p>
      </PublicSection>
      <PublicSection title="Premium and payments">
        <p>
          The Premium dashboard is currently an entitlement and product-readiness view. Purchases
          are not connected in this release. Do not send payment details through support.
        </p>
      </PublicSection>
      <PublicSection title="Notifications">
        <p>
          Notification preferences can be saved only after the account and consent flow is
          available. Delivery providers are not active yet, so saving a preference does not claim
          that an email or push message was sent.
        </p>
      </PublicSection>
      <PublicSection title="Contact checklist">
        <p>
          Include your account email only if necessary, the route or feature involved, the
          approximate time, browser/device, and a screenshot with personal or secret information
          removed. Lum Tech Solutions will use the smallest amount of information needed to
          investigate.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
