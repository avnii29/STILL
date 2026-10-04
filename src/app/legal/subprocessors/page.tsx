import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Subprocessors",
  description: "Providers that can process STILL data.",
};

export default function SubprocessorsPage() {
  return (
    <LegalShell title="Subprocessors">
      <p>Only providers this product can actually call are listed. Locations are omitted where the repository does not record them.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4 font-medium">Provider</th>
              <th className="py-2 pr-4 font-medium">Purpose</th>
              <th className="py-2 pr-4 font-medium">Data involved</th>
              <th className="py-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3 pr-4 align-top">Supabase</td>
              <td className="py-3 pr-4 align-top">Authentication and database</td>
              <td className="py-3 pr-4 align-top">Account and application data</td>
              <td className="py-3 align-top">The region of the configured project. Not recorded here.</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">Google</td>
              <td className="py-3 pr-4 align-top">Calendar, only after you connect it</td>
              <td className="py-3 pr-4 align-top">Events needed for context and an approved change</td>
              <td className="py-3 align-top">Google&apos;s infrastructure</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 align-top">Cloudflare Turnstile</td>
              <td className="py-3 pr-4 align-top">Optional sign-up and sign-in challenge</td>
              <td className="py-3 pr-4 align-top">Verification metadata when keys are set. Not used when they are empty.</td>
              <td className="py-3 align-top">Cloudflare</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>No analytics provider. No email provider. No AI provider, unless an operator configures one later and updates this page.</p>
    </LegalShell>
  );
}
