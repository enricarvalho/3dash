import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getCustomer, getSale, listSaleItems } from "@/lib/db";
import { dateBR } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, SALE_STATUS_LABEL } from "@/lib/domain";
import type { ReceiptData } from "@/lib/receipt-pdf";

/** Monta os dados do recibo de uma venda (cliente, itens, contatos da empresa). */
export function useReceiptData(saleId: string | null | undefined) {
  const enabled = !!saleId;
  const sale = useQuery({
    queryKey: ["sales", saleId],
    queryFn: () => getSale(saleId!),
    enabled,
  });
  const items = useQuery({
    queryKey: ["sale_items", saleId],
    queryFn: () => listSaleItems(saleId!),
    enabled,
  });
  const customer = useQuery({
    queryKey: ["customers", sale.data?.customer_id],
    queryFn: () => getCustomer(sale.data!.customer_id!),
    enabled: enabled && !!sale.data?.customer_id,
  });
  const profile = useQuery({
    queryKey: ["profiles", "me", "contact"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "company, contact_email, contact_phone, contact_instagram, contact_website, contact_address, pdf_footer_text",
        )
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const isLoading =
    enabled &&
    (sale.isLoading ||
      items.isLoading ||
      profile.isLoading ||
      (!!sale.data?.customer_id && customer.isLoading));

  const data = React.useMemo<ReceiptData | null>(() => {
    const s = sale.data;
    if (!s) return null;
    const list = items.data ?? [];
    const c = customer.data;
    const p = profile.data;
    const subtotal = list.reduce((t, i) => t + Number(i.quantity) * Number(i.unit_price), 0);
    return {
      company: p?.company || "3D Create",
      contactLines: [
        [p?.contact_email, p?.contact_phone].filter(Boolean).join(" · "),
        [p?.contact_instagram, p?.contact_website].filter(Boolean).join(" · "),
        p?.contact_address ?? "",
      ].filter(Boolean),
      footerText: p?.pdf_footer_text?.trim() || "3D Create · Impressão 3D · Goiânia/GO",
      number: s.id.slice(0, 8).toUpperCase(),
      saleDate: dateBR(s.sale_date),
      issuedAt: dateBR(new Date().toISOString()),
      status: SALE_STATUS_LABEL[s.status] ?? s.status,
      paymentMethod: s.payment_method
        ? (PAYMENT_METHOD_LABEL[s.payment_method] ?? s.payment_method)
        : "—",
      clientName: c?.name ?? s.guest_name ?? "Consumidor final",
      clientDoc: c?.doc_number ?? "",
      clientContact: [c?.phone ?? s.guest_phone, c?.email ?? s.guest_email]
        .filter(Boolean)
        .join(" · "),
      clientAddress: c
        ? [c.street, c.number, c.district, c.city && c.state ? `${c.city}/${c.state}` : c.city]
            .filter(Boolean)
            .join(", ")
        : "",
      items: list.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
      })),
      subtotal,
      discount: Number(s.discount) || 0,
      total: Number(s.total) || 0,
      notes: s.notes,
    };
  }, [sale.data, items.data, customer.data, profile.data]);

  return { data, isLoading, notFound: enabled && !sale.isLoading && !sale.data };
}
