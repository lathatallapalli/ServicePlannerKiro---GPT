export type BookingCategoryApplyScope = 'entry' | 'booking-set' | 'order';

export interface BookingCategory {
  id: string;
  label: string;
  color: string;
  appliesTo: BookingCategoryApplyScope;
  tagBackgroundColor?: string;
  tagTextColor?: string;
  description?: string;
  isSystem?: boolean;
}
