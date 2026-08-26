import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { fetchFulfillRows, getShopInfo } from "../lib/orders.server";
import { buildFulfillWorkbook, exportFilename } from "../lib/xlsx.server";
import { COLUMNS } from "../lib/columns";

function shopToday(offsetMinutes: number) {
  const now = new Date(Date.now() + offsetMinutes * 60_000);
  return now.toISOString().slice(0, 10);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const shop = await getShopInfo(admin);
  return { shop, today: shopToday(shop.timezoneOffsetMinutes) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "preview");
  const from = String(form.get("from") || "");
  const to = String(form.get("to") || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false as const, error: "Ngày không hợp lệ." };
  }
  if (from > to) {
    return { ok: false as const, error: "Ngày bắt đầu phải trước ngày kết thúc." };
  }

  try {
    const shop = await getShopInfo(admin);
    const { rows, orderCount, itemCount } = await fetchFulfillRows(admin, {
      from,
      to,
      offsetMinutes: shop.timezoneOffsetMinutes,
    });

    if (intent === "export") {
      if (!rows.length) {
        return { ok: false as const, error: "Không có đơn nào trong khoảng ngày này." };
      }
      const buffer = await buildFulfillWorkbook(rows);
      return {
        ok: true as const,
        intent: "export" as const,
        filename: exportFilename(from, to),
        fileBase64: buffer.toString("base64"),
        orderCount,
        itemCount,
      };
    }

    return {
      ok: true as const,
      intent: "preview" as const,
      orderCount,
      itemCount,
      rows: rows.slice(0, 100),
      truncated: rows.length > 100,
    };
  } catch (error: any) {
    return {
      ok: false as const,
      error: error?.message || "Lỗi khi lấy đơn hàng từ Shopify.",
    };
  }
};

export default function Index() {
  const { shop, today } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const busy = fetcher.state !== "idle";
  const data = fetcher.data;

  // Tải file khi server trả về base64.
  useEffect(() => {
    if (!data || !("ok" in data) || !data.ok) return;
    if (data.intent !== "export" || !data.fileBase64) return;
    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [data]);

  const submit = (intent: "preview" | "export") =>
    fetcher.submit({ intent, from, to }, { method: "POST" });

  const preset = (days: number) => {
    const base = new Date(`${today}T00:00:00Z`);
    const start = new Date(base.getTime() - days * 86_400_000);
    setFrom(start.toISOString().slice(0, 10));
    setTo(days === 1 ? start.toISOString().slice(0, 10) : today);
  };

  const previewRows = useMemo(() => {
    if (!data || !("ok" in data) || !data.ok || data.intent !== "preview") return [];
    return (data.rows || []).map((r: any) => COLUMNS.map((c) => String(r[c.key] ?? "")));
  }, [data]);

  return (
    <Page>
      <TitleBar title="Fulfill Export" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Lấy đơn theo ngày
                </Text>
                <Badge tone="info">{`Múi giờ store: ${shop.ianaTimezone}`}</Badge>
              </InlineStack>

              <InlineStack gap="300" blockAlign="end" wrap>
                <Box minWidth="180px">
                  <TextField
                    label="Từ ngày"
                    type="date"
                    value={from}
                    onChange={setFrom}
                    autoComplete="off"
                  />
                </Box>
                <Box minWidth="180px">
                  <TextField
                    label="Đến ngày"
                    type="date"
                    value={to}
                    onChange={setTo}
                    autoComplete="off"
                  />
                </Box>
                <ButtonGroup>
                  <Button onClick={() => preset(0)}>Hôm nay</Button>
                  <Button onClick={() => preset(1)}>Hôm qua</Button>
                  <Button onClick={() => preset(7)}>7 ngày</Button>
                </ButtonGroup>
              </InlineStack>

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  loading={busy && fetcher.formData?.get("intent") === "preview"}
                  onClick={() => submit("preview")}
                >
                  Lấy đơn
                </Button>
                <Button
                  loading={busy && fetcher.formData?.get("intent") === "export"}
                  onClick={() => submit("export")}
                >
                  Tải file .xlsx
                </Button>
              </InlineStack>

              {data && "ok" in data && !data.ok ? (
                <Banner tone="critical" title="Không lấy được đơn">
                  <p>{data.error}</p>
                </Banner>
              ) : null}

              {data && "ok" in data && data.ok ? (
                <Banner tone="success">
                  <p>
                    {`${data.orderCount} đơn · ${data.itemCount} dòng (line item) trong khoảng ${from} → ${to}.`}
                    {data.intent === "export" ? " File đã được tải xuống." : ""}
                  </p>
                </Banner>
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>

        {previewRows.length ? (
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <Text as="h2" variant="headingMd">
                  Xem trước (tối đa 100 dòng)
                </Text>
              </Box>
              <DataTable
                columnContentTypes={COLUMNS.map((c) =>
                  c.key === "quantity" ? "numeric" : "text",
                )}
                headings={COLUMNS.map((c) => c.header)}
                rows={previewRows}
                truncate
              />
            </Card>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}
