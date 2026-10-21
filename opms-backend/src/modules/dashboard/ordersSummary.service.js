/**
 * Dashboard aggregates for KPIs, the monthly chart, and leaderboards.
 * Scoped with the same visibility rules as GET /orders. The response is
 * numbers and names — not order documents.
 */
const { getModels } = require('../../data/mongoRegistry');
const { deriveOrderWorkflowStatus } = require('../orders/orderListPage.service');
const { isSalesUser } = require('../orders/orderAssignee.util');

const TAB_IDS = [
  'all',
  'draft',
  'pending_admin_approval',
  'due_sheet_pending',
  'pending_finance_approval',
  'pending_account_approval',
  'open_dispatched',
  'transport_pending',
  'in_transit',
  'closed_delivered',
  'on_hold',
  'cancelled',
  'rejected',
];

const ITEM_SELECT = [
  'order_items.product',
  'order_items.product_name',
  'order_items.product_type',
  'order_items.ordered_quantity',
  'order_items.quantity',
  'order_items.approved_quantity',
  'order_items.dispatched_quantity',
  'order_items.dispatch_quantity',
  'order_items.billed_dispatched_quantity',
  'order_items.unit_price',
  'order_items.approved_unit_price',
  'order_items.rate',
  'order_items.gst_percent',
  'order_items.tax_percent',
  'order_items.applied_rate_type',
  'order_items.kit_parent_product',
  'order_date',
  'billing_date',
  'dispatched_at',
  'dispatch_date',
  'createdAt',
  'party',
  'assigned_sales_user',
].join(' ');

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function refId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return String(value._id ?? value.id ?? '');
  return String(value);
}

function emptyStat() {
  return { count: 0, quantity: 0, kitQuantity: 0, amount: 0 };
}

function emptyTabs() {
  return Object.fromEntries(TAB_IDS.map((id) => [id, emptyStat()]));
}

function emptyBucket() {
  return { total: 0, sr: 0, sra: 0, cr: 0 };
}

function rateTypeOf(raw) {
  const rateType = !raw || raw === 'MANUAL' ? 'SR' : String(raw).toUpperCase();
  if (rateType === 'SR' || rateType === 'SRA' || rateType === 'CR') return rateType;
  return null;
}

function addBucket(bucket, rateType, value) {
  bucket.total += value;
  if (rateType === 'SR') bucket.sr += value;
  else if (rateType === 'SRA') bucket.sra += value;
  else if (rateType === 'CR') bucket.cr += value;
}

function isKitBucket(line) {
  return Boolean(refId(line?.kit_parent_product));
}

function isKitShell(line, allLines) {
  if (!line || refId(line.kit_parent_product)) return false;
  if (String(line.product_type || '').toLowerCase() === 'kit') return true;
  const nested = line.product;
  if (nested && typeof nested === 'object' && String(nested.product_type || '').toLowerCase() === 'kit') {
    return true;
  }
  const productId = refId(line.product);
  if (!productId) return false;
  return allLines.some((other) => refId(other.kit_parent_product) === productId);
}

function boardQty(line, basis) {
  if (basis === 'dispatched') {
    const explicit = num(
      line.dispatched_quantity ?? line.dispatch_quantity ?? line.billed_dispatched_quantity,
    );
    if (explicit > 0) return explicit;
    return num(line.approved_quantity ?? line.ordered_quantity ?? line.quantity);
  }
  return num(line.approved_quantity);
}

function lineQty(line, basis, status) {
  if (basis === 'dispatched') return boardQty(line, 'dispatched');
  const isApproved =
    status !== 'draft' &&
    status !== 'submitted' &&
    status !== 'cancelled' &&
    status !== 'finance_rejected' &&
    status !== 'rejected' &&
    status !== 'on_hold';
  return isApproved ? num(line.approved_quantity) : num(line.ordered_quantity ?? line.quantity);
}

