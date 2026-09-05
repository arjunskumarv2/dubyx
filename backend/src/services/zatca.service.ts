import crypto from 'crypto';

/**
 * ZATCA (Zakat, Tax and Customs Authority) e-invoicing helpers — Saudi Arabia.
 *
 * Phase 1 "Generation" (mandatory since 4 Dec 2021) is fully implemented here:
 * every invoice carries a UUID, a Base64 TLV QR code and the mandatory fields,
 * and is rendered bilingually (Arabic is required by law).
 *
 * Phase 2 "Integration" adds a cryptographic stamp from a ZATCA-issued CSID and
 * clearance/reporting through the Fatoora API. The invoice hash chain and the
 * UBL 2.1 XML below are the inputs those steps need; the signing itself is left
 * to `signInvoice`, which stays inert until real onboarding credentials exist.
 */

export const VAT_STANDARD_RATE = 15; // KSA standard VAT rate since 1 July 2020

/* ─────────────────────────── Saudi identifiers ─────────────────────────── */

/**
 * Saudi VAT registration number: 15 digits, beginning and ending with "3".
 * (Structural check only — ZATCA does not publish a checksum algorithm.)
 */
export const isValidVatNumber = (vat?: string | null): boolean => {
  if (!vat) return false;
  const v = vat.replace(/\s/g, '');
  return /^3\d{13}3$/.test(v);
};

/** Saudi Commercial Registration (CR / السجل التجاري): 10 digits. */
export const isValidCrNumber = (cr?: string | null): boolean =>
  !!cr && /^\d{10}$/.test(cr.replace(/\s/g, ''));

/** Saudi mobile: 05XXXXXXXX or +9665XXXXXXXX (also accepts 9665… / 5…). */
export const isValidSaudiPhone = (phone?: string | null): boolean =>
  !!phone && /^(\+?966|0)?5\d{8}$/.test(phone.replace(/[\s-]/g, ''));

/** Normalise any accepted Saudi mobile form to +9665XXXXXXXX. */
export const normalizeSaudiPhone = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '');
  const local = digits.replace(/^966/, '').replace(/^0/, '');
  return `+966${local}`;
};

/** Saudi National Address postal code and additional number are both 4-5 digits. */
export const isValidPostalCode = (code?: string | null): boolean => !!code && /^\d{5}$/.test(code.trim());
export const isValidBuildingNumber = (n?: string | null): boolean => !!n && /^\d{4}$/.test(n.trim());
export const isValidAdditionalNumber = (n?: string | null): boolean => !!n && /^\d{4}$/.test(n.trim());

/* ─────────────────────────── VAT calculation ─────────────────────────── */

export type VatCategory = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';

/** ZATCA UBL tax category codes: S = standard, Z = zero-rated, E = exempt. */
export const vatCategoryCode = (category: VatCategory): 'S' | 'Z' | 'E' =>
  category === 'ZERO_RATED' ? 'Z' : category === 'EXEMPT' ? 'E' : 'S';

export const vatCategoryReason = (category: VatCategory): string | null =>
  category === 'ZERO_RATED'
    ? 'Zero-rated supply under Article 33/34 of the VAT Implementing Regulations'
    : category === 'EXEMPT'
      ? 'Exempt supply under Article 29 of the VAT Implementing Regulations'
      : null;

/** Effective VAT rate for a line — zero-rated and exempt lines always carry 0%. */
export const effectiveVatRate = (category: VatCategory, rate: number): number =>
  category === 'STANDARD' ? (rate ?? VAT_STANDARD_RATE) : 0;

/** Round to 2 decimals (halalas) the way ZATCA expects on invoice totals. */
export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

/* ─────────────────────────── Phase 1: TLV QR code ─────────────────────────── */

/**
 * One TLV field: 1-byte tag, 1-byte length, UTF-8 value. The length is a single
 * byte, so values are trimmed to 255 bytes on a character boundary (a long
 * Arabic trade name can otherwise overflow and corrupt the payload).
 */
const tlv = (tag: number, value: string): Buffer => {
  let val = Buffer.from(value, 'utf8');
  if (val.length > 255) {
    let cut = 255;
    // Do not split a multi-byte UTF-8 sequence
    while (cut > 0 && (val[cut] & 0xc0) === 0x80) cut--;
    val = val.subarray(0, cut);
  }
  return Buffer.concat([Buffer.from([tag]), Buffer.from([val.length]), val]);
};

