import type { IArgsMeta, IInletsMeta, IOutletsMeta, IPropsMeta } from "@jspatcher/jspatcher/src/core/objects/base/AbstractObject";
import { Bang, isBang } from "../sdk";
import MidiObject from "./Base";

interface IS {
    channel: number,
    velocity: number,
    duration: number,
    map: Set<number>[][];
}

interface P {
    repeatMode: "Poly" | "Re-trigger" | "Stop last";
}

export default class makeNote extends MidiObject<{}, {}, [number | "clear" | "stop", number, number], [number, number, number], [number?, number?, number?, number?], P> {
    static description = "Generate a note-on/note-off pair";
    static inlets: IInletsMeta = [{
        isHot: true,
        type: "anything",
        description: 'MIDI-note number to start a note, "clear" to cancel future note-offs, "stop" to send note-offs now.'
    }, {
        isHot: false,
        type: "number",
        description: "Velocity (0-127)"
    }, {
        isHot: false,
        type: "number",
        description: "Duration in milliseconds"
    }, {
        isHot: false,
        type: "number",
        description: "Channel (1-based)"
    }];
    static outlets: IOutletsMeta = [{
        type: "number",
        description: "Pitch (0-127)"
    }, {
        type: "number",
        description: "Velocity (0-127)"
    }, {
        type: "number",
        description: "Channel (1-based)"
    }];
    static args: IArgsMeta = [{
        type: "number",
        optional: false,
        description: "Initial velocity (0-127)",
        default: 0
    }, {
        type: "number",
        optional: false,
        description: "Initial duration in milliseconds",
        default: 0
    }, {
        type: "number",
        optional: true,
        description: "Initial channel (1-based)",
        default: 1
    }];
    static props: IPropsMeta<P> = {
        repeatMode: {
            type: "enum",
            enums: ["Poly", "Re-trigger", "Stop last"],
            description: "Re-trigger: if the note was already playing, send a note-off and retrigger the note; Stop last: send only one note-off message at the end of the last note.",
            default: "Poly"
        }
    };
    _: IS = {
        velocity: Math.min(127, Math.max(0, ~~+this.args[0])) || 0,
        duration: Math.max(0, +this.args[1]) || 0,
        channel: Math.min(16, Math.max(1, ~~+this.args[2])) || 1,
        map: new Array(16).fill(null).map(() => new Array(128).fill(null).map(() => new Set()))
    };
    subscribe() {
        super.subscribe();
        this.on("preInit", () => {
            this.inlets = 4;
            this.outlets = 3;
        });
        this.on("inlet", async ({ data, inlet }) => {
            if (inlet === 0) {
                if (typeof data === "number") {
                    if (isNaN(data)) return;
                    const note = Math.min(127, Math.max(0, ~~+data));
                    const { velocity, duration, channel, map } = this._;
                    const repeatMode = this.getProp("repeatMode");
                    const set = map[channel - 1][note];
                    const ref = window.setTimeout(() => {
                        set.delete(ref);
                        this.outletAll([note, 0, channel]);
                    }, duration);
                    if (set.size) {
                        if (repeatMode === "Re-trigger") {
                            set.forEach((ref) => {
                                window.clearTimeout(ref);
                                this.outletAll([note, 0, channel]);
                            });
                            set.clear();
                        } else if (repeatMode === "Stop last") {
                            set.forEach((ref) => {
                                window.clearTimeout(ref);
                            });
                            set.clear();
                        }
                    }
                    set.add(ref);
                    this.outletAll([note, velocity, channel]);
                } else if (data === "clear") {
                    this._.map.forEach((noteMap) => {
                        noteMap.forEach((set) => {
                            set.forEach(ref => window.clearTimeout(ref));
                            set.clear();
                        })
                    });
                } else if (data === "stop") {
                    const repeatMode = this.getProp("repeatMode");
                    this._.map.forEach((noteMap, channel) => {
                        noteMap.forEach((set, note) => {
                            set.forEach(ref => window.clearTimeout(ref));
                            if (repeatMode === "Stop last") this.outletAll([note, 0, channel]);
                            else set.forEach(() => this.outletAll([note, 0, channel]));
                            set.clear();
                        })
                    });
                }
            } else if (inlet === 1) {
                this._.velocity = Math.min(127, Math.max(0, ~~+data)) || 0;
            } else if (inlet === 2) {
                this._.duration = Math.max(0, +data) || 0;
            } else if (inlet === 3) {
                this._.channel = Math.min(16, Math.max(1, ~~+data)) || 1;
            }
        });
        this.on("destroy", () => {
            this._.map.forEach((channel) => {
                channel.forEach((note) => {
                    note.forEach(ref => window.clearTimeout(ref));
                    note.clear();
                })
            });
        });
    }
}
