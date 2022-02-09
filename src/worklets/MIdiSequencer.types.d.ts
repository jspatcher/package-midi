import type { MidiData } from "./MidiParser";

export type Parameters = "playing" | "loop" | "replaceOnEnd";
export type MsgIn = { type: "midiJson"; data: MidiData } | { type: "goto"; data: number };
export type MsgOut = { type: "timeOffset"; data: number } | { type: "midiMessage", data: { bytes: Uint8Array; time: number } };
