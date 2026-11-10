import { pageActor } from "@/lib/core-server";
import { ProfileForm } from "@/modules/core/components/profile-form";
export default async function ProfilePage() {
  return <ProfileForm actor={await pageActor()} />;
}