function unitPrice(line) {
  const base = num(line.unit_price ?? line.approved_unit_price ?? line.rate);
  const gstPct = num(line.gst_percent ?? line.tax_percent);
  return base * (1 + gstPct / 100);
}

function shouldInclude(order, basis) {
  const status = deriveOrderWorkflowStatus(order);
  if (
    status === 'draft' ||
    status === 'deleted' ||
    order.deletedAt != null
  ) {
    return false;
  }
  if (
    status === 'cancelled' ||
    status === 'finance_rejected' ||
    status === 'rejected' ||
    status === 'on_hold'
  ) {
    return false;
  }
  if (basis === 'dispatched') {
    return Boolean(order.billing_date || order.dispatched_at || order.dispatch_date);
  }
  return true;
}

function eventDate(order, basis) {
  const raw =
    basis === 'dispatched'
      ? (order.billing_date || order.dispatched_at || order.dispatch_date)
      : (order.order_date || order.createdAt);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inPeriod(order, query, dataType) {
  const basis = dataType === 'billed' ? 'dispatched' : 'approved';
  const d = eventDate(order, basis);
  if (!d) return false;
  const dateFilter = String(query.dateFilter || 'all');
  if (dateFilter !== 'all') {
    const from = query.dateFrom ? new Date(query.dateFrom) : null;
    const to = query.dateTo ? new Date(query.dateTo) : null;
    if (from && !Number.isNaN(from.getTime()) && d < from) return false;
    if (to && !Number.isNaN(to.getTime()) && d > to) return false;
    return true;
  }
  const years = String(query.years || '')
    .split(',')
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
  const months = String(query.months || '')
    .split(',')
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
  if (!years.length || !months.length) return false;
  return years.includes(d.getFullYear()) && months.includes(d.getMonth());
}

function partyName(party) {
  if (!party || typeof party !== 'object') return 'Unknown Party';
  return (
    party.party_name ||
    party.contact_person ||
    party.legal_name ||
    party.trade_name ||
    party.name ||
    'Unknown Party'
  );
}

function salesName(user) {
  if (!user || typeof user !== 'object') return 'Unassigned';
  return user.name || user.username || 'Unassigned';
}

function productName(line) {
  const nested = line.product;
  if (nested && typeof nested === 'object') {
    return nested.product_name || nested.name || line.product_name || 'Unknown Product';
  }
  return line.product_name || 'Unknown Product';
}

function ensureMonthGrid(store, year) {
  const key = String(year);
  if (!store[key]) store[key] = Array.from({ length: 12 }, () => 0);
  return store[key];
}

function rowsFromMap(map) {
  return Array.from(map.values()).sort((a, b) => b.quantity.total - a.quantity.total);
}

const SUMMARY_TTL_MS = 20_000;
const summaryCache = new Map();
const summaryInflight = new Map();

function summaryCacheKey(user, query) {
  const uid = String(user?._id || user?.id || user?.email || '');
  const parts = [
    uid,
    query.dataType || '',
    query.dateFilter || '',
    query.dateFrom || '',
    query.dateTo || '',
    query.years || '',
    query.months || '',
  ];
  return parts.join('|');
}

function idList(ids) {
  return [...ids].filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
}

async function attachSummaryRefs(details) {
  const partyIds = new Set();
  const userIds = new Set();
  const productIds = new Set();
  for (const order of details) {
    const partyId = refId(order.party);
    const userId = refId(order.assigned_sales_user);
    if (partyId) partyIds.add(partyId);
    if (userId) userIds.add(userId);
    for (const line of order.order_items || []) {
      const productId = refId(line.product);
      if (productId) productIds.add(productId);
    }
  }

  const models = getModels();
  const [parties, users, products] = await Promise.all([
    partyIds.size
      ? models.Party.find({ _id: { $in: idList(partyIds) } })
          .select('party_name contact_person legal_name trade_name name')
          .lean()
      : [],
    userIds.size
      ? models.User.find({ _id: { $in: idList(userIds) } })
          .select('name username')
          .lean()
      : [],
    productIds.size
      ? models.Product.find({ _id: { $in: idList(productIds) } })
          .select('product_name name product_type')
          .lean()
      : [],
  ]);
  const partyById = new Map(parties.map((row) => [String(row._id), row]));
  const userById = new Map(users.map((row) => [String(row._id), row]));
  const productById = new Map(products.map((row) => [String(row._id), row]));

  return details.map((order) => ({
    ...order,
    party: partyById.get(refId(order.party)) || order.party,
    assigned_sales_user: userById.get(refId(order.assigned_sales_user)) || order.assigned_sales_user,
    order_items: (order.order_items || []).map((line) => {
      const product = productById.get(refId(line.product));
      return product ? { ...line, product } : line;
    }),
  }));
}

async function ordersSummary(query, user, buildBaseQuery) {
  const cacheKey = summaryCacheKey(user, query);
  const hit = summaryCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const pending = summaryInflight.get(cacheKey);
  if (pending) return pending;

  const job = computeOrdersSummary(query, user, buildBaseQuery, cacheKey);
  summaryInflight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    summaryInflight.delete(cacheKey);
  }
}

