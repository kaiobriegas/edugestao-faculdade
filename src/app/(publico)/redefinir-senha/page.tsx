import { AuthForm } from "@/modules/core/components/auth-form";
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <AuthForm
      key="redefinir"
      mode="redefinir"
      token={(await searchParams).token || ""}
    />
  );
}
