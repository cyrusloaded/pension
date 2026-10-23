import Link from "next/link";
import {
  Shield,
  Users,
  FileCheck,
  CreditCard,
  ArrowRight,
  Building2,
  ClipboardList,
  HelpCircle,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const features = [
  {
    icon: Users,
    title: "Employee & Pensioner Records",
    description:
      "Centralized registry of civil servants and enrolled pensioners with full service history.",
  },
  {
    icon: FileCheck,
    title: "Retirement Processing",
    description:
      "Structured workflow from eligibility assessment through benefit approval and enrolment.",
  },
  {
    icon: CreditCard,
    title: "Pension Payments",
    description:
      "Monthly payment schedules, authorization, disbursement tracking, and reconciliation.",
  },
  {
    icon: Shield,
    title: "Secure Self-Service",
    description:
      "Pensioners can view entitlements, payment history, and submit verification evidence.",
  },
];

const quickLinks = [
  {
    href: "/retirement-process",
    icon: ClipboardList,
    title: "Retirement Process",
    description: "Steps and requirements for civil service retirement.",
  },
  {
    href: "/pensioner-guide",
    icon: HelpCircle,
    title: "Pensioner Guide",
    description: "Guidance for enrolled pensioners on using the portal.",
  },
  {
    href: "/services",
    icon: Building2,
    title: "Services",
    description: "Overview of pension administration services offered.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-primary">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-700/40 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-wider text-secondary-300">
                Government of Kogi State
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Civil Service Pension Management System
              </h1>
              <p className="mt-5 text-lg text-slate-300">
                A secure, centralized platform for administering civil service
                pensions across Kogi State — from employee records and
                retirement processing to monthly payments and pensioner
                self-service.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-md bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary-600"
                >
                  Access Portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center rounded-md border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Platform Capabilities
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Designed for state-wide pension administration with role-based
              access, audit trails, and secure workflows.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-white p-6 shadow-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Information for the Public
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-lg border border-border bg-slate-50 p-6 transition hover:border-primary/30 hover:shadow-card-hover"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                    <link.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900 group-hover:text-primary">
                    {link.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {link.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Read more
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Authorized Personnel &amp; Pensioners
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Log in to the secure portal to manage records, process cases, or
              view your pension details. Administrative accounts are provisioned
              by authorized administrators only.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              Go to Login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
