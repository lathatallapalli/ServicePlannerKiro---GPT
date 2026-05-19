export interface UnavailabilityBlock {
  resourceId: string;
  start: Date;
  end: Date;
  reason?: string;
  title?: string;
  color?: string;
  kind?: 'availability' | 'blocked-order';
}
