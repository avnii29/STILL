import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Cookies",
  description: "What STILL stores in your browser.",
};

export default function CookiesPage() {
  return (
    <LegalShell title="Cookies and storage">
      <p>
        This list comes from the current repository. STILL does not invent cookies to look more
        complete.
      </p>

      <section>
        <h2>Strictly necessary</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase Auth session cookies (typically <code>sb-*-auth-token</code>)</td>
              <td>Supabase via this application</td>
              <td>Keep you signed in</td>
              <td>Follows the Supabase project session / refresh settings</td>
              <td>STRICTLY NECESSARY</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Functional</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>IndexedDB <code>still-guest</code></td>
              <td>This application, in your browser only</td>
              <td>
                Guest threads created when you enter STILL without an account. Not uploaded until you
                choose which memories to bring into an account.
              </td>
              <td>Until you clear them, they expire after 7 days, or selected threads migrate</td>
              <td>FUNCTIONAL</td>
            </tr>
            <tr>
              <td>Legacy <code>localStorage</code> key <code>still-guest-v1</code></td>
              <td>This application, in your browser only</td>
              <td>Older guest workspace. Copied once into IndexedDB, then removed.</td>
              <td>Until the one-time migration runs</td>
              <td>FUNCTIONAL</td>
            </tr>
            <tr>
              <td>Cache API <code>still-shell-v1</code></td>
              <td>This application (service worker)</td>
              <td>Offline shell: home, login, offline page, logo, manifest</td>
              <td>Until the service worker updates the cache</td>
              <td>FUNCTIONAL</td>
            </tr>
            <tr>
              <td>Web Push subscription</td>
              <td>Your browser + STILL database</td>
              <td>Deliver reminders you enabled</td>
              <td>Until you disable push or delete the account</td>
              <td>FUNCTIONAL</td>
            </tr>
          </tbody>
        </table>
        <p>
          Guest STILL uses IndexedDB (<code>still-guest</code>). An older localStorage key is read
          once and removed. The Supabase browser client may keep session material in cookies managed
          by the server.
        </p>
      </section>

      <section>
        <h2>Analytics</h2>
        <p>None. NO OPTIONAL ANALYTICS CURRENTLY INSTALLED.</p>
      </section>

      <section>
        <h2>Marketing</h2>
        <p>None.</p>
      </section>

      <section>
        <h2>Consent banner</h2>
        <p>
          Because STILL currently uses only necessary session technology plus optional features you
          switch on yourself (push, microphone, integrations), there is no cookie wall and no
          pre-ticked marketing choice.
        </p>
      </section>
    </LegalShell>
  );
}
