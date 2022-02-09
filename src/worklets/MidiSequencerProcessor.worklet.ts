import type { AudioWorkletGlobalScope, TypedAudioParamDescriptor, TypedMessageEvent } from "@jspatcher/jspatcher/src/core/worklets/TypedAudioWorklet";
import type { MidiChannelEvent, MidiData } from "./MidiParser";
import type { MsgIn, MsgOut, Parameters } from "./MIdiSequencer.types";

export const processorId = "__JSPatcher_package-midi_MidiSequencer";

const audioWorkletGlobalScope = globalThis as unknown as AudioWorkletGlobalScope;
const { registerProcessor, sampleRate } = audioWorkletGlobalScope;
const AudioWorkletProcessor = audioWorkletGlobalScope.AudioWorkletProcessor;

class MidiSequencerProcessor extends AudioWorkletProcessor<MsgIn, MsgOut, Parameters> {
    static get parameterDescriptors(): TypedAudioParamDescriptor<Parameters>[] {
        return [{
            name: "playing",
            minValue: 0,
            maxValue: 1,
            defaultValue: 0
        }, {
            name: "loop",
            minValue: 0,
            maxValue: 1,
            defaultValue: 0
        }, {
            name: "replaceOnEnd",
            minValue: 0,
            maxValue: 1,
            defaultValue: 0
        }];
    }
    playing = false;
    loop = false;
    replaceOnEnd = false;
    toReplaceOnEnd: MidiData = null;
    data: MidiData = null;
    orderedEvents: { data: Uint8Array; time: number }[] = [];
    $event = 0;
    timeOffset = 0;
    totalDuration = 0;
    handleMessage: (e: TypedMessageEvent<MsgIn>) => any;
    constructor(options: AudioWorkletNodeOptions) {
        super(options);
        this.handleMessage = (e) => {
            if (e.data.type === "midiJson") {
                this.setData(e.data.data);
            } else if (e.data.type === "goto") {
                this.goto(e.data.data);
            }
        };
        this.port.onmessage = this.handleMessage;
    }
    _setData(data: MidiData) {
        this.sendFlush();
        this.data = data;
        this.orderedEvents = [];
        this.$event = 0;
        this.timeOffset = 0;
        this.totalDuration = data.duration;
        data.tracks.forEach((track) => {
            track.forEach((event: MidiChannelEvent<any>) => {
                if (event.bytes) {
                    this.orderedEvents.push({ time: event.time, data: event.bytes });
                }
            })
        });
        this.orderedEvents.sort((a, b) => a.time - b.time);
    }
    setData(data: MidiData) {
        if (this.replaceOnEnd) {
            this.toReplaceOnEnd = data;
        } else {
            this._setData(data);
        }
    }
    goto(time: number) {
        this.sendFlush();
        let $ = 0;
        this.timeOffset = Math.min(time, this.totalDuration);
        for (let i = 0; i < this.orderedEvents.length; i++) {
            const event = this.orderedEvents[i];
            if (event.time < this.timeOffset) $ = i;
            else break;
        }
        this.$event = $;
    }
    onMidi(data: Uint8Array, time: number) {
        this.port.postMessage({ type: "midiMessage", data: { bytes: data, time } })
    }
    sendFlush() {
        const { currentTime } = audioWorkletGlobalScope;
        this.onMidi(new Uint8Array([176, 121, 0]), currentTime); // All Controllers Reset
        this.onMidi(new Uint8Array([176, 123, 0]), currentTime); // All Notes Off
    }
    advance(offset: number, playing: boolean, loop: boolean, fromTime: number) {
        if (!playing) return;
        if (this.timeOffset >= this.totalDuration) {
            if (this.toReplaceOnEnd && this.replaceOnEnd) {
                this._setData(this.toReplaceOnEnd);
                this.toReplaceOnEnd = null;
            }
            if (loop) {
                this.timeOffset = 0;
                this.$event = 0;
            } else return;
        }
        if (!this.orderedEvents.length) return;
        let advanced = 0;
        while (advanced < offset) {
            let $ = this.$event + 1;
            let nextEventDeltaTime = 0;
            let nextEvent = null;
            const timeOffset = this.timeOffset + advanced;
            if ($ >= this.orderedEvents.length) {
                nextEventDeltaTime += this.totalDuration - timeOffset;
                if (loop) {
                    $ = 0;
                    nextEvent = this.orderedEvents[$];
                    const { time } = nextEvent;
                    this.timeOffset -= this.totalDuration;
                    nextEventDeltaTime += time;
                }
            } else {
                nextEvent = this.orderedEvents[$];
                const { time } = nextEvent;
                nextEventDeltaTime += time - timeOffset;
            }
            if (advanced + nextEventDeltaTime < offset) {
                if (nextEvent) {
                    const { data } = nextEvent;
                    this.onMidi(data, fromTime + advanced);
                } else break;
                this.$event = $;
            }
            advanced += nextEventDeltaTime;
        }
        this.timeOffset += offset;
        if (loop) {
            this.timeOffset %= this.totalDuration;
        } else if (this.timeOffset > this.totalDuration) {
            this.timeOffset = this.totalDuration;
        }
    }
    updateTime() {
        this.port.postMessage({ type: "timeOffset", data: this.timeOffset });
    }
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<Parameters, Float32Array>) {
        const bufferSize = outputs[0][0].length;
        const advanceTime = 1 / sampleRate;
        const { currentTime } = audioWorkletGlobalScope;
        for (let i = 0; i < bufferSize; i++) {
            const fromTime = currentTime * advanceTime * i;
            const playing = !!(i < parameters.playing.length ? parameters.playing[i] : parameters.playing[0]);
            if (playing !== this.playing && !playing) this.onMidi(new Uint8Array([176, 123, 0]), fromTime); // All Notes Off
            this.playing = playing;
            const loop = !!(i < parameters.loop.length ? parameters.loop[i] : parameters.loop[0]);
            this.loop = loop;
            const replaceOnEnd = !!(i < parameters.replaceOnEnd.length ? parameters.replaceOnEnd[i] : parameters.replaceOnEnd[0]);
            if (replaceOnEnd !== this.replaceOnEnd && !replaceOnEnd) this.toReplaceOnEnd = null;
            this.replaceOnEnd = replaceOnEnd;
            this.advance(advanceTime, this.playing, this.loop, fromTime);
        }
        this.updateTime();
        return true;
    }
}
try {
    registerProcessor(processorId, MidiSequencerProcessor)
} catch (error) {
    console.warn(error);
}
