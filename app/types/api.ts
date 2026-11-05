/** Formes des réponses de l'API qr_api utilisées par le back-office. */
import type { OrderStatus } from '~/utils/order-status';

export type Role = 'OWNER' | 'MANAGER' | 'STAFF';
export type OrderMode = 'DINE_IN' | 'TAKEAWAY';
export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';
export type TableStatus = 'FREE' | 'OCCUPIED' | 'ORDERING' | 'BILL_REQUESTED' | 'TO_CLEAN' | 'RESERVED';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RestaurantMembership {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  currency: string;
  role: Role;
  staffProfile: string | null;
  permissions: string[];
}

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  restaurants: RestaurantMembership[];
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  brandColors: { primary?: string; secondary?: string; accent?: string } | null;
  menuTheme: 'LIGHT' | 'DARK';
  currency: string;
  locale: string;
  timezone: string;
  taxEnabled: boolean;
  taxRateBp: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Dashboard {
  since: string;
  currency: string;
  isOpen: boolean;
  salesTotal: number;
  ordersCount: number;
  ordersInProgress: number;
  averageBasket: number;
  tablesOccupied: number;
  staffPresent: number;
}

export interface AnalyticsOverview {
  currency: string;
  revenue: number;
  orders: number;
  averageBasket: number;
  cancelledOrders: number;
  cancellationRate: number;
  comparison: {
    revenueChange: number | null;
    ordersChange: number | null;
    averageBasketChange: number | null;
  };
  byMode: Record<string, { orders: number; revenue: number }>;
  peakHours: { hour: number; orders: number; revenue: number }[];
  daily: { date: string; orders: number; revenue: number }[];
}

