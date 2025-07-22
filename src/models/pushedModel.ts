export interface PushedResponse {
  model: PushedRegistration;
  success: boolean;
  message: string | null;
  errCode: string | null;
}

export interface PushedRegistration {
  clientToken: string;
}

export interface DeviceSettings {
  transportKind: string;
  deviceToken: string;
}

export interface PushedRequest {
  clientToken: string;
  deviceSettings: DeviceSettings[];
}
