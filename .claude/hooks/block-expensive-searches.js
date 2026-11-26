// PreToolUse hook: bloquea comandos Bash costosos en tokens y exige Repomix.
// Lee el JSON del hook por stdin; salir con código 2 bloquea la llamada.
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0);
  }

  const patterns = [
    /\bgrep\s+-r/, // grep -r
    /\bfind\s+\./, // find .
    /(^|[\s;&|(])cat(\s|$)/, // cat como comando (no "concat", no "ls-tree")
    /(^|[\s;&|(])tree(\s|$)/, // tree como comando (no "git ls-tree")
  ];

  if (patterns.some((re) => re.test(command))) {
    process.stderr.write(
      "ACCION RECHAZADA: Usa `npx repomix` para entender la estructura o lecturas acotadas con `head`/`tail`.\n"
    );
    process.exit(2);
  }
  process.exit(0);
});
