import type { IInletsMeta, IOutletsMeta, IPropsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import MidiObject from "./Base";

interface IS {
    channel: number;
}

type I = [Iterable<number>, Iterable<number>, Iterable<number>, number, number, number, number];

type O = [Uint8Array];

interface P {
    hires: "off" | "float" | "14bit";
}

export default class midiFormat extends MidiObject<{}, {}, I, O, [string], P> {
    static description = "Prepare data in the form of a MIDI message";
    static outlets: IOutletsMeta = [{
        type: "object",
        description: "Raw MIDI message: Uint8Array"
    }];
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "object",
        description: "Note-on and Note-off [pitch, velocity]: Iterable<number>"
    }, {
        isHot: true,
        type: "object",
        description: "Poly Key Pressure [key, value]: Iterable<number>"
    }, {
        isHot: true,
        type: "object",
        description: "Control Change [controller, value]: Iterable<number>"
    }, {
        isHot: true,
        type: "number",
        description: "Program Change"
    }, {
        isHot: true,
        type: "number",
        description: "Aftertouch"
    }, {
        isHot: true,
        type: "number",
        description: "Pitch Bend"
    }, {
        isHot: false,
        type: "number",
        description: "MIDI Channel"
    }];
    static props: IPropsMeta<P> = {
        hires: {
            type: "enum",
            enums: ["off", "float", "14bit"],
            default: "off",
            description: "High-resolution Pitch Bend (Off (0-127), Float (-1 to 1), 14-bit Fixed (-8192 to 8191))"
        }
    };
    _: IS = { channel: 0 };
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 7;
            this.outlets = 1;
        })
        this.on("inlet", ({ data, inlet }) => {
            if (inlet < 3) {
                try {
                    let [data1, data2] = data as Iterable<number>;
                    if (typeof data1 !== "number" || typeof data2 !== "number") {
                        throw new Error("Input MIDI data is not numbers");
                    }
                    data1 = Math.round(Math.max(0, Math.min(127, data1)));
                    data2 = Math.round(Math.max(0, Math.min(127, data2)));
                    if (inlet === 0) {
                        this.outlet(0, new Uint8Array([0x90 + this._.channel, data1, data2]));
                    } else if (inlet === 1) {
                        this.outlet(0, new Uint8Array([0xa0 + this._.channel, data1, data2]));
                    } else if (inlet === 2) {
                        this.outlet(0, new Uint8Array([0xb0 + this._.channel, data1, data2]));
                    }
                } catch (e) {
                    this.error(e);
                }
            } else if (inlet >= 3) {
                if (typeof data !== "number") {
                    this.error("Input MIDI data is not number");
                    return;
                }
                const data1 = Math.round(Math.max(0, Math.min(127, data))); 
                if (inlet === 3) {
                    this.outlet(0, new Uint8Array([0xc0 + this._.channel, data1]));
                } else if (inlet === 4) {
                    this.outlet(0, new Uint8Array([0xd0 + this._.channel, data1]));
                } else if (inlet === 5) {
                    const hires = this.getProp("hires");
                    if (hires === "off") {
                        this.outlet(0, new Uint8Array([0xe0 + this._.channel, 0, data1]));
                    } else if (hires === "float") {
                        const data = ~~((Math.max(-1, Math.min(1, data1)) + 1) * 0.5 * 16383);
                        this.outlet(0, new Uint8Array([0xe0 + this._.channel, data & 0x7f, data >> 7]));
                    } else {
                        const data = ~~Math.max(-8192, Math.min(8191, data1)) + 8192;
                        this.outlet(0, new Uint8Array([0xe0 + this._.channel, data & 0x7f, data >> 7]));
                    }
                } else if (inlet === 6) {
                    this._.channel = Math.min(15, data1 - 1);
                }
            }
        })
    }
}
