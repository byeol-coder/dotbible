/* DotPad 연결·출력 관리자.
   원본 vanilla 앱의 DP 싱글턴을 그대로 옮겼다 — 진단 로직(blocker/reason),
   재연결, 그래픽/텍스트 출력 알고리즘은 바꾸지 않았다.

   두 가지만 React 포팅에 맞게 바꿨다:
   1. window.DotPadSDK 등 전역 우회 없이 sdk.ts에서 직접 import한다.
   2. t()(i18n)를 전역으로 참조하지 않고 blocker()/reason() 호출 시
      인자로 받는다 — 이 클래스는 화면 언어를 몰라도 된다.
   3. UI.dpBadge() 같은 임의 전역 재호출 대신, 구독자(subscribe)에게
      알리는 방식으로 바꿨다 — useSyncExternalStore로 React에 연결한다. */
import { DotPadSDK, DotPadScanner, DataCodes, KeyCodes, DisplayMode } from "./sdk";
import type { TFn } from "../i18n";

export interface DotPadDiag {
  protocol: string;
  secureContext: boolean;
  hasBluetooth: boolean;
  inFrame: boolean;
  ancestorOrigins: string[] | null;
  bluetoothAllowedInFrame: boolean | null;
  userAgent: string;
}

// DotPadSDK가 실제로 노출하는 최소 형태만 타입으로 잡는다(벤더 코드는 미니파이돼
// 정밀 타입을 낼 수 없다 — 우리가 실제로 호출하는 메서드만 선언).
interface SdkDevice { numberCellColumns?: number; numberCellRows?: number; name?: string }
interface Sdk {
  connectBleDevice(bt: BluetoothDevice): Promise<SdkDevice | null>;
  disconnect?(dev: SdkDevice): Promise<void>;
  setCallBack(msg: (d: SdkDevice, code: string) => void, key: (d: SdkDevice, key: string) => void): void;
  displayGraphicData(hex: string, dev: SdkDevice, mode?: unknown): Promise<void>;
  displayTextData(hex: string, dev: SdkDevice, mode?: unknown): Promise<void>;
}

type Listener = () => void;

