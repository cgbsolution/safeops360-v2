// Supplier corrective-action view — one audit, reached by token.
//
// Rendered client-side on purpose. The token is in the URL, the API is public,
// and server-rendering it would put the token into the Next.js server's request
// logs on every view for no benefit.

import { SupplierPortalView } from "./portal-view";

export const dynamic = "force-dynamic";

export default async function SupplierPortalPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  return <SupplierPortalView token={token} />;
}
