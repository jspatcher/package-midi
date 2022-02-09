import midiDevices from "./objects/devices";
import midiFormat from "./objects/midiFormat";
import midiIn from "./objects/midiIn";
import midiOut from "./objects/midiOut";
import midiParse from "./objects/midiParse";
import midiSequencer from "./objects/midiSequencer";
import makeNote from "./objects/makeNote";

export default async () => {
    return {
        midiDevices,
        midiIn,
        midiin: midiIn,
        midiOut,
        midiout: midiOut,
        midiFormat,
        midiformat: midiFormat,
        midiParse,
        midiparse: midiParse,
        midiSequencer,
        midisequencer: midiSequencer,
        makenote: makeNote,
        makeNote
    };
};