export interface RepProperties {
  role: "Mayor" | "Council Member";
  city: string;
  ward: number | null;
  repName: string | null;
  repParty: string;
  repPhotoUrl: string | null;
  repEmail: string | null;
  repPhone: string | null;
  officeSince: string;
  committees: string[];
  neighborhoods: string[];
  officeRoom: string | null;
  profileUrl: string | null;
}

export interface Hearing {
  title: string;
  datetime: string;
  location: string;
}
