import type { IArgsMeta, IInletsMeta, IOutletsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import { Bang, isBang } from "../sdk";
import MidiObject from "./Base";

interface IS {
    midiAccess: WebMidi.MIDIAccess;
    search: string;
    port: WebMidi.MIDIInput;
}

export default class midiIn extends MidiObject<{}, {}, [string | Bang], [Uint8Array, WebMidi.MIDIInput], [string]> {
    static description = "Get MIDI input from device name or ID";
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "anything",
        description: "string to fetch device name or ID, bang to output MIDI port instance"
    }];
    static outlets: IOutletsMeta = [{
        type: "object",
        description: "MIDI message: Uint8Array"
    }, {
        type: "object",
        description: "Instance: MIDIPort"
    }];
    static args: IArgsMeta = [{
        type: "string",
        optional: false,
        description: "Device name or ID"
    }];
    _: IS = { midiAccess: undefined as WebMidi.MIDIAccess, search: undefined as string, port: undefined as WebMidi.MIDIInput };
    handleDeviceChange = async () => {
        const { midiAccess } = this._;
        if (!midiAccess) {
            this.error("MIDIAccess not available.");
            return;
        }
        const devices: WebMidi.MIDIInput[] = [];
        midiAccess.inputs.forEach(v => devices.push(v));
        const enums = devices.map(d => d.name || d.id);
        const { meta } = this;
        meta.args[0] = { ...midiIn.args[0], type: "enum", enums };
        this.setMeta(meta);
    };
    handleMIDIMessage = (e: WebMidi.MIDIMessageEvent) => this.outlet(0, e.data);
    newSearch = async (search?: string) => {
        this._.search = search;
        const { midiAccess } = this._;
        if (!midiAccess) {
            this.error("MIDIAccess not available.");
            return;
        }
        const devices: WebMidi.MIDIInput[] = [];
        midiAccess.inputs.forEach(v => devices.push(v));
        for (let i = 0; i < devices.length; i++) {
            const port = devices[i];
            if (!search || port.id === search || port.name === search) {
                if (port !== this._.port) {
                    if (this._.port) this._.port.removeEventListener("midimessage", this.handleMIDIMessage);
                    this._.port = port;
                    port.addEventListener("midimessage", this.handleMIDIMessage);
                    break;
                }
            }
        }
    };
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 1;
            this.outlets = 2;
        });
        this.on("postInit", async () => {
            const search = this.args[0];
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
                    await this.newSearch(data);
                }
                if (this._.port) this.outlet(1, this._.port);
            }
        });
        this.on("destroy", () => {
            if (this._.midiAccess) this._.midiAccess.removeEventListener("statechange", this.handleDeviceChange);
            if (this._.port) this._.port.removeEventListener("midimessage", this.handleMIDIMessage);
        });
    }
}
