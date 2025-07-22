export interface MultifactorResponse {
  model: MultifactorRegistration;
  success: boolean;
}

export interface MultifactorRegistration {
  accountId: string;
  deviceId: string;
  identity: string;
  scopeName: string;
  otpkey: string;
  signingKey: string;
}

export interface MultifactorRegisterRequest {
  RequestId: string;
  ClientToken: string;
  DeviceName: string;
  DeviceType: string;
  AppVersion: string;
}

export interface MultifactorCallbackPayload {
  RequestId: string;
  AccountIdentity: {
    DeviceId: string;
    AccountId: string;
  };
  Action: string;
}

export interface MultifactorCallbackRequest {
  Salt: string;
  Sign: string;
  Payload: MultifactorCallbackPayload;
}

export interface MultifactorCallbackResponse {
  success: boolean;
  message: string;
}

export interface MultifactorApproveRequest {
  Type: string;
  Name: string;
  RequestId: string;
  AccountId: string;
  Message: string;
  TTL: string;
  DC: string;
  IsMobilePushOtpCodeRequired: string;
}