class DotPadManager {
  sdk: Sdk | null = null;
  btDevice: BluetoothDevice | null = null;
  device: SdkDevice | null = null;
  live = false;
  busy = false;
  private _vis = false;
  private _keyCb: ((key: string) => void) | null = null;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  hasReal(): boolean {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  /** document.featurePolicy는 비표준·구식 Chrome 전용 API라 최신 버전에서는
      아예 없을 수 있다. 있으면 쓰고, 없으면 판정 불가(null)로 둔다 —
      "없다"를 "권한 없음"으로 잘못 해석하지 않기 위해서다. */
  framePolicy(): boolean | null {
    try {
      const fp = (document as unknown as { featurePolicy?: { allowsFeature: (f: string) => boolean } }).featurePolicy;
      if (fp && typeof fp.allowsFeature === "function") return !!fp.allowsFeature("bluetooth");
    } catch { /* noop */ }
    return null;
  }

  inFrame(): boolean {
    try { return window.self !== window.top; } catch { return true; }
  }

  /** location.ancestorOrigins(Chrome/Edge)은 이 페이지를 감싼 프레임들의 실제
      origin을 알려준다. "프레임에 권한이 없다"는 진단이 나올 때 그게 로컬
      테스트 하네스인지 실제 배포 호스트인지 여기서 구분된다. */
  ancestorOrigins(): string[] | null {
    try {
      const ao = (location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins;
      return ao ? Array.from(ao) : null;
    } catch { return null; }
  }

  diag(): DotPadDiag {
    return {
      protocol: location.protocol,
      secureContext: !!window.isSecureContext,
      hasBluetooth: !!navigator.bluetooth,
      inFrame: this.inFrame(),
      ancestorOrigins: this.ancestorOrigins(),
      bluetoothAllowedInFrame: this.framePolicy(),
      userAgent: navigator.userAgent,
    };
  }

  blocker(t: TFn): string | null {
    if (location.protocol === "file:") return t("err.fileProtocol");
    if (!navigator.bluetooth) return t("err.noWebBluetooth");
    if (this.inFrame() && this.framePolicy() === false) return this.frameBlockMsg(t);
    return null;
  }

  frameBlockMsg(t: TFn): string {
    const ao = this.ancestorOrigins();
    const where = ao && ao.length ? t("err.ancestorChain", ao.join(" → ")) : t("err.ancestorUnknown");
    return t("err.frameBlocked", where);
  }

  /** SDK의 startBleScan()은 모든 예외를 삼키고 undefined만 돌려줘서 취소인지
      권한 거부인지 구분할 수 없다. 같은 필터로 직접 호출해 실제 오류
      이름을 받는다. */
  requestDevice(): Promise<BluetoothDevice> {
    return navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "DotPad" }],
      optionalServices: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"],
    });
  }

  reason(err: unknown, t: TFn): string {
    const n = (err as { name?: string })?.name || "";
    if (n === "NotFoundError") return t("err.notFound");
    if (n === "SecurityError" || n === "NotAllowedError") {
      if (this.inFrame() && this.framePolicy() === false) return this.frameBlockMsg(t);
      if (this.inFrame() && this.framePolicy() === null) return t("err.frameUnknown");
      if (window.isSecureContext === false) return t("err.insecureContext");
      return t("err.secDenied");
    }
    if (n === "InvalidStateError") return t("err.btOff");
    if (n === "NetworkError") return t("err.netFail");
    return t("err.genericFail", n);
  }

  gattOk(): boolean {
    try { return !!this.btDevice?.gatt?.connected; } catch { return false; }
  }
  isConnected(): boolean { return this.live && this.gattOk(); }
  deviceName(): string { try { return this.device?.name || this.btDevice?.name || "DotPad"; } catch { return "DotPad"; } }

  /** 연결된 기기의 촉각 핀 격자 크기 (320→60×40, 768→96×64). 미연결 시 320 기준 */
  gridPins(): { cols: number; rows: number } {
    let c = 0, r = 0;
    try { c = this.device?.numberCellColumns || 0; r = this.device?.numberCellRows || 0; } catch { /* noop */ }
    return { cols: c > 0 ? c * 2 : 60, rows: r > 0 ? r * 4 : 40 };
  }

  onKey(fn: (key: string) => void): void { this._keyCb = fn; }

  async ensure(force = false): Promise<boolean> {
    if (!(this.sdk && this.btDevice)) return !!this.device;
    if (!force && this.device && this.gattOk()) return true;
    try { if (this.device && this.sdk.disconnect) await this.sdk.disconnect(this.device); } catch { /* noop */ }
    this.device = null;
    try {
      const dev = await this.sdk.connectBleDevice(this.btDevice);
      if (dev) { this.device = dev; this.live = true; this.notify(); return true; }
    } catch { /* noop */ }
    return false;
  }

  /** 실패하면 예외를 던진다 — 호출부가 reason()으로 원인을 표시한다 */
  async connect(): Promise<boolean> {
    const bt = await this.requestDevice(); // 취소·거부 시 여기서 throw
    const sdk = new DotPadSDK() as unknown as Sdk;
    const dev = await sdk.connectBleDevice(bt);
    if (!dev) { const e = new Error("connectBleDevice returned null"); e.name = "NetworkError"; throw e; }
    try {
      sdk.setCallBack(
        (_d, code) => {
          if (code === DataCodes.Disconnected) { this.live = false; this.device = null; this.notify(); }
          else if (code === DataCodes.Connected) { this.live = true; this.notify(); }
        },
        (_d, key) => { if (this._keyCb) this._keyCb(key); }
      );
    } catch { /* noop */ }
    this.sdk = sdk; this.btDevice = bt; this.device = dev; this.live = !!dev;
    this.notify();
    if (!this._vis) {
      this._vis = true;
      try {
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden && this.sdk && this.btDevice && !this.gattOk()) this.ensure().catch(() => {});
        });
      } catch { /* noop */ }
    }
    return !!dev;
  }

  /** 멀티라인 촉각 면 출력 — hex = 핀 격자 전체(GraphicMode) */
  async outputGraphic(hex: string): Promise<boolean> {
    if (this.busy || !hex) return false;
    this.busy = true;
    try {
      if (!(this.sdk && this.btDevice)) return false;
      if (!this.device || !this.gattOk()) await this.ensure();
      if (!this.device) return false;
      try { await this.sdk.displayGraphicData(hex, this.device, DisplayMode.GraphicMode); return true; }
      catch {
        try { if (await this.ensure(true)) { await this.sdk.displayGraphicData(hex, this.device, DisplayMode.GraphicMode); return true; } }
        catch { /* noop */ }
        return false;
      }
    } finally { this.busy = false; }
  }

  /** 하단 20셀 점자 텍스트 라인 — 장·절 등 상태 표시(있는 기기에서만, 실패 무시) */
  async outputTextLine(hex: string): Promise<boolean> {
    try {
      if (!(this.sdk && this.device && this.gattOk())) return false;
      await this.sdk.displayTextData(hex, this.device, DisplayMode.TextMode);
      return true;
    } catch { return false; }
  }
}

export const DP = new DotPadManager();
export { DotPadScanner, KeyCodes };
