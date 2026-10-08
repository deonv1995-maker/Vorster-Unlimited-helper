export const DELIVERY_VEHICLES = [
  { id: 'vehicle-1', name: 'Vehicle 1' },
  { id: 'vehicle-2', name: 'Vehicle 2' },
] as const;

export type VehicleId = (typeof DELIVERY_VEHICLES)[number]['id'];

export interface OrderItem {
  id: string;
  jobCardId: string;
  position: number;
  productCode: string;
  description: string;
  quantity: number;
  sourcePage: number;
}

export interface ParsedOrderItem {
  position: number;
  productCode: string;
  description: string;
  quantity: number;
  sourcePage: number;
}

export interface DeliveryAllocation {
  jobCardId: string;
  vehicleId: VehicleId;
  loadPercent: number;
}

export interface VehicleCapacity {
  vehicleId: VehicleId;
  bookedPercent: number;
}

export function isVehicleId(value: unknown): value is VehicleId {
  return DELIVERY_VEHICLES.some((vehicle) => vehicle.id === value);
}
