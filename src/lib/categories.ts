export type CategoryId = 'identity' | 'finance' | 'travel' | 'personal' | string;

export interface Category {
  id: CategoryId;
  name: string;
  icon: string; // Ionicons name
  hue: string; // tint used for chips/thumbnails
  types: string[];
  custom?: boolean;
}

export const BUILTIN_CATEGORIES: Category[] = [
  {
    id: 'identity',
    name: 'Identity',
    icon: 'id-card-outline',
    hue: '#5B4CF0',
    types: ['Passport', 'National ID', 'Driving Licence', 'Visa', 'Residence Permit', 'Aadhaar', 'PAN Card'],
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: 'wallet-outline',
    hue: '#E0576B',
    types: ['Bank Statement', 'Credit Card', 'Insurance', 'Tax Document', 'Investment Document'],
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: 'airplane-outline',
    hue: '#2F8FDB',
    types: ['Flight Ticket', 'Hotel Booking', 'Travel Insurance', 'Boarding Pass', 'Travel Document'],
  },
  {
    id: 'personal',
    name: 'Personal',
    icon: 'heart-outline',
    hue: '#1F9D6B',
    types: [
      'Birth Certificate',
      'Marriage Certificate',
      'Educational Certificate',
      'Medical Document',
      'Family Document',
    ],
  },
];

/** Document types that are rendered as wallet cards (front/back). */
export const CARD_TYPES = new Set([
  'Passport',
  'National ID',
  'Driving Licence',
  'Residence Permit',
  'Aadhaar',
  'PAN Card',
  'Credit Card',
  'Visa',
  'Boarding Pass',
]);

/** Types for which an expiry date is meaningful and reminders are offered. */
export const EXPIRING_TYPES = new Set([
  'Passport',
  'National ID',
  'Driving Licence',
  'Visa',
  'Residence Permit',
  'Insurance',
  'Travel Insurance',
  'Credit Card',
]);