export interface OrderItemOption {
  groupName: string;
  name: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  options: OrderItemOption[];
  notes: string | null;
  lineTotal: number;
  batch: number;
  kitchenStatus?: 'PENDING' | 'IN_PROGRESS' | 'READY';
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  mode: OrderMode;
  source: 'CUSTOMER' | 'STAFF';
  paymentStatus: PaymentStatus;
  table: { id: string; label: string } | null;
  items: OrderItem[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceFee: number;
  tipAmount: number;
  total: number;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  promoCode: string | null;
  isRush: boolean;
  cancelReason: string | null;
  estimatedReadyAt: string | null;
  createdAt: string;
  _count?: { items: number };
}

export interface Payment {
  id: string;
  method: 'CASH' | 'CARD' | 'MOBILE_MONEY';
  provider: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  amount: number;
  refundedAmount: number;
  operator: string | null;
  createdAt: string;
  refunds?: { id: string; amount: number; reason: string; status: string; createdAt: string }[];
}

export interface Option {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface OptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: Option[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  costAmount: number | null;
  images: string[] | null;
  prepTimeMinutes: number | null;
  isActive: boolean;
  isAvailable: boolean;
  available: boolean;
  stockQuantity: number | null;
  availableAgainAt: string | null;
  allergens: string[] | null;
  dietaryTags: string[] | null;
  calories: number | null;
  stationId?: string | null;
  position: number;
  optionGroups: OptionGroup[];
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  itemsCount: number;
  stationId?: string | null;
  children?: Category[];
}

export interface Zone {
  id: string;
  name: string;
  _count?: { tables: number };
}

export interface DiningTable {
  id: string;
  label: string;
  capacity: number | null;
  kind: 'TABLE' | 'COUNTER';
  status: TableStatus;
  statusChangedAt: string;
  qrVersion: number;
  zone: { id: string; name: string } | null;
}

export interface OpeningHour {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
}

export interface RestaurantDetails extends Restaurant {
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  socialLinks: { website?: string; facebook?: string; instagram?: string; tiktok?: string; whatsapp?: string } | null;
  priceFormat: string | null;
  pricesIncludeTax: boolean;
  serviceFeeBp: number;
  openingHours: OpeningHour[];
}

export interface Closure {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export type StaffProfile = 'CUISINE' | 'SALLE' | 'CAISSE' | 'BAR';

export interface PermissionOverrides {
  grant?: string[];
  deny?: string[];
}

export interface Member {
  id: string;
  role: Role;
  staffProfile: StaffProfile | null;
  permissionOverrides: PermissionOverrides | null;
  permissions: string[];
  user: { id: string; email: string; phone: string | null; firstName: string; lastName: string; status: string };
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string | null;
  phone: string | null;
  role: Role;
  staffProfile: StaffProfile | null;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
}

export interface Station {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isActive: boolean;
}

export type KitchenItemStatus = 'PENDING' | 'IN_PROGRESS' | 'READY';

export interface KitchenTicket {
  orderId: string;
  number: number;
  mode: OrderMode;
  table: string | null;
  status: OrderStatus;
  isRush: boolean;
  notes: string | null;
  customerName: string | null;
  createdAt: string;
  estimatedReadyAt: string | null;
  ageMinutes: number;
  urgency: 'normal' | 'warning' | 'late';
  items: {
    id: string;
    name: string;
    quantity: number;
    options: string[];
    notes: string | null;
    batch: number;
    kitchenStatus: KitchenItemStatus;
    station: Pick<Station, 'id' | 'name' | 'color'> | null;
  }[];
}

export interface Receipt {
  receiptNumber: string;
  issuedAt: string;
  restaurant: { name: string; address?: string | null; city?: string | null; phone?: string | null };
  order: { number: number; mode: OrderMode; table: string | null; createdAt: string };
  items: { name: string; quantity: number; unitPrice: number; options: string[]; lineTotal: number }[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  taxRateBp: number;
  pricesIncludeTax: boolean;
  serviceFee: number;
  tipAmount: number;
  total: number;
  payments: { method: Payment['method']; operator: string | null; amount: number; paidAt: string; refunds: { amount: number; reason: string; date: string }[] }[];
}

export interface RealtimeMessage<T = unknown> {
  seq: number;
  type: string;
  restaurantId: string;
  orderId: string | null;
  payload: T;
  createdAt: string;
}

export type PromotionType = 'PERCENT' | 'AMOUNT' | 'BUY_X_GET_Y' | 'FREE_ITEM';

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: PromotionType;
  /** PERCENT : points de base (1000 = 10 %) ; AMOUNT : plus petite unité. */
  value: number;
  buyQuantity: number | null;
  freeQuantity: number | null;
  menuItemId: string | null;
  minSubtotal: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface LoyaltyProgram {
  restaurantId: string;
  isActive: boolean;
  pointsPerUnit: number;
  unitAmount: number;
  expiryDays: number | null;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  type: PromotionType;
  value: number;
  menuItemId: string | null;
  isActive: boolean;
}

export interface LoyaltyAccount {
  id: string;
  points: number;
  lifetimePoints: number;
  lastActivityAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  status: 'PUBLISHED' | 'HIDDEN';
  hiddenReason: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  order: { number: number } | null;
}

export interface ReviewSummary {
  averageRating: number | null;
  distribution: Record<string, number>;
  total?: number;
}

export interface MenuPerformanceRow {
  menuItemId: string;
  name: string;
  category: string;
  active: boolean;
  quantity: number;
  revenue: number;
  cost: number | null;
  margin: number | null;
  marginRate: number | null;
}

export interface MenuPerformance {
  period: { from: string; to: string };
  currency: string;
  items: MenuPerformanceRow[];
  bestSellers: MenuPerformanceRow[];
  leastSold: MenuPerformanceRow[];
  lowestMargin: MenuPerformanceRow[];
}

export interface TaxReport {
  period: { from: string; to: string };
  currency: string;
  groupBy: 'day' | 'month';
  lines: {
    period: string;
    taxRateBp: number;
    orders: number;
    baseAmount: number;
    taxAmount: number;
    totalInclTax: number;
    serviceFees: number;
    tips: number;
  }[];
  totals: {
    orders: number;
    baseAmount: number;
    taxAmount: number;
    totalInclTax: number;
    serviceFees: number;
    tips: number;
    refunds: number;
  };
}
