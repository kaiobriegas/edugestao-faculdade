import { pageActor } from "@/lib/core-server";
import { Shell } from "@/modules/core/components/shell";
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await pageActor();
  return <Shell actor={actor}>{children}</Shell>;
}
