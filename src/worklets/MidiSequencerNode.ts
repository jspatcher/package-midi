import processorUrl from "./MidiSequencerProcessor.worklet.ts";
import type { MsgIn as MsgOut, MsgOut as MsgIn, Parameters } from "./MidiSequencer.types";
import type { TypedAudioWorkletNode } from "@jspatcher/jspatcher/src/core/worklets/TypedAudioWorklet";
import parseMidi from "./MidiParser";

export const processorId = "__JSPatcher_package-midi_MidiSequencer";

export const AudioWorkletNode = globalThis.AudioWorkletNode as typeof TypedAudioWorkletNode;

export default class MidiSequencerNode extends AudioWorkletNode<MsgIn, MsgOut, Parameters> {
    static register(context: BaseAudioContext) {
        return context.audioWorklet.addModule(processorUrl);
    }
    handleMessage: (e: MessageEvent<MsgIn>) => void;
    onMidi: (bytes: Uint8Array, time: number) => any;
    onEnd: () => any;
    timeOffset: number;
    totalDuration: number;
    constructor(context: BaseAudioContext) {
        super(context, processorId, { numberOfInputs: 0, numberOfOutputs: 1 });
        this.timeOffset = 0;
        this.totalDuration = 0;
        this.handleMessage = (e: MessageEvent<MsgIn>) => {
            if (e.data.type === "midiMessage") {
                this.onMidi?.(e.data.data.bytes, e.data.data.time);
            } else if (e.data.type === "timeOffset") {
                this.timeOffset = e.data.data;
            } else if (e.data.type === "end") {
                this.onEnd?.();
            }
        };
        this.port.onmessage = this.handleMessage;
    }
    loadFile(file: ArrayBuffer) {
        const data = parseMidi(file);
        this.totalDuration = data.duration;
        this.port.postMessage({ type: "midiJson", data });
    }
    goto(time: number) {
        this.port.postMessage({ type: "goto", data: time });
    }
    sendFlush() {
        this.onMidi?.(new Uint8Array([176, 121, 0]), this.context.currentTime); // All Controllers Reset
        this.onMidi?.(new Uint8Array([176, 123, 0]), this.context.currentTime); // All Notes Off
    }
	destroy() {
        this.sendFlush();
	}
}
