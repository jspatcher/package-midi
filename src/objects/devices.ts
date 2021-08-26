import type { IArgsMeta, IInletsMeta, IOutletsMeta, IPropsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import type { StrictDropdownItemProps } from "semantic-ui-react";
import { Bang, isBang } from "../sdk";
import MidiObject from "./Base";

interface IS {
    midiAccess: WebMidi.MIDIAccess;
}
interface P {
    autoUpdate: boolean;
}

export default class midiDevices extends MidiObject<{}, {}, [Bang | WebMidi.MIDIPortType[]], [WebMidi.MIDIPort[], StrictDropdownItemProps[]], WebMidi.MIDIPortType[], P> {
    static description = "Enumerate MIDI devices";
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "object",
        description: "Bang to enumerate, MIDIPortType[] to use a filter"
    }];
    static outlets: IOutletsMeta = [{
        type: "object",
        description: "Array of MIDIPort"
    }, {
        type: "object",
        description: "Array of DropdownItemProps"
    }];
    static args: IArgsMeta = [{
        type: "enum",
        varLength: true,
        optional: true,
        enums: ["input", "output"],
        default: ["input", "output"],
        description: "Output only kinds of devices"
    }];
    static props: IPropsMeta<P> = {
        autoUpdate: {
            type: "boolean",
            default: true,
            description: "Auto output devices when devices change"
        }
    };
    _ = { midiAccess: undefined as WebMidi.MIDIAccess };
    handleDeviceChange = async () => {
        if (!this.getProp("autoUpdate")) return;
        const filters = this.args.slice();
        if (!filters.length) filters.push("input", "output");
        const { midiAccess } = this._;
        if (!midiAccess) {
            this.error("MIDIAccess not available.");
            return;
        }
        const devices: WebMidi.MIDIPort[] = [];
        if (filters.indexOf("input") !== -1) midiAccess.inputs.forEach(v => devices.push(v));
        if (filters.indexOf("output") !== -1) midiAccess.outputs.forEach(v => devices.push(v));
        const options = devices.map((d, key) => {
            const { type, name, id } = d;
            return { key, icon: { input: "sign-in", output: "sign-out" }[type], text: name || id, value: id };
        });
        this.outletAll([devices, options]);
    };
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 1;
            this.outlets = 2;
        });
        this.on("postInit", async () => {
            try {
                const midiAccess = await navigator.requestMIDIAccess({ sysex: true });
                this._.midiAccess = midiAccess;
                midiAccess.addEventListener("statechange", this.handleDeviceChange);
                if (this.getProp("autoUpdate")) this.handleDeviceChange();
            } catch (e) {
                this.error(e);
            }
        });
        this.on("inlet", async ({ data, inlet }) => {
            if (inlet === 0) {
                let filters: WebMidi.MIDIPortType[];
                if (isBang(data)) {
                    filters = this.args.slice();
                    if (!filters.length) filters.push("input", "output");
                } else {
                    filters = data.slice();
                }
                const { midiAccess } = this._;
                if (!midiAccess) {
                    this.error("MIDIAccess not available.");
                    return;
                }
                const devices: WebMidi.MIDIPort[] = [];
                if (filters.indexOf("input") !== -1) midiAccess.inputs.forEach(v => devices.push(v));
                if (filters.indexOf("output") !== -1) midiAccess.outputs.forEach(v => devices.push(v));
                const options = devices.map((d, key) => {
                    const { type, name, id } = d;
                    return { key, icon: { input: "sign-in", output: "sign-out" }[type], text: name || id, value: id };
                });
                this.outletAll([devices, options]);
            }
        });
        this.on("destroy", () => {
            if (this._.midiAccess) this._.midiAccess.removeEventListener("statechange", this.handleDeviceChange);
        });
    }
}
