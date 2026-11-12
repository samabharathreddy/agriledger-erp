import {
  ArrowLeftRight,
  BadgeIndianRupee,
  BookOpenText,
  Boxes,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FileSpreadsheet,
  HandCoins,
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  Percent,
  ReceiptIndianRupee,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Store,
  Tags,
  Timer,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { addDays, daysUntil, live, money, moneyShort, num, sum, text, todayIso, totalsOf } from "./format";
import type { Line, ModuleDef, NavGroup, Row } from "./types";

/* ------------------------------------------------------------------ */
/* Shared choices                                                      */
/* ------------------------------------------------------------------ */

export const CATEGORIES = ["Fertilizer", "Pesticide", "Seed", "Other"];
export const PAY_MODES = ["Cash", "UPI", "Card", "Bank transfer", "Cheque"];
export const UNITS = ["Bag", "Bottle", "Packet", "Tin", "Kg", "Litre", "Piece"];
export const GST_RATES = ["0", "5", "12", "18"];

/** Label colours required on pesticide packs in India, most to least toxic. */
export const TOXICITY = [
  "Red – extremely toxic",
  "Yellow – highly toxic",
  "Blue – moderately toxic",
  "Green – slightly toxic",
];

const isCategory = (name: string) => (values: Record<string, unknown>) => values.category === name;

/** Sample dates are written relative to today so the screens never look stale. */
const today = todayIso();
const d = (offset: number) => addDays(today, offset);
const L = (product: string, batch: string, qty: number, rate: number, gst: number, expiry?: string): Line => ({
  product,
  batch,
  qty,
  rate,
  gst,
  ...(expiry ? { expiry } : {}),
});

const fromProducts = { module: "products", key: "name" };
const fromSuppliers = { module: "suppliers", key: "name" };
const fromCustomers = { module: "customers", key: "name" };

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

const products: Row[] = [
  { id: "p1", name: "Urea 46% N (neem coated)", category: "Fertilizer", brand: "IFFCO", fertType: "Nitrogenous", npk: "46:0:0", form: "Prilled", subsidised: true, unit: "Bag", packSize: "45 kg", hsn: "31021000", gst: "5", purchasePrice: 232, mrp: 266.5, sellPrice: 266.5, stock: 128, reorder: 40, rack: "Godown A1", status: "Active" },
  { id: "p2", name: "DAP 18:46:0", category: "Fertilizer", brand: "IPL", fertType: "Complex", npk: "18:46:0", form: "Granular", subsidised: true, unit: "Bag", packSize: "50 kg", hsn: "31053000", gst: "5", purchasePrice: 1225, mrp: 1350, sellPrice: 1350, stock: 84, reorder: 30, rack: "Godown A2", status: "Active" },
  { id: "p3", name: "MOP 0:0:60", category: "Fertilizer", brand: "IPL", fertType: "Potassic", npk: "0:0:60", form: "Granular", subsidised: true, unit: "Bag", packSize: "50 kg", hsn: "31042000", gst: "5", purchasePrice: 1520, mrp: 1700, sellPrice: 1680, stock: 22, reorder: 25, rack: "Godown A3", status: "Active" },
  { id: "p4", name: "Gromor NPK 10:26:26", category: "Fertilizer", brand: "Coromandel", fertType: "Complex", npk: "10:26:26", form: "Granular", subsidised: true, unit: "Bag", packSize: "50 kg", hsn: "31052000", gst: "5", purchasePrice: 1330, mrp: 1470, sellPrice: 1470, stock: 56, reorder: 20, rack: "Godown A2", status: "Active" },
  { id: "p5", name: "Zinc sulphate 21%", category: "Fertilizer", brand: "Coromandel", fertType: "Micronutrient", npk: "", form: "Powder", subsidised: false, unit: "Bag", packSize: "10 kg", hsn: "28332990", gst: "5", purchasePrice: 520, mrp: 640, sellPrice: 620, stock: 34, reorder: 12, rack: "Rack B1", status: "Active" },
  { id: "p6", name: "Chlorpyrifos 20% EC", category: "Pesticide", brand: "Dhanuka", pestType: "Insecticide", technical: "Chlorpyrifos", formulation: "EC – emulsifiable concentrate", strength: "20%", toxicity: TOXICITY[1], cibReg: "CIR-18,456/2019", dose: "500 ml per acre", crops: "Paddy, cotton, groundnut", waitingDays: 15, restricted: false, unit: "Bottle", packSize: "1 litre", hsn: "38089199", gst: "18", purchasePrice: 338, mrp: 460, sellPrice: 420, stock: 18, reorder: 12, rack: "Rack P1 (locked)", status: "Active" },
  { id: "p7", name: "Imidacloprid 17.8% SL", category: "Pesticide", brand: "Bayer", pestType: "Insecticide", technical: "Imidacloprid", formulation: "SL – soluble liquid", strength: "17.8%", toxicity: TOXICITY[1], cibReg: "CIR-22,104/2020", dose: "100 ml per acre", crops: "Cotton, chilli, paddy", waitingDays: 21, restricted: false, unit: "Bottle", packSize: "250 ml", hsn: "38089199", gst: "18", purchasePrice: 268, mrp: 395, sellPrice: 360, stock: 42, reorder: 15, rack: "Rack P1 (locked)", status: "Active" },
  { id: "p8", name: "Mancozeb 75% WP", category: "Pesticide", brand: "Indofil", pestType: "Fungicide", technical: "Mancozeb", formulation: "WP – wettable powder", strength: "75%", toxicity: TOXICITY[2], cibReg: "CIR-9,812/2018", dose: "600 g per acre", crops: "Chilli, tomato, potato", waitingDays: 10, restricted: false, unit: "Packet", packSize: "1 kg", hsn: "38089290", gst: "18", purchasePrice: 372, mrp: 520, sellPrice: 480, stock: 27, reorder: 10, rack: "Rack P2 (locked)", status: "Active" },
  { id: "p9", name: "Glyphosate 41% SL", category: "Pesticide", brand: "Excel Crop Care", pestType: "Herbicide", technical: "Glyphosate", formulation: "SL – soluble liquid", strength: "41%", toxicity: TOXICITY[2], cibReg: "CIR-11,377/2017", dose: "800 ml per acre", crops: "Tea, non-crop areas", waitingDays: 0, restricted: true, unit: "Bottle", packSize: "1 litre", hsn: "38089390", gst: "18", purchasePrice: 402, mrp: 560, sellPrice: 520, stock: 9, reorder: 10, rack: "Rack P3 (locked)", status: "Active" },
  { id: "p10", name: "Neem oil 1500 ppm", category: "Pesticide", brand: "T. Stanes", pestType: "Bio-pesticide", technical: "Azadirachtin", formulation: "EC – emulsifiable concentrate", strength: "0.15%", toxicity: TOXICITY[3], cibReg: "CIR-30,220/2021", dose: "1 litre per acre", crops: "Vegetables, cotton", waitingDays: 3, restricted: false, unit: "Bottle", packSize: "1 litre", hsn: "38089199", gst: "5", purchasePrice: 310, mrp: 450, sellPrice: 410, stock: 24, reorder: 8, rack: "Rack P2 (locked)", status: "Active" },
  { id: "p11", name: "Pioneer P3396 hybrid maize", category: "Seed", brand: "Corteva", crop: "Maize", variety: "P3396", seedClass: "Hybrid", germination: 90, seasonFit: "Kharif and Rabi", unit: "Packet", packSize: "4 kg", hsn: "10051000", gst: "0", purchasePrice: 1580, mrp: 1900, sellPrice: 1850, stock: 32, reorder: 40, rack: "Rack S1", status: "Active" },
  { id: "p12", name: "RCH 659 BG-II cotton", category: "Seed", brand: "Rasi Seeds", crop: "Cotton", variety: "RCH 659 BG-II", seedClass: "Hybrid", germination: 75, seasonFit: "Kharif", unit: "Packet", packSize: "475 g", hsn: "12072090", gst: "0", purchasePrice: 790, mrp: 901, sellPrice: 901, stock: 0, reorder: 50, rack: "Rack S2", status: "Active" },
];

const batches: Row[] = [
  { id: "b1", product: "Urea 46% N (neem coated)", batchNo: "IF-U-2609", mfgDate: d(-70), expiryDate: d(650), qty: 128, purchaseRate: 232, mrp: 266.5, supplier: "IFFCO e-Bazar, Warangal", rack: "Godown A1" },
  { id: "b2", product: "DAP 18:46:0", batchNo: "IPL-D-2608", mfgDate: d(-95), expiryDate: d(620), qty: 84, purchaseRate: 1225, mrp: 1350, supplier: "GreenGrow Distributors", rack: "Godown A2" },
  { id: "b3", product: "Chlorpyrifos 20% EC", batchNo: "DH-CP-2411", mfgDate: d(-700), expiryDate: d(18), qty: 6, purchaseRate: 338, mrp: 460, supplier: "Deccan Seeds & Chemicals", rack: "Rack P1 (locked)" },
  { id: "b4", product: "Chlorpyrifos 20% EC", batchNo: "DH-CP-2604", mfgDate: d(-210), expiryDate: d(520), qty: 12, purchaseRate: 338, mrp: 460, supplier: "Deccan Seeds & Chemicals", rack: "Rack P1 (locked)" },
  { id: "b5", product: "Imidacloprid 17.8% SL", batchNo: "BY-IM-2601", mfgDate: d(-300), expiryDate: d(430), qty: 42, purchaseRate: 268, mrp: 395, supplier: "Deccan Seeds & Chemicals", rack: "Rack P1 (locked)" },
  { id: "b6", product: "Mancozeb 75% WP", batchNo: "IN-MZ-2502", mfgDate: d(-640), expiryDate: d(52), qty: 9, purchaseRate: 372, mrp: 520, supplier: "Sri Lakshmi Agro Agencies", rack: "Rack P2 (locked)" },
  { id: "b7", product: "Mancozeb 75% WP", batchNo: "IN-MZ-2607", mfgDate: d(-120), expiryDate: d(610), qty: 18, purchaseRate: 372, mrp: 520, supplier: "Sri Lakshmi Agro Agencies", rack: "Rack P2 (locked)" },
  { id: "b8", product: "Glyphosate 41% SL", batchNo: "EX-GL-2412", mfgDate: d(-720), expiryDate: d(-6), qty: 3, purchaseRate: 402, mrp: 560, supplier: "Deccan Seeds & Chemicals", rack: "Rack P3 (locked)" },
  { id: "b9", product: "Pioneer P3396 hybrid maize", batchNo: "LOT-P3396-26K", mfgDate: d(-150), expiryDate: d(75), qty: 32, purchaseRate: 1580, mrp: 1900, supplier: "Deccan Seeds & Chemicals", rack: "Rack S1" },
  { id: "b10", product: "Neem oil 1500 ppm", batchNo: "TS-NO-2605", mfgDate: d(-180), expiryDate: d(185), qty: 24, purchaseRate: 310, mrp: 450, supplier: "Sri Lakshmi Agro Agencies", rack: "Rack P2 (locked)" },
  { id: "b11", product: "Glyphosate 41% SL", batchNo: "EX-GL-2606", mfgDate: d(-160), expiryDate: d(570), qty: 6, purchaseRate: 402, mrp: 560, supplier: "Deccan Seeds & Chemicals", rack: "Rack P3 (locked)" },
  { id: "b12", product: "MOP 0:0:60", batchNo: "IPL-M-2606", mfgDate: d(-170), expiryDate: d(560), qty: 22, purchaseRate: 1520, mrp: 1700, supplier: "GreenGrow Distributors", rack: "Godown A3" },
  { id: "b13", product: "Gromor NPK 10:26:26", batchNo: "CR-N-2607", mfgDate: d(-130), expiryDate: d(600), qty: 56, purchaseRate: 1330, mrp: 1470, supplier: "GreenGrow Distributors", rack: "Godown A2" },
  { id: "b14", product: "Zinc sulphate 21%", batchNo: "CR-Z-2606", mfgDate: d(-165), expiryDate: d(565), qty: 34, purchaseRate: 520, mrp: 640, supplier: "GreenGrow Distributors", rack: "Rack B1" },
];

const customers: Row[] = [
  { id: "c1", name: "Ramesh Reddy", type: "Farmer", phone: "98480 12345", village: "Kondapur", mandal: "Hanamkonda", district: "Warangal", landAcres: 12, crops: "Paddy, cotton", creditLimit: 50000, creditDays: 90, balance: 0, status: "Active" },
  { id: "c2", name: "Lakshmi Agro Farm", type: "Farmer", phone: "99490 22110", village: "Mulugu Road", mandal: "Geesugonda", district: "Warangal", landAcres: 28, crops: "Chilli, maize", creditLimit: 100000, creditDays: 120, balance: 17600, status: "Active" },
  { id: "c3", name: "Mahesh Kumar", type: "Farmer", phone: "90000 56781", village: "Dharmasagar", mandal: "Dharmasagar", district: "Hanamkonda", landAcres: 5, crops: "Paddy", creditLimit: 20000, creditDays: 60, balance: 4200, status: "Active" },
  { id: "c4", name: "Sai Krishna Fertilisers", type: "Dealer", phone: "98661 40404", village: "Narsampet", mandal: "Narsampet", district: "Warangal", gstin: "36AAKFS4411R1Z2", creditLimit: 250000, creditDays: 30, balance: 20950, status: "Active" },
  { id: "c5", name: "Walk-in customer", type: "Retail customer", phone: "", village: "", mandal: "", district: "", creditLimit: 0, creditDays: 0, balance: 0, status: "Active" },
  { id: "c6", name: "Yadagiri Goud", type: "Farmer", phone: "96520 77123", village: "Atmakur", mandal: "Atmakur", district: "Hanamkonda", landAcres: 8, crops: "Cotton, turmeric", creditLimit: 30000, creditDays: 90, balance: 0, status: "Active" },
];

const suppliers: Row[] = [
  { id: "s1", name: "GreenGrow Distributors", type: "Distributor", contact: "Suresh Agarwal", phone: "98490 55001", email: "orders@greengrow.example", gstin: "36AABCG1234F1Z5", city: "Hyderabad", state: "Telangana", supplies: "Fertilizer", creditDays: 30, balance: 66069, status: "Active" },
  { id: "s2", name: "Deccan Seeds & Chemicals", type: "Distributor", contact: "Anil Rao", phone: "99590 12890", email: "sales@deccanseeds.example", gstin: "36AAECD7788K1Z9", city: "Warangal", state: "Telangana", supplies: "Pesticide, Seed", creditDays: 45, balance: 0, status: "Active" },
  { id: "s3", name: "IFFCO e-Bazar, Warangal", type: "Manufacturer", contact: "Depot in-charge", phone: "0870 244 1100", email: "", gstin: "36AAAAI0050M1ZT", city: "Warangal", state: "Telangana", supplies: "Fertilizer", creditDays: 0, balance: 0, status: "Active" },
  { id: "s4", name: "Sri Lakshmi Agro Agencies", type: "Wholesaler", contact: "Venkat Rao", phone: "98852 61234", email: "", gstin: "36ABDFS9021C1Z7", city: "Karimnagar", state: "Telangana", supplies: "Pesticide", creditDays: 21, balance: 9179, status: "Active" },
];

const salesInvoices: Row[] = [
  { id: "i1", no: "INV-0184", date: d(0), customer: "Ramesh Reddy", saleType: "Retail", payMode: "UPI", lines: [L("DAP 18:46:0", "IPL-D-2608", 10, 1285.71, 5), L("Imidacloprid 17.8% SL", "BY-IM-2601", 4, 305.08, 18)], discount: 0, paid: 14940, status: "Paid" },
  { id: "i2", no: "INV-0183", date: d(0), customer: "Lakshmi Agro Farm", saleType: "Retail", payMode: "Credit", lines: [L("Gromor NPK 10:26:26", "CR-N-2607", 8, 1400, 5), L("Mancozeb 75% WP", "IN-MZ-2607", 2, 406.78, 18)], discount: 120, paid: 0, status: "Credit" },
  { id: "i3", no: "INV-0182", date: d(-1), customer: "Mahesh Kumar", saleType: "Retail", payMode: "Cash", lines: [L("Urea 46% N (neem coated)", "IF-U-2609", 20, 253.81, 5), L("Zinc sulphate 21%", "CR-Z-2606", 2, 590.48, 5)], discount: 0, paid: 2370, status: "Partial" },
  { id: "i4", no: "INV-0181", date: d(-1), customer: "Sai Krishna Fertilisers", saleType: "Wholesale", payMode: "Bank transfer", lines: [L("Urea 46% N (neem coated)", "IF-U-2609", 100, 250, 5), L("DAP 18:46:0", "IPL-D-2608", 20, 1270, 5)], discount: 500, paid: 31470, status: "Partial" },
  { id: "i5", no: "INV-0180", date: d(-2), customer: "Walk-in customer", saleType: "Retail", payMode: "Cash", lines: [L("Neem oil 1500 ppm", "TS-NO-2605", 2, 390.48, 5)], discount: 0, paid: 820, status: "Paid" },
  { id: "i6", no: "INV-0179", date: d(-3), customer: "Yadagiri Goud", saleType: "Retail", payMode: "UPI", lines: [L("Pioneer P3396 hybrid maize", "LOT-P3396-26K", 3, 1850, 0), L("Chlorpyrifos 20% EC", "DH-CP-2604", 2, 355.93, 18)], discount: 0, paid: 6390, status: "Paid" },
  { id: "i7", no: "INV-0178", date: d(-4), customer: "Ramesh Reddy", saleType: "Retail", payMode: "Cash", lines: [L("Urea 46% N (neem coated)", "IF-U-2609", 30, 253.81, 5), L("MOP 0:0:60", "IPL-M-2606", 6, 1600, 5)], discount: 0, paid: 18075, status: "Paid" },
  { id: "i8", no: "INV-0177", date: d(-5), customer: "Walk-in customer", saleType: "Retail", payMode: "UPI", lines: [L("Mancozeb 75% WP", "IN-MZ-2502", 3, 406.78, 18), L("Neem oil 1500 ppm", "TS-NO-2605", 1, 390.48, 5)], discount: 0, paid: 1850, status: "Paid" },
  { id: "i9", no: "INV-0176", date: d(-6), customer: "Yadagiri Goud", saleType: "Retail", payMode: "UPI", lines: [L("Gromor NPK 10:26:26", "CR-N-2607", 12, 1400, 5), L("Imidacloprid 17.8% SL", "BY-IM-2601", 6, 305.08, 18)], discount: 0, paid: 19800, status: "Paid" },
];

const purchaseOrders: Row[] = [
  { id: "po1", no: "PO-0031", date: d(-1), supplier: "Deccan Seeds & Chemicals", expectedDate: d(4), lines: [L("RCH 659 BG-II cotton", "", 100, 790, 0), L("Pioneer P3396 hybrid maize", "", 40, 1580, 0)], terms: "Delivery to shop, payment in 45 days", status: "Sent" },
  { id: "po2", no: "PO-0030", date: d(-6), supplier: "GreenGrow Distributors", expectedDate: d(-1), lines: [L("MOP 0:0:60", "", 60, 1520, 5), L("DAP 18:46:0", "", 100, 1225, 5)], terms: "Freight paid by supplier", status: "Partly received" },
  { id: "po3", no: "PO-0029", date: d(-14), supplier: "Sri Lakshmi Agro Agencies", expectedDate: d(-9), lines: [L("Mancozeb 75% WP", "", 20, 372, 18)], terms: "", status: "Received" },
  { id: "po4", no: "PO-0032", date: d(0), supplier: "Deccan Seeds & Chemicals", expectedDate: d(7), lines: [L("Glyphosate 41% SL", "", 12, 402, 18)], terms: "", status: "Draft" },
];

const goodsReceipts: Row[] = [
  { id: "g1", no: "GRN-0044", date: d(-2), supplier: "GreenGrow Distributors", poNo: "PO-0030", supplierInvoiceNo: "GG/26-27/1182", vehicleNo: "TS 03 UB 4471", lines: [L("DAP 18:46:0", "IPL-D-2611", 60, 1225, 5, d(700))], receivedBy: "Srinu", status: "Shortage reported", notes: "40 bags of DAP and all MOP still to come." },
  { id: "g2", no: "GRN-0043", date: d(-9), supplier: "Sri Lakshmi Agro Agencies", poNo: "PO-0029", supplierInvoiceNo: "SLA/2291", vehicleNo: "TS 02 T 9088", lines: [L("Mancozeb 75% WP", "IN-MZ-2607", 20, 372, 18, d(610))], receivedBy: "Srinu", status: "Checked", notes: "" },
];

const purchaseBills: Row[] = [
  { id: "pb1", no: "PB-0078", billNo: "GG/26-27/1182", date: d(-2), supplier: "GreenGrow Distributors", grnNo: "GRN-0044", dueDate: d(28), lines: [L("DAP 18:46:0", "IPL-D-2611", 60, 1225, 5)], freight: 0, paid: 11106, status: "Partial" },
  { id: "pb2", no: "PB-0077", billNo: "SLA/2291", date: d(-9), supplier: "Sri Lakshmi Agro Agencies", grnNo: "GRN-0043", dueDate: d(12), lines: [L("Mancozeb 75% WP", "IN-MZ-2607", 20, 372, 18)], freight: 400, paid: 0, status: "Unpaid" },
  { id: "pb3", no: "PB-0076", billNo: "DSC/8841", date: d(-21), supplier: "Deccan Seeds & Chemicals", grnNo: "", dueDate: d(-3), lines: [L("Imidacloprid 17.8% SL", "BY-IM-2601", 48, 268, 18), L("Pioneer P3396 hybrid maize", "LOT-P3396-26K", 20, 1580, 0)], freight: 0, paid: 46780, status: "Paid" },
];

const purchaseReturns: Row[] = [
  { id: "pr1", no: "PR-0006", date: d(-4), supplier: "Deccan Seeds & Chemicals", billNo: "DSC/8102", reason: "Expired stock", lines: [L("Glyphosate 41% SL", "EX-GL-2412", 3, 402, 18)], debitNoteNo: "DN-0006", status: "Sent to supplier" },
];

const salesReturns: Row[] = [
  { id: "sr1", no: "SR-0009", date: d(-1), customer: "Mahesh Kumar", invoiceNo: "INV-0182", reason: "Bought extra", lines: [L("Zinc sulphate 21%", "CR-Z-2606", 1, 590.48, 5)], restock: true, refundMode: "Adjust in ledger", status: "Adjusted" },
];

const stockAdjustments: Row[] = [
  { id: "a1", no: "ADJ-0012", date: d(-3), product: "Urea 46% N (neem coated)", batch: "IF-U-2609", type: "Damage", qty: 2, reason: "Two bags torn while unloading", approvedBy: "Owner" },
  { id: "a2", no: "ADJ-0011", date: d(-8), product: "Imidacloprid 17.8% SL", batch: "BY-IM-2601", type: "Leakage", qty: 1, reason: "Bottle cap cracked on the shelf", approvedBy: "Owner" },
];

const receipts: Row[] = [
  { id: "rc1", no: "RC-0102", date: d(0), customer: "Ramesh Reddy", amount: 14940, mode: "UPI", reference: "UPI 4318 8870 2291", againstInvoice: "INV-0184", notes: "" },
  { id: "rc2", no: "RC-0101", date: d(-1), customer: "Sai Krishna Fertilisers", amount: 31470, mode: "Bank transfer", reference: "NEFT N3182266", againstInvoice: "INV-0181", notes: "Balance promised next week" },
  { id: "rc3", no: "RC-0100", date: d(-1), customer: "Mahesh Kumar", amount: 2370, mode: "Cash", reference: "", againstInvoice: "INV-0182", notes: "" },
  { id: "rc4", no: "RC-0099", date: d(-2), customer: "Walk-in customer", amount: 820, mode: "Cash", reference: "", againstInvoice: "INV-0180", notes: "" },
  { id: "rc5", no: "RC-0098", date: d(-3), customer: "Yadagiri Goud", amount: 6390, mode: "UPI", reference: "UPI 4311 2207 9914", againstInvoice: "INV-0179", notes: "" },
  { id: "rc6", no: "RC-0097", date: d(-4), customer: "Ramesh Reddy", amount: 18075, mode: "Cash", reference: "", againstInvoice: "INV-0178", notes: "" },
  { id: "rc7", no: "RC-0096", date: d(-5), customer: "Walk-in customer", amount: 1850, mode: "UPI", reference: "UPI 4309 5521 0087", againstInvoice: "INV-0177", notes: "" },
  { id: "rc8", no: "RC-0095", date: d(-6), customer: "Yadagiri Goud", amount: 19800, mode: "UPI", reference: "UPI 4307 1180 4410", againstInvoice: "INV-0176", notes: "" },
];

/*
 * Older sample bills, days 7 to 60 back, so the month filters, the customer
 * dashboards and the charts have something to show. They are generated with a
 * fixed sequence, so every visit sees the same sample history.
 */
{
  let state = 7;
  const rand = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const sellable = products.filter((p) => num(p.stock) > 0);
  let invoiceNo = 175;
  let receiptNo = 94;
  for (let back = 7; back <= 60 && invoiceNo > 40; back++) {
    const bills = 1 + Math.floor(rand() * 3);
    for (let n = 0; n < bills; n++) {
      const customer = pick(customers);
      const chosen = [pick(sellable), pick(sellable)].filter((p, i, all) => all.indexOf(p) === i).slice(0, 1 + Math.floor(rand() * 2));
      const lines = chosen.map((p) =>
        L(text(p.name), "", p.category === "Fertilizer" ? 2 + Math.floor(rand() * 14) : 1 + Math.floor(rand() * 4), Math.round((num(p.sellPrice) / (1 + num(p.gst) / 100)) * 100) / 100, num(p.gst)),
      );
      const payMode = pick(["Cash", "Cash", "UPI", "UPI", "Bank transfer"]);
      const invoice: Row = { id: `gi${invoiceNo}`, no: `INV-${String(invoiceNo).padStart(4, "0")}`, date: d(-back), customer: customer.name, saleType: customer.type === "Dealer" ? "Wholesale" : "Retail", payMode, lines, discount: 0, paid: 0, status: "Paid" };
      invoice.paid = totalsOf(invoice).total;
      salesInvoices.push(invoice);
      receipts.push({ id: `gr${receiptNo}`, no: `RC-${String(receiptNo).padStart(4, "0")}`, date: d(-back), customer: customer.name, amount: invoice.paid, mode: payMode, reference: "", againstInvoice: invoice.no, notes: "" });
      invoiceNo--;
      receiptNo--;
    }
  }
}

const estimates: Row[] = [
  { id: "es1", no: "EST-0012", date: d(-1), validTill: d(6), customer: "Lakshmi Agro Farm", lines: [L("DAP 18:46:0", "", 40, 1285.71, 5), L("MOP 0:0:60", "", 20, 1600, 5), L("Mancozeb 75% WP", "", 6, 406.78, 18)], discount: 500, status: "Open", notes: "Rabi chilli, 28 acres" },
  { id: "es2", no: "EST-0011", date: d(-9), validTill: d(-2), customer: "Sai Krishna Fertilisers", lines: [L("Urea 46% N (neem coated)", "", 200, 250, 5)], discount: 0, status: "Expired", notes: "" },
];

const supplierPayments: Row[] = [
  { id: "sp1", no: "SP-0058", date: d(-2), supplier: "GreenGrow Distributors", amount: 11106, mode: "Bank transfer", reference: "NEFT N3179004", againstBill: "PB-0078", notes: "Part payment" },
  { id: "sp2", no: "SP-0057", date: d(-12), supplier: "Deccan Seeds & Chemicals", amount: 46780, mode: "Cheque", reference: "Chq 004417", againstBill: "PB-0076", notes: "" },
];

const expenses: Row[] = [
  { id: "e1", no: "EX-0041", date: d(0), category: "Loading and hamali", amount: 600, paidTo: "Hamali team", mode: "Cash", billNo: "", notes: "Unloading 60 bags of DAP" },
  { id: "e2", no: "EX-0040", date: d(-3), category: "Electricity", amount: 2840, paidTo: "TGNPDCL", mode: "UPI", billNo: "Oct bill", notes: "" },
  { id: "e3", no: "EX-0039", date: d(-5), category: "Transport", amount: 1500, paidTo: "Sri Sai Transport", mode: "Cash", billNo: "LR 2281", notes: "Auto trolley from the depot" },
  { id: "e4", no: "EX-0038", date: d(-6), category: "Repairs", amount: 450, paidTo: "Electrician", mode: "Cash", billNo: "", notes: "Godown light fitting" },
];

const licences: Row[] = [
  { id: "l1", name: "Fertilizer dealer authorisation", number: "FL/WGL/2021/0481", authority: "Department of Agriculture, Telangana", issueDate: d(-1060), expiryDate: d(35), holder: "B. Ravinder", renewalFee: 2250, notes: "Apply for renewal 30 days before expiry." },
  { id: "l2", name: "Insecticide selling licence", number: "PL/WGL/2022/0177", authority: "Department of Agriculture, Telangana", issueDate: d(-700), expiryDate: d(390), holder: "B. Ravinder", renewalFee: 7500, notes: "Add new company principal certificates when a brand is added." },
  { id: "l3", name: "Seed dealer licence", number: "SL/WGL/2023/0092", authority: "Department of Agriculture, Telangana", issueDate: d(-880), expiryDate: d(215), holder: "B. Ravinder", renewalFee: 1000, notes: "" },
  { id: "l4", name: "GST registration", number: "36ABCPR1234K1Z6", authority: "GST Council", issueDate: d(-2400), expiryDate: "", holder: "Sri Venkateswara Agro", renewalFee: 0, notes: "No expiry." },
  { id: "l5", name: "Shop and establishment registration", number: "SEA/WGL/11872", authority: "Labour Department, Telangana", issueDate: d(-380), expiryDate: d(-15), holder: "Sri Venkateswara Agro", renewalFee: 1200, notes: "" },
];

const users: Row[] = [
  { id: "u1", name: "B. Ravinder", role: "Owner", phone: "98480 00111", loginId: "ravinder", canBill: true, canPurchase: true, canEditStock: true, canSeeReports: true, status: "Active" },
  { id: "u2", name: "Srinu", role: "Billing staff", phone: "90100 22334", loginId: "srinu", canBill: true, canPurchase: false, canEditStock: false, canSeeReports: false, status: "Active" },
  { id: "u3", name: "Padma (accountant)", role: "Accountant", phone: "99080 77665", loginId: "padma", canBill: false, canPurchase: true, canEditStock: false, canSeeReports: true, status: "Active" },
];

const brands: Row[] = [
  { id: "br1", name: "IFFCO", makes: "Fertilizer", principalCertificate: "Not needed", contact: "Depot, Warangal", status: "Active" },
  { id: "br2", name: "Coromandel", makes: "Fertilizer", principalCertificate: "Not needed", contact: "Area manager", status: "Active" },
  { id: "br3", name: "Bayer", makes: "Pesticide", principalCertificate: "On file", certificateValidTill: d(240), contact: "Territory officer", status: "Active" },
  { id: "br4", name: "Dhanuka", makes: "Pesticide", principalCertificate: "On file", certificateValidTill: d(40), contact: "Territory officer", status: "Active" },
  { id: "br5", name: "Corteva", makes: "Seed", principalCertificate: "On file", certificateValidTill: d(300), contact: "Seed officer", status: "Active" },
];

const taxRates: Row[] = [
  { id: "t1", hsn: "3102", description: "Nitrogenous fertilizers such as urea", category: "Fertilizer", gst: "5" },
  { id: "t2", hsn: "3105", description: "Complex fertilizers such as DAP and NPK", category: "Fertilizer", gst: "5" },
  { id: "t3", hsn: "3808", description: "Insecticides, fungicides, herbicides", category: "Pesticide", gst: "18" },
  { id: "t4", hsn: "1005 / 1207", description: "Seeds for sowing", category: "Seed", gst: "0" },
];

const shopProfile: Row[] = [
  { id: "shop", shopName: "Sri Venkateswara Agro", owner: "B. Ravinder", phone: "98480 00111", email: "svagro@example.com", address: "Shop 4, Market Yard Road", town: "Hanamkonda", district: "Warangal", state: "Telangana", pin: "506001", gstin: "36ABCPR1234K1Z6", invoicePrefix: "INV", splitInvoices: true, invoiceSize: "A5", showBatch: true, showDose: true, lowStockAlerts: true, expiryAlertDays: 60, terms: "Goods once sold are taken back only with the bill and in sealed condition. Use pesticides as per the label." },
];

/* ------------------------------------------------------------------ */
/* Module definitions                                                  */
/* ------------------------------------------------------------------ */

const billTotal = (row: Row) => totalsOf(row).total;
const dueOf = (row: Row) => Math.max(0, billTotal(row) - num(row.paid));

export const MODULES: ModuleDef[] = [
  { id: "dashboard", title: "Dashboard", singular: "", description: "What needs your attention at the shop today.", icon: LayoutDashboard, kind: "custom" },

  /* ---------------- Sales ---------------- */
  { id: "new-sale", title: "New sale", singular: "sale", description: "Bill a customer at the counter.", icon: ShoppingCart, kind: "custom" },
  {
    id: "sales-invoices",
    title: "Sales invoices",
    singular: "invoice",
    description: "Every bill you have raised. Retail, wholesale and credit sales are filters here, not separate screens.",
    icon: ReceiptText,
    kind: "records",
    idPrefix: "INV",
    numberKey: "no",
    tabs: { key: "status", values: ["Paid", "Partial", "Credit", "Cancelled"] },
    columns: [
      { key: "no", label: "Invoice", kind: "id", subKey: "saleType" },
      { key: "customer", label: "Customer", kind: "strong", subKey: "billTo" },
      { key: "date", label: "Date", kind: "date" },
      { key: "payMode", label: "Paid by" },
      { key: "lines", label: "Amount", kind: "linesTotal" },
      { key: "paid", label: "Balance", kind: "due" },
      { key: "status", label: "Status", kind: "status" },
    ],
    stats: (all) => {
      const rows = live(all);
      return [
      { label: "Billed", value: moneyShort(sum(rows, billTotal)), note: `${rows.length} invoices` },
      { label: "Collected", value: moneyShort(sum(rows, (r) => num(r.paid))), tone: "good" },
      { label: "Still to collect", value: moneyShort(sum(rows, dueOf)), tone: "warn" },
      ];
    },
    sections: [
      {
        title: "Bill details",
        fields: [
          { key: "no", label: "Invoice number", type: "text", required: true, hint: "Filled in for you. Change it only to match a paper bill." },
          { key: "date", label: "Invoice date", type: "date", required: true, initial: today },
          { key: "saleType", label: "Sale type", type: "segment", options: ["Retail", "Wholesale"], initial: "Retail" },
          { key: "customer", label: "Customer", type: "select", optionsFrom: fromCustomers, required: true, span: 3 },
          { key: "payMode", label: "Paid by", type: "select", options: [...PAY_MODES, "Credit"], initial: "Cash", span: 3 },
        ],
      },
      { title: "Items sold", fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "sell", span: 6, required: true }] },
      {
        title: "Payment",
        fields: [
          { key: "discount", label: "Discount", type: "money", initial: 0 },
          { key: "paid", label: "Amount received", type: "money", initial: 0 },
          { key: "status", label: "Status", type: "select", options: ["Paid", "Partial", "Credit", "Cancelled"], initial: "Paid" },
          { key: "notes", label: "Note on the bill", type: "textarea", span: 6, placeholder: "Anything the customer should see on the printed bill" },
        ],
      },
    ],
    seed: salesInvoices,
  },
  {
    id: "estimates",
    title: "Estimates",
    singular: "estimate",
    description: "Quotations for a farmer or dealer. One click turns an accepted estimate into a sale.",
    icon: FileText,
    kind: "records",
    idPrefix: "EST",
    numberKey: "no",
    tabs: { key: "status", values: ["Open", "Converted", "Expired"] },
    columns: [
      { key: "no", label: "Estimate", kind: "id" },
      { key: "customer", label: "Customer", kind: "strong", subKey: "notes" },
      { key: "date", label: "Date", kind: "date" },
      { key: "validTill", label: "Valid till", kind: "date" },
      { key: "lines", label: "Amount", kind: "linesTotal" },
      { key: "status", label: "Status", kind: "status" },
    ],
    stats: (rows) => [
      { label: "Open estimates", value: String(rows.filter((r) => r.status === "Open").length), note: moneyShort(sum(rows.filter((r) => r.status === "Open"), billTotal)) },
      { label: "Turned into sales", value: String(rows.filter((r) => r.status === "Converted").length), tone: "good" },
    ],
    sections: [
      {
        title: "Estimate details",
        fields: [
          { key: "no", label: "Estimate number", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: true, initial: today },
          { key: "validTill", label: "Valid till", type: "date", initial: d(7), hint: "Prices are held until this date." },
          { key: "customer", label: "Customer", type: "select", optionsFrom: fromCustomers, required: true, span: 4 },
          { key: "status", label: "Status", type: "select", options: ["Open", "Converted", "Expired"], initial: "Open" },
        ],
      },
      { title: "Items quoted", fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "sell", span: 6, required: true }] },
      {
        title: "Terms",
        fields: [
          { key: "discount", label: "Discount", type: "money", initial: 0 },
          { key: "notes", label: "Note for the customer", type: "textarea", span: 6, placeholder: "Crop, acreage, delivery place" },
        ],
      },
    ],
    seed: estimates,
  },
  {
    id: "sales-returns",
    title: "Sales returns",
    singular: "return",
    description: "Goods a customer brought back. Saving a return is also the credit note.",
    icon: Undo2,
    kind: "records",
    idPrefix: "SR",
    numberKey: "no",
    columns: [
      { key: "no", label: "Return", kind: "id", subKey: "invoiceNo" },
      { key: "customer", label: "Customer", kind: "strong" },
      { key: "date", label: "Date", kind: "date" },
      { key: "reason", label: "Reason" },
      { key: "lines", label: "Value", kind: "linesTotal" },
      { key: "status", label: "Status", kind: "status" },
    ],
    sections: [
      {
        title: "Return details",
        fields: [
          { key: "no", label: "Return number", type: "text", required: true },
          { key: "date", label: "Return date", type: "date", required: true, initial: today },
          { key: "invoiceNo", label: "Original invoice", type: "select", optionsFrom: { module: "sales-invoices", key: "no" } },
          { key: "customer", label: "Customer", type: "select", optionsFrom: fromCustomers, required: true, span: 3 },
          { key: "reason", label: "Reason", type: "select", options: ["Bought extra", "Wrong item given", "Damaged pack", "Leaking pack", "Near expiry", "Other"], span: 3 },
        ],
      },
      { title: "Items returned", fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "sell", span: 6, required: true }] },
      {
        title: "Settlement",
        fields: [
          { key: "restock", label: "Put back into saleable stock", type: "toggle", initial: true, span: 3, hint: "Switch off for opened, leaking or expired packs." },
          { key: "refundMode", label: "How it is settled", type: "select", options: ["Cash refund", "UPI refund", "Adjust in ledger"], initial: "Adjust in ledger", span: 3 },
          { key: "status", label: "Status", type: "select", options: ["Pending", "Refunded", "Adjusted"], initial: "Pending", span: 3 },
        ],
      },
    ],
    seed: salesReturns,
  },
  {
    id: "customers",
    title: "Customers and farmers",
    singular: "customer",
    description: "Farmers, walk-in buyers and dealers you sell to, with their credit terms.",
    icon: Users,
    kind: "records",
    tabs: { key: "type", values: ["Farmer", "Dealer", "Retail customer"] },
    columns: [
      { key: "name", label: "Name", kind: "strong", subKey: "phone" },
      { key: "type", label: "Type" },
      { key: "village", label: "Village", subKey: "district" },
      { key: "crops", label: "Crops" },
      { key: "creditLimit", label: "Credit limit", kind: "money" },
      { key: "balance", label: "Due now", kind: "money" },
    ],
    stats: (rows) => [
      { label: "Customers", value: String(rows.length), note: `${rows.filter((r) => r.type === "Farmer").length} farmers` },
      { label: "Total due from customers", value: moneyShort(sum(rows, (r) => num(r.balance))), tone: "warn" },
      { label: "Over their credit limit", value: String(rows.filter((r) => num(r.creditLimit) > 0 && num(r.balance) > num(r.creditLimit)).length), tone: "bad" },
    ],
    sections: [
      {
        title: "Who they are",
        fields: [
          { key: "type", label: "Customer type", type: "segment", options: ["Farmer", "Retail customer", "Dealer"], initial: "Farmer", span: 6 },
          { key: "name", label: "Full name", type: "text", required: true, span: 3 },
          { key: "phone", label: "Mobile number", type: "phone", span: 3, placeholder: "10-digit mobile" },
        ],
      },
      {
        title: "Address",
        fields: [
          { key: "village", label: "Village or town", type: "text" },
          { key: "mandal", label: "Mandal", type: "text" },
          { key: "district", label: "District", type: "text" },
        ],
      },
      {
        title: "Photo and Aadhaar",
        description: "Helps you recognise the customer before giving credit. Take the customer's consent before saving these.",
        fields: [
          { key: "photo", label: "Customer photo", type: "image", span: 3 },
          { key: "aadhaarPhoto", label: "Aadhaar card photo", type: "image", span: 3 },
          { key: "aadhaarNo", label: "Aadhaar number", type: "text", span: 3, placeholder: "12 digits", hint: "Screens and prints show only the last four digits." },
          { key: "fatherName", label: "Father's or husband's name", type: "text", span: 3 },
        ],
      },
      {
        title: "Farm details",
        description: "Helps you suggest the right fertilizer and pesticide quantity.",
        showIf: (v) => v.type === "Farmer",
        fields: [
          { key: "landAcres", label: "Land held", type: "number", unit: "acres" },
          { key: "crops", label: "Main crops", type: "text", span: 4, placeholder: "Paddy, cotton, chilli" },
        ],
      },
      {
        title: "Business details",
        showIf: (v) => v.type === "Dealer",
        fields: [
          { key: "gstin", label: "GSTIN", type: "text", span: 3, placeholder: "15-character GSTIN" },
          { key: "dealerLicence", label: "Dealer licence number", type: "text", span: 3, hint: "Needed before you sell pesticides wholesale." },
        ],
      },
      {
        title: "Credit terms",
        fields: [
          { key: "creditLimit", label: "Credit limit", type: "money", initial: 0, hint: "0 means cash sales only." },
          { key: "creditDays", label: "Days to pay", type: "number", unit: "days", initial: 0 },
          { key: "balance", label: "Due now", type: "money", initial: 0, hint: "Opening balance when you add the customer." },
          { key: "status", label: "Status", type: "segment", options: ["Active", "Blocked"], initial: "Active", span: 3 },
        ],
      },
    ],
    seed: customers,
  },

  /* ---------------- Purchases ---------------- */
  {
    id: "purchase-orders",
    title: "Purchase orders",
    singular: "purchase order",
    description: "What you have asked suppliers to send.",
    icon: ClipboardList,
    kind: "records",
    idPrefix: "PO",
    numberKey: "no",
    tabs: { key: "status", values: ["Draft", "Sent", "Partly received", "Received"] },
    columns: [
      { key: "no", label: "Order", kind: "id" },
      { key: "supplier", label: "Supplier", kind: "strong" },
      { key: "date", label: "Ordered", kind: "date" },
      { key: "expectedDate", label: "Expected", kind: "date" },
      { key: "lines", label: "Value", kind: "linesTotal" },
      { key: "status", label: "Status", kind: "status" },
    ],
    stats: (rows) => [
      { label: "Open orders", value: String(rows.filter((r) => r.status === "Sent" || r.status === "Partly received").length) },
      { label: "Value on order", value: moneyShort(sum(rows.filter((r) => r.status !== "Received" && r.status !== "Cancelled"), billTotal)) },
      { label: "Late deliveries", value: String(rows.filter((r) => (r.status === "Sent" || r.status === "Partly received") && daysUntil(r.expectedDate) < 0).length), tone: "bad" },
    ],
    sections: [
      {
        title: "Order details",
        fields: [
          { key: "no", label: "Order number", type: "text", required: true },
          { key: "date", label: "Order date", type: "date", required: true, initial: today },
          { key: "expectedDate", label: "Expected delivery", type: "date" },
          { key: "supplier", label: "Supplier", type: "select", optionsFrom: fromSuppliers, required: true, span: 4 },
          { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Partly received", "Received", "Cancelled"], initial: "Draft" },
        ],
      },
      { title: "Items to order", fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "buy", span: 6, required: true }] },
      { title: "Terms", fields: [{ key: "terms", label: "Delivery and payment terms", type: "textarea", span: 6, placeholder: "Freight, delivery place, payment days" }] },
    ],
    seed: purchaseOrders,
  },
  {
    id: "goods-receipts",
    title: "Goods received",
    singular: "goods receipt",
    description: "Stock that arrived at the shop. Batch and expiry are captured here, and stock goes up when you save.",
    icon: PackagePlus,
    kind: "records",
    idPrefix: "GRN",
    numberKey: "no",
    columns: [
      { key: "no", label: "Receipt", kind: "id", subKey: "poNo" },
      { key: "supplier", label: "Supplier", kind: "strong", subKey: "supplierInvoiceNo" },
      { key: "date", label: "Received", kind: "date" },
      { key: "receivedBy", label: "Received by" },
      { key: "lines", label: "Value", kind: "linesTotal" },
      { key: "status", label: "Status", kind: "status" },
    ],
    sections: [
      {
        title: "Delivery details",
        fields: [
          { key: "no", label: "Receipt number", type: "text", required: true },
          { key: "date", label: "Received on", type: "date", required: true, initial: today },
          { key: "poNo", label: "Against purchase order", type: "select", optionsFrom: { module: "purchase-orders", key: "no" } },
          { key: "supplier", label: "Supplier", type: "select", optionsFrom: fromSuppliers, required: true, span: 3 },
          { key: "supplierInvoiceNo", label: "Supplier invoice number", type: "text", span: 3 },
          { key: "vehicleNo", label: "Vehicle number", type: "text", placeholder: "TS 03 AB 1234" },
          { key: "receivedBy", label: "Received by", type: "text" },
          { key: "status", label: "Check result", type: "select", options: ["Pending check", "Checked", "Shortage reported", "Damage reported"], initial: "Checked" },
        ],
      },
      {
        title: "Items received",
        description: "Copy batch number and expiry from the pack. They drive expiry alerts and first-expiry-first-out selling.",
        fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "buy", withExpiry: true, span: 6, required: true }],
      },
      { title: "Remarks", fields: [{ key: "notes", label: "Shortage, damage or other remarks", type: "textarea", span: 6 }] },
    ],
    seed: goodsReceipts,
  },
  {
    id: "purchase-bills",
    title: "Purchase bills",
    singular: "purchase bill",
    description: "Supplier invoices and what you still owe on each.",
    icon: FileSpreadsheet,
    kind: "records",
    idPrefix: "PB",
    numberKey: "no",
    tabs: { key: "status", values: ["Unpaid", "Partial", "Paid"] },
    columns: [
      { key: "no", label: "Bill", kind: "id", subKey: "billNo" },
      { key: "supplier", label: "Supplier", kind: "strong" },
      { key: "date", label: "Bill date", kind: "date" },
      { key: "dueDate", label: "Pay by", kind: "date" },
      { key: "lines", label: "Amount", kind: "linesTotal" },
      { key: "paid", label: "Balance", kind: "due" },
      { key: "status", label: "Status", kind: "status" },
    ],
    stats: (rows) => [
      { label: "Purchased", value: moneyShort(sum(rows, billTotal)), note: `${rows.length} bills` },
      { label: "Still to pay", value: moneyShort(sum(rows, dueOf)), tone: "warn" },
      { label: "Past the pay-by date", value: String(rows.filter((r) => r.status !== "Paid" && daysUntil(r.dueDate) < 0).length), tone: "bad" },
    ],
    sections: [
      {
        title: "Bill details",
        fields: [
          { key: "no", label: "Our reference", type: "text", required: true },
          { key: "billNo", label: "Supplier bill number", type: "text", required: true },
          { key: "date", label: "Bill date", type: "date", required: true, initial: today },
          { key: "supplier", label: "Supplier", type: "select", optionsFrom: fromSuppliers, required: true, span: 3 },
          { key: "grnNo", label: "Goods receipt", type: "select", optionsFrom: { module: "goods-receipts", key: "no" }, span: 3, hint: "Link the receipt so quantity billed can be matched to quantity received." },
        ],
      },
      { title: "Items billed", fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "buy", span: 6, required: true }] },
      {
        title: "Payment",
        fields: [
          { key: "freight", label: "Freight and other charges", type: "money", initial: 0 },
          { key: "dueDate", label: "Pay by", type: "date" },
          { key: "paid", label: "Paid so far", type: "money", initial: 0 },
          { key: "status", label: "Status", type: "select", options: ["Unpaid", "Partial", "Paid"], initial: "Unpaid" },
        ],
      },
    ],
    seed: purchaseBills,
  },
  {
    id: "purchase-returns",
    title: "Purchase returns",
    singular: "purchase return",
    description: "Stock sent back to a supplier. Saving a return is also the debit note.",
    icon: ArrowLeftRight,
    kind: "records",
    idPrefix: "PR",
    numberKey: "no",
    columns: [
      { key: "no", label: "Return", kind: "id", subKey: "debitNoteNo" },
      { key: "supplier", label: "Supplier", kind: "strong" },
      { key: "date", label: "Date", kind: "date" },
      { key: "reason", label: "Reason" },
      { key: "lines", label: "Value", kind: "linesTotal" },
      { key: "status", label: "Status", kind: "status" },
    ],
    sections: [
      {
        title: "Return details",
        fields: [
          { key: "no", label: "Return number", type: "text", required: true },
          { key: "date", label: "Return date", type: "date", required: true, initial: today },
          { key: "debitNoteNo", label: "Debit note number", type: "text" },
          { key: "supplier", label: "Supplier", type: "select", optionsFrom: fromSuppliers, required: true, span: 3 },
          { key: "billNo", label: "Original supplier bill", type: "text", span: 3 },
          { key: "reason", label: "Reason", type: "select", options: ["Expired stock", "Near expiry", "Damaged in transit", "Wrong item", "Quality complaint", "Excess supplied"], span: 3 },
          { key: "status", label: "Status", type: "select", options: ["Pending", "Sent to supplier", "Credit received"], initial: "Pending", span: 3 },
        ],
      },
      { title: "Items sent back", fields: [{ key: "lines", label: "Items", type: "lines", priceFrom: "buy", span: 6, required: true }] },
    ],
    seed: purchaseReturns,
  },
  {
    id: "suppliers",
    title: "Suppliers",
    singular: "supplier",
    description: "Companies and distributors you buy from.",
    icon: Truck,
    kind: "records",
    columns: [
      { key: "name", label: "Supplier", kind: "strong", subKey: "contact" },
      { key: "type", label: "Type" },
      { key: "supplies", label: "Supplies" },
      { key: "phone", label: "Phone" },
      { key: "creditDays", label: "Credit days", kind: "number" },
      { key: "balance", label: "You owe", kind: "money" },
    ],
    stats: (rows) => [
      { label: "Suppliers", value: String(rows.length) },
      { label: "Total you owe", value: moneyShort(sum(rows, (r) => num(r.balance))), tone: "warn" },
    ],
    sections: [
      {
        title: "Supplier",
        fields: [
          { key: "name", label: "Business name", type: "text", required: true, span: 4 },
          { key: "type", label: "Type", type: "select", options: ["Manufacturer", "Distributor", "Wholesaler"], initial: "Distributor" },
          { key: "supplies", label: "What they supply", type: "text", span: 3, placeholder: "Fertilizer, pesticide, seed" },
          { key: "gstin", label: "GSTIN", type: "text", span: 3, hint: "Needed to claim input tax credit on their bills." },
        ],
      },
      {
        title: "Contact",
        fields: [
          { key: "contact", label: "Contact person", type: "text" },
          { key: "phone", label: "Phone", type: "phone" },
          { key: "email", label: "Email", type: "text" },
          { key: "city", label: "City", type: "text", span: 3 },
          { key: "state", label: "State", type: "text", span: 3, initial: "Telangana", hint: "A supplier outside your state is billed with IGST instead of CGST and SGST." },
        ],
      },
      {
        title: "Payment terms",
        fields: [
          { key: "creditDays", label: "Days to pay", type: "number", unit: "days", initial: 30 },
          { key: "balance", label: "You owe now", type: "money", initial: 0, hint: "Opening balance when you add the supplier." },
          { key: "status", label: "Status", type: "segment", options: ["Active", "Stopped"], initial: "Active" },
        ],
      },
    ],
    seed: suppliers,
  },

  /* ---------------- Stock ---------------- */
  {
    id: "products",
    title: "Products",
    singular: "product",
    description: "Your catalogue. The form asks only for what each kind of product needs.",
    icon: Tags,
    kind: "records",
    tabs: { key: "category", values: CATEGORIES },
    searchKeys: ["name", "brand", "technical", "npk", "crop", "hsn", "barcode"],
    columns: [
      { key: "name", label: "Product", kind: "product" },
      { key: "packSize", label: "Pack", subKey: "unit" },
      { key: "stock", label: "In stock", kind: "number" },
      { key: "sellPrice", label: "Selling price", kind: "money", subKey: "mrp" },
      { key: "gst", label: "GST %", kind: "number" },
      { key: "status", label: "Status", kind: "status" },
    ],
    stats: (rows) => [
      { label: "Products", value: String(rows.length), note: `${rows.filter((r) => r.category === "Fertilizer").length} fertilizer, ${rows.filter((r) => r.category === "Pesticide").length} pesticide, ${rows.filter((r) => r.category === "Seed").length} seed` },
      { label: "At or below reorder level", value: String(rows.filter((r) => num(r.stock) <= num(r.reorder)).length), tone: "warn" },
      { label: "Stock value at cost", value: moneyShort(sum(rows, (r) => num(r.stock) * num(r.purchasePrice))) },
    ],
    sections: [
      {
        title: "Basics",
        fields: [
          { key: "category", label: "Category", type: "segment", options: CATEGORIES, initial: "Fertilizer", span: 6, hint: "Choosing a category shows only the fields that category needs." },
          { key: "name", label: "Product name", type: "text", required: true, span: 4, placeholder: "As printed on the pack" },
          { key: "brand", label: "Brand or manufacturer", type: "select", optionsFrom: { module: "brands", key: "name" } },
        ],
      },
      {
        title: "Fertilizer details",
        description: "The nutrient grade is printed on every bag, for example 18:46:0.",
        showIf: isCategory("Fertilizer"),
        fields: [
          { key: "fertType", label: "Fertilizer type", type: "select", options: ["Nitrogenous", "Phosphatic", "Potassic", "Complex", "Micronutrient", "Water soluble", "Organic or bio-fertilizer"] },
          { key: "npk", label: "N : P : K grade", type: "text", placeholder: "18:46:0", hint: "Leave empty for micronutrients and bio-fertilizers." },
          { key: "form", label: "Form", type: "select", options: ["Granular", "Prilled", "Powder", "Liquid", "Crystalline"] },
          { key: "subsidised", label: "Subsidised fertilizer", type: "toggle", span: 6, hint: "Switch on for urea, DAP, MOP and NPK sold through the government PoS machine at the fixed price." },
        ],
      },
      {
        title: "Pesticide details",
        description: "Copy these from the product label and leaflet.",
        showIf: isCategory("Pesticide"),
        fields: [
          { key: "pestType", label: "Pesticide type", type: "select", options: ["Insecticide", "Fungicide", "Herbicide", "Plant growth regulator", "Bio-pesticide", "Rodenticide"] },
          { key: "technical", label: "Active ingredient", type: "text", placeholder: "Technical name" },
          { key: "strength", label: "Strength", type: "text", placeholder: "20%" },
          { key: "formulation", label: "Formulation", type: "select", options: ["EC – emulsifiable concentrate", "SC – suspension concentrate", "SL – soluble liquid", "WP – wettable powder", "WG – water dispersible granules", "GR – granules", "DP – dusting powder"], span: 3 },
          { key: "toxicity", label: "Toxicity label colour", type: "select", options: TOXICITY, span: 3, hint: "The colour of the diamond on the pack." },
          { key: "cibReg", label: "CIB&RC registration number", type: "text", span: 3 },
          { key: "waitingDays", label: "Waiting period before harvest", type: "number", unit: "days", span: 3 },
          { key: "dose", label: "Dose", type: "text", span: 3, placeholder: "500 ml per acre" },
          { key: "crops", label: "Recommended crops", type: "text", span: 3 },
          { key: "restricted", label: "Restricted product", type: "toggle", span: 6, hint: "Switch on if sale is limited by government order. Billing will ask you to confirm the buyer before it is sold." },
        ],
      },
      {
        title: "Seed details",
        showIf: isCategory("Seed"),
        fields: [
          { key: "crop", label: "Crop", type: "text", placeholder: "Maize" },
          { key: "variety", label: "Variety or hybrid", type: "text" },
          { key: "seedClass", label: "Seed class", type: "select", options: ["Hybrid", "Certified", "Truthfully labelled", "Research variety"] },
          { key: "germination", label: "Germination on the tag", type: "percent", span: 3 },
          { key: "seasonFit", label: "Season", type: "select", options: ["Kharif", "Rabi", "Summer", "Kharif and Rabi", "All seasons"], span: 3 },
        ],
      },
      {
        title: "Pack and tax",
        fields: [
          { key: "unit", label: "Sold by", type: "select", options: UNITS, initial: "Bag" },
          { key: "packSize", label: "Pack size", type: "text", placeholder: "50 kg" },
          { key: "hsn", label: "HSN code", type: "text" },
          { key: "barcode", label: "Barcode", type: "text", span: 3, placeholder: "Scan or type the pack's barcode", hint: "Lets you add this product to a bill with a barcode scanner." },
          { key: "gst", label: "GST rate", type: "segment", options: GST_RATES, initial: "5", span: 6, unit: "%" },
        ],
      },
      {
        title: "Prices",
        fields: [
          { key: "purchasePrice", label: "Purchase price", type: "money", hint: "Before GST." },
          { key: "mrp", label: "MRP", type: "money", hint: "Printed on the pack." },
          { key: "sellPrice", label: "Selling price", type: "money", hint: "Must not be above MRP." },
        ],
      },
      {
        title: "Stock",
        fields: [
          { key: "stock", label: "Stock in hand", type: "number", initial: 0 },
          { key: "reorder", label: "Reorder level", type: "number", initial: 0, hint: "You are alerted when stock falls to this number." },
          { key: "rack", label: "Where it is kept", type: "text", placeholder: "Godown A1" },
          { key: "status", label: "Status", type: "segment", options: ["Active", "Stopped"], initial: "Active", span: 3 },
        ],
      },
    ],
    seed: products,
  },
  { id: "stock", title: "Stock overview", singular: "", description: "Stock in hand for every product, with low and zero stock on top.", icon: Boxes, kind: "custom" },
  {
    id: "batches",
    title: "Batches and expiry",
    singular: "batch",
    description: "Every batch on your shelves, soonest expiry first.",
    icon: Timer,
    kind: "records",
    searchKeys: ["product", "batchNo", "supplier"],
    columns: [
      { key: "product", label: "Product", kind: "strong", subKey: "rack" },
      { key: "batchNo", label: "Batch or lot", kind: "id" },
      { key: "mfgDate", label: "Made on", kind: "date" },
      { key: "expiryDate", label: "Expiry", kind: "expiry" },
      { key: "qty", label: "Quantity", kind: "number" },
      { key: "mrp", label: "MRP", kind: "money" },
    ],
    stats: (rows) => [
      { label: "Already expired", value: String(rows.filter((r) => daysUntil(r.expiryDate) < 0).length), note: "Remove from the sales shelf", tone: "bad" },
      { label: "Expiring in 60 days", value: String(rows.filter((r) => daysUntil(r.expiryDate) >= 0 && daysUntil(r.expiryDate) <= 60).length), note: "Sell first or return", tone: "warn" },
      { label: "Value at risk", value: money(sum(rows.filter((r) => daysUntil(r.expiryDate) <= 60), (r) => num(r.qty) * num(r.purchaseRate))) },
    ],
    sections: [
      {
        title: "Batch",
        fields: [
          { key: "product", label: "Product", type: "select", optionsFrom: fromProducts, required: true, span: 4 },
          { key: "batchNo", label: "Batch number", type: "text", required: true },
          { key: "lotNo", label: "Lot number", type: "text", span: 3, hint: "Seed packs carry a lot number. It fills in on the sale bill with the batch." },
          { key: "mfgDate", label: "Manufacturing date", type: "date", span: 3 },
          { key: "expiryDate", label: "Expiry date", type: "date", required: true },
        ],
      },
      {
        title: "Quantity and price",
        fields: [
          { key: "qty", label: "Quantity in this batch", type: "number", required: true },
          { key: "purchaseRate", label: "Purchase rate", type: "money" },
          { key: "mrp", label: "MRP on this batch", type: "money", hint: "MRP can change between batches." },
          { key: "supplier", label: "Bought from", type: "select", optionsFrom: fromSuppliers, span: 3 },
          { key: "rack", label: "Where it is kept", type: "text", span: 3 },
        ],
      },
    ],
    seed: batches,
  },
  {
    id: "stock-adjustments",
    title: "Stock adjustments",
    singular: "adjustment",
    description: "Damage, leakage, expiry write-offs and count corrections, each with a reason.",
    icon: ClipboardCheck,
    kind: "records",
    idPrefix: "ADJ",
    numberKey: "no",
    columns: [
      { key: "no", label: "Entry", kind: "id" },
      { key: "product", label: "Product", kind: "strong", subKey: "batch" },
      { key: "date", label: "Date", kind: "date" },
      { key: "type", label: "Type", kind: "status" },
      { key: "qty", label: "Quantity", kind: "number" },
      { key: "reason", label: "Reason" },
    ],
    sections: [
      {
        title: "Adjustment",
        fields: [
          { key: "no", label: "Entry number", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: true, initial: today },
          { key: "type", label: "Type", type: "select", options: ["Damage", "Leakage", "Expired write-off", "Shortage found in count", "Excess found in count", "Free sample given"], required: true, hint: "Only “Excess found in count” adds stock. Every other type reduces it." },
          { key: "product", label: "Product", type: "select", optionsFrom: fromProducts, required: true, span: 3 },
          { key: "batch", label: "Batch", type: "select", optionsFrom: { module: "batches", key: "batchNo" }, span: 3 },
          { key: "qty", label: "Quantity", type: "number", required: true },
          { key: "approvedBy", label: "Approved by", type: "text" },
          { key: "reason", label: "What happened", type: "textarea", span: 6, required: true },
        ],
      },
    ],
    seed: stockAdjustments,
  },

  /* ---------------- Money ---------------- */
  {
    id: "receipts",
    title: "Customer receipts",
    singular: "receipt",
    description: "Money received from customers against their dues.",
    icon: HandCoins,
    kind: "records",
    idPrefix: "RC",
    numberKey: "no",
    columns: [
      { key: "no", label: "Receipt", kind: "id", subKey: "againstInvoice" },
      { key: "customer", label: "Customer", kind: "strong" },
      { key: "date", label: "Date", kind: "date" },
      { key: "mode", label: "Mode", subKey: "reference" },
      { key: "amount", label: "Amount", kind: "money" },
    ],
    stats: (rows) => [
      { label: "Received", value: moneyShort(sum(rows, (r) => num(r.amount))), note: `${rows.length} receipts`, tone: "good" },
      { label: "In cash", value: moneyShort(sum(rows.filter((r) => r.mode === "Cash"), (r) => num(r.amount))) },
    ],
    sections: [
      {
        title: "Receipt",
        fields: [
          { key: "no", label: "Receipt number", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: true, initial: today },
          { key: "amount", label: "Amount received", type: "money", required: true },
          { key: "customer", label: "Customer", type: "select", optionsFrom: fromCustomers, required: true, span: 3 },
          { key: "againstInvoice", label: "Against invoice", type: "select", optionsFrom: { module: "sales-invoices", key: "no" }, span: 3, hint: "Leave empty to take it as an advance." },
          { key: "mode", label: "Mode", type: "segment", options: PAY_MODES, initial: "Cash", span: 6 },
          { key: "reference", label: "Reference", type: "text", span: 3, placeholder: "UPI or cheque number", showIf: (v) => v.mode !== "Cash" },
          { key: "notes", label: "Note", type: "textarea", span: 6 },
        ],
      },
    ],
    seed: receipts,
  },
  {
    id: "supplier-payments",
    title: "Supplier payments",
    singular: "payment",
    description: "Money paid to suppliers against their bills.",
    icon: BadgeIndianRupee,
    kind: "records",
    idPrefix: "SP",
    numberKey: "no",
    columns: [
      { key: "no", label: "Payment", kind: "id", subKey: "againstBill" },
      { key: "supplier", label: "Supplier", kind: "strong" },
      { key: "date", label: "Date", kind: "date" },
      { key: "mode", label: "Mode", subKey: "reference" },
      { key: "amount", label: "Amount", kind: "money" },
    ],
    stats: (rows) => [{ label: "Paid out", value: moneyShort(sum(rows, (r) => num(r.amount))), note: `${rows.length} payments` }],
    sections: [
      {
        title: "Payment",
        fields: [
          { key: "no", label: "Payment number", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: true, initial: today },
          { key: "amount", label: "Amount paid", type: "money", required: true },
          { key: "supplier", label: "Supplier", type: "select", optionsFrom: fromSuppliers, required: true, span: 3 },
          { key: "againstBill", label: "Against bill", type: "select", optionsFrom: { module: "purchase-bills", key: "no" }, span: 3, hint: "Leave empty to record an advance." },
          { key: "mode", label: "Mode", type: "segment", options: PAY_MODES, initial: "Bank transfer", span: 6 },
          { key: "reference", label: "Reference", type: "text", span: 3, placeholder: "UTR or cheque number", showIf: (v) => v.mode !== "Cash" },
          { key: "notes", label: "Note", type: "textarea", span: 6 },
        ],
      },
    ],
    seed: supplierPayments,
  },
  {
    id: "expenses",
    title: "Expenses",
    singular: "expense",
    description: "Rent, salaries, hamali, transport and other shop running costs.",
    icon: Wallet,
    kind: "records",
    idPrefix: "EX",
    numberKey: "no",
    columns: [
      { key: "no", label: "Entry", kind: "id" },
      { key: "category", label: "Category", kind: "strong", subKey: "notes" },
      { key: "paidTo", label: "Paid to" },
      { key: "date", label: "Date", kind: "date" },
      { key: "mode", label: "Mode" },
      { key: "amount", label: "Amount", kind: "money" },
    ],
    stats: (rows) => {
      const byCategory = new Map<string, number>();
      rows.forEach((r) => byCategory.set(text(r.category), (byCategory.get(text(r.category)) ?? 0) + num(r.amount)));
      const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
      return [
        { label: "Spent", value: moneyShort(sum(rows, (r) => num(r.amount))), note: `${rows.length} entries` },
        { label: "Biggest head", value: top ? top[0] : "—", note: top ? money(top[1]) : undefined },
      ];
    },
    sections: [
      {
        title: "Expense",
        fields: [
          { key: "no", label: "Entry number", type: "text", required: true },
          { key: "date", label: "Date", type: "date", required: true, initial: today },
          { key: "amount", label: "Amount", type: "money", required: true },
          { key: "category", label: "Category", type: "select", options: ["Shop rent", "Salaries", "Electricity", "Loading and hamali", "Transport", "Licence and renewal fees", "Repairs", "Bank charges", "Other"], required: true, span: 3 },
          { key: "paidTo", label: "Paid to", type: "text", span: 3 },
          { key: "mode", label: "Mode", type: "segment", options: PAY_MODES, initial: "Cash", span: 6 },
          { key: "billNo", label: "Bill or voucher number", type: "text", span: 3 },
          { key: "notes", label: "Note", type: "textarea", span: 6 },
        ],
      },
    ],
    seed: expenses,
  },
  {
    id: "cash-advances",
    title: "Cash lent to customers",
    singular: "cash advance",
    description: "Cash you give a farmer in hand. It is added to what they owe and comes back with their payments.",
    icon: HandCoins,
    kind: "records",
    idPrefix: "CL",
    numberKey: "no",
    columns: [
      { key: "no", label: "Entry", kind: "id" },
      { key: "customer", label: "Customer", kind: "strong", subKey: "reason" },
      { key: "date", label: "Given on", kind: "date" },
      { key: "returnBy", label: "Return by", kind: "date" },
      { key: "mode", label: "Mode" },
      { key: "amount", label: "Amount", kind: "money" },
    ],
    stats: (rows) => [
      { label: "Cash lent so far", value: moneyShort(sum(rows, (r) => num(r.amount))), note: `${rows.length} entries`, tone: "warn" },
      { label: "Past the return date", value: String(rows.filter((r) => r.returnBy && daysUntil(r.returnBy) < 0).length), tone: "bad" },
    ],
    sections: [
      {
        title: "Cash advance",
        fields: [
          { key: "no", label: "Entry number", type: "text", required: true },
          { key: "date", label: "Given on", type: "date", required: true, initial: today },
          { key: "amount", label: "Amount given", type: "money", required: true },
          { key: "customer", label: "Customer", type: "select", optionsFrom: fromCustomers, required: true, span: 3 },
          { key: "reason", label: "Reason", type: "select", options: ["Crop expenses", "Labour payment", "Family need", "Other"], span: 3 },
          { key: "mode", label: "Given by", type: "segment", options: PAY_MODES, initial: "Cash", span: 6 },
          { key: "returnBy", label: "To be returned by", type: "date", span: 3, hint: "Usually the end of the crop season." },
          { key: "notes", label: "Note", type: "textarea", span: 6 },
        ],
      },
    ],
    seed: [
      { id: "cl1", no: "CL-0003", date: d(-20), customer: "Lakshmi Agro Farm", amount: 5000, mode: "Cash", reason: "Labour payment", returnBy: d(100), notes: "" },
    ],
  },
  { id: "season", title: "Season settlement", singular: "", description: "Collect dues at the end of the crop season, and decide what happens to any part left unpaid.", icon: Sprout, kind: "custom" },
  { id: "dues", title: "Dues and ledger", singular: "", description: "Who owes you, and whom you owe, in one place.", icon: BookOpenText, kind: "custom" },
  { id: "cashbook", title: "Cash and bank book", singular: "", description: "Money in and out, day by day, built from receipts, payments and expenses.", icon: ReceiptIndianRupee, kind: "custom" },

  /* ---------------- Compliance ---------------- */
  {
    id: "licences",
    title: "Licences",
    singular: "licence",
    description: "Fertilizer, insecticide and seed licences, with renewal reminders.",
    icon: ShieldCheck,
    kind: "records",
    columns: [
      { key: "name", label: "Licence", kind: "strong", subKey: "authority" },
      { key: "number", label: "Number", kind: "id" },
      { key: "holder", label: "Held by" },
      { key: "issueDate", label: "Issued", kind: "date" },
      { key: "expiryDate", label: "Valid till", kind: "expiry" },
    ],
    stats: (rows) => [
      { label: "Expired", value: String(rows.filter((r) => daysUntil(r.expiryDate) < 0).length), note: "Selling without a valid licence is an offence", tone: "bad" },
      { label: "Renew within 60 days", value: String(rows.filter((r) => daysUntil(r.expiryDate) >= 0 && daysUntil(r.expiryDate) <= 60).length), tone: "warn" },
      { label: "Valid", value: String(rows.filter((r) => daysUntil(r.expiryDate) > 60).length), tone: "good" },
    ],
    sections: [
      {
        title: "Licence",
        fields: [
          { key: "name", label: "Licence type", type: "select", options: ["Fertilizer dealer authorisation", "Insecticide selling licence", "Seed dealer licence", "GST registration", "Shop and establishment registration", "Trade licence", "Weights and measures certificate", "Other"], required: true, span: 3 },
          { key: "number", label: "Licence number", type: "text", required: true, span: 3 },
          { key: "authority", label: "Issued by", type: "text", span: 3 },
          { key: "holder", label: "Held in the name of", type: "text", span: 3 },
          { key: "issueDate", label: "Issue date", type: "date" },
          { key: "expiryDate", label: "Valid till", type: "date", hint: "Leave empty if it never expires." },
          { key: "renewalFee", label: "Renewal fee", type: "money" },
          { key: "notes", label: "Renewal notes", type: "textarea", span: 6, placeholder: "Documents needed, whom to contact" },
        ],
      },
    ],
    seed: licences,
  },
  { id: "gst", title: "GST summary", singular: "", description: "Tax collected on sales, tax paid on purchases, and what is left to pay.", icon: Percent, kind: "custom" },

  /* ---------------- Reports ---------------- */
  { id: "reports", title: "Reports", singular: "", description: "Profit, sales by category and best sellers.", icon: ChartColumn, kind: "custom" },

  /* ---------------- Setup ---------------- */
  {
    id: "shop",
    title: "Shop profile",
    singular: "shop profile",
    description: "Details printed on every bill, and how the shop likes to work.",
    icon: Store,
    kind: "form",
    sections: [
      {
        title: "Shop",
        fields: [
          { key: "shopName", label: "Shop name", type: "text", required: true, span: 3 },
          { key: "owner", label: "Owner", type: "text", span: 3 },
          { key: "phone", label: "Phone", type: "phone", span: 3 },
          { key: "email", label: "Email", type: "text", span: 3 },
          { key: "gstin", label: "GSTIN", type: "text", span: 3, hint: "Printed on every tax invoice." },
        ],
      },
      {
        title: "Address",
        fields: [
          { key: "address", label: "Street address", type: "text", span: 6 },
          { key: "town", label: "Town", type: "text" },
          { key: "district", label: "District", type: "text" },
          { key: "state", label: "State", type: "text" },
          { key: "pin", label: "PIN code", type: "text" },
        ],
      },
      {
        title: "Bills",
        description: "Licence numbers are picked up from the Licences screen, so they are not repeated here.",
        fields: [
          { key: "splitInvoices", label: "Separate invoice for fertilizer, pesticide and seed", type: "toggle", span: 6, hint: "One bill on the billing screen is saved as up to three invoices, numbered F-0001, P-0001 and S-0001. Switch off for one combined invoice." },
          { key: "invoicePrefix", label: "Invoice number prefix", type: "text", hint: "INV gives INV-0001, INV-0002… Used for combined invoices." },
          { key: "invoiceSize", label: "Print size", type: "segment", options: ["A4", "A5", "Thermal 3 inch"], span: 4 },
          { key: "showBatch", label: "Print batch and expiry on the bill", type: "toggle", span: 3 },
          { key: "showDose", label: "Print pesticide dose on the bill", type: "toggle", span: 3 },
          { key: "terms", label: "Terms printed at the bottom", type: "textarea", span: 6 },
        ],
      },
      {
        title: "Alerts",
        fields: [
          { key: "lowStockAlerts", label: "Alert when stock reaches the reorder level", type: "toggle", span: 3 },
          { key: "expiryAlertDays", label: "Warn before expiry", type: "number", unit: "days", span: 3 },
        ],
      },
    ],
    seed: shopProfile,
  },
  {
    id: "users",
    title: "Staff and access",
    singular: "staff member",
    description: "Who can log in and what each person is allowed to do.",
    icon: UserCog,
    kind: "records",
    columns: [
      { key: "name", label: "Name", kind: "strong", subKey: "loginId" },
      { key: "role", label: "Role" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status", kind: "status" },
    ],
    sections: [
      {
        title: "Person",
        fields: [
          { key: "name", label: "Full name", type: "text", required: true, span: 3 },
          { key: "phone", label: "Mobile number", type: "phone", span: 3 },
          { key: "loginId", label: "Login name", type: "text", span: 3 },
          { key: "role", label: "Role", type: "select", options: ["Owner", "Manager", "Billing staff", "Accountant"], initial: "Billing staff", span: 3 },
        ],
      },
      {
        title: "What they can do",
        fields: [
          { key: "canBill", label: "Make sales bills", type: "toggle", initial: true, span: 3 },
          { key: "canPurchase", label: "Enter purchases and payments", type: "toggle", span: 3 },
          { key: "canEditStock", label: "Adjust stock", type: "toggle", span: 3 },
          { key: "canSeeReports", label: "See profit and reports", type: "toggle", span: 3 },
          { key: "status", label: "Status", type: "segment", options: ["Active", "Disabled"], initial: "Active", span: 3 },
        ],
      },
    ],
    seed: users,
  },
  {
    id: "brands",
    title: "Brands",
    singular: "brand",
    description: "Manufacturers you stock. Pesticide brands need a principal certificate on your licence.",
    icon: Sprout,
    kind: "records",
    columns: [
      { key: "name", label: "Brand", kind: "strong", subKey: "contact" },
      { key: "makes", label: "Makes" },
      { key: "principalCertificate", label: "Principal certificate", kind: "status" },
      { key: "certificateValidTill", label: "Certificate valid till", kind: "expiry" },
      { key: "status", label: "Status", kind: "status" },
    ],
    sections: [
      {
        title: "Brand",
        fields: [
          { key: "name", label: "Brand or manufacturer", type: "text", required: true, span: 3 },
          { key: "makes", label: "Makes", type: "select", options: CATEGORIES, span: 3 },
          { key: "contact", label: "Company contact", type: "text", span: 3 },
          { key: "status", label: "Status", type: "segment", options: ["Active", "Stopped"], initial: "Active", span: 3 },
        ],
      },
      {
        title: "Principal certificate",
        description: "A pesticide company's certificate must be added to your insecticide licence before you sell its products.",
        showIf: (v) => v.makes === "Pesticide" || v.makes === "Seed",
        fields: [
          { key: "principalCertificate", label: "Certificate", type: "segment", options: ["On file", "Applied", "Missing"], initial: "Missing", span: 3 },
          { key: "certificateValidTill", label: "Valid till", type: "date", span: 3 },
        ],
      },
    ],
    seed: brands,
  },
  {
    id: "tax-rates",
    title: "HSN and GST rates",
    singular: "rate",
    description: "The rate filled in automatically when you add a product. Confirm rates with your accountant.",
    icon: ScrollText,
    kind: "records",
    columns: [
      { key: "hsn", label: "HSN", kind: "id" },
      { key: "description", label: "Covers", kind: "strong" },
      { key: "category", label: "Category" },
      { key: "gst", label: "GST %", kind: "number" },
    ],
    sections: [
      {
        title: "Rate",
        fields: [
          { key: "hsn", label: "HSN code", type: "text", required: true },
          { key: "category", label: "Category", type: "select", options: CATEGORIES },
          { key: "gst", label: "GST rate", type: "segment", options: GST_RATES, unit: "%", span: 6 },
          { key: "description", label: "What it covers", type: "text", span: 6 },
        ],
      },
    ],
    seed: taxRates,
  },
];

export const NAV: NavGroup[] = [
  { label: "", modules: ["dashboard"] },
  { label: "Sales", modules: ["new-sale", "sales-invoices", "estimates", "sales-returns", "customers"] },
  { label: "Purchases", modules: ["purchase-orders", "goods-receipts", "purchase-bills", "purchase-returns", "suppliers"] },
  { label: "Stock", modules: ["products", "stock", "batches", "stock-adjustments"] },
  { label: "Money", modules: ["receipts", "cash-advances", "season", "supplier-payments", "expenses", "dues", "cashbook"] },
  { label: "Compliance and reports", modules: ["licences", "gst", "reports"] },
  { label: "Setup", modules: ["shop", "users", "brands", "tax-rates"] },
];

export const moduleById = (id: string): ModuleDef =>
  MODULES.find((module) => module.id === id) ?? MODULES[0];

export const PackageSearchIcon = PackageSearch;
