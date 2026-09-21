import { PageHeader } from "../components/PageHeader";
import { ChangePasswordCard } from "./SettingsPage";

export function AccountPage() {
  return (
    <div>
      <PageHeader
        title="My Account"
        description="Manage your own account security"
        breadcrumb={[{ label: "Account" }]}
      />
      <ChangePasswordCard />
    </div>
  );
}
