import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatContainerNumber } from "@/lib/container-number";
import { LOGO_MARK_PNG } from "./logo";
import { SIGNATURE_PNG, STAMP_LOGO_PNG } from "./stamp";

// Brand palette (from the logo)
const NAVY = "#192440";
const GOLD = "#C6A04F";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f6f7fb";
// Rubber-stamp ink
const STAMP = "#2344b2";

// Wrap whole words only ("cargo-wor-thy" looks sloppy on a legal document).
Font.registerHyphenationCallback((word) => [word]);

export interface InvoiceData {
  number: string;
  issuedAt: Date;
  status: "DRAFT" | "SENT";
  company: {
    legalName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    rcNumber?: string;
    bank: { name: string; accountName: string; accountNumber: string };
  };
  customer: { name: string; company?: string | null; email: string; phone: string; address?: string | null };
  fulfilment: { method: "PICKUP" | "DELIVERY"; address?: string | null; zone?: string | null; terminals: string[] };
  /** Website orders only (paid online via Paystack). Admin-raised invoices have none. */
  order: { reference: string; channel: string | null; paystackId: string | null } | null;
  paidAt: Date | null;
  /** Payment due date — admin-raised invoices awaiting payment. */
  dueAt: Date | null;
  lines: { description: string; containerNumber: string; quantity: number; unitPriceKobo: number }[];
  subtotalKobo: number;
  deliveryKobo: number;
  totalKobo: number;
  note?: string | null;
}

