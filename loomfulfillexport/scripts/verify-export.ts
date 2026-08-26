/**
 * Kiểm thử offline: giả lập dữ liệu Shopify -> sinh file xlsx -> so header với file mẫu.
 * Chạy: npm run verify
 */
import { fetchFulfillRows, localDateToUtcIso } from "../app/lib/orders.server";
import { buildFulfillWorkbook } from "../app/lib/xlsx.server";
import { writeFileSync } from "node:fs";

const ORDER_FIXTURE = {
  data: {
    orders: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        {
          id: "gid://shopify/Order/8822490267934",
          name: "LC#8616",
          createdAt: "2026-08-25T21:15:00-04:00",
          email: "reggiecoram1222@gmail.com",
          phone: null,
          note: null,
          displayFinancialStatus: "PAID",
          displayFulfillmentStatus: "UNFULFILLED",
          shippingLine: { title: "Normal Shipping" },
          customer: { phone: null, email: "reggiecoram1222@gmail.com" },
          shippingAddress: {
            name: "Reginald L Coram",
            address1: "5916 Plata St",
            address2: "House",
            city: "Clinton",
            province: "Maryland",
            provinceCode: "MD",
            country: "United States",
            countryCodeV2: "US",
            zip: "20735",
            phone: null,
          },
          lineItems: {
            nodes: [
              {
                id: "1",
                name: "Custom Photo Name Football Metal Sign",
                sku: "MS-RECT-12517",
                quantity: 1,
                currentQuantity: 1,
                variantTitle: "Rectangular Metal Sign / 12.5 X 17.5 INCHES / Dallas Cowboys",
                customAttributes: [
                  { key: "Custom Design Image", value: "https://cdn.shopify.com/uploads/design-abc.jpg" },
                  { key: "Portrait Image", value: "https://cdn.shopify.com/uploads/portrait-abc.jpg" },
                  { key: "Custom Name", value: "Reggie" },
                  { key: "_hidden", value: "ignore-me" },
                ],
              },
            ],
          },
        },
        {
          id: "gid://shopify/Order/8822454649118",
          name: "LC#8614",
          createdAt: "2026-08-25T20:55:00-04:00",
          email: "",
          phone: "+1 (614) 984-8546",
          note: null,
          displayFinancialStatus: "PAID",
          displayFulfillmentStatus: "UNFULFILLED",
          shippingLine: { title: "Fast Shipping" },
          customer: { phone: null, email: "" },
          shippingAddress: {
            name: "Barbara Sailor",
            address1: "3034 Hiawatha St",
            address2: null,
            city: "Columbus",
            province: "Ohio",
            provinceCode: "OH",
            country: "United States",
            countryCodeV2: "US",
            zip: "43224",
            phone: null,
          },
          lineItems: {
            nodes: [
              {
                id: "2",
                name: "Item A",
                sku: "SKU-A",
                quantity: 2,
                currentQuantity: 2,
                variantTitle: "A",
                customAttributes: [],
              },
              {
                id: "3",
                name: "Item B (đã refund)",
                sku: "SKU-B",
                quantity: 1,
                currentQuantity: 0,
                variantTitle: "B",
                customAttributes: [{ key: "Custom Design Image", value: "" }],
              },
            ],
          },
        },
      ],
    },
  },
};

const admin = {
  graphql: async (query: string) => {
    const payload = query.includes("ShopTimezone")
      ? { data: { shop: { name: "Loom Custom", ianaTimezone: "America/New_York", timezoneOffsetMinutes: -240 } } }
      : ORDER_FIXTURE;
    return new Response(JSON.stringify(payload));
  },
};

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
  } else {
    console.log("PASS:", label);
  }
}

async function main() {
  assert(
    localDateToUtcIso("2026-08-26", -240, false) === "2026-08-26T04:00:00.000Z",
    "đầu ngày theo giờ store -> UTC",
  );
  assert(
    localDateToUtcIso("2026-08-26", -240, true) === "2026-08-27T03:59:59.999Z",
    "cuối ngày theo giờ store -> UTC",
  );

  const { rows, orderCount, itemCount } = await fetchFulfillRows(admin as any, {
    from: "2026-08-25",
    to: "2026-08-26",
    offsetMinutes: -240,
  });

  assert(orderCount === 2, "đếm đủ 2 đơn");
  assert(itemCount === 2, "bỏ line item currentQuantity = 0");
  assert(rows[0].orderId === "LC#8616", "Order Id = order name");
  assert(rows[0].shippingMethod === "NORMAL SHIPPING", "Shipping method viết hoa");
  assert(rows[0].urlMockup === "https://cdn.shopify.com/uploads/design-abc.jpg", "Url Mockup = Custom Design Image");
  assert(rows[1].urlMockup === "", "không có Custom Design Image -> để trống");
  assert(rows[0].province === "MD" && rows[0].countryCode === "US", "province/country dùng mã");
  assert(rows[1].phone1 === "16149848546", "phone chỉ còn chữ số");
  assert(rows[1].quantity === 2, "quantity theo currentQuantity");
  assert(rows[1].sellersItemSku === "SKU-A", "Sellers item sku = SKU line item");

  const buf = await buildFulfillWorkbook(rows);
  writeFileSync("/tmp/verify-output.xlsx", buf);
  console.log("Đã ghi /tmp/verify-output.xlsx", buf.length, "bytes");
}

main();
