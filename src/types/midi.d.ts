declare module "midi" {
    class Input {
        getPortCount(): number;
        getPortName(port: number): string;
        openPort(port: number): void;
        openVirtualPort(name: string): void;
        closePort(): void;
        on(event: "message", callback: (deltaTime: number, message: number[]) => void): void;
    }

    class Output {
        getPortCount(): number;
        getPortName(port: number): string;
        openPort(port: number): void;
        openVirtualPort(name: string): void;
        closePort(): void;
        sendMessage(message: number[]): void;
    }

    const _default: { Input: typeof Input; Output: typeof Output };
    export default _default;
}
