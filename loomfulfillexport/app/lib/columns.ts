/**
 * Cấu hình cột của file fulfillment (khớp 1:1 với file mẫu "Test ff belle.xlsx").
 * Sửa ở đây nếu nhà in đổi template.
 */
export type FulfillRow = {
  orderId: string;
  shippingMethod: string;
  sellersItemSku: string;
  productCode: string;
  productName: string;
  quantity: number | string;
  shippingName: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  countryCode: string;
  zip: string;
  phone1: string;
  phone2: string;
  email: string;
  urlMockup: string;
  artwork: string;
  shape: string;
  remark: string;
};

export const COLUMNS: {
  header: string;
  key: keyof FulfillRow;
  text?: boolean;
  width?: number;
}[] = [
  { header: "*Order Id", key: "orderId" },
  { header: "*Shipping method", key: "shippingMethod" },
  { header: "*Sellers item sku", key: "sellersItemSku" },
  { header: "*Product Code", key: "productCode" },
  { header: "Product Name", key: "productName", width: 46 },
  { header: "*Quantity", key: "quantity" },
  { header: "*Shipping name", key: "shippingName" },
  { header: "*Shipping address1", key: "address1" },
  { header: "Shipping address2", key: "address2" },
  { header: "*Shipping city", key: "city" },
  { header: "*Shipping province", key: "province" },
  { header: "*Shipping country code", key: "countryCode" },
  { header: "*Shipping zip", key: "zip", text: true },
  { header: "Shipping phone1", key: "phone1", text: true },
  { header: "Shipping phone2", key: "phone2", text: true },
  { header: "Email", key: "email" },
  { header: "Url Mockup", key: "urlMockup" },
  { header: "*Artwork", key: "artwork" },
  { header: "Shape", key: "shape" },
  { header: "Remark", key: "remark" },
];

/**
 * Tên line item property được dùng làm "Url Mockup".
 * Khớp không phân biệt hoa thường / khoảng trắng. Có thể khai báo nhiều tên,
 * cách nhau bằng dấu phẩy, qua biến môi trường MOCKUP_PROPERTY_KEYS.
 */
export const MOCKUP_PROPERTY_KEYS = (
  process.env.MOCKUP_PROPERTY_KEYS || "Custom Design Image"
)
  .split(",")
  .map((k) => k.trim().toLowerCase())
  .filter(Boolean);
