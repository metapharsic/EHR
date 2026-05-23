const fs = require("fs");
const lines = fs.readFileSync("prisma/schema.prisma", "utf8").split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith("model User ")) console.log("User line " + i);
  if (lines[i].startsWith("model Patient ")) console.log("Patient line " + i);
  if (lines[i].startsWith("model VoiceCommandSession ")) console.log("Voice line " + i);
}