export interface QrInput {
  sellerName: string;       // tag 1
  vatNumber: string;        // tag 2
  timestamp: Date | string; // tag 3 — ISO 8601 (Z)
  total: number;            // tag 4 — total including VAT
  vatTotal: number;         // tag 5 — VAT amount
  invoiceHash?: string;     // tag 6 — Phase 2
  signature?: string;       // tag 7 — Phase 2
  publicKey?: string;       // tag 8 — Phase 2
  stampSignature?: string;  // tag 9 — Phase 2, simplified invoices only
}

/**
 * Base64 TLV QR payload. Tags 1-5 are the Phase 1 mandatory set; tags 6-9 are
 * appended once a cryptographic stamp is available (Phase 2).
 */
export const generateQrCode = (input: QrInput): string => {
  const ts = input.timestamp instanceof Date ? input.timestamp : new Date(input.timestamp);
  // ZATCA expects ISO 8601 to the second (YYYY-MM-DDThh:mm:ssZ), without milliseconds
  const parts = [
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, ts.toISOString().replace(/\.\d{3}Z$/, 'Z')),
    tlv(4, input.total.toFixed(2)),
    tlv(5, input.vatTotal.toFixed(2)),
  ];
  if (input.invoiceHash) parts.push(tlv(6, input.invoiceHash));
  if (input.signature) parts.push(tlv(7, input.signature));
  if (input.publicKey) parts.push(tlv(8, input.publicKey));
  if (input.stampSignature) parts.push(tlv(9, input.stampSignature));
  return Buffer.concat(parts).toString('base64');
};

/** Decode a TLV QR payload back to its tags — used by the QR verification endpoint. */
export const decodeQrCode = (base64: string): Record<number, string> => {
  const buf = Buffer.from(base64, 'base64');
  const out: Record<number, string> = {};
  let i = 0;
  while (i + 2 <= buf.length) {
    const tag = buf[i];
    const len = buf[i + 1];
    const value = buf.subarray(i + 2, i + 2 + len).toString('utf8');
    out[tag] = value;
    i += 2 + len;
  }
  return out;
};

/* ─────────────────────────── Invoice hash chain (PIH) ─────────────────────────── */

/** The first invoice in a chain uses the Base64 of "0" as its previous hash. */
export const GENESIS_HASH = Buffer.from('0').toString('base64');

/** SHA-256, Base64 encoded — ZATCA's invoice hash format. */
export const hashInvoiceXml = (xml: string): string =>
  crypto.createHash('sha256').update(xml, 'utf8').digest('base64');

/**
 * Placeholder for the Phase 2 cryptographic stamp. Signing needs an EC private
 * key and the CSID issued by ZATCA's onboarding API; until those are configured
 * this returns null and the invoice stays a valid Phase 1 document.
 */
export const signInvoice = (_xml: string): { signature: string; publicKey: string; certificate: string } | null => {
  const privateKey = process.env.ZATCA_PRIVATE_KEY;
  const certificate = process.env.ZATCA_CERTIFICATE;
  if (!privateKey || !certificate) return null;

  const signer = crypto.createSign('SHA256');
  signer.update(_xml, 'utf8');
  const signature = signer.sign(privateKey, 'base64');
  const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
  return { signature, publicKey, certificate };
};

/* ─────────────────────────── UBL 2.1 XML (Phase 2 input) ─────────────────────────── */

const esc = (v: any): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const d = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const t = (value: Date | string) => new Date(value).toISOString().slice(11, 19);

/** ZATCA invoice type code: 388 tax invoice, 381 credit note, 383 debit note. */
export const invoiceTypeCode = (kind: string): string =>
  kind === 'CREDIT_NOTE' ? '381' : kind === 'DEBIT_NOTE' ? '383' : '388';

/** Sub-type: "01" standard (B2B, cleared), "02" simplified (B2C, reported). */
export const invoiceSubTypeCode = (type: string): string => (type === 'SIMPLIFIED' ? '0200000' : '0100000');

export interface XmlLine {
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;   // excluding VAT
  vatRate: number;
  vatAmount: number;
  vatCategory: VatCategory;
}

