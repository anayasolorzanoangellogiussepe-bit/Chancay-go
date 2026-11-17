export type Role = 'passenger' | 'driver' | 'admin';
export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type TripStatus = 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export interface Profile {
  id: string; role: Role; full_name: string; phone: string; dni: string;
  emergency_name: string | null; emergency_phone: string | null;
}
export interface Driver {
  id: string; license_no: string; plate: string; vehicle_model: string; vehicle_color: string;
  soat_expiry: string; municipal_permit: string; photo_url: string | null; license_url: string | null; soat_url: string | null;
  status: DriverStatus; rejection_reason: string | null; is_online: boolean;
  lat: number | null; lng: number | null; rating_avg: number; rating_count: number;
}
export interface Trip {
  id: string; passenger_id: string; driver_id: string | null;
  origin_text: string; origin_lat: number; origin_lng: number;
  dest_text: string; dest_lat: number; dest_lng: number;
  distance_km: number; fare: number; status: TripStatus; share_token: string; created_at: string;
}
