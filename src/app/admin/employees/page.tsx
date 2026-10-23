import { redirect } from "next/navigation";

/**
 * Terminology: people managed by the system are New Placement / Pensioner.
 * Legacy /admin/employees URL redirects to registration workspace.
 */
export default function EmployeesRedirectPage() {
  redirect("/admin/intake");
}
