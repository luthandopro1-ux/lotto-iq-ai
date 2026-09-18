import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell, PublicSection } from "@/components/PublicPageShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Lotto IQ AI — Privacy Policy" },
      { name: "description", content: "Privacy policy for Lotto IQ AI by Lum Tech Solutions." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy policy"
      title="Privacy that matches what Lotto IQ AI actually does"
    >
      <p>
        <strong className="text-foreground">Effective date: 18 September 2026.</strong> This policy
        describes the current Lotto IQ AI web application developed by Lum Tech Solutions. It will
        be updated before any advertising, paid billing, or notification provider is activated.
      </p>
      <PublicSection title="Information we receive">
        <p>
          If you create an account, Supabase Auth processes your email address, authentication
          credentials, and session information. Lotto IQ AI stores the profile, personal workspace,
          workspace membership, workspace settings, Premium entitlement state, and notification
          preferences needed to operate the features you use.
        </p>
      </PublicSection>
      <PublicSection title="How we use information">
        <p>
          We use account information to authenticate you, maintain your workspace, protect private
          records with row-level security, and provide requested analysis features. We do not claim
          to use personal data to improve lottery odds, and the app does not guarantee outcomes.
        </p>
      </PublicSection>
      <PublicSection title="Sharing and providers">
        <p>
          The current application uses Supabase for authentication and database services. Premium
          provider fields and notification preferences exist as controlled foundations, but no
          payment provider, advertising network, email provider, or push-delivery provider is
          represented as active by this release.
        </p>
      </PublicSection>
      <PublicSection title="Retention and deletion">
        <p>
          Account records remain while your account is active or as needed to provide the service.
          Contact Lum Tech Solutions through the Support page to request account assistance or
          deletion. We will verify the request before taking account-level action.
        </p>
      </PublicSection>
      <PublicSection title="Security">
        <p>
          Customer tables use Supabase Row Level Security. Operator administration uses a separate
          admin-key boundary. Do not share passwords, session tokens, or administrator keys.
        </p>
      </PublicSection>
      <PublicSection title="Contact">
        <p>
          For privacy questions, use{" "}
          <a className="text-primary hover:underline" href="/support">
            Lotto IQ AI Support
          </a>{" "}
          and include enough detail for us to identify the issue without sending secrets.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
