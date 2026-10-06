import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatContainerNumber } from "@/lib/container-number";
import { LOGO_MARK_PNG } from "./logo";

// Brand palette (from the logo)
const NAVY = "#192440";
const GOLD = "#C6A04F";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f6f7fb";

export interface InvoiceData {
  number: string;
  issuedAt: Date;
  status: "DRAFT" | "SENT";
  company: { legalName: string; address: string; phone: string; email: string; website: string; rcNumber?: string };
  customer: { name: string; company?: string | null; email: string; phone: string };
  fulfilment: { method: "PICKUP" | "DELIVERY"; address?: string | null; zone?: string | null; terminals: string[] };
  order: { reference: string; paidAt: Date | null; channel: string | null; paystackId: string | null };
  lines: { description: string; containerNumber: string; unitPriceKobo: number }[];
  subtotalKobo: number;
  deliveryKobo: number;
  totalKobo: number;
  note?: string | null;
}

// Built-in PDF fonts have no ₦ glyph, so amounts use the ISO code (standard on invoices).
const money = (kobo: number) => `NGN ${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 64, paddingHorizontal: 0, fontFamily: "Helvetica", fontSize: 9, color: INK, lineHeight: 1.4 },
  topBar: { height: 6, backgroundColor: NAVY },
  goldBar: { height: 2, backgroundColor: GOLD },
  body: { paddingHorizontal: 40 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 28, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: LINE },
  brand: { flexDirection: "row", alignItems: "center", maxWidth: 300 },
  logo: { width: 64, height: 41, marginRight: 12 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 13, color: NAVY, letterSpacing: 0.3, lineHeight: 1.1, marginBottom: 4 },
  companyLine: { fontSize: 8, color: MUTED, marginTop: 1 },
  titleBox: { alignItems: "flex-end" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 26, color: NAVY, letterSpacing: 2, lineHeight: 1, marginBottom: 10 },
  metaRow: { flexDirection: "row", marginTop: 3 },
  metaLabel: { width: 78, textAlign: "right", color: MUTED, marginRight: 8 },
  metaValue: { fontFamily: "Helvetica-Bold", minWidth: 110, textAlign: "right" },

  parties: { flexDirection: "row", marginTop: 22, gap: 14 },
  partyBox: { flex: 1, backgroundColor: SOFT, borderRadius: 6, padding: 12 },
  partyLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: GOLD, letterSpacing: 1.2, marginBottom: 5 },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: NAVY, marginBottom: 2 },

  table: { marginTop: 22 },
  thead: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingVertical: 7, paddingHorizontal: 8 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 0.8 },
  tr: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  cNo: { width: 24 },
  cDesc: { flex: 1, paddingRight: 8 },
  cCont: { width: 120 },
  cQty: { width: 34, textAlign: "center" },
  cAmt: { width: 100, textAlign: "right" },
  mono: { fontFamily: "Courier-Bold", fontSize: 9.5, color: NAVY, letterSpacing: 0.5 },

  totalsWrap: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  paidBox: { borderWidth: 2, borderColor: "#0f9f6e", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-start", transform: "rotate(-4deg)", marginTop: 6, marginLeft: 8 },
  paidText: { fontFamily: "Helvetica-Bold", fontSize: 20, color: "#0f9f6e", letterSpacing: 3, lineHeight: 1 },
  paidSub: { fontSize: 7.5, color: "#0f9f6e", marginTop: 5, lineHeight: 1 },
  totals: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8 },
  grand: { flexDirection: "row", justifyContent: "space-between", backgroundColor: NAVY, color: "#ffffff", borderRadius: 4, paddingVertical: 8, paddingHorizontal: 8, marginTop: 4 },
  grandText: { fontFamily: "Helvetica-Bold", fontSize: 11 },

  section: { marginTop: 22 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, color: NAVY, letterSpacing: 1, marginBottom: 4 },
  small: { fontSize: 8, color: MUTED },

  draft: { position: "absolute", top: 330, left: 90, fontFamily: "Helvetica-Bold", fontSize: 110, color: "#e5e7eb", transform: "rotate(-30deg)", opacity: 0.6 },

  footerLine: { position: "absolute", bottom: 40, left: 40, right: 40, height: 1.5, backgroundColor: GOLD },
  footerLeft: { position: "absolute", bottom: 22, left: 40 },
  footerRight: { position: "absolute", bottom: 22, right: 40, width: 220, textAlign: "right" },
});

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { company, customer, order, fulfilment } = data;
  const companyLines = [company.address, `${company.phone} · ${company.email}`, company.website, company.rcNumber ? `RC ${company.rcNumber}` : null].filter(Boolean) as string[];

  return (
    <Document title={`Invoice ${data.number}`} author={company.legalName} subject={`Invoice ${data.number} for order ${order.reference}`} creator={company.legalName} producer={company.legalName}>
      <Page size="A4" style={s.page}>
        {data.status === "DRAFT" ? <Text style={s.draft} fixed>DRAFT</Text> : null}
        <View style={s.topBar} fixed />
        <View style={s.goldBar} fixed />

        <View style={s.body}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.brand}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
              <Image src={LOGO_MARK_PNG} style={s.logo} />
              <View>
                <Text style={s.company}>{company.legalName.toUpperCase()}</Text>
                {companyLines.map((l) => (
                  <Text key={l} style={s.companyLine}>{l}</Text>
                ))}
              </View>
            </View>
            <View style={s.titleBox}>
              <Text style={s.title}>INVOICE</Text>
              <Meta label="Invoice no." value={data.number} />
              <Meta label="Issue date" value={date(data.issuedAt)} />
              <Meta label="Order ref." value={order.reference} />
              {order.paidAt ? <Meta label="Paid on" value={date(order.paidAt)} /> : null}
            </View>
          </View>

          {/* Parties */}
          <View style={s.parties}>
            <View style={s.partyBox}>
              <Text style={s.partyLabel}>BILLED TO</Text>
              <Text style={s.partyName}>{customer.name}</Text>
              {customer.company ? <Text>{customer.company}</Text> : null}
              <Text>{customer.email}</Text>
              <Text>{customer.phone}</Text>
            </View>
            <View style={s.partyBox}>
              <Text style={s.partyLabel}>{fulfilment.method === "DELIVERY" ? "DELIVERED TO" : "COLLECTED FROM"}</Text>
              {fulfilment.method === "DELIVERY" ? (
                <>
                  <Text>{fulfilment.address}</Text>
                  {fulfilment.zone ? <Text style={s.small}>Delivery region: {fulfilment.zone}</Text> : null}
                </>
              ) : (
                <Text>{fulfilment.terminals.join(", ") || "C-ZUCHI terminal"}</Text>
              )}
            </View>
          </View>

          {/* Items */}
          <View style={s.table}>
            <View style={s.thead}>
              <Text style={[s.th, s.cNo]}>#</Text>
              <Text style={[s.th, s.cDesc]}>DESCRIPTION</Text>
              <Text style={[s.th, s.cCont]}>CONTAINER NO.</Text>
              <Text style={[s.th, s.cQty]}>QTY</Text>
              <Text style={[s.th, s.cAmt]}>AMOUNT</Text>
            </View>
            {data.lines.map((l, i) => (
              <View key={i} style={[s.tr, i % 2 === 1 ? { backgroundColor: SOFT } : {}]} wrap={false}>
                <Text style={s.cNo}>{i + 1}</Text>
                <Text style={s.cDesc}>{l.description}</Text>
                <Text style={[s.cCont, s.mono]}>{formatContainerNumber(l.containerNumber)}</Text>
                <Text style={s.cQty}>1</Text>
                <Text style={s.cAmt}>{money(l.unitPriceKobo)}</Text>
              </View>
            ))}
          </View>

          {/* Totals + PAID stamp */}
          <View style={s.totalsWrap} wrap={false}>
            {order.paidAt ? (
              <View style={s.paidBox}>
                <Text style={s.paidText}>PAID</Text>
                <Text style={s.paidSub}>{date(order.paidAt)}{order.channel ? ` · ${order.channel}` : ""}</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={s.totals}>
              <TotalRow label="Subtotal" value={money(data.subtotalKobo)} />
              <TotalRow label={fulfilment.method === "DELIVERY" ? "Delivery" : "Pickup"} value={fulfilment.method === "DELIVERY" ? money(data.deliveryKobo) : "No charge"} />
              <View style={s.grand}>
                <Text style={s.grandText}>Total paid</Text>
                <Text style={s.grandText}>{money(data.totalKobo)}</Text>
              </View>
            </View>
          </View>

          {/* Payment + notes */}
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>PAYMENT DETAILS</Text>
            <Text style={s.small}>
              Paid online via Paystack{order.channel ? ` (${order.channel})` : ""}. Payment reference {order.reference}
              {order.paystackId ? ` · transaction ${order.paystackId}` : ""}.
            </Text>
          </View>
          {data.note ? (
            <View style={s.section} wrap={false}>
              <Text style={s.sectionTitle}>NOTES</Text>
              <Text>{data.note}</Text>
            </View>
          ) : null}
          <View style={s.section} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 10 }}>Thank you for your business.</Text>
            <Text style={s.small}>Questions about this invoice? Contact {company.email} or {company.phone}, quoting {data.number}.</Text>
          </View>
        </View>

        {/* Footer: each piece absolutely positioned on its own. (react-pdf mis-places dynamic `render` text here, so no page count.) */}
        <View style={s.footerLine} fixed />
        <Text style={[s.small, s.footerLeft]} fixed>{company.legalName} · {company.website}</Text>
        <Text style={[s.small, s.footerRight]} fixed>{data.number}</Text>
      </Page>
    </Document>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.totalRow}>
      <Text style={{ color: MUTED }}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}