async function computeOrdersSummary(query, user, buildBaseQuery, cacheKey) {
  const { countProcessStages } = require('../orders/orderListPage.service');
  const dataType = query.dataType === 'billed' ? 'billed' : 'approved';
  const kpiBasis = dataType === 'billed' ? 'dispatched' : 'approved';
  const salesTabs = isSalesUser(user);
  const scopeQuery = await buildBaseQuery(
    salesTabs ? {} : { exclude_status: 'draft' },
    user,
  );
  const { tabCounts } = await countProcessStages(scopeQuery, salesTabs);

  const stageMatch = { ...scopeQuery };
  if (!salesTabs) stageMatch.process_stage = { $nin: ['draft', null] };
  const rawDetails = await getModels()
    .Order.find(stageMatch)
    .select(`${ITEM_SELECT} process_stage status lifecycle_status workflow_stage current_action dispatch_status delivery_status closed_at`)
    .lean();
  const details = await attachSummaryRefs(rawDetails);

  const queueCounts = {};
  for (const id of TAB_IDS) queueCounts[id] = tabCounts[id] || 0;

  const tabStats = emptyTabs();
  const monthly = {
    approved: { quantity: {}, volume: {} },
    dispatched: { quantity: {}, volume: {} },
  };
  const yearSet = new Set([new Date().getFullYear()]);
  const parties = new Map();
  const products = new Map();
  const salesUsers = new Map();
  const contributionMap = new Map();

  for (const order of details) {
    const tab = order.process_stage || null;
    const status = deriveOrderWorkflowStatus(order);
    const items = order.order_items || [];
    const periodMatch = inPeriod(order, query, dataType);

    const approvedDate = eventDate(order, 'approved');
    const billedDate = eventDate(order, 'dispatched');
    if (dataType === 'billed') {
      if (billedDate) yearSet.add(billedDate.getFullYear());
    } else if (approvedDate) {
      yearSet.add(approvedDate.getFullYear());
    }

    if (periodMatch && tab !== 'draft') {
      let quantity = 0;
      let kitQuantity = 0;
      let amount = 0;
      for (const line of items) {
        const q = lineQty(line, kpiBasis, status);
        if (q !== 0) {
          if (isKitShell(line, items)) kitQuantity += q;
          else quantity += q;
        }
        if (isKitBucket(line)) continue;
        const pricedQty = kpiBasis === 'dispatched'
          ? lineQty(line, 'dispatched', status)
          : num(line.approved_quantity);
        if (pricedQty === 0) continue;
        amount += pricedQty * unitPrice(line);
      }
      const addStat = (stat) => {
        stat.count += 1;
        stat.quantity += quantity;
        stat.kitQuantity += kitQuantity;
        stat.amount += amount;
      };
      addStat(tabStats.all);
      if (tab && tab !== 'all' && tabStats[tab]) addStat(tabStats[tab]);
    }

    for (const basis of ['approved', 'dispatched']) {
      if (!shouldInclude(order, basis)) continue;
      const d = eventDate(order, basis);
      if (!d) continue;
      const quantityGrid = ensureMonthGrid(monthly[basis].quantity, d.getFullYear());
      const volumeGrid = ensureMonthGrid(monthly[basis].volume, d.getFullYear());
      for (const line of items) {
        const shell = isKitShell(line, items);
        const bucketLine = isKitBucket(line);
        const q = boardQty(line, basis);
        if (!shell && q) quantityGrid[d.getMonth()] += q;
        if (!bucketLine && q) volumeGrid[d.getMonth()] += q * unitPrice(line);
      }
    }

    if (!periodMatch || !shouldInclude(order, kpiBasis)) continue;

    const partyLabel = partyName(order.party);
    const salesLabel = salesName(order.assigned_sales_user);
    const salesUserId = refId(order.assigned_sales_user);
    const partyId = refId(order.party);
    if (!parties.has(partyLabel)) {
      parties.set(partyLabel, { name: partyLabel, quantity: emptyBucket(), volume: emptyBucket() });
    }
    if (!salesUsers.has(salesLabel)) {
      salesUsers.set(salesLabel, { name: salesLabel, quantity: emptyBucket(), volume: emptyBucket() });
    }
    const partyRow = parties.get(partyLabel);
    const salesRow = salesUsers.get(salesLabel);

    for (const line of items) {
      const shell = isKitShell(line, items);
      const bucketLine = isKitBucket(line);
      const q = boardQty(line, kpiBasis);
      const price = unitPrice(line);
      const rate = rateTypeOf(line.applied_rate_type);
      const qtyValue = shell ? 0 : q;
      const volValue = bucketLine ? 0 : q * price;
      addBucket(partyRow.quantity, rate, qtyValue);
      addBucket(partyRow.volume, rate, volValue);
      addBucket(salesRow.quantity, rate, qtyValue);
      addBucket(salesRow.volume, rate, volValue);

      const name = productName(line);
      if (!products.has(name)) {
        products.set(name, {
          name,
          quantity: emptyBucket(),
          quantityKit: emptyBucket(),
          volume: emptyBucket(),
          volumeKit: emptyBucket(),
        });
      }
      const productRow = products.get(name);
      const productQty = q;
      addBucket(productRow.quantity, rate, productQty);
      if (shell) addBucket(productRow.quantityKit, rate, productQty);
      if (!bucketLine) addBucket(productRow.volume, rate, q * price);

      const productId = refId(line.product);
      if (!productId) continue;
      const key = `${productId}|${salesUserId}|${partyId}`;
      const cell = contributionMap.get(key) || {
        productId,
        salesUserId,
        partyId,
        quantity: 0,
        volume: 0,
      };
      cell.quantity += qtyValue;
      cell.volume += volValue;
      contributionMap.set(key, cell);
    }
  }

  const value = {
    availableYears: Array.from(yearSet).sort((a, b) => b - a),
    queueCounts,
    tabStats,
    monthly,
    leaderboards: {
      parties: rowsFromMap(parties),
      products: rowsFromMap(products),
      salesUsers: rowsFromMap(salesUsers),
    },
    contributions: Array.from(contributionMap.values()),
  };
  summaryCache.set(cacheKey, { expires: Date.now() + SUMMARY_TTL_MS, value });
  if (summaryCache.size > 40) {
    const oldest = summaryCache.keys().next().value;
    summaryCache.delete(oldest);
  }
  return value;
}

module.exports = { ordersSummary };
