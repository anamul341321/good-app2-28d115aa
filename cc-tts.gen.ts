import { speakBengali } from "./src/lib/tts-free.server";
import { CALL_CENTER_SCRIPTS } from "./src/lib/callcenter-scripts";
import { writeFileSync } from "fs";

const agent = CALL_CENTER_SCRIPTS.find(s => s.key === "agent")!;
const wav = await speakBengali(agent.text);
if (!wav) { console.error("TTS failed"); process.exit(1); }
writeFileSync("/tmp/cc-tts/agent.wav", Buffer.from(wav));
console.log("wav bytes:", wav.byteLength);
