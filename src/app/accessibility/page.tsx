import { PublicPage } from "@/components/public/PublicPage";

export default function AccessibilityPage() {
  return (
    <PublicPage
      title="Accessibility"
      subtitle="Our commitment to usable digital services for all citizens."
    >
      <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          The interface uses semantic structure, visible focus states, and sufficient colour
          contrast. Forms expose labels and validation errors to assistive technologies.
        </p>
        <p>
          If you encounter a barrier while using this site or the portal, contact the Board
          via the Contact page and describe the page, device, and assistive technology used
          so we can improve the experience.
        </p>
      </div>
    </PublicPage>
  );
}
