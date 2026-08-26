import { MOCKUP_PROPERTY_KEYS, type FulfillRow } from "./columns";

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const SHOP_QUERY = `#graphql
  query ShopTimezone {
    shop {
      name
      ianaTimezone
      timezoneOffsetMinutes
    }
  }
`;

const ORDERS_QUERY = `#graphql
  query FulfillOrders($query: String!, $cursor: String) {
    orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        createdAt
        email
        phone
        note
        displayFinancialStatus
        displayFulfillmentStatus
        shippingLine { title }
        customer { phone email }
        shippingAddress {
          name
          address1
          address2
          city
          province
          provinceCode
          country
          countryCodeV2
          zip
          phone
        }
        lineItems(first: 100) {
          nodes {
            id
            name
            sku
            quantity
            currentQuantity
            variantTitle
            customAttributes { key value }
          }
        }
      }
    }
  }
`;

export type ShopInfo = { name: string; ianaTimezone: string; timezoneOffsetMinutes: number };

export async function getShopInfo(admin: AdminClient): Promise<ShopInfo> {
  const res = await admin.graphql(SHOP_QUERY);
  const body = (await res.json()) as any;
  const shop = body?.data?.shop;
  return {
    name: shop?.name ?? "",
    ianaTimezone: shop?.ianaTimezone ?? "UTC",
    timezoneOffsetMinutes: shop?.timezoneOffsetMinutes ?? 0,
  };
}

/**
 * "2026-08-26" + offset của store -> mốc UTC ISO để đưa vào query created_at.
 * endOfDay = true -> 23:59:59.999 theo giờ store.
 */
export function localDateToUtcIso(
  date: string,
  offsetMinutes: number,
  endOfDay = false,
): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const end = endOfDay ? 24 * 60 * 60 * 1000 - 1 : 0;
  return new Date(base + end - offsetMinutes * 60_000).toISOString();
}

function digitsOnly(value?: string | null): string {
  if (!value) return "";
  const cleaned = value.replace(/[^\d+]/g, "").replace(/\+/g, "");
  return cleaned;
}

function pickMockupUrl(attrs: { key: string; value: string | null }[]): string {
  for (const wanted of MOCKUP_PROPERTY_KEYS) {
    const hit = attrs.find(
      (a) => (a.key || "").trim().toLowerCase().replace(/:$/, "") === wanted,
    );
    if (hit?.value && hit.value.trim()) return hit.value.trim();
  }
  return "";
}

export type FetchResult = {
  rows: FulfillRow[];
  orderCount: number;
  itemCount: number;
};

export async function fetchFulfillRows(
  admin: AdminClient,
  opts: { from: string; to: string; offsetMinutes: number },
): Promise<FetchResult> {
  const startIso = localDateToUtcIso(opts.from, opts.offsetMinutes, false);
  const endIso = localDateToUtcIso(opts.to, opts.offsetMinutes, true);
  const query = `created_at:>='${startIso}' AND created_at:<='${endIso}'`;

  const rows: FulfillRow[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  let orderCount = 0;
  let guard = 0;

  while (hasNext && guard < 200) {
    guard += 1;
    const res = await admin.graphql(ORDERS_QUERY, {
      variables: { query, cursor },
    });
    const body = (await res.json()) as any;

    if (body.errors?.length) {
      throw new Error(
        body.errors.map((e: any) => e.message).join(" | ") || "GraphQL error",
      );
    }

    const conn = body?.data?.orders;
    if (!conn) throw new Error("Không đọc được dữ liệu đơn hàng từ Shopify.");

    for (const order of conn.nodes as any[]) {
      orderCount += 1;
      const addr = order.shippingAddress ?? {};
      const phone = digitsOnly(
        addr.phone || order.phone || order.customer?.phone || "",
      );
      const method = (order.shippingLine?.title || "").toUpperCase();

      for (const li of order.lineItems.nodes as any[]) {
        const qty = li.currentQuantity ?? li.quantity ?? 0;
        if (!qty) continue;
        const attrs = (li.customAttributes || []).filter(
          (a: any) => a && !String(a.key || "").startsWith("_"),
        );

        rows.push({
          orderId: order.name,
          shippingMethod: method,
          sellersItemSku: li.sku || order.name,
          productCode: "",
          quantity: qty,
          shippingName: addr.name || "",
          address1: addr.address1 || "",
          address2: addr.address2 || "",
          city: addr.city || "",
          province: addr.provinceCode || addr.province || "",
          countryCode: addr.countryCodeV2 || "",
          zip: addr.zip || "",
          phone1: phone,
          phone2: "",
          email: order.email || order.customer?.email || "",
          urlMockup: pickMockupUrl(attrs),
          artwork: "",
          shape: "",
          remark: "",
        });
      }
    }

    hasNext = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }

  return { rows, orderCount, itemCount: rows.length };
}
