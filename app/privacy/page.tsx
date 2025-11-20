export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-slate-100">
          Privacy Policy
        </h1>

        <a
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 mt-3"
        >
        Back To Dashboard
        </a>

        <section className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>
            This Privacy Policy explains how Kevin Mahana{" "}
            {"("}we, us, or our{")"} processes the personal data of users of
            the Last War Command Center application{" "}
            {"("}the Service{")"}. We are committed to protecting your privacy
            in compliance with the EU General Data Protection Regulation
            {" ("}GDPR{")"} and relevant local laws.
          </p>

          {/* 1. Data Controller */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">
              1. Data Controller
            </h2>
            <p>
              <strong>Data Controller:</strong> Kevin Mahana, Germany
              <br />
              <strong>Contact:</strong>{" "}
              <a
                href="mailto:lastwarheros.underfeed182@passmail.com"
                className="text-sky-400 hover:text-sky-300"
              >
                lastwarheros.underfeed182@passmail.com
              </a>
            </p>
          </div>

          {/* 2. Data we collect and purpose */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">
              2. Data We Collect and Purpose
            </h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Email Address:</strong> Used to create and manage your
                account and to authenticate you in the Service.
              </li>
              <li>
                <strong>Game Data:</strong> Building levels, hero stats, research
                progress, and other Last War information that you choose to
                enter into the Service.
              </li>
            </ul>
          </div>

          {/* 3. Legal basis and storage */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">
              3. Legal Basis and Storage
            </h2>
            <p>
              <strong>Legal Basis:</strong> We process your email address and
              game data as part of providing the Service to you, which is
              considered contractual necessity under GDPR.
              <br />
              <strong>Storage Location:</strong> Your application data is stored
              in Google Cloud Firestore, hosted in the region europe west three
              {" ("}Frankfurt, Germany{")"}.
              <br />
              <strong>Authentication:</strong> Email and login information is
              processed and stored by Firebase Authentication{" "}
              {"("}Google{")"}, which may use multiple Google Cloud regions to
              provide the service.
              <br />
              <strong>Sharing:</strong> We do not share your personal data with
              third parties for advertising or resale.
            </p>
          </div>

          {/* 4. Retention */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">
              4. Data Retention
            </h2>
            <p>
              Your data is retained while your account remains active. If you
              request deletion of your account, your personal data and game data
              associated with your user profile will be removed from Firestore
              within a reasonable time frame, subject to any legal obligations
              that require longer retention.
            </p>
          </div>

          {/* 5. Your rights */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">
              5. Your Rights {"("}EU and UK Users{")"}
            </h2>
            <p>
              Under GDPR and similar regulations, you have the right to:
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Request access to the personal data we hold about you.</li>
              <li>
                Request correction of inaccurate or incomplete personal data.
              </li>
              <li>
                Request deletion of your personal data where there is no longer
                a legal basis for us to process it.
              </li>
              <li>Request a copy of your data in a portable format.</li>
              <li>
                Object to or request restriction of certain types of processing.
              </li>
            </ul>
            <p>
              You can exercise these rights by contacting us at the email
              address listed above. You also have the right to lodge a complaint
              with your national data protection authority if you believe your
              rights have been violated.
            </p>
          </div>

          {/* 6. Changes to this policy */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">
              6. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in the Service, legal requirements, or technical
              developments. If changes are material, we will take reasonable
              steps to inform you, for example by showing a notice in the
              application.
            </p>
          </div>

          <p className="text-xs text-slate-600 mt-6">
            Last updated: {new Date().toLocaleDateString("en-US")}
          </p>
        </section>
      </div>
    </main>
  );
}