export interface XmlInput {
  invoiceNumber: string;
  uuid: string;
  issuedAt: Date | string;
  supplyDate?: Date | string | null;
  invoiceType: string;
  invoiceKind: string;
  previousHash: string;
  currency: string;
  seller: {
    name: string; vatNumber: string; crNumber?: string | null;
    buildingNumber?: string | null; street?: string | null; district?: string | null;
    city?: string | null; postalCode?: string | null; additionalNumber?: string | null;
  };
  buyer: {
    name: string; vatNumber?: string | null;
    buildingNumber?: string | null; street?: string | null; district?: string | null;
    city?: string | null; postalCode?: string | null; additionalNumber?: string | null;
  };
  lines: XmlLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  originalInvoiceNumber?: string | null;
  noteReason?: string | null;
}

const addressXml = (a: XmlInput['seller'] | XmlInput['buyer']) => `
      <cac:PostalAddress>
        <cbc:StreetName>${esc(a.street || '')}</cbc:StreetName>
        <cbc:BuildingNumber>${esc(a.buildingNumber || '')}</cbc:BuildingNumber>
        <cbc:PlotIdentification>${esc(a.additionalNumber || '')}</cbc:PlotIdentification>
        <cbc:CitySubdivisionName>${esc(a.district || '')}</cbc:CitySubdivisionName>
        <cbc:CityName>${esc(a.city || '')}</cbc:CityName>
        <cbc:PostalZone>${esc(a.postalCode || '')}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>`;

/** UBL 2.1 invoice in the shape ZATCA's Phase 2 API expects. */
export const generateUblXml = (input: XmlInput): string => {
  const lines = input.lines.map((l, i) => `
  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${l.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${input.currency}">${round2(l.lineTotal).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${input.currency}">${round2(l.vatAmount).toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="${input.currency}">${round2(l.lineTotal + l.vatAmount).toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${esc(l.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${vatCategoryCode(l.vatCategory)}</cbc:ID>
        <cbc:Percent>${l.vatRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${input.currency}">${round2(l.price).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`).join('');

  // One tax subtotal per VAT category present on the invoice
  const byCategory = new Map<string, { taxable: number; vat: number; rate: number; category: VatCategory }>();
  for (const l of input.lines) {
    const key = `${l.vatCategory}-${l.vatRate}`;
    const entry = byCategory.get(key) || { taxable: 0, vat: 0, rate: l.vatRate, category: l.vatCategory };
    entry.taxable += l.lineTotal;
    entry.vat += l.vatAmount;
    byCategory.set(key, entry);
  }
  const subtotals = [...byCategory.values()].map(c => {
    const reason = vatCategoryReason(c.category);
    return `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${input.currency}">${round2(c.taxable).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${input.currency}">${round2(c.vat).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${vatCategoryCode(c.category)}</cbc:ID>
        <cbc:Percent>${c.rate.toFixed(2)}</cbc:Percent>${reason ? `
        <cbc:TaxExemptionReason>${esc(reason)}</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
  }).join('');

  const isNote = input.invoiceKind !== 'INVOICE';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(input.uuid)}</cbc:UUID>
  <cbc:IssueDate>${d(input.issuedAt)}</cbc:IssueDate>
  <cbc:IssueTime>${t(input.issuedAt)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${invoiceSubTypeCode(input.invoiceType)}">${invoiceTypeCode(input.invoiceKind)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${input.currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${input.currency}</cbc:TaxCurrencyCode>${isNote && input.originalInvoiceNumber ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(input.originalInvoiceNumber)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''}${isNote && input.noteReason ? `
  <cbc:Note>${esc(input.noteReason)}</cbc:Note>` : ''}
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(input.previousHash)}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${esc(input.seller.crNumber || '')}</cbc:ID>
      </cac:PartyIdentification>${addressXml(input.seller)}
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(input.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(input.seller.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>${addressXml(input.buyer)}${input.buyer.vatNumber ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(input.buyer.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(input.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>${input.supplyDate ? `
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${d(input.supplyDate)}</cbc:ActualDeliveryDate>
  </cac:Delivery>` : ''}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${input.currency}">${round2(input.vatTotal).toFixed(2)}</cbc:TaxAmount>${subtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${input.currency}">${round2(input.subtotal).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${input.currency}">${round2(input.subtotal).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${input.currency}">${round2(input.total).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${input.currency}">${round2(input.total).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
};
