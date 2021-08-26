import type { IArgsMeta, IInletsMeta, IOutletsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import { Bang, isBang } from "../sdk";
import MidiObject from "./Base";

interface IS {
    midiAccess: WebMidi.MIDIAccess;
    search: string;
    port: WebMidi.MIDIOutput;
    timestamp: number;
}

export default class midiOut extends MidiObject<{}, IS, [Uint8Array | number[] | string | Bang, number], [WebMidi.MIDIOutput], [string]> {
    static description = "Get MIDI output from device name or ID";
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "anything",
        description: "Uint8Array or number[] to output MIDI message, string to fetch device name or ID, bang to output MIDI port instance"
    }, {
        isHot: false,
        type: "number",
        description: "The time at which to begin sending the data to the port. 0 or past means immediate send."
    }];
    static outlets: IOutletsMeta = [{
        type: "object",
        description: "Instance: MIDIPort"
    }];
    static args: IArgsMeta = [{
        type: "string",
        optional: false,
        description: "Device name or ID"
    }];
    _: IS = { midiAccess: undefined as WebMidi.MIDIAccess, search: undefined as string, port: undefined as WebMidi.MIDIOutput, timestamp: 0 };
    handleDeviceChange = async () => {
        const { midiAccess } = this._;
        if (!midiAccess) {
            this.error("MIDIAccess not available.");
            return;
        }
        const devices: WebMidi.MIDIOutput[] = [];
        midiAccess.outputs.forEach(v => devices.push(v));
        const enums = devices.map(d => d.name || d.id);
        const { meta } = this;
        meta.args[0] = { ...midiOut.args[0], type: "enum", enums };
        this.setMeta(meta);
    };
    newSearch = async (search?: string) => {
        this._.search = search;
        const { midiAccess } = this._;
        if (!midiAccess) {
            this.error("MIDIAccess not available.");
            return;
        }
        const devices: WebMidi.MIDIOutput[] = [];
        midiAccess.outputs.forEach(v => devices.push(v));
        for (let i = 0; i < devices.length; i++) {
            const port = devices[i];
            if (!search || port.id === search || port.name === search) {
                this._.port = port;
                break;
            }
        }
    };
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 1;
            this.outlets = 1;
        });
        this.on("postInit", async () => {
            const search = this.box.args[0];
            try {
                const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
                this._.midiAccess = midiAccess;
                midiAccess.addEventListener("statechange", this.handleDeviceChange);
                this.handleDeviceChange();
                this.newSearch(search);
            } catch (e) {
                this.error(e);
            }
        });
        this.on("updateArgs", (args: [string?]) => {
            this.newSearch(args[0]);
        });
        this.on("updateProps", () => {
            this.newSearch(this._.search);
        });
        this.on("inlet", async ({ data, inlet }) => {
            if (inlet === 0) {
                if (!isBang(data)) {
                    if (typeof data === "string") {
                        await this.newSearch(data);
                    } else {
                        if (this._.port) this._.port.send(data as Uint8Array | number[]);
                        return;
                    }
                }
                if (this._.port) this.outlet(0, this._.port);
            } else if (inlet === 1) {
                this._.timestamp = +data || 0 as number;
            }
        });
        this.on("destroy", () => {
            if (this._.midiAccess) this._.midiAccess.removeEventListener("statechange", this.handleDeviceChange);
        });
    }
}