// Built-in PDF fonts have no ₦ glyph, so amounts use the ISO code (standard on invoices).
const money = (kobo: number) => `NGN ${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Lagos" });

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
  cCont: { width: 110 },
  cQty: { width: 30, textAlign: "center" },
  cUnit: { width: 86, textAlign: "right" },
  cAmt: { width: 90, textAlign: "right" },
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

  closing: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22 },
  closingLeft: { width: 300 },
  bankBox: { borderWidth: 1, borderColor: LINE, borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 4, padding: 12 },
  bankRow: { flexDirection: "row", marginTop: 3 },
  bankLabel: { width: 84, color: MUTED },
  bankValue: { flex: 1, fontFamily: "Helvetica-Bold", color: NAVY },
  accountNo: { fontFamily: "Courier-Bold", fontSize: 13, color: NAVY, letterSpacing: 1.5 },

  signBlock: { width: 190, alignItems: "center" },
  stamp: { width: 184, borderWidth: 1.6, borderColor: STAMP, paddingVertical: 7, paddingHorizontal: 9, transform: "rotate(-2deg)", opacity: 0.92 },
  stampHead: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  stampLogo: { width: 38, height: 24, marginRight: 6 },
  stampName: { fontFamily: "Helvetica-Bold", fontSize: 17, color: STAMP, letterSpacing: 0.5, lineHeight: 1 },
  stampSub: { fontFamily: "Helvetica-Bold", fontSize: 6.5, color: STAMP, letterSpacing: 0.6, marginTop: 5, textAlign: "right" },
  stampRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 9 },
  stampLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: STAMP, width: 30 },
  stampLine: { flex: 1, minHeight: 12, borderBottomWidth: 1, borderBottomColor: STAMP, borderBottomStyle: "dashed" },
  stampDate: { fontFamily: "Helvetica-Oblique", fontSize: 9, color: STAMP, paddingLeft: 8, lineHeight: 1.2 },
  signature: { position: "absolute", left: 76, top: 24, width: 72, height: 57 },
  signCaption: { fontSize: 7.5, color: MUTED, marginTop: 8 },

  draft: { position: "absolute", top: 330, left: 90, fontFamily: "Helvetica-Bold", fontSize: 110, color: "#e5e7eb", transform: "rotate(-30deg)", opacity: 0.6 },

  footerLine: { position: "absolute", bottom: 40, left: 40, right: 40, height: 1.5, backgroundColor: GOLD },
  footerLeft: { position: "absolute", bottom: 22, left: 40 },
  footerRight: { position: "absolute", bottom: 22, right: 40, width: 220, textAlign: "right" },
});

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { company, customer, order, fulfilment } = data;
  const companyLines = [company.address, `${company.phone} · ${company.email}`, company.website, company.rcNumber ? `RC ${company.rcNumber}` : null].filter(Boolean) as string[];
  const paid = !!data.paidAt;

  return (
    <Document title={`Invoice ${data.number}`} author={company.legalName} subject={order ? `Invoice ${data.number} for order ${order.reference}` : `Invoice ${data.number}`} creator={company.legalName} producer={company.legalName}>
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
              {order ? <Meta label="Order ref." value={order.reference} /> : null}
              {data.paidAt ? <Meta label="Paid on" value={date(data.paidAt)} /> : data.dueAt ? <Meta label="Due date" value={date(data.dueAt)} /> : null}
            </View>
          </View>

          {/* Parties */}
          <View style={s.parties}>
            <View style={s.partyBox}>
              <Text style={s.partyLabel}>BILLED TO</Text>
              <Text style={s.partyName}>{customer.name}</Text>
              {customer.company ? <Text>{customer.company}</Text> : null}
              {customer.address ? <Text>{customer.address}</Text> : null}
              <Text>{customer.email}</Text>
              <Text>{customer.phone}</Text>
            </View>
            <View style={s.partyBox}>
              <Text style={s.partyLabel}>{fulfilment.method === "DELIVERY" ? (order ? "DELIVERED TO" : "DELIVER TO") : order ? "COLLECTED FROM" : "COLLECTION"}</Text>
              {fulfilment.method === "DELIVERY" ? (
                <>
                  <Text>{fulfilment.address || "Address to be confirmed"}</Text>
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
              <Text style={[s.th, s.cUnit]}>UNIT PRICE</Text>
              <Text style={[s.th, s.cAmt]}>AMOUNT</Text>
            </View>
            {data.lines.map((l, i) => (
              <View key={i} style={[s.tr, i % 2 === 1 ? { backgroundColor: SOFT } : {}]} wrap={false}>
                <Text style={s.cNo}>{i + 1}</Text>
                <Text style={s.cDesc}>{l.description}</Text>
                <Text style={[s.cCont, s.mono]}>{l.containerNumber ? formatContainerNumber(l.containerNumber) : "—"}</Text>
                <Text style={s.cQty}>{l.quantity}</Text>
                <Text style={s.cUnit}>{money(l.unitPriceKobo)}</Text>
                <Text style={s.cAmt}>{money(l.unitPriceKobo * l.quantity)}</Text>
              </View>
            ))}
          </View>

          {/* Totals + PAID stamp */}
          <View style={s.totalsWrap} wrap={false}>
            {data.paidAt ? (
              <View style={s.paidBox}>
                <Text style={s.paidText}>PAID</Text>
                <Text style={s.paidSub}>{date(data.paidAt)}{order?.channel ? ` · ${order.channel}` : ""}</Text>
              </View>
            ) : (
              <View />
            )}
            <View style={s.totals}>
              <TotalRow label="Subtotal" value={money(data.subtotalKobo)} />
              <TotalRow label={fulfilment.method === "DELIVERY" ? "Delivery" : "Pickup"} value={fulfilment.method === "DELIVERY" ? money(data.deliveryKobo) : "No charge"} />
              <View style={s.grand}>
                <Text style={s.grandText}>{paid ? "Total paid" : "Amount due"}</Text>
                <Text style={s.grandText}>{money(data.totalKobo)}</Text>
              </View>
            </View>
          </View>

          {data.note ? (
            <View style={s.section} wrap={false}>
              <Text style={s.sectionTitle}>NOTES</Text>
              <Text>{data.note}</Text>
            </View>
          ) : null}

          {/* Payment details + company stamp */}
          <View style={s.closing} wrap={false}>
            <View style={s.closingLeft}>
              <Text style={s.sectionTitle}>PAYMENT DETAILS</Text>
              {order ? (
                <Text style={s.small}>
                  Paid online via Paystack{order.channel ? ` (${order.channel})` : ""}. Payment reference {order.reference}
                  {order.paystackId ? ` · transaction ${order.paystackId}` : ""}.
                </Text>
              ) : paid ? (
                <Text style={s.small}>Payment received with thanks on {date(data.paidAt!)}.</Text>
              ) : (
                <View style={s.bankBox}>
                  <Text style={{ color: MUTED, marginBottom: 4 }}>Please pay by bank transfer to:</Text>
                  <View style={s.bankRow}><Text style={s.bankLabel}>Bank</Text><Text style={s.bankValue}>{company.bank.name}</Text></View>
                  <View style={s.bankRow}><Text style={s.bankLabel}>Account name</Text><Text style={s.bankValue}>{company.bank.accountName}</Text></View>
                  <View style={[s.bankRow, { alignItems: "center" }]}><Text style={s.bankLabel}>Account number</Text><Text style={s.accountNo}>{company.bank.accountNumber}</Text></View>
                  <Text style={[s.small, { marginTop: 6 }]}>
                    Use <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY }}>{data.number}</Text> as the transfer reference{data.dueAt ? ` and pay by ${date(data.dueAt)}` : ""}, then send your proof of payment to {company.email}.
                  </Text>
                </View>
              )}
              <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 10, marginTop: 16 }}>Thank you for your business.</Text>
              <Text style={s.small}>Questions about this invoice? Contact {company.email} or {company.phone}, quoting {data.number}.</Text>
            </View>
            <CompanyStamp date={data.issuedAt} />
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

/** The company's rubber stamp, signed and dated — mirrors the physical stamp. */
function CompanyStamp({ date: d }: { date: Date }) {
  return (
    <View style={s.signBlock}>
      <View style={s.stamp}>
        <View style={s.stampHead}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={STAMP_LOGO_PNG} style={s.stampLogo} />
          <View>
            <Text style={s.stampName}>C-ZUCHI</Text>
            <Text style={s.stampSub}>GLOBAL SERVICE  LTD.</Text>
          </View>
        </View>
        <View style={s.stampRow}>
          <Text style={s.stampLabel}>Sign:</Text>
          <View style={s.stampLine} />
        </View>
        <View style={s.stampRow}>
          <Text style={s.stampLabel}>Date:</Text>
          <View style={s.stampLine}>
            <Text style={s.stampDate}>{shortDate(d)}</Text>
          </View>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        <Image src={SIGNATURE_PNG} style={s.signature} />
      </View>
      <Text style={s.signCaption}>Authorised signatory</Text>
    </View>
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
