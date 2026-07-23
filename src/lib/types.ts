export interface WardProperties {
  city: string;
  ward: number;
  repName: string | null;
  repParty: string;
  repPhotoUrl: string | null;
  repEmail: string | null;
  repPhone: string | null;
  officeSince: string;
}

export interface Hearing {
  title: string;
  datetime: string;
  location: string;
}
