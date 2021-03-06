import type { IArgsMeta, IInletsMeta, IOutletsMeta, IPropsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import { Bang } from "../sdk";
import MidiSequencerNode from "../worklets/MidiSequencerNode";
import MidiObject from "./Base";

interface IS {
    node: MidiSequencerNode;
}
interface P {
    loop: boolean;
    replaceOnEnd: boolean;
}

export default class midiSequencer extends MidiObject<{}, IS, [ArrayBuffer | Uint8Array | { goto: number } | boolean | number], [Uint8Array, Bang], [], P> {
    static description = "MIDI File Player";
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "anything",
        description: "ArrayBuffer as MIDI File, { goto: number } to jump, boolean/number to switch play/stop"
    }];
    static outlets: IOutletsMeta = [{
        type: "object",
        description: "realtime MIDI event"
    }, {
        type: "bang",
        description: "Bang on End"
    }];
    static args: IArgsMeta = [];
    static props: IPropsMeta<P> = {
        loop: {
            type: "boolean",
            description: "Loop",
            default: false
        },
        replaceOnEnd: {
            type: "boolean",
            description: "Replace MIDI file when current playing file ends",
            default: false
        }
    };
    _: IS = { node: null };
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 1;
            this.outlets = 2;
        });
        this.on("postInit", async () => {
            await MidiSequencerNode.register(this.audioCtx);
            const node = new MidiSequencerNode(this.audioCtx);
            node.parameters.get("loop").value = +!!this.getProp("loop");
            node.parameters.get("replaceOnEnd").value = +!!this.getProp("replaceOnEnd");
            node.onMidi = bytes => this.outlet(0, bytes);
            node.onEnd = () => this.outlet(1, new Bang());
            this._.node = node;
        });
        this.on("updateProps", () => {
            this._.node.parameters.get("loop").value = +!!this.getProp("loop");
            this._.node.parameters.get("replaceOnEnd").value = +!!this.getProp("replaceOnEnd");
        });
        this.on("inlet", async ({ data, inlet }) => {
            if (inlet === 0) {
                if (typeof data === "number" || typeof data === "boolean") {
                    this._.node.parameters.get("playing").value = +!!data;
                } else if (data instanceof ArrayBuffer) {
                    this._.node.loadFile(data);
                } else if (data instanceof Uint8Array) {
                    this._.node.loadFile(data.buffer);
                } else if (typeof data === "object") {
                    if (typeof data.goto === "number") this._.node.goto(data.goto);
                }
            }
        });
        this.on("destroy", () => {
            this._.node.destroy();
        });
    }
}
