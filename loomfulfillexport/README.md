# Loom Fulfill Export

App Shopify (embedded, Remix) lấy đơn hàng theo **khoảng ngày** và xuất ra file `.xlsx`
đúng định dạng file fulfill của nhà in (`Test ff belle.xlsx`).

- Mỗi **line item = 1 dòng**, `Order Id` lặp lại cho các item cùng đơn.
- Có cột **Product Name** (tên sản phẩm + variant) nằm giữa `*Product Code` và `*Quantity`, khớp cột F của sheet FULFILL.
- `Url Mockup` lấy từ line item property **`Custom Design Image`**; khách không upload → để trống.
- Server chạy trên Railway, app cài vào store qua Partner Dashboard (dev.shopify.com).

---

## 1. Bản đồ cột (Shopify → file xlsx)

| Cột trong file | Nguồn dữ liệu Shopify |
|---|---|
| `*Order Id` | `order.name` (VD `LC#8616`) |
| `*Shipping method` | `order.shippingLine.title`, viết HOA (VD `NORMAL SHIPPING`) |
| `*Sellers item sku` | `lineItem.sku`; nếu SKU trống → dùng `order.name` |
| `*Product Code` | để trống (nhà in tự điền) |
| `Product Name` | `lineItem.name` + variant (VD `... Metal Sign - 12.5 X 17.5 INCHES / Dallas Cowboys`) |
| `*Quantity` | `lineItem.currentQuantity` (đã trừ hàng refund/removed) |
| `*Shipping name` | `shippingAddress.name` |
| `*Shipping address1` / `address2` | `shippingAddress.address1` / `address2` |
| `*Shipping city` | `shippingAddress.city` |
| `*Shipping province` | `provinceCode` (VD `MD`) |
| `*Shipping country code` | `countryCodeV2` (VD `US`) |
| `*Shipping zip` | `shippingAddress.zip` (định dạng text, giữ số 0 đầu) |
| `Shipping phone1` | SĐT ship → SĐT đơn → SĐT khách; chỉ giữ chữ số |
| `Shipping phone2` | để trống |
| `Email` | `order.email` → `customer.email` |
| `Url Mockup` | property `Custom Design Image` (đổi được bằng `MOCKUP_PROPERTY_KEYS`) |
| `*Artwork`, `Shape`, `Remark` | để trống |

Đổi mapping: sửa `app/lib/columns.ts` (danh sách cột) và `app/lib/orders.server.ts` (logic lấy dữ liệu).

---

## 2. App trên dev.shopify.com (ĐÃ TẠO XONG)

App **Loom Fulfill Export** đã được tạo và release version `loom-fulfill-export-2`:

- Dashboard: https://dev.shopify.com/dashboard/198828422/apps/415393021953
- App URL tạm: `https://loom-fulfill-export.up.railway.app` (đổi thành domain Railway thật sau)
- Embedded: bật · Webhooks API version: `2026-07`
- Scopes: `read_orders,read_products`
- Redirect URLs: `/auth/callback`, `/auth/shopify/callback`, `/api/auth/callback`

**Client ID / Secret**: App settings → Credentials (bấm nút copy).
Dán vào Railway thành `SHOPIFY_API_KEY` và `SHOPIFY_API_SECRET`.

> **Lưu ý về scope:** `read_orders` chỉ trả về đơn trong **60 ngày gần nhất**.
> Cần lịch sử xa hơn: xin thêm `read_all_orders` (Protected customer data),
> rồi thêm vào `scopes` trong `shopify.app.toml`, biến `SCOPES`, và release version mới.

---

## 2b. Đưa code lên GitHub

```bash
unzip loom-fulfill-export.zip -d loom-fulfill-export
cd loom-fulfill-export
git init
git add .
git commit -m "Loom Fulfill Export app"
gh repo create loom-fulfill-export --private --source=. --push
# hoặc: tạo repo trống trên github.com rồi
# git remote add origin git@github.com:<user>/loom-fulfill-export.git && git push -u origin main
```

---

## 3. Deploy lên Railway

1. Push thư mục này lên GitHub.
2. Railway → project của bạn → **New** → **GitHub Repo** → chọn repo.
3. **New** → **Database** → **Add PostgreSQL** (cùng project).
4. Vào service app → tab **Variables**, thêm:

   | Biến | Giá trị |
   |---|---|
   | `SHOPIFY_API_KEY` | Client ID ở bước 2 |
   | `SHOPIFY_API_SECRET` | Client secret ở bước 2 |
   | `SCOPES` | `read_orders,read_products` |
   | `DATABASE_URL` | dùng **Add variable reference** → Postgres → `DATABASE_URL` |
   | `SHOPIFY_APP_URL` | domain public của service (điền sau bước 5) |
   | `MOCKUP_PROPERTY_KEYS` | `Custom Design Image` |
   | `NODE_ENV` | `production` |

5. Tab **Settings** → **Networking** → **Generate Domain** → copy domain
   (VD `https://loom-fulfill.up.railway.app`) → dán vào `SHOPIFY_APP_URL` rồi **Redeploy**.

Railway tự build bằng `Dockerfile`. Lúc khởi động, `npm run docker-start` chạy
`prisma db push` để tạo bảng `Session` rồi mới start server.

---

## 4. Cập nhật URL sau khi có domain Railway

Dev Dashboard → app → **Versions** → **Create version**, sửa:

- **App URL**: `https://<domain-railway>`
- **Allowed redirection URL(s)**:
  - `https://<domain-railway>/auth/callback`
  - `https://<domain-railway>/auth/shopify/callback`
  - `https://<domain-railway>/api/auth/callback`

Hoặc chạy tại máy: `npm run config:link` (chọn app Loom Fulfill Export) → sửa URL trong `shopify.app.toml` → `npm run deploy`.

---

## 5. Cài vào store

Dev Dashboard → app → **Overview** → **Install app** / **Select store** → chọn store `b8t7nn-dr` → **Install**.
App hiện trong Shopify Admin → **Apps** → *Loom Fulfill Export*.

Dùng: chọn **Từ ngày / Đến ngày** (theo múi giờ store) → **Lấy đơn** để xem trước →
**Tải file .xlsx** để tải file fulfill.

---

## 6. Chạy ở máy local (tuỳ chọn)

```bash
npm install
cp .env.example .env      # điền key + DATABASE_URL (Postgres local hoặc Railway)
npm run config:link
npm run dev               # Shopify CLI tự tạo tunnel
```

## 7. Kiểm thử offline

```bash
npm run verify
```

Chạy dữ liệu giả qua đúng code mapping + sinh file `.xlsx`, kiểm tra: quy đổi múi giờ,
bỏ line item đã refund, viết hoa shipping method, lấy đúng `Custom Design Image`,
chuẩn hoá số điện thoại.

---

## Cấu trúc chính

```
app/lib/columns.ts        # định nghĩa 19 cột + tên property mockup
app/lib/orders.server.ts  # query GraphQL theo ngày + map sang dòng dữ liệu
app/lib/xlsx.server.ts    # sinh file xlsx (header xám, freeze pane, zip/phone dạng text)
app/routes/app._index.tsx # UI: chọn ngày, Lấy đơn, xem trước, Tải file
scripts/verify-export.ts  # test offline
```
