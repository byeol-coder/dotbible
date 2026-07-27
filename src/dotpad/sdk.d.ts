/* DotPad Web SDK 3.0.0 — 미니파이된 벤더 코드라 정밀 타입을 낼 수 없다.
   DotPadManager.ts가 실제로 호출하는 표면만 선언했다. */
export interface SdkDeviceLike {
  numberCellColumns?: number;
  numberCellRows?: number;
  name?: string;
}

export declare class DotPadSDK {
  connectBleDevice(bt: BluetoothDevice): Promise<SdkDeviceLike | null>;
  disconnect?(dev: SdkDeviceLike): Promise<void>;
  setCallBack(
    msg: (d: SdkDeviceLike, code: string) => void,
    key: (d: SdkDeviceLike, key: string) => void
  ): void;
  displayGraphicData(hex: string, dev: SdkDeviceLike, mode?: unknown): Promise<void>;
  displayTextData(hex: string, dev: SdkDeviceLike, mode?: unknown): Promise<void>;
}

export declare class DotPadScanner {
  startBleScan(): Promise<BluetoothDevice | undefined>;
  startUsbScan(): Promise<unknown>;
}

export declare const DataCodes: {
  Connected: string;
  Disconnected: string;
  [key: string]: string;
};
export declare const KeyCodes: {
  KeyFunction1: string; KeyFunction2: string; KeyFunction3: string; KeyFunction4: string;
  KeyFunction12: string; KeyFunction13: string; KeyFunction14: string;
  KeyFunction23: string; KeyFunction24: string; KeyFunction34: string;
  KeyElse: string; PanningAll: string; PanningLeft: string; PanningRight: string;
  LPF1: string; RPF4: string;
  [key: string]: string;
};
export declare const DeviceInfo: { DeviceName: string; FirmwareVersion: string; HardwareVersion: string };
export declare const DisplayMode: { GraphicMode: string; TextMode: string };
