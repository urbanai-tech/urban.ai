import { redirect } from "next/navigation";

/**
 * /plans/v2 - alias legado. Mantem queries antigas como ?upsell=quota.
 */
export default async function PlansV2AliasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const qs = query.toString();
  redirect(qs ? `/plans?${qs}` : "/plans");
}
