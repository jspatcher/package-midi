import type { IInletsMeta, IOutletsMeta, IPropsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import MidiObject from "./Base";

type I = [Iterable<number>];

type O = [[number, number], [number, number], [number, number], number, number, number, number];

interface P {
    hires: "off" | "float" | "14bit";
}

export default class midiParse extends MidiObject<{}, {}, I, O, [string], P> {
    static description = "Interpret raw MIDI data";
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "anything",
        description: "Raw MIDI message: Iterable<number>"
    }];
    static outlets: IOutletsMeta = [{
        type: "object",
        description: "Note-on and Note-off [pitch, velocity]: Uint8Array"
    }, {
        type: "object",
        description: "Poly Key Pressure [key, value]: Uint8Array"
    }, {
        type: "object",
        description: "Control Change [controller, value]: Uint8Array"
    }, {
        type: "number",
        description: "Program Change"
    }, {
        type: "number",
        description: "Aftertouch"
    }, {
        type: "number",
        description: "Pitch Bend"
    }, {
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
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 1;
            this.outlets = 7;
        })
        this.on("inlet", ({ data, inlet }) => {
            if (inlet === 0) {
                try {
                    const [data0, data1, data2] = data;
                    const eventType = data0 >> 4;
                    const channel = data0 & 0x0f + 1;
                    if (eventType === 0x08) {
                        this.outlet(0, [data1, 0]);
                    } else if (eventType === 0x09) {
                        this.outlet(6, channel);
                        this.outlet(0, [data1, data2]);
                    } else if (eventType === 0x0a) {
                        this.outlet(6, channel);
                        this.outlet(1, [data1, data2]);
                    } else if (eventType === 0x0b) {
                        this.outlet(6, channel);
                        this.outlet(2, [data1, data2]);
                    } else if (eventType === 0x0c) {
                        this.outlet(6, channel);
                        this.outlet(3, data1);
                    } else if (eventType === 0x0d) {
                        this.outlet(6, channel);
                        this.outlet(4, data1);
                    } else if (eventType === 0x0e) {
                        this.outlet(6, channel);
                        const hires = this.getProp("hires");
                        if (hires === "off") this.outlet(5, data2);
                        else if (hires === "float") this.outlet(5, (data1 + (data2 << 7)) / 16383 * 2 - 1)
                        else this.outlet(5, -8192 + data1 + (data2 << 7));
                    } else {
                        this.error(`Unrecognised MIDI event type: ${eventType}`)
                    }
                } catch (e) {
                    this.error(e);
                }
            }
        })
    }
}
