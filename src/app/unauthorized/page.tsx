import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          Access Denied
        </h1>
        <p className="mt-2 max-w-md text-slate-600">
          You do not have permission to view this resource. If you believe this
          is an error, contact your system administrator.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/admin/dashboard"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
