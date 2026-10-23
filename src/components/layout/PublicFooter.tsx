import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-primary text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold">KSCSPMS</h3>
            <p className="mt-2 max-w-md text-sm text-slate-300">
              Kogi State Civil Service Pension Management System — the official
              platform for administering civil service pensions across Kogi
              State, Nigeria.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Quick Links
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-secondary-300">
                  About
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-secondary-300">
                  Services
                </Link>
              </li>
              <li>
                <Link
                  href="/retirement-process"
                  className="hover:text-secondary-300"
                >
                  Retirement Process
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="hover:text-secondary-300">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Legal
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy-policy"
                  className="hover:text-secondary-300"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-secondary-300">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link
                  href="/accessibility"
                  className="hover:text-secondary-300"
                >
                  Accessibility
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-secondary-300">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} Kogi State Government. All rights
            reserved.
          </p>
          <p className="mt-1">
            This system processes personal and financial data. Unauthorized
            access is prohibited.
          </p>
        </div>
      </div>
    </footer>
  );
}
